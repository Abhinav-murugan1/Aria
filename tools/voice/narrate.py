"""aria voice: turn a narration script into expressive speech, word-timed captions and one narration track.

    python narrate.py SCRIPT.json OUT_DIR [--voice VOICE.wav] [--only 3,5] [--tries 8] [--cpu]

SCRIPT.json:
    {
      "voice": "aria-heart",                        # optional: a preset name (voices/NAME.wav) or a WAV path to clone
      "lead": 0.25,                                 # optional: silence before the first line, seconds
      "lines": [
        {"say": "[happy] This is aria!", "caption": "This is aria!", "pause": 0.35},
        {"say": "[whispering] And it whispers too.", "pause": 0.5, "gain": -1, "seed": 4},
        {"say": "[dramatic] A second voice.", "voice": "aria-adam"}   # optional per-line voice (preset or WAV)
      ]
    }

Each line is one take, spoken by Chatterbox Turbo. Emotion and sound tags go at the START of a sentence:
    emotions: [happy] [dramatic] [whispering] [fear] [surprised] [sarcastic] [angry] [crying]
    sounds:   [chuckle] [laugh] [sigh] [gasp] [sniff] [cough]
"say" is what is spoken (spell numbers out: "twenty twenty-six"); "caption" is what is shown (defaults to "say"
without its tags). Every take is checked by speech recognition (faster-whisper); a take that drops, adds or
garbles a word, or stalls, is spoken again with a new seed, up to --tries times.

Writes OUT_DIR/line01.wav ..., OUT_DIR/narration.wav (all lines with their pauses, 24 kHz mono) and
OUT_DIR/captions.json:
    {"seconds": 31.4, "lines": [{"file": "line01.wav", "start": 0.25, "end": 2.1, "text": "...", "ok": true,
                                 "tries": [{"heard": "...", "ok": true}],
                                 "words": [{"w": "This", "s": 0.25, "e": 0.41}, ...]}]}
"tries" is the hearing-check log: every take spoken for that line, in order, with what recognition heard.
All times are seconds on the narration track, so a composition can cue on them directly.
"""
import argparse
import difflib
import json
import logging
import os
import re
import sys

import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
TAG = re.compile(r"\s*\[[a-z ]+\]\s*")
FILLER = {"ha", "haha", "hahaha", "heh", "hm", "hmm", "oh", "ah", "uh", "um", "huh", "mm", "laughs", "sighs", "gasps", "chuckles", "wow"}
NUMS = {"one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "twenty", "thirty", "forty",
        "fifty", "hundred", "thousand", "percent", "a", "m", "am"}


def norm(s):
    s = re.sub(r"\[[a-z ]+\]|\([^)]*\)", " ", s.lower())
    s = re.sub(r"\$(\d+)", r"\1 dollars", s.replace("*", "").replace("%", " percent"))
    return re.sub(r"[^a-z0-9 ]", "", re.sub(r"[-—/]", " ", s)).split()


def _content(words, filler=frozenset()):
    # numbers and spelled letters are skipped on both sides: "three D" may be heard as "3D", "twenty" as "20"
    return [x for x in words if x not in NUMS and x not in filler and len(x) > 1 and not re.search(r"\d", x)]


def heard_score(want, got):
    """(ok, score). ok: every wanted word heard (one slip allowed in long lines), nothing extra but filler sounds."""
    w = _content(norm(want))
    filler = FILLER - set(w)  # a filler word the script itself says ("it even laughs") must still be heard
    g = _content(norm(got), filler)
    sm = difflib.SequenceMatcher(a=w, b=g, autojunk=False)
    hits = sum(b.size for b in sm.get_matching_blocks())
    ok = hits >= len(w) - (1 if len(w) >= 14 else 0) and len(g) <= len(w)
    return ok, hits - max(0, len(g) - len(w))


