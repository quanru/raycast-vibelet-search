# Vibelet Search

> Part of the **[Vibelet](https://vibelet.icu)** toolkit — AI coding from your phone. Visit **<https://vibelet.icu>** to remotely drive Claude / Codex coding agents from mobile (send prompts, review diffs, approve tool calls, all local-first).

Search your Claude and Codex sessions globally from Raycast — across **CLI and Desktop apps** — by title or full conversation content. Resume any session in your terminal, or jump straight into the corresponding desktop app, with one keystroke.

🌐 **Website**: <https://vibelet.icu>  ·  Repo: <https://github.com/quanru/raycast-vibelet-search>

## Features

- **Unified search across four sources**:
  - 🟠 **Claude Code** CLI (`~/.claude`)
  - 🟣 **Claude Desktop** app (`~/Library/Application Support/Claude/claude-code-sessions`)
  - 🟢 **Codex CLI** (`~/.codex`)
  - 🔵 **Codex Desktop** app (writes to `~/.codex` with `originator = "Codex Desktop"`)
- **Title + content search** — full-text search powered by ripgrep, scales to thousands of sessions
- **Match context view** — when you search by content, the matched message and surrounding context appear at the top of the detail view
- **Per-session source badge** — every list row and detail header is tagged with its origin
- **Open in App or Resume in Terminal** — pick the action that fits the session; App-sourced sessions default to opening the desktop app, CLI-sourced default to the terminal
- **Multi-terminal support** — Terminal.app, iTerm, Ghostty, WezTerm, Warp
- **Chat-style detail view** — user messages rendered as quote bubbles, assistant messages flat, with timestamps, source badges, and (for Claude App sessions) linked PR metadata

## Commands

| Command | Description |
|---|---|
| **Vibelet Search** | Browse and search all Claude Code / Codex sessions |

### Actions on a session

- `↵` View conversation (or matched context if searching content)
- `⌘O` Open in corresponding desktop app (Claude.app / Codex.app)
- `⌘T` Resume in configured terminal
- `⌘R` Copy resume command to clipboard
- `⌘⇧R` Copy resume command with the per-CLI dangerous-skip-permissions flag
- Open project directory in Finder
- Copy session ID / project path

## Installation

This extension is **not yet on the Raycast Store**, so install it from source.
This section is written so an AI assistant (Claude Code, Codex, etc.) can run
it end-to-end without further input.

### Prerequisites

- macOS (Raycast is macOS-only)
- [Raycast](https://raycast.com) installed at `/Applications/Raycast.app`
- Node.js ≥ 20 (`node -v`) — `brew install node` if missing
- `git`

### One-liner (recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/quanru/raycast-vibelet-search/main/install.sh | bash
```

The script clones the repo to `~/.local/share/vibelet-search`, runs `npm install`,
builds, and opens Raycast's "Import Extension" dialog pointed at the clone.

### Manual install

```bash
git clone https://github.com/quanru/raycast-vibelet-search.git ~/.local/share/vibelet-search
cd ~/.local/share/vibelet-search
npm install        # postinstall copies the bundled ripgrep binary
npm run build
open "raycast://extensions/raycast/raycast/import-extension?path=$HOME/.local/share/vibelet-search"
```

Then accept the import prompt inside Raycast.

### Updating

Because the extension is sideloaded (not from the Store), updates are **manual** —
re-run the installer:

```bash
bash ~/.local/share/vibelet-search/install.sh
```

The script does `git fetch && git reset --hard origin/main`, rebuilds, and Raycast
picks up the new bundle. (When the extension lands on the Raycast Store, Store
users will get automatic updates; sideloaded users will still need to re-run the
installer or `git pull && npm run build`.)

### Uninstall

```bash
rm -rf ~/.local/share/vibelet-search
```

Then remove "Vibelet Search" from Raycast → Extensions.

### For AI Agent

Runbook when the one-liner above appears to succeed but the **Vibelet Search**
command is missing from Raycast (typical symptom: user reports `command not
found`). This is what to do without further input from the user.

**1. Detect every Raycast variant on the machine.** Both Stable and Beta can
coexist; their bundle IDs and config dirs are distinct:

| Variant | App path | Bundle ID | Config dir |
|---|---|---|---|
| Stable | `/Applications/Raycast.app` | `com.raycast.macos` | `~/.config/raycast` |
| Beta | `/Applications/Raycast Beta.app` | `com.raycast-x.macos` | `~/.config/raycast-x` |

```bash
ls /Applications | grep -i raycast
pgrep -lf Raycast | grep -v grep   # which one is actually running
```

**2. Make sure `raycast://` opens the variant the user actually uses.** The
one-liner installer fires `open raycast://extensions/raycast/raycast/import-extension?path=...`,
which goes to whichever app currently owns the `raycast://` URL scheme — often
the wrong one when both are installed. Retarget it explicitly:

```bash
brew install duti                                   # if missing
duti -s com.raycast-x.macos raycast viewer          # Beta
# or
duti -s com.raycast.macos   raycast viewer          # Stable
duti -x raycast                                     # verify
```

**3. Confirm whether the import actually landed.** A successful import creates
`~/.config/raycast*/extensions/vibelet-search/`:

```bash
find ~/.config -maxdepth 4 -name vibelet-search 2>/dev/null
```

If nothing is printed, the `import-extension` URL did **not** register the
extension (the dialog may have been dismissed, or the wrong Raycast handled
the URL). Do **not** retry the URL — fall through to step 4, which is the
reliable path.

**4. Force-register via `ray develop`.** This is the most robust sideload
method: the dev server talks to the running Raycast and creates the extension
dir directly. Run it in the background (the process must stay alive while
`ray develop` is the source of truth):

```bash
cd ~/.local/share/vibelet-search
npm run dev &                                       # leaves ray develop running
# wait a few seconds, then verify
find ~/.config -maxdepth 4 -name vibelet-search 2>/dev/null
```

Once the directory exists, the command appears in Raycast immediately.

**5. (Optional) Persist without keeping `ray develop` running.** Once the
extension dir exists, `npm run sync` copies `dist/` into every Raycast variant
that has it imported, so the extension survives after the dev process exits:

```bash
npm run build && npm run sync
# then it's safe to:
kill %1   # stop the backgrounded `ray develop`
```

**6. Reporting back to the user.** Tell them: which Raycast variant the
extension was registered into (Stable vs Beta), the absolute extension dir
created under `~/.config/raycast*/extensions/`, and — if step 2 was needed —
that the `raycast://` URL handler was switched. If you left `ray develop`
running in the background, say so explicitly so they can stop it later.

## Preferences

- **Default Terminal** — choose your preferred terminal app (Terminal.app, iTerm, Ghostty, WezTerm, Warp)
- **Claude CLI Path** — override the `claude` binary name/path (default: `claude`)
- **Codex CLI Path** — override the `codex` binary name/path (default: `codex`)

## How it works

The extension reads session files directly from disk:

- **Claude Code (CLI)** — `~/.claude/sessions/*.json` (metadata) + `~/.claude/projects/<encoded-path>/<session>.jsonl` (conversation)
- **Claude Desktop (App)** — `~/Library/Application Support/Claude/claude-code-sessions/<user>/<workspace>/local_*.json` (metadata: title, PR link, activity timestamp). The conversation jsonl is the CLI file pointed to by `cliSessionId`, so App-sourced sessions reuse the same content store.
- **Codex CLI / Codex Desktop** — both write to `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`. The first line (`session_meta`) carries an `originator` field; we tag entries as **Codex App** when `originator == "Codex Desktop"` and **Codex CLI** otherwise. `~/.codex/session_index.jsonl` provides titles when present.

When the same session appears in both CLI and App sources (e.g. a Claude session shared between them), the App entry wins because it carries richer metadata.

To keep startup fast even with thousands of sessions, only the first ~64 KB of each file is read at index time to extract the title. Full message content is lazily loaded when you open a session detail view, and full-text search is delegated to ripgrep.

Nothing leaves your machine. The extension makes zero network requests.

## Development

```bash
npm install            # postinstall copies the ripgrep binary into assets/
npm test               # vitest
npm run dev            # `ray develop` — hot-reloads into Raycast
npm run build:sync     # one-shot: build + push dist/ into every Raycast
                       # install (Stable / Beta / etc.) that already has
                       # the extension imported. Useful when you don't
                       # want to keep `ray develop` running.
```

`npm run sync` auto-detects any `~/.config/raycast*/extensions/vibelet-search/` it finds and copies `dist/` into each — no Raycast variant is hard-coded.

## Related

- **[Vibelet](https://vibelet.icu)** — control Claude / Codex coding agents from your phone. Companion to this extension: search your sessions from Raycast on desktop, drive them from mobile.

