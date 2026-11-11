---
description: Build a new expressive Aria voice preset to clone from
argument-hint: NAME KOKORO_VOICE|RECORDING.wav
---
Load the `aria-voice` skill and build a preset from: $ARGUMENTS
If the source is a recording, ask the user to confirm it is their own voice or that they have the speaker's consent.
Without that confirmation, refuse. Then follow the skill's "Voice presets" section and report two test lines' meter readings.