def syllables(word):
    w = re.sub(r"[^a-z]", "", word.lower())
    if not w:
        return 1.5
    n = len(re.findall(r"[aeiouy]+", w))
    if w.endswith("e") and n > 1 and not w.endswith("le"):
        n -= 1
    return max(1, n)


def align(cap_words, asr_words, dur):
    """Caption word times from recognised word stamps; words recognition missed share the gap by syllables."""
    ck = ["".join(norm(w)) for w in cap_words]
    ak = ["".join(norm(w.word)) for w in asr_words]
    times = [None] * len(cap_words)
    for blk in difflib.SequenceMatcher(a=ck, b=ak, autojunk=False).get_matching_blocks():
        for n in range(blk.size):
            aw = asr_words[blk.b + n]
            times[blk.a + n] = [max(0.0, aw.start), min(dur, aw.end)]
    i = 0
    while i < len(cap_words):
        if times[i] is not None:
            i += 1
            continue
        j = i
        while j < len(cap_words) and times[j] is None:
            j += 1
        t0 = times[i - 1][1] if i > 0 else (asr_words[0].start if asr_words else 0.0)
        t1 = times[j][0] if j < len(cap_words) else dur
        if t1 <= t0:
            t1 = t0 + 0.25 * (j - i)
        wts = [syllables(w) + 0.35 for w in cap_words[i:j]]
        t = t0
        for n, wt in enumerate(wts):
            d = (t1 - t0) * wt / sum(wts)
            times[i + n] = [t, t + d]
            t += d
        i = j
    for n in range(1, len(times)):
        times[n][0] = max(times[n][0], times[n - 1][1])
        times[n][1] = max(times[n][1], times[n][0] + 0.05)
    return times


