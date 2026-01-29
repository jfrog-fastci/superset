#!/usr/bin/env bash
# Builds the voice sidecar Python script into a standalone binary using PyInstaller.
# The output binary is placed in dist/voice-sidecar/ and gets bundled into
# the Electron app's extraResources by electron-builder.
#
# Prerequisites:
#   pip install pyinstaller   (in the voice python venv)
#
# Usage:
#   ./scripts/build-voice-sidecar.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DESKTOP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PYTHON_DIR="$DESKTOP_DIR/src/main/lib/voice/python"
VENV_DIR="$PYTHON_DIR/.venv"
OUTPUT_DIR="$DESKTOP_DIR/dist/voice-sidecar"

if [ ! -d "$VENV_DIR" ]; then
  echo "Error: Python venv not found at $VENV_DIR"
  echo "Create it with: python3 -m venv $VENV_DIR && $VENV_DIR/bin/pip install openwakeword sounddevice numpy"
  exit 1
fi

PYTHON="$VENV_DIR/bin/python3"
PIP="$VENV_DIR/bin/pip"

# Ensure PyInstaller is installed
if ! "$PYTHON" -c "import PyInstaller" 2>/dev/null; then
  echo "Installing PyInstaller..."
  "$PIP" install pyinstaller
fi

echo "Building voice sidecar binary..."

"$PYTHON" -m PyInstaller \
  --name voice-sidecar \
  --onedir \
  --noconfirm \
  --clean \
  --distpath "$OUTPUT_DIR" \
  --workpath "$DESKTOP_DIR/dist/voice-sidecar-build" \
  --specpath "$DESKTOP_DIR/dist" \
  --collect-data openwakeword \
  "$PYTHON_DIR/main.py"

echo "Voice sidecar binary built at: $OUTPUT_DIR/voice-sidecar/"
echo "Contents:"
ls -la "$OUTPUT_DIR/voice-sidecar/"
