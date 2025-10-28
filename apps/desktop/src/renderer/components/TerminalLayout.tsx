import { useEffect, useState } from "react";
import type { LayoutNode, TerminalPane, TerminalSplit } from "shared/types";
import Terminal from "./Terminal";

interface TerminalLayoutProps {
    layout: LayoutNode;
    workingDirectory: string;
}

interface TerminalInstanceProps {
    pane: TerminalPane;
    workingDirectory: string;
}

function TerminalInstance({ pane, workingDirectory }: TerminalInstanceProps) {
    const [terminalId, setTerminalId] = useState<string | null>(null);

    useEffect(() => {
        // Create terminal instance
        const createTerminal = async () => {
            try {
                const id = await window.ipcRenderer.invoke<string>("terminal-create", {
                    cwd: workingDirectory,
                });
                setTerminalId(id);

                // Execute startup command if specified
                if (pane.command && id) {
                    setTimeout(() => {
                        window.ipcRenderer.invoke("terminal-execute-command", {
                            id,
                            command: pane.command,
                        });
                    }, 500); // Small delay to ensure terminal is ready
                }
            } catch (error) {
                console.error("Failed to create terminal:", error);
            }
        };

        createTerminal();

        // Cleanup
        return () => {
            if (terminalId) {
                window.ipcRenderer.invoke("terminal-kill", terminalId);
            }
        };
    }, [workingDirectory, pane.command]);

    return (
        <div className="w-full h-full">
            <Terminal />
        </div>
    );
}

interface SplitLayoutProps {
    split: TerminalSplit;
    workingDirectory: string;
}

function SplitLayout({ split, workingDirectory }: SplitLayoutProps) {
    const totalRatio = split.ratio.reduce((sum, r) => sum + r, 0);
    const isVertical = split.direction === "vertical";

    return (
        <div
            className={`flex ${isVertical ? "flex-row" : "flex-col"} w-full h-full gap-1`}
        >
            {split.children.map((child, index) => {
                const flexBasis = `${(split.ratio[index] / totalRatio) * 100}%`;

                return (
                    <div
                        key={index}
                        style={{ flexBasis }}
                        className="grow shrink overflow-hidden rounded border border-neutral-800"
                    >
                        <LayoutNodeRenderer
                            node={child}
                            workingDirectory={workingDirectory}
                        />
                    </div>
                );
            })}
        </div>
    );
}

interface LayoutNodeRendererProps {
    node: LayoutNode;
    workingDirectory: string;
}

function LayoutNodeRenderer({
    node,
    workingDirectory,
}: LayoutNodeRendererProps) {
    if (node.type === "pane") {
        return <TerminalInstance pane={node} workingDirectory={workingDirectory} />;
    }

    return <SplitLayout split={node} workingDirectory={workingDirectory} />;
}

export default function TerminalLayout({
    layout,
    workingDirectory,
}: TerminalLayoutProps) {
    return (
        <div className="w-full h-full">
            <LayoutNodeRenderer node={layout} workingDirectory={workingDirectory} />
        </div>
    );
}
