# Optional helper for Windows users.
# Installs command-line metadata tools using winget when available.
# Run in PowerShell from the project folder:
#   powershell -ExecutionPolicy Bypass -File scripts\download-tools.ps1

$ErrorActionPreference = "Continue"
Write-Host "Installing/locating metadata tools for Video Inspector..."

if (Get-Command winget -ErrorAction SilentlyContinue) {
  winget install --id Gyan.FFmpeg -e --accept-source-agreements --accept-package-agreements
  winget install --id PhilHarvey.ExifTool -e --accept-source-agreements --accept-package-agreements
  winget install --id MediaArea.MediaInfo.GUI -e --accept-source-agreements --accept-package-agreements
} else {
  Write-Warning "winget not found. Install FFmpeg/FFprobe, ExifTool, and MediaInfo manually, then make sure they are in PATH."
}

Write-Host "Done. Restart your terminal/app so PATH updates are visible."