def trim(a, rate, floor=0.006):
    loud = np.where(np.abs(a) > floor)[0]
    if len(loud) == 0:
        return a
    pad = int(0.03 * rate)
    return a[max(0, loud[0] - pad): loud[-1] + pad]


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("script")
    ap.add_argument("out")
    ap.add_argument("--voice", help="voice sample to clone (overrides the script's)")
    ap.add_argument("--only", help="re-speak only these line numbers (1-based, comma separated); others are reused")
    ap.add_argument("--tries", type=int, default=8)
    ap.add_argument("--cpu", action="store_true", help="run without CUDA (slow)")
    ap.add_argument("--asr-cpu", action="store_true", help="speech recognition on CPU (frees ~1 GB VRAM on small GPUs)")
    args = ap.parse_args()

    script = json.load(open(args.script, encoding="utf-8"))
    base = os.path.dirname(os.path.abspath(args.script))

    def resolve(v):
        if not v:
            return None
        preset = os.path.join(os.path.dirname(os.path.dirname(HERE)), "voices", v + ".wav")
        if os.path.exists(preset):  # a preset name: "aria-heart", "aria-adam"
            return preset
        return v if os.path.isabs(v) else os.path.join(base, v)

    voice = resolve(args.voice or script.get("voice"))
    os.makedirs(args.out, exist_ok=True)
    only = {int(x) for x in args.only.split(",")} if args.only else None

    logging.getLogger("chatterbox").setLevel(logging.ERROR)
    import torch
    import librosa
    from chatterbox.tts_turbo import ChatterboxTurboTTS
    from faster_whisper import WhisperModel

    device = "cpu" if args.cpu or not torch.cuda.is_available() else "cuda"
    print(f"aria voice: loading Turbo + whisper on {device}", flush=True)
    tts = ChatterboxTurboTTS.from_pretrained(device=device)
    asr_dev = "cpu" if args.asr_cpu else device
    asr = WhisperModel("small.en", device=asr_dev, compute_type="float16" if asr_dev == "cuda" else "int8")
    conds = {}  # voice path -> prepared conditionals, so per-line voices switch without re-encoding

    def use_voice(v):
        if v and v not in conds:
            tts.prepare_conditionals(v)
            conds[v] = tts.conds
        if v:
            tts.conds = conds[v]

    use_voice(voice)
    rate = tts.sr

    old = {}
    cap_path = os.path.join(args.out, "captions.json")
    if only and os.path.exists(cap_path):
        old = {ln["file"]: ln for ln in json.load(open(cap_path, encoding="utf-8"))["lines"]}

    takes = []
    for n, line in enumerate(script["lines"], 1):
        name = f"line{n:02d}.wav"
        path = os.path.join(args.out, name)
        spoken = line["say"]
        caption = line.get("caption") or TAG.sub(" ", spoken).strip()
        cap_words = caption.split()
        if only and n not in only and os.path.exists(path) and name in old:
            a, _ = sf.read(path, dtype="float32")
            prev = old[name]
            rel = [[w["s"] - prev["start"], w["e"] - prev["start"]] for w in prev["words"]]
            takes.append((line, name, a, caption, cap_words, rel, prev.get("ok", True), prev.get("heard", ""),
                          prev.get("tries", [])))
            continue
        use_voice(resolve(line.get("voice")) or voice)
        plain = TAG.sub(" ", spoken).strip()
        tags = len(re.findall(r"\[[a-z ]+\]", spoken))
        best = None
        tries = []
        for s in range(args.tries):
            torch.manual_seed(int(line.get("seed", n)) * 100 + s)
            wav = tts.generate(spoken, temperature=0.8 if s < 4 else 0.7)
            a = trim(wav.squeeze(0).cpu().numpy().astype(np.float32), rate)
            segs, _ = asr.transcribe(librosa.resample(a, orig_sr=rate, target_sr=16000), language="en", beam_size=5,
                                     word_timestamps=True)
            segs = list(segs)
            heard = " ".join(x.text for x in segs).strip()
            words = [w for x in segs for w in (x.words or [])]
            not_stalled = len(a) / rate < 0.75 * len(plain.split()) + 1.0 + 0.8 * tags
            ok, score = heard_score(plain, heard)
            ok = ok and not_stalled
            score = score if not_stalled else score - 100
            tries.append({"heard": heard, "ok": bool(ok)})
            if ok or best is None or score > best[4]:  # no take passes: keep the closest one
                best = (a, heard, words, ok, score)
            if ok:
                break
            print(f"  line {n} try {s + 1}: heard {heard!r}, speaking again", flush=True)
        a, heard, words, ok, _ = best
        a = a * (10 ** (line.get("gain", 0) / 20))
        sf.write(path, a, rate)
        rel = align(cap_words, words, len(a) / rate)
        print(f"line {n:2d} {'ok ' if ok else 'BAD'} {len(a) / rate:5.2f}s  {heard}", flush=True)
        takes.append((line, name, a, caption, cap_words, rel, ok, heard, tries))

    t = float(script.get("lead", 0.25))
    track = [np.zeros(int(t * rate), dtype=np.float32)]
    out_lines = []
    for line, name, a, caption, cap_words, rel, ok, heard, tries in takes:
        dur = len(a) / rate
        out_lines.append({
            "file": name, "start": round(t, 3), "end": round(t + dur, 3), "text": caption, "ok": ok, "heard": heard, "tries": tries,
            "words": [{"w": w, "s": round(t + s, 3), "e": round(t + e, 3)} for w, (s, e) in zip(cap_words, rel)],
        })
        pause = float(line.get("pause", 0.3))
        track += [a.astype(np.float32), np.zeros(int(pause * rate), dtype=np.float32)]
        t += dur + pause
    full = np.concatenate(track)
    sf.write(os.path.join(args.out, "narration.wav"), full, rate)
    json.dump({"seconds": round(len(full) / rate, 3), "rate": rate, "lines": out_lines},
              open(cap_path, "w", encoding="utf-8"), indent=1)
    bad = [ln["file"] for ln in out_lines if not ln["ok"]]
    print(f"aria voice: {len(out_lines)} lines, {len(full) / rate:.1f}s -> {args.out}" +
          (f"  (check by ear: {', '.join(bad)})" if bad else ""))
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
