---
description: Run Aria's export check on a video and explain the findings
argument-hint: VIDEO.mp4 [--platform shorts|reels|tiktok]
allowed-tools: Bash(aria check:*), Bash(python:*), Read
---
Run `aria check $ARGUMENTS -o CHECK.json` (beside the video). Group findings by rule and severity, explain each in
plain words with where it happens and the fix, and give a clear fit-to-publish verdict.
