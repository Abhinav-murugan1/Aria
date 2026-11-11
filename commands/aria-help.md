---
description: List every Aria slash command (read from what is installed)
allowed-tools: Bash(ls:*), Read, Glob
---
List the files `~/.claude/commands/aria-*.md`. For each, read its frontmatter and print one table row:
`/NAME` | `argument-hint` | `description`. Add the rows `/aria`, `/aria-video`, `/aria-voice` (the skills themselves).
End with one line: the command-line tool is `aria` (`aria help` lists its verbs).
