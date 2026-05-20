import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execFileSync } from "child_process";
import { rgPath } from "@vscode/ripgrep";
import { claudeAdapter, codexAdapter, cleanTitle, getAdapter, isMeaningfulUserMessage } from "./format-adapters";
import type {
  ClaudeSessionIndexFile,
  CodexConversationLine,
  CodexIndexLine,
  SessionMessage,
  SessionMeta,
} from "./types";

/** Internal logging — surfaces in `ray develop` console without breaking the user. */
function warn(...args: unknown[]): void {
  console.warn("[vibelet]", ...args);
}

/**
 * Read up to `maxBytes` from the head of a JSONL file and return parsed objects.
 * Used by title extraction to avoid loading multi-MB conversation files just to grab the first message.
 */
function readJsonlHead(filePath: string, maxBytes: number = 65536): unknown[] {
  let fd: number | undefined;
  try {
    fd = fs.openSync(filePath, "r");
    const stat = fs.fstatSync(fd);
    const readSize = Math.min(maxBytes, stat.size);
    const buf = Buffer.alloc(readSize);
    fs.readSync(fd, buf, 0, readSize, 0);

    const chunk = buf.toString("utf-8", 0, readSize);
    const lines = chunk.split("\n");
    // Discard last line if we cut mid-line (only when we didn't read the whole file)
    if (readSize < stat.size && lines.length > 1) lines.pop();

    const results: unknown[] = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        results.push(JSON.parse(line));
      } catch {
        // Single malformed JSONL line — skip but keep parsing the rest
      }
    }
    return results;
  } catch (e) {
    warn(`readJsonlHead failed for ${filePath}:`, e);
    return [];
  } finally {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch {
        // already closed
      }
    }
  }
}

/**
 * Extract a session title from a JSONL file by finding the first meaningful user message.
 */
function extractTitleFromFile(filePath: string, source: "claude-code" | "codex"): { title: string; timestamp: string } {
  const adapter = getAdapter(source);
  // Codex sessions can have a very long AGENTS.md as the first user message; read more bytes
  const maxBytes = source === "codex" ? 131072 : 65536;
  const lines = readJsonlHead(filePath, maxBytes);

  for (const raw of lines) {
    const parsed = adapter.parseLine(raw);
    if (!parsed || parsed.role !== "user") continue;
    if (!isMeaningfulUserMessage(parsed.content)) continue;
    return { title: cleanTitle(parsed.content), timestamp: parsed.timestamp };
  }

  return { title: "Untitled Session", timestamp: "" };
}

/**
 * Load only metadata (title, path, timestamp) for all Claude Code sessions.
 * Does NOT read full message content — used for the initial list render.
 */
export function loadClaudeCodeSessionMetas(): SessionMeta[] {
  const homeDir = os.homedir();
  const sessionsDir = path.join(homeDir, ".claude", "sessions");
  const projectsDir = path.join(homeDir, ".claude", "projects");

  // Build map of sessionId -> session index file (for cwd + start timestamp)
  const sessionIndex = new Map<string, ClaudeSessionIndexFile>();
  if (fs.existsSync(sessionsDir)) {
    try {
      for (const file of fs.readdirSync(sessionsDir)) {
        if (!file.endsWith(".json")) continue;
        try {
          const content = fs.readFileSync(path.join(sessionsDir, file), "utf-8");
          const meta = JSON.parse(content) as ClaudeSessionIndexFile;
          if (meta.sessionId) sessionIndex.set(meta.sessionId, meta);
        } catch (e) {
          warn(`failed to parse claude session index ${file}:`, e);
        }
      }
    } catch (e) {
      warn("failed to read ~/.claude/sessions:", e);
    }
  }

  if (!fs.existsSync(projectsDir)) return [];

  const results: SessionMeta[] = [];

  try {
    for (const projDir of fs.readdirSync(projectsDir)) {
      const projPath = path.join(projectsDir, projDir);
      try {
        if (!fs.statSync(projPath).isDirectory()) continue;
      } catch {
        continue;
      }

      let jsonlFiles: string[];
      try {
        jsonlFiles = fs.readdirSync(projPath).filter((f) => f.endsWith(".jsonl"));
      } catch (e) {
        warn(`failed to read claude project dir ${projDir}:`, e);
        continue;
      }

      for (const jsonlFile of jsonlFiles) {
        const sessionId = jsonlFile.replace(".jsonl", "");
        const filePath = path.join(projPath, jsonlFile);

        let mtime = 0;
        try {
          mtime = fs.statSync(filePath).mtimeMs;
        } catch {
          // Use 0 — file will sort to the bottom
        }

        const indexEntry = sessionIndex.get(sessionId);
        const { title, timestamp: firstMsgTs } = extractTitleFromFile(filePath, "claude-code");
        const decodedPath = decodeURIComponent(projDir);

        const firstMsgEpoch = firstMsgTs ? new Date(firstMsgTs).getTime() : NaN;
        const timestamp = indexEntry?.startedAt ?? (Number.isFinite(firstMsgEpoch) ? firstMsgEpoch : mtime);

        results.push({
          id: sessionId,
          title,
          source: "claude-code",
          projectPath: indexEntry?.cwd || decodedPath,
          timestamp,
          filePath,
        });
      }
    }
  } catch (e) {
    warn("failed to scan ~/.claude/projects:", e);
  }

  return results;
}

