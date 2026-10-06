#!/data/data/com.termux/files/usr/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ -d "engine/nightdrop/.git" ]; then
  echo "Night Drop foundation already exists."
  exit 0
fi

mkdir -p engine
git clone https://github.com/alexbieber/GTA-mini.git engine/nightdrop

echo
echo "Foundation installed at:"
echo "$ROOT/engine/nightdrop"
echo
echo "Open engine/nightdrop/project.godot with Godot 4.7.x."
echo "Do not copy or use Rockstar/GTA assets."
