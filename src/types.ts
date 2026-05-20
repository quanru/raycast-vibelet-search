/**
 * Source-agnostic shapes used by the UI layer.
 */

export type SessionSource = "claude-code" | "codex";

export interface SessionMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface SessionMeta {
  id: string;
  title: string;
  source: SessionSource;
  projectPath: string;
  timestamp: number; // epoch ms
  filePath: string; // path to the JSONL file for lazy loading
}

/**
 * Source-specific raw line shapes (only the fields we read).
 * Each adapter in `parsers.ts` consumes one of these.
 */

// Claude Code session index file: ~/.claude/sessions/<pid>.json
export interface ClaudeSessionIndexFile {
  pid: number;
  sessionId: string;
  cwd: string;
  startedAt: number;
  kind?: string;
  entrypoint?: string;
}

// Claude Code conversation JSONL line
export interface ClaudeConversationLine {
  type: "user" | "assistant" | string;
  timestamp?: string;
  message?: {
    role: "user" | "assistant";
    content?: string | Array<{ type?: string; text?: string }>;
  };
}

// Codex session index line: ~/.codex/session_index.jsonl
export interface CodexIndexLine {
  id: string;
  thread_name: string;
  updated_at: string;
}

// Codex conversation JSONL — supports two historical formats:
//   New: { type: "session_meta" | "response_item", payload: {...} }
//   Old: { type: "message", role, content } | { id, timestamp, instructions }
export interface CodexConversationLine {
  type?: string;
  // new format
  payload?: {
    type?: string;
    role?: "user" | "assistant";
    content?: Array<{ type?: string; text?: string }>;
    id?: string;
    cwd?: string;
  };
  timestamp?: string;
  // old format (session-meta line)
  id?: string;
  instructions?: string | null;
  git?: { cwd?: string; branch?: string };
  // old format (message line)
  role?: "user" | "assistant";
  content?: Array<{ type?: string; text?: string }>;
}
