# Video Inspector for Windows

A clean drag-and-drop Windows desktop app that reads as much technical metadata as possible from video files and presents it in an editor/colorist-friendly way.

It is designed for files like `.mov`, `.mp4`, `.mxf`, `.mkv`, `.braw`, `.r3d`, camera clips, phone clips, action-cam clips, and exports.

## What it reports

- Camera make/model when embedded
- Lens metadata when embedded
- Resolution + FPS
- Duration + file size
- Bitrate
- Codec, codec tag, profile, pixel/chroma format
- Container / QuickTime brand / wrapper info
- Bit depth
- Color space, transfer, primaries, range
- Audio streams
- Data/metadata streams
- Gyro / telemetry clues, including GoPro GPMF-style data streams when visible
- Raw JSON from the underlying tools for deep inspection

## Important limitation

The app can only report metadata that exists and that tools can read. Some cameras/apps do not embed camera/lens/gyro data in normal readable tags, or they store it in private binary blocks. In those cases the app will show "unknown" or report clues instead of fully decoded values.

This is a metadata inspector, not a ProRes RAW decoder/player.

## Metadata engines

The packaged Windows build now bundles the command-line tools it needs:

1. **FFprobe** — stream/container/codec/color basics
2. **ExifTool** — camera, lens, QuickTime, maker notes, embedded metadata
3. **MediaInfo CLI** — friendly codec/container/bit-depth/compression fields

The app looks in its bundled `resources/tools` folder first, then falls back to PATH. If you run from source and have not copied the `tools` folder, the app still runs but reports less. The sidebar shows which tools were found.

## Run from source on Windows 11

Install Node.js LTS first: https://nodejs.org/

Then from this folder in PowerShell or CMD:

```bat
npm install
npm start
```

Optional tool install if you want to update/override the bundled tools:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\download-tools.ps1
```

Restart the terminal/app after installing tools so PATH updates are picked up.

## Build Windows packages

From this folder on Windows:

```bat
build-windows.bat
```

That builds both a normal installer and a portable app.

To build only the standard installer with uninstall support:

```bat
build-installer.bat
```

Or manually:

```bat
npm install
npm run test
npm run build:installer
```

The NSIS installer will be created under:

```text
release\VideoInspectorSetup-0.1.1-x64.exe
```

It creates Start Menu/Desktop shortcuts, installs into a normal Windows app location, registers an uninstaller in Windows “Add or remove programs”, and launches Video Inspector from the final installer screen.

To build only the portable app:

```bat
build-portable.bat
```

or:

```bat
npm run build:portable
```

The portable app will be created under:

```text
release\VideoInspector-0.1.1-Portable-x64.exe
```

## GitHub Actions builds

This repo includes `.github/workflows/build-windows.yml`. GitHub Actions will run tests and build the Windows installer/portable EXE on pushes to `main`, pull requests, manual workflow runs, and version tags like `v0.1.0`.

For tag pushes, it also publishes a GitHub Release with the generated `.exe` artifacts attached.

## App icon

Electron Builder will automatically use `build/icon.ico` if you add one later. See `build/README.md` for recommended icon sizes.

## Bundled tools

The Windows package includes:

```text
tools\ffprobe.exe
tools\exiftool.exe
tools\exiftool_files\...
tools\mediainfo.exe
tools\LIBCURL.DLL
tools\Plugin\...
```

You can replace these with newer versions later. The app searches the bundled tools first, then PATH.

## Source layout

```text
src/main/main.js           Electron main process
src/main/preload.js        safe IPC bridge
src/main/videoAnalyzer.js  tool discovery, ffprobe/exiftool/mediainfo parsing, summary logic
src/renderer/index.html    UI markup
src/renderer/styles.css    UI styling
src/renderer/renderer.js   drag/drop and report rendering
test/analyzer.test.js      parser tests
scripts/download-tools.ps1 optional tool installer
build-windows.bat          Windows build helper
```

## How to modify

- Add new metadata extraction rules in `src/main/videoAnalyzer.js`.
- Add new UI cards/fields in `src/renderer/index.html` and `src/renderer/renderer.js`.
- Change the visual design in `src/renderer/styles.css`.
- Add parser regressions in `test/analyzer.test.js`.