/**
 * Walk a directory tree and return all `.jsonl` file paths.
 */
function walkJsonlFiles(dir: string): string[] {
  const files: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    warn(`failed to read directory ${dir}:`, e);
    return files;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkJsonlFiles(fullPath));
    } else if (entry.name.endsWith(".jsonl")) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Codex session_meta lines can be large (sometimes >15 KB) because the legacy format embeds
 * the full system instructions inline. Read enough bytes so a normal session_meta is captured;
 * pathologically huge first lines (> CODEX_META_READ_BYTES) are skipped with a warning.
 */
const CODEX_META_READ_BYTES = 256 * 1024;

/**
 * Read the first JSONL line of a Codex session file to extract id/cwd/timestamp.
 * Returns `null` if the line can't be parsed or doesn't carry session metadata.
 */
export function parseCodexSessionMetaLine(parsed: CodexConversationLine): {
  id: string;
  projectPath: string;
  ts: number;
} | null {
  // New format: { type: "session_meta", payload: { id, cwd, ... } }
  if (parsed.type === "session_meta" && parsed.payload?.id) {
    return {
      id: parsed.payload.id,
      projectPath: parsed.payload.cwd || "",
      ts: parsed.timestamp ? new Date(parsed.timestamp).getTime() : 0,
    };
  }

  // Old format: { id, timestamp, instructions, git? } — no `type` field
  if (parsed.id && parsed.timestamp && !parsed.type) {
    return {
      id: parsed.id,
      projectPath: parsed.git?.cwd || "",
      ts: new Date(parsed.timestamp).getTime(),
    };
  }

  return null;
}

function readCodexSessionMeta(filePath: string): { id: string; projectPath: string; ts: number } | null {
  const lines = readJsonlHead(filePath, CODEX_META_READ_BYTES);
  if (lines.length === 0) return null;
  return parseCodexSessionMetaLine(lines[0] as CodexConversationLine);
}

/**
 * Load only metadata for all Codex sessions.
 */
export function loadCodexSessionMetas(): SessionMeta[] {
  const homeDir = os.homedir();
  const codexDir = path.join(homeDir, ".codex");
  const indexPath = path.join(codexDir, "session_index.jsonl");
  const sessionsDir = path.join(codexDir, "sessions");

  if (!fs.existsSync(codexDir)) return [];

  // Build title index from session_index.jsonl (only covers a subset of sessions)
  const titleMap = new Map<string, { name: string; updatedAt: string }>();
  if (fs.existsSync(indexPath)) {
    try {
      const content = fs.readFileSync(indexPath, "utf-8");
      for (const line of content.split("\n")) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line) as CodexIndexLine;
          titleMap.set(parsed.id, { name: parsed.thread_name, updatedAt: parsed.updated_at });
        } catch (e) {
          warn("failed to parse codex index line:", e);
        }
      }
    } catch (e) {
      warn("failed to read codex session_index.jsonl:", e);
    }
  }

  if (!fs.existsSync(sessionsDir)) return [];

  const results: SessionMeta[] = [];

  for (const filePath of walkJsonlFiles(sessionsDir)) {
    const sessionMeta = readCodexSessionMeta(filePath);
    if (!sessionMeta) continue;

    const indexInfo = titleMap.get(sessionMeta.id);
    const title = indexInfo?.name || extractTitleFromFile(filePath, "codex").title;

    results.push({
      id: sessionMeta.id,
      title,
      source: "codex",
      projectPath: sessionMeta.projectPath,
      timestamp: indexInfo ? new Date(indexInfo.updatedAt).getTime() : sessionMeta.ts,
      filePath,
    });
  }

  return results;
}

/**
 * Load all session metas from both sources, sorted by recency.
 */
