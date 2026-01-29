import type { ChildProcess } from "node:child_process";
import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { createInterface } from "node:readline";
import type { PythonVoiceEvent, VoiceSidecarEvent } from "shared/voice";
import { getVoiceSpawnConfig } from "./voice-process-paths";

export const voiceProcessEmitter = new EventEmitter();

let childProcess: ChildProcess | null = null;
let isRunning = false;
let lastEvent: VoiceSidecarEvent = { type: "idle" };

function parsePythonEvent(raw: PythonVoiceEvent): VoiceSidecarEvent | null {
	switch (raw.event) {
		case "ready":
			return { type: "ready" };
		case "recording":
			return { type: "recording" };
		case "audio_captured":
			if (raw.audio_b64 && raw.duration_s !== undefined) {
				return {
					type: "audio_captured",
					audioB64: raw.audio_b64,
					durationS: raw.duration_s,
				};
			}
			return null;
		case "error":
			return { type: "error", message: raw.message ?? "Unknown error" };
		case "idle":
			return { type: "idle" };
		default:
			return null;
	}
}

export function startVoiceProcess(): void {
	if (childProcess) {
		console.warn("[voice-process] Already running");
		return;
	}

	const config = getVoiceSpawnConfig();

	console.log(
		`[voice-process] Starting: ${config.command} ${config.args.join(" ")}`,
	);

	childProcess = spawn(config.command, config.args, {
		cwd: config.cwd,
		stdio: ["pipe", "pipe", "pipe"],
		env: { ...process.env },
	});

	isRunning = true;

	// Parse stdout JSON lines
	if (childProcess.stdout) {
		const rl = createInterface({ input: childProcess.stdout });
		rl.on("line", (line) => {
			try {
				const raw = JSON.parse(line) as PythonVoiceEvent;
				const event = parsePythonEvent(raw);
				if (event) {
					lastEvent = event;
					voiceProcessEmitter.emit("voice-event", event);
				}
			} catch {
				console.warn("[voice-process] Non-JSON stdout:", line);
			}
		});
	}

	// Log stderr
	if (childProcess.stderr) {
		const rl = createInterface({ input: childProcess.stderr });
		rl.on("line", (line) => {
			console.error("[voice-process/stderr]", line);
		});
	}

	childProcess.on("error", (err) => {
		console.error("[voice-process] Spawn error:", err.message);
		voiceProcessEmitter.emit("voice-event", {
			type: "error",
			message: `Process error: ${err.message}`,
		} satisfies VoiceSidecarEvent);
		cleanup();
	});

	childProcess.on("exit", (code, signal) => {
		console.log(`[voice-process] Exited with code=${code} signal=${signal}`);
		cleanup();
	});
}

export function stopVoiceProcess(): void {
	if (!childProcess) {
		return;
	}

	// Send stop command via stdin
	if (childProcess.stdin && !childProcess.stdin.destroyed) {
		try {
			childProcess.stdin.write(`${JSON.stringify({ cmd: "stop" })}\n`);
		} catch {
			// stdin may be closed already
		}
	}

	// Give it a moment to exit gracefully, then force kill
	const timeout = setTimeout(() => {
		if (childProcess) {
			childProcess.kill("SIGKILL");
		}
	}, 3000);

	childProcess.once("exit", () => {
		clearTimeout(timeout);
	});

	childProcess.kill("SIGTERM");
}

export function getVoiceProcessStatus(): {
	running: boolean;
} {
	return { running: isRunning };
}

export function getCurrentVoiceState(): VoiceSidecarEvent {
	return lastEvent;
}

function cleanup(): void {
	childProcess = null;
	isRunning = false;
	lastEvent = { type: "idle" };
}
