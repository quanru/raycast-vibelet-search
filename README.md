# Vibelet Search

Search your Claude and Codex sessions globally from Raycast — across **CLI and Desktop apps** — by title or full conversation content. Resume any session in your terminal, or jump straight into the corresponding desktop app, with one keystroke.

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
- `⌘T` Open resume command in configured terminal
- `⌘R` Copy resume command to clipboard
- Open project directory in Finder
- Copy session ID / project path

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
