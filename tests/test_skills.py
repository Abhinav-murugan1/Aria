"""The agent files: every shipped skill and slash command has frontmatter, and aria-brag names no other product."""
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def frontmatter(rel):
    text = open(os.path.join(ROOT, rel), encoding="utf-8").read()
    assert text.startswith("---\n"), rel
    head = text[4:text.index("\n---\n", 4)]
    return dict(line.split(":", 1) for line in head.splitlines() if ":" in line and not line.startswith("#")), text


def test_aria_brag_skill_has_frontmatter():
    fm, text = frontmatter("skills/aria-brag/SKILL.md")
    assert fm["name"].strip() == "aria-brag"
    assert fm["description"].strip()
    for banned in ("brag by", "hyperframes"):
        assert banned not in text.lower(), banned


def test_aria_brag_command_has_frontmatter():
    fm, text = frontmatter("commands/aria-brag.md")
    assert fm["description"].strip()
    assert "--no-voice" in fm["argument-hint"]
    assert "aria-brag" in text and "$ARGUMENTS" in text


def test_aria_brag_notice_carries_the_license():
    text = open(os.path.join(ROOT, "skills", "aria-brag", "NOTICE"), encoding="utf-8").read()
    assert "MIT License" in text and "Permission is hereby granted" in text
