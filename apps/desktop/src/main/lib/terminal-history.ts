/**
 * Terminal History Persistence (Phase 4)
 *
 * Provides cold restore capability by persisting terminal scrollback to disk.
 * This enables terminal recovery after app/system restarts when the daemon
 * is not running (unlike warm attach which reconnects to live daemon sessions).
 *
 * Storage format:
 * - scrollback.bin: Raw PTY output (append-only during session)
 * - meta.json: Session metadata (cols, rows, cwd, timestamps)
 *
 * Cold restore detection:
 * - meta.json exists but has no endedAt → unclean shutdown → can restore
 * - meta.json has endedAt → clean shutdown → no restore needed
 */

import { createWriteStream, promises as fs, type WriteStream } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { SUPERSET_DIR_NAME } from "shared/constants";

// =============================================================================
// Types
// =============================================================================

export interface SessionMetadata {
	cwd: string;
	cols: number;
	rows: number;
	startedAt: string;
	endedAt?: string;
	exitCode?: number;
}

// =============================================================================
// Path Helpers
// =============================================================================

const TERMINAL_HISTORY_DIR_NAME = "terminal-history";

export function getTerminalHistoryRootDir(): string {
	return join(homedir(), SUPERSET_DIR_NAME, TERMINAL_HISTORY_DIR_NAME);
}

function getHistoryDir(workspaceId: string, paneId: string): string {
	return join(getTerminalHistoryRootDir(), workspaceId, paneId);
}

function getScrollbackPath(workspaceId: string, paneId: string): string {
	return join(getHistoryDir(workspaceId, paneId), "scrollback.bin");
}

function getMetadataPath(workspaceId: string, paneId: string): string {
	return join(getHistoryDir(workspaceId, paneId), "meta.json");
}

// =============================================================================
// HistoryWriter
// =============================================================================

/**
 * Writes terminal output to disk for cold restore.
 *
 * Usage:
 * 1. Create writer with session params
 * 2. Call init() with optional initial scrollback (from daemon snapshot)
 * 3. Call write() for each data event from PTY
 * 4. Call close() when session ends (writes endedAt to meta.json)
 */
export class HistoryWriter {
	private stream: WriteStream | null = null;
	private dir: string;
	private scrollbackPath: string;
	private metaPath: string;
	private metadata: SessionMetadata;
	private streamErrored = false;
	private closed = false;

	constructor(
		private workspaceId: string,
		private paneId: string,
		cwd: string,
		cols: number,
		rows: number,
	) {
		this.dir = getHistoryDir(workspaceId, paneId);
		this.scrollbackPath = getScrollbackPath(workspaceId, paneId);
		this.metaPath = getMetadataPath(workspaceId, paneId);
		this.metadata = {
			cwd,
			cols,
			rows,
			startedAt: new Date().toISOString(),
		};
	}

	/**
	 * Initialize the history file.
	 * Creates the directory, writes initial scrollback, and opens append stream.
	 */
	async init(initialScrollback?: string): Promise<void> {
		await fs.mkdir(this.dir, { recursive: true });

		// Write initial scrollback or create empty file
		// node-pty produces UTF-8 strings, so we store as UTF-8
		if (initialScrollback) {
			await fs.writeFile(
				this.scrollbackPath,
				Buffer.from(initialScrollback, "utf8"),
			);
		} else {
			await fs.writeFile(this.scrollbackPath, Buffer.alloc(0));
		}

		// Open stream in append mode for subsequent writes
		this.stream = createWriteStream(this.scrollbackPath, { flags: "a" });
		this.stream.on("error", (error) => {
			console.error(
				`[HistoryWriter] Stream error for ${this.paneId}:`,
				error.message,
			);
			this.streamErrored = true;
			this.stream = null;
		});

		// Write meta.json immediately (without endedAt)
		// This enables cold restore detection - if app crashes,
		// meta.json exists but has no endedAt, indicating unclean shutdown
		await this.writeMetadata();
	}

	/**
	 * Write terminal data to the scrollback file.
	 * Non-blocking - errors are swallowed to avoid disrupting terminal operation.
	 */
	write(data: string): void {
		if (this.closed || this.streamErrored || !this.stream) {
			return;
		}

		try {
			// node-pty produces UTF-8 strings
			this.stream.write(Buffer.from(data, "utf8"));
		} catch {
			this.streamErrored = true;
		}
	}

	/**
	 * Flush pending writes to disk.
	 * Returns a promise that resolves when data is flushed.
	 */
	async flush(): Promise<void> {
		if (this.closed || this.streamErrored || !this.stream) {
			return;
		}

		return new Promise<void>((resolve) => {
			// Cork and uncork forces a flush
			this.stream?.once("drain", resolve);
			// If nothing to drain, resolve immediately
			if (this.stream?.writableLength === 0) {
				resolve();
			}
		});
	}

