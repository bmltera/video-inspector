# Video Inspector for Windows Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Build a Windows desktop app where an editor/colorist can drag in a video file and get an easy-to-read technical metadata report.

**Architecture:** Electron desktop UI with a Node.js main-process analyzer. The analyzer runs FFprobe, ExifTool, and MediaInfo when available, normalizes their raw outputs into a concise report, and exposes it to the renderer via safe IPC.

**Tech Stack:** Electron, Node.js, electron-builder, FFprobe, ExifTool, MediaInfo.

---

### Task 1: Create Electron app shell

Create `package.json`, `src/main/main.js`, `src/main/preload.js`, and a minimal renderer.

### Task 2: Implement metadata analyzer

Create `src/main/videoAnalyzer.js` to discover tools, run them, parse JSON, and normalize fields.

### Task 3: Build polished drag/drop UI

Create sidebar, drop zone, hero cards, detailed cards, metadata table, and raw JSON details.

### Task 4: Add tests

Create parser tests using synthetic ffprobe/exif data.

### Task 5: Add Windows build instructions

Create README, build batch file, and optional PowerShell tool installer.
