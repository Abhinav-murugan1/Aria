"""The agent files: the launch-video skill and its slash command have frontmatter and carry no outside names."""
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OLD = re.compile(bytes([98, 114, 97, 103]).decode(), re.I)  # the pre-rename word, spelled as bytes so this file passes


def frontmatter(rel):
    text = open(os.path.join(ROOT, rel), encoding="utf-8").read()
    assert text.startswith("---\n"), rel
    head = text[4:text.index("\n---\n", 4)]
    return dict(line.split(":", 1) for line in head.splitlines() if ":" in line and not line.startswith("#")), text


def test_launch_skill_has_frontmatter():
    fm, text = frontmatter("skills/aria-launch/SKILL.md")
    assert fm["name"].strip() == "aria-launch"
    assert fm["description"].strip()
    assert not OLD.search(text)
    assert "hyperframes" not in text.lower()


def test_launch_command_has_frontmatter():
    fm, text = frontmatter("commands/aria-launch.md")
    assert fm["description"].strip()
    assert "--no-voice" in fm["argument-hint"]
    assert "aria-launch" in text and "$ARGUMENTS" in text
    assert not OLD.search(text)


def test_launch_notice_carries_the_license():
    text = open(os.path.join(ROOT, "skills", "aria-launch", "NOTICE"), encoding="utf-8").read()
    assert "MIT License" in text and "Permission is hereby granted" in text
