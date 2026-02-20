import { Button } from "@superset/ui/button";
import { XIcon } from "lucide-react";

export interface TaskChipData {
	taskId: string;
	slug: string;
	title: string;
	externalUrl?: string | null;
}

interface TaskChipProps {
	task: TaskChipData;
	onSelect?: (taskId: string) => void;
	onRemove?: (taskId: string) => void;
}

export function TaskChip({ task, onSelect, onRemove }: TaskChipProps) {
	return (
		<div className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/60 px-2 py-1 text-xs">
			<button
				type="button"
				className="inline-flex items-center gap-1 truncate text-left hover:text-foreground"
				onClick={() => onSelect?.(task.taskId)}
			>
				<span className="font-mono text-[11px] text-muted-foreground">
					{task.slug}
				</span>
				<span className="max-w-[220px] truncate text-foreground">
					{task.title}
				</span>
			</button>
			{onRemove ? (
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="size-4 shrink-0 text-muted-foreground hover:text-foreground"
					onClick={() => onRemove(task.taskId)}
				>
					<XIcon className="size-3" />
				</Button>
			) : null}
		</div>
	);
}
