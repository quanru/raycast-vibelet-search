import type { ClaudeConversationLine, CodexConversationLine, SessionMessage, SessionSource } from "./types";

/**
 * Parsed message extracted from a single JSONL line.
 * `null` means the line carries no user-visible message (e.g. tool result, session_meta).
 */
export type ParsedLine = SessionMessage | null;

/**
 * Single source of truth for "given a JSONL line from source X, extract the visible message".
 * All consumers (title extraction, full conversation load, content search snippets) go through here.
 */
export interface FormatAdapter {
  source: SessionSource;
  parseLine(raw: unknown): ParsedLine;
}

function extractTextBlocks(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((block: { type?: string; text?: string }) => {
      // Skip non-text blocks (tool calls, images, etc.)
      if (block.type === "tool_use" || block.type === "tool_result" || block.type === "input_image") {
        return "";
      }
      return block.text || "";
    })
    .filter(Boolean)
    .join("\n");
}

export const claudeAdapter: FormatAdapter = {
  source: "claude-code",
  parseLine(raw) {
    if (raw === null || typeof raw !== "object") return null;
    const line = raw as ClaudeConversationLine;
    if (line.type !== "user" && line.type !== "assistant") return null;
    if (!line.message?.content) return null;

    const text = extractTextBlocks(line.message.content);
    if (!text) return null;

    return {
      role: line.type,
      content: text,
      timestamp: line.timestamp || "",
    };
  },
};

export const codexAdapter: FormatAdapter = {
  source: "codex",
  parseLine(raw) {
    if (raw === null || typeof raw !== "object") return null;
    const line = raw as CodexConversationLine;

    // New format: { type: "response_item", payload: { type: "message", role, content } }
    if (line.type === "response_item" && line.payload?.type === "message" && line.payload.role) {
      const text = extractTextBlocks(line.payload.content);
      if (!text) return null;
      return {
        role: line.payload.role,
        content: text,
        timestamp: line.timestamp || "",
      };
    }

    // Old format: { type: "message", role, content }
    if (line.type === "message" && line.role && line.content) {
      const text = extractTextBlocks(line.content);
      if (!text) return null;
      return {
        role: line.role,
        content: text,
        timestamp: line.timestamp || "",
      };
    }

    return null;
  },
};

export function getAdapter(source: SessionSource): FormatAdapter {
  return source === "claude-code" ? claudeAdapter : codexAdapter;
}

/**
 * Heuristic: is this user message a real user input vs system/env context?
 * Used by title extraction to skip AGENTS.md, environment context, etc.
 */
export function isMeaningfulUserMessage(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 3) return false;

  // Skip AGENTS.md / CLAUDE.md / system instructions
  if (/^#\s*(AGENTS|CLAUDE)\.md/i.test(trimmed)) return false;

  // Skip wrapped system context tags
  if (/^<(system-reminder|environment_context|command-message|command-name|command-args)[\s>]/.test(trimmed)) {
    return false;
  }

  // Skip caveat prefixes
  if (trimmed.startsWith("Caveat:")) return false;

  return true;
}

/**
 * Clean up a title string: strip leading wrapper tags, take first non-empty line, truncate.
 */
export function cleanTitle(text: string): string {
  const stripped = text.trim().replace(/^<[^>]+>\s*/, "");
  const firstLine = stripped
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  return (firstLine || stripped).slice(0, 120);
}
