#!/usr/bin/env bash
# Build the narration engine in .tts/ — a Python environment and the open voice
# models. Nothing here costs money or needs an account.
#
#   bash tools/tts/setup.sh            # environment + all four voices (~6 GB)
#   bash tools/tts/setup.sh hi mr      # just these voices
#
# Voices: AI4Bharat Indic-TTS (MIT), https://github.com/AI4Bharat/Indic-TTS
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENGINE="$ROOT/.tts"
RELEASE="https://github.com/AI4Bharat/Indic-TTS/releases/download/v1-checkpoints-release"
LANGS=("$@"); [ ${#LANGS[@]} -eq 0 ] && LANGS=(en hi mr or)

command -v uv >/dev/null || { echo "Install uv first: https://docs.astral.sh/uv/"; exit 1; }
command -v ffmpeg >/dev/null || { echo "Install ffmpeg first: brew install ffmpeg"; exit 1; }

mkdir -p "$ENGINE/models"

if [ ! -x "$ENGINE/venv/bin/python" ]; then
  uv venv --python 3.11 "$ENGINE/venv"
  # Pinned: coqui-tts 0.24 breaks against transformers 4.50 and later.
  uv pip install --python "$ENGINE/venv/bin/python" "coqui-tts==0.24.3" "transformers==4.46.3" "openai-whisper==20250625"
fi

for lang in "${LANGS[@]}"; do
  if [ -f "$ENGINE/models/$lang/fastpitch/best_model.pth" ]; then echo "✓ $lang voice already here"; continue; fi
  echo "… $lang voice (about 1.5 GB)"
  # In parallel pieces: the release server gives one connection a trickle.
  "$ENGINE/venv/bin/python" "$ROOT/tools/tts/fetch_voice.py" "$lang" "$ENGINE/models"
done
