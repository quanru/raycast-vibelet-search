# Vibelet Search

Search your Claude Code and Codex CLI sessions globally from Raycast — by title or full conversation content. Resume any session in your terminal with one keystroke.

## Features

- **Unified search** across Claude Code (`~/.claude`) and Codex CLI (`~/.codex`) sessions
- **Title + content search** — full-text search powered by ripgrep, scales to thousands of sessions
- **Match context view** — when you search by content, the matched message and surrounding context appear at the top of the detail view
- **Resume in terminal** — one Enter to open the session resume command in your terminal of choice
- **Multi-terminal support** — Terminal.app, iTerm, Ghostty, WezTerm, Warp
- **Chat-style detail view** — user messages rendered as quote bubbles, assistant messages flat, with timestamps and source badges

## Commands

| Command | Description |
|---|---|
| **Vibelet Search** | Browse and search all Claude Code / Codex sessions |

### Actions on a session

- `↵` View conversation (or matched context if searching content)
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

- **Claude Code**: `~/.claude/sessions/*.json` (metadata) + `~/.claude/projects/<encoded-path>/<session>.jsonl` (conversation)
- **Codex CLI**: `~/.codex/session_index.jsonl` (titles) + `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` (conversation)

To keep startup fast even with thousands of sessions, only the first ~64 KB of each file is read at index time to extract the title. Full message content is lazily loaded when you open a session detail view, and full-text search is delegated to ripgrep.

Nothing leaves your machine. The extension makes zero network requests.
