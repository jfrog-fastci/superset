import { type ITheme, Terminal as XTerm } from "@xterm/xterm";
import { useEffect, useRef, useState } from "react";
import "@xterm/xterm/css/xterm.css";

interface TerminalProps {
	hidden?: boolean;
	className?: string;
}

interface TerminalMessage {
	id: string;
	data: string;
}

const TERMINAL_THEME: Record<"LIGHT" | "DARK", ITheme> = {
	LIGHT: {
		background: "#ffffff",
		foreground: "#2d2d2d",
		cursor: "#333333",
		cursorAccent: "#ffffff",
		black: "#2d2d2d",
		red: "#d64646",
		green: "#4e9a06",
		yellow: "#c4a000",
		blue: "#3465a4",
		magenta: "#75507b",
		cyan: "#06989a",
		white: "#d3d7cf",
		brightBlack: "#555753",
		brightRed: "#ef2929",
		brightGreen: "#8ae234",
		brightYellow: "#fce94f",
		brightBlue: "#729fcf",
		brightMagenta: "#ad7fa8",
		brightCyan: "#34e2e2",
		brightWhite: "#eeeeec",
		selectionBackground: "#bfbfbf",
	},
	DARK: {
		background: "#1e1e1e",
		foreground: "#d4d4d4",
		cursor: "#d4d4d4",
		cursorAccent: "#1e1e1e",
		black: "#000000",
		red: "#cd3131",
		green: "#0dbc79",
		yellow: "#e5e510",
		blue: "#2472c8",
		magenta: "#bc3fbc",
		cyan: "#11a8cd",
		white: "#e5e5e5",
		brightBlack: "#666666",
		brightRed: "#f14c4c",
		brightGreen: "#23d18b",
		brightYellow: "#f5f543",
		brightBlue: "#3b8eea",
		brightMagenta: "#d670d6",
		brightCyan: "#29b8db",
		brightWhite: "#e5e5e5",
	},
};

export default function TerminalComponent({
	hidden = false,
	className = "",
}: TerminalProps) {
	const terminalRef = useRef<HTMLDivElement>(null);
	const [terminal, setTerminal] = useState<XTerm | null>(null);
	const [theme] = useState<"light" | "dark">("dark"); // Can be connected to theme provider later
	const terminalIdRef = useRef<string | null>(null);

	useEffect(() => {
		if (terminal) {
			terminal.options.theme =
				theme === "light" ? TERMINAL_THEME.LIGHT : TERMINAL_THEME.DARK;
		}
	}, [theme, terminal]);

	useEffect(() => {
		if (!terminalRef.current || terminal) {
			return;
		}

		const { term, terminalDataListener, cleanup } = initTerminal(
			terminalRef.current,
			theme,
		);
		setTerminal(term);

		return () => {
			term.dispose();
			setTerminal(null);
			cleanup();
		};
	}, [theme]);

	function initTerminal(
		container: HTMLDivElement,
		currentTheme: "light" | "dark",
	) {
		const term = new XTerm({
			cursorBlink: true,
			fontSize: 12,
			fontFamily: 'Menlo, Monaco, "Courier New", monospace',
			theme:
				currentTheme === "light" ? TERMINAL_THEME.LIGHT : TERMINAL_THEME.DARK,
			convertEol: true,
			allowTransparency: true,
			disableStdin: false,
		});

		term.open(container);
		const { cols, rows } = term;

		// Request a new terminal session
		window.ipcRenderer
			.invoke("terminal-create", { cols, rows })
			.then((terminalId: string) => {
				terminalIdRef.current = terminalId;

				// Get terminal history
				return window.ipcRenderer.invoke("terminal-get-history", terminalId);
			})
			.then((history: string | undefined) => {
				if (history) {
					term.write(history);
				}
			})
			.catch((error: Error) => {
				console.error("Failed to initialize terminal:", error);
			});

		// Set up event listeners
		term.onData((data) => {
			if (terminalIdRef.current) {
				window.ipcRenderer.send("terminal-input", {
					id: terminalIdRef.current,
					data,
				});
			}
		});

		term.onResize(({ cols, rows }) => {
			if (terminalIdRef.current) {
				window.ipcRenderer.send("terminal-resize", {
					id: terminalIdRef.current,
					cols,
					rows,
				});
			}
		});

		const terminalDataListener = (
			_event: unknown,
			message: TerminalMessage,
		) => {
			if (message.id === terminalIdRef.current) {
				term.write(message.data);
			}
		};

		window.ipcRenderer.on("terminal-on-data", terminalDataListener);

		const cleanup = () => {
			window.ipcRenderer.off("terminal-on-data", terminalDataListener);
			if (terminalIdRef.current) {
				window.ipcRenderer.send("terminal-kill", terminalIdRef.current);
			}
		};

		return { term, terminalDataListener, cleanup };
	}

	return (
		<div
			className={`transition-all duration-300 ${hidden ? "h-0 w-0 invisible" : "h-full w-full"} ${className}`}
		>
			<div
				ref={terminalRef}
				className={`h-full w-full p-2 transition-opacity duration-200 ${hidden ? "opacity-0" : "opacity-100 delay-300"}`}
			/>
		</div>
	);
}
