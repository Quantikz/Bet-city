#!/data/data/com.termux/files/usr/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GAME="$ROOT/engine/nightdrop"
BRANCH="godot-nightdrop-base"
BASE="https://raw.githubusercontent.com/Quantikz/Bet-city/$BRANCH/engine/nightdrop"

mkdir -p "$GAME/scripts" "$GAME/scenes"

echo "Applying Bet City Phase 1..."

curl -fL "$BASE/scripts/bet_city.gd" -o "$GAME/scripts/bet_city.gd"
curl -fL "$BASE/scripts/bet_hud.gd" -o "$GAME/scripts/bet_hud.gd"
curl -fL "$BASE/scripts/bet_touch_controls.gd" -o "$GAME/scripts/bet_touch_controls.gd"
curl -fL "$BASE/project.godot" -o "$GAME/project.godot"
curl -fL "$BASE/scenes/main.tscn" -o "$GAME/scenes/main.tscn"

echo
echo "Bet City Phase 1 applied."
echo "Open/reimport: $GAME"
echo "Then press Play."
