#!/usr/bin/env bash
#
# Vibelet Search — Raycast extension installer
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/quanru/raycast-vibelet-search/main/install.sh | bash
#
# Or, after cloning manually:
#   ./install.sh
#

set -euo pipefail

REPO_URL="${VIBELET_REPO:-https://github.com/quanru/raycast-vibelet-search.git}"
INSTALL_DIR="${VIBELET_DIR:-$HOME/.local/share/vibelet-search}"
BRANCH="${VIBELET_BRANCH:-main}"

color() { printf "\033[%sm%s\033[0m\n" "$1" "$2"; }
info() { color "1;34" "==> $1"; }
ok() { color "1;32" "✓ $1"; }
err() { color "1;31" "✗ $1" >&2; }

# --- pre-flight checks ---

[[ "$(uname)" == "Darwin" ]] || { err "macOS only (Raycast is macOS-only)"; exit 1; }

command -v git >/dev/null 2>&1 || { err "git not found. Install Xcode Command Line Tools first."; exit 1; }
command -v node >/dev/null 2>&1 || { err "Node.js not found. Install via 'brew install node' or from nodejs.org"; exit 1; }
command -v npm  >/dev/null 2>&1 || { err "npm not found. Reinstall Node.js."; exit 1; }

[[ -d "/Applications/Raycast.app" ]] || { err "Raycast.app not found. Install Raycast first: https://raycast.com"; exit 1; }

NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
[[ "$NODE_MAJOR" -ge 20 ]] || { err "Node.js >= 20 required (you have $(node -v))."; exit 1; }

# --- clone or update ---

if [[ -d "$INSTALL_DIR/.git" ]]; then
  info "Updating existing install at $INSTALL_DIR"
  git -C "$INSTALL_DIR" fetch --quiet origin "$BRANCH"
  git -C "$INSTALL_DIR" reset --quiet --hard "origin/$BRANCH"
else
  info "Cloning $REPO_URL to $INSTALL_DIR"
  mkdir -p "$(dirname "$INSTALL_DIR")"
  git clone --quiet --depth 1 --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
fi

# --- install dependencies & build ---

info "Installing dependencies"
cd "$INSTALL_DIR"
npm install --silent

info "Building extension"
npm run build >/dev/null

ok "Built successfully"

# --- register with Raycast ---

info "Registering with Raycast"

# `ray develop` runs the dev server which makes Raycast pick up the extension.
# We just need it to register once — we don't need to keep it running.
# The trick: run `ray develop` in background, wait until Raycast registers, then stop.

# Actually, the cleanest way to install permanently is to invoke Raycast's import flow
# via the deep link. This opens Raycast's "Import Extension" dialog pointed at our path.
open "raycast://extensions/raycast/raycast/import-extension?path=$(printf %s "$INSTALL_DIR" | sed 's| |%20|g')" 2>/dev/null || true

cat <<EOF

$(color "1;32" "✓ Vibelet Search installed!")

Path: $INSTALL_DIR

Next steps:
  1. Raycast should have opened with an "Import Extension" prompt.
     If not, open Raycast manually and run "Import Extension", then point it at:
       $INSTALL_DIR
  2. After importing, search for "Vibelet Search" in Raycast.

To update later:
  bash $INSTALL_DIR/install.sh

To uninstall:
  rm -rf "$INSTALL_DIR"
  (and remove the extension from Raycast settings)

EOF
