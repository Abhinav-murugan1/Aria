"""The text side of the narrator: normalising, the hearing check's scoring, syllables and caption alignment.

No GPU and no models: only narrate.py's module-level helpers are loaded (main() imports the heavy packages lazily).
"""
import importlib.util
import os
from types import SimpleNamespace

import pytest

pytest.importorskip("numpy")
pytest.importorskip("soundfile")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


@pytest.fixture(scope="module")
def narrate():
    spec = importlib.util.spec_from_file_location("aria_narrate", os.path.join(ROOT, "tools", "voice", "narrate.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_norm_strips_tags_and_punctuation(narrate):
    assert narrate.norm("[happy] Hello, World!") == ["hello", "world"]
    assert narrate.norm("[whispering] Except me...") == ["except", "me"]


def test_norm_spells_symbols_and_splits_dashes(narrate):
    assert narrate.norm("50% off") == ["50", "percent", "off"]
    assert narrate.norm("$5") == ["5", "dollars"]
    assert narrate.norm("twenty twenty-six") == ["twenty", "twenty", "six"]
    assert narrate.norm("this/that") == ["this", "that"]


def test_heard_exact_take_passes(narrate):
    ok, _ = narrate.heard_score("[dramatic] Nobody noticed the lamp go out.", "Nobody noticed the lamp go out.")
    assert ok


def test_heard_dropped_word_fails(narrate):
    ok, _ = narrate.heard_score("Nobody noticed the lamp go out.", "Nobody noticed the go out.")
    assert not ok


def test_heard_extra_word_fails(narrate):
    ok, _ = narrate.heard_score("Nobody noticed the lamp.", "Nobody really noticed the lamp.")
    assert not ok


def test_heard_filler_from_sound_tags_is_allowed(narrate):
    ok, _ = narrate.heard_score("[chuckle] Okay, that sounded spooky.", "Haha, okay, that sounded spooky.")
    assert ok


def test_heard_filler_the_script_says_must_be_heard(narrate):
    ok, _ = narrate.heard_score("It even laughs haha.", "It even laughs.")
    assert not ok


def test_heard_spelled_numbers_match_digits(narrate):
    ok, _ = narrate.heard_score("It was twenty twenty-four.", "It was 2024.")
    assert ok


def test_heard_long_line_allows_one_slip(narrate):
    want = "one quick brown fox jumps over seventeen lazy sleeping dogs beside the quiet river bank tonight"
    got = want.replace("sleeping ", "")
    assert narrate.heard_score(want, got)[0]
    assert not narrate.heard_score(want, got.replace("quiet ", ""))[0]


def test_heard_score_prefers_better_take(narrate):
    want = "Nobody noticed the lamp go out."
    _, good = narrate.heard_score(want, "Nobody noticed the lamp go out.")
    _, worse = narrate.heard_score(want, "Nobody noticed the lamp.")
    assert good > worse


@pytest.mark.parametrize("word,n", [("cat", 1), ("hello", 2), ("make", 1), ("table", 2), ("beautiful", 3)])
def test_syllables(narrate, word, n):
    assert narrate.syllables(word) == n


def test_syllables_of_non_word(narrate):
    assert narrate.syllables("2024") == 1.5


def _asr(*words):
    return [SimpleNamespace(word=w, start=s, end=e) for w, s, e in words]


def test_align_uses_recognised_times(narrate):
    times = narrate.align(["Hello", "there,", "world."], _asr(("hello", 0.1, 0.4), ("there", 0.45, 0.7),
                                                             ("world", 0.8, 1.2)), 1.5)
    assert times == [[0.1, 0.4], [0.45, 0.7], [0.8, 1.2]]


def test_align_fills_missed_words_in_the_gap(narrate):
    times = narrate.align(["Hello", "beautiful", "world"], _asr(("hello", 0.0, 0.4), ("world", 1.0, 1.3)), 1.5)
    assert times[0] == [0.0, 0.4] and times[2] == [1.0, 1.3]
    assert 0.4 <= times[1][0] < times[1][1] <= 1.0


def test_align_is_monotonic_and_inside_the_take(narrate):
    words = ["One", "two", "three", "four", "five"]
    times = narrate.align(words, _asr(("one", 0.2, 0.5), ("five", 1.6, 1.9)), 2.0)
    assert len(times) == len(words)
    for (s0, e0), (s1, e1) in zip(times, times[1:]):
        assert s0 < e0 <= s1 < e1
    assert times[0][0] >= 0 and times[-1][1] <= 2.0


def test_align_with_nothing_recognised_spreads_the_line(narrate):
    times = narrate.align(["Except", "me"], [], 1.0)
    assert times[0][0] == 0.0 and abs(times[-1][1] - 1.0) < 1e-9
