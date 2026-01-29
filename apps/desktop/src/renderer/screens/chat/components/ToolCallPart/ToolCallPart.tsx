import type { BetaToolUseBlock, ToolResult } from "@superset/ai-chat/stream";
import { Badge } from "@superset/ui/badge";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@superset/ui/collapsible";
import { cn } from "@superset/ui/utils";
import { useState } from "react";
import { LuChevronRight } from "react-icons/lu";

interface ToolCallPartProps {
	block: BetaToolUseBlock;
	result?: ToolResult;
}

function getToolState(result?: ToolResult) {
	if (!result) return { label: "Running", variant: "secondary" as const };
	if (result.isError)
		return { label: "Error", variant: "destructive" as const };
	return { label: "Completed", variant: "default" as const };
}

export function ToolCallPart({ block, result }: ToolCallPartProps) {
	const [isOpen, setIsOpen] = useState(false);
	const state = getToolState(result);

	return (
		<Collapsible open={isOpen} onOpenChange={setIsOpen}>
			<CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm hover:bg-muted transition-colors">
				<LuChevronRight
					className={cn(
						"h-4 w-4 shrink-0 transition-transform",
						isOpen && "rotate-90",
					)}
				/>
				<span className="font-mono text-xs font-medium">{block.name}</span>
				<Badge variant={state.variant} className="ml-auto text-xs">
					{state.label}
				</Badge>
			</CollapsibleTrigger>
			<CollapsibleContent>
				<div className="mt-1 space-y-2 rounded-md border border-border bg-muted/30 p-3">
					{block.input != null &&
						typeof block.input === "object" &&
						Object.keys(block.input).length > 0 && (
							<div>
								<p className="mb-1 text-xs font-medium text-muted-foreground">
									Input
								</p>
								<pre className="overflow-x-auto rounded bg-background p-2 text-xs">
									{JSON.stringify(block.input, null, 2)}
								</pre>
							</div>
						)}
					{result && (
						<div>
							<p className="mb-1 text-xs font-medium text-muted-foreground">
								Output
							</p>
							<pre
								className={cn(
									"overflow-x-auto rounded p-2 text-xs",
									result.isError
										? "bg-destructive/10 text-destructive"
										: "bg-background",
								)}
							>
								{result.output || "(empty)"}
							</pre>
						</div>
					)}
				</div>
			</CollapsibleContent>
		</Collapsible>
	);
}