	/**
	 * Close the history file and write endedAt to metadata.
	 */
	async close(exitCode?: number): Promise<void> {
		if (this.closed) {
			return;
		}
		this.closed = true;

		// Close the stream
		if (this.stream && !this.streamErrored) {
			await new Promise<void>((resolve) => {
				this.stream?.end(() => resolve());
			}).catch(() => {
				// Ignore stream close errors
			});
		}
		this.stream = null;

		// Update metadata with end time
		this.metadata.endedAt = new Date().toISOString();
		if (exitCode !== undefined) {
			this.metadata.exitCode = exitCode;
		}

		await this.writeMetadata();
	}

	/**
	 * Reinitialize the history file (e.g., after clear scrollback).
	 * Closes the current stream and creates a fresh empty file.
	 */
	async reinitialize(): Promise<void> {
		// Close existing stream without writing endedAt
		if (this.stream && !this.streamErrored) {
			await new Promise<void>((resolve) => {
				this.stream?.end(() => resolve());
			}).catch(() => {
				// Ignore
			});
		}
		this.stream = null;
		this.streamErrored = false;
		this.closed = false;

		// Reset metadata with new start time
		this.metadata.startedAt = new Date().toISOString();
		delete this.metadata.endedAt;
		delete this.metadata.exitCode;

		// Reinitialize with empty scrollback
		await this.init();
	}

	/**
	 * Delete all history files for this session.
	 */
	async deleteHistory(): Promise<void> {
		// Close stream first
		if (this.stream && !this.streamErrored) {
			await new Promise<void>((resolve) => {
				this.stream?.end(() => resolve());
			}).catch(() => {
				// Ignore
			});
		}
		this.stream = null;
		this.closed = true;

		// Delete the directory
		await fs.rm(this.dir, { recursive: true, force: true }).catch((error) => {
			console.warn(
				`[HistoryWriter] Failed to delete history for ${this.paneId}:`,
				error.message,
			);
		});
	}

	private async writeMetadata(): Promise<void> {
		try {
			await fs.writeFile(this.metaPath, JSON.stringify(this.metadata, null, 2));
		} catch (error) {
			console.warn(
				`[HistoryWriter] Failed to write metadata for ${this.paneId}:`,
				error instanceof Error ? error.message : String(error),
			);
		}
	}
}

// =============================================================================
// HistoryReader
// =============================================================================

/**
 * Reads terminal history for cold restore.
 *
 * Usage:
 * 1. Create reader with workspace/pane IDs
 * 2. Check exists() to see if history is available
 * 3. Read metadata to check for unclean shutdown (no endedAt)
 * 4. Read scrollback to restore terminal content
 */
export class HistoryReader {
	private dir: string;
	private scrollbackPath: string;
	private metaPath: string;

	constructor(
		private workspaceId: string,
		private paneId: string,
	) {
		this.dir = getHistoryDir(workspaceId, paneId);
		this.scrollbackPath = getScrollbackPath(workspaceId, paneId);
		this.metaPath = getMetadataPath(workspaceId, paneId);
	}

	/**
	 * Check if history exists for this session.
	 */
	async exists(): Promise<boolean> {
		try {
			await fs.access(this.metaPath);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Read session metadata.
	 * Returns null if metadata doesn't exist or is invalid.
	 */
	async readMetadata(): Promise<{
		cols: number;
		rows: number;
		cwd: string;
		endedAt?: string;
	} | null> {
		try {
			const content = await fs.readFile(this.metaPath, "utf8");
			const metadata = JSON.parse(content) as SessionMetadata;

			return {
				cols: metadata.cols,
				rows: metadata.rows,
				cwd: metadata.cwd,
				endedAt: metadata.endedAt,
			};
		} catch {
			return null;
		}
	}

	/**
	 * Read scrollback content.
	 * Returns null if scrollback doesn't exist.
	 */
	async readScrollback(): Promise<string | null> {
		try {
			// Read as UTF-8 to match how node-pty produces terminal output
			return await fs.readFile(this.scrollbackPath, "utf8");
		} catch {
			return null;
		}
	}

	/**
	 * Delete history files for this session.
	 */
	cleanup(): void {
		fs.rm(this.dir, { recursive: true, force: true }).catch((error) => {
			console.warn(
				`[HistoryReader] Failed to cleanup history for ${this.paneId}:`,
				error instanceof Error ? error.message : String(error),
			);
		});
	}
}