export function loadAllSessionMetas(): SessionMeta[] {
  const claude = loadClaudeCodeSessionMetas();
  const codex = loadCodexSessionMetas();
  return [...claude, ...codex].sort((a, b) => b.timestamp - a.timestamp);
}

// --- Content loading (on demand) ---

/**
 * Load all messages for a single session. Reads the entire JSONL file.
 * Called lazily when the user opens the detail view.
 */
export function loadSessionMessages(meta: SessionMeta): SessionMessage[] {
  let content: string;
  try {
    content = fs.readFileSync(meta.filePath, "utf-8");
  } catch (e) {
    warn(`failed to read session ${meta.filePath}:`, e);
    return [];
  }

  const adapter = getAdapter(meta.source);
  const messages: SessionMessage[] = [];

  for (const line of content.split("\n")) {
    if (!line.trim()) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }
    const msg = adapter.parseLine(parsed);
    if (msg) messages.push(msg);
  }

  return messages;
}

// --- Content search ---

/**
 * Build a clean snippet around the matched query inside a parsed message body.
 */
function buildSnippet(text: string, lowerQuery: string, queryLength: number): string {
  const idx = text.toLowerCase().indexOf(lowerQuery);
  if (idx === -1) return text.slice(0, 160).replace(/\s+/g, " ");
  const s = Math.max(0, idx - 50);
  const e = Math.min(text.length, idx + queryLength + 50);
  return (s > 0 ? "..." : "") + text.slice(s, e).replace(/\s+/g, " ") + (e < text.length ? "..." : "");
}

/**
 * Search content across all session files using ripgrep (bundled via @vscode/ripgrep).
 * Returns a map of filePath -> snippet. Limited to `limit` matches.
 *
 * Ripgrep runs as a subprocess so we don't pull hundreds of MB of JSONL into the Raycast Worker
 * heap. We then parse each matched line through our adapters to extract a clean text snippet.
 */
export function searchSessionContent(query: string, limit: number): Map<string, string> {
  const results = new Map<string, string>();
  if (!query.trim() || query.length < 2) return results;

  if (!fs.existsSync(rgPath)) {
    warn(`ripgrep binary missing at ${rgPath}`);
    return results;
  }

  const homeDir = os.homedir();
  const searchDirs = [path.join(homeDir, ".claude", "projects"), path.join(homeDir, ".codex", "sessions")].filter((d) =>
    fs.existsSync(d),
  );
  if (searchDirs.length === 0) return results;

  let output: string;
  try {
    output = execFileSync(
      rgPath,
      [
        "--fixed-strings",
        "--ignore-case",
        "--max-count",
        "1",
        "--max-filesize",
        "20M",
        "--glob",
        "*.jsonl",
        "--no-heading",
        "--with-filename",
        "--line-number",
        query,
        ...searchDirs,
      ],
      {
        encoding: "utf-8",
        maxBuffer: 16 * 1024 * 1024,
        timeout: 15000,
      },
    );
  } catch (err) {
    // ripgrep exits with code 1 when there are no matches — that's not an error.
    // Anything else (timeouts, OOM, ENOENT, code >= 2) IS an error and should be surfaced.
    const e = err as { status?: number; stderr?: Buffer; message?: string };
    if (e.status === 1) return results;
    warn(`ripgrep search failed (status=${e.status}):`, e.stderr?.toString() || e.message);
    return results;
  }

  const lowerQuery = query.toLowerCase();
  const queryLength = query.length;

  for (const line of output.split("\n")) {
    if (results.size >= limit) break;
    if (!line) continue;

    // Format: /path/to/file.jsonl:lineNum:matchedContent
    const firstColon = line.indexOf(":");
    if (firstColon === -1) continue;
    const secondColon = line.indexOf(":", firstColon + 1);
    if (secondColon === -1) continue;

    const filePath = line.slice(0, firstColon);
    const matchedJsonLine = line.slice(secondColon + 1);

    // Parse the matched JSONL line through the same adapter the rest of the code uses,
    // so we get a clean text snippet (no JSON noise).
    let snippet: string;
    try {
      const parsed = JSON.parse(matchedJsonLine);
      const adapter = filePath.includes("/.codex/") ? codexAdapter : claudeAdapter;
      const msg = adapter.parseLine(parsed);
      snippet = msg
        ? buildSnippet(msg.content, lowerQuery, queryLength)
        : matchedJsonLine.slice(0, 160).replace(/\s+/g, " ");
    } catch {
      snippet = matchedJsonLine.slice(0, 160).replace(/\s+/g, " ");
    }

    results.set(filePath, snippet);
  }

  return results;
}
