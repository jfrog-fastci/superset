import { Button } from "@superset/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@superset/ui/dialog";
import { Input } from "@superset/ui/input";
import { Label } from "@superset/ui/label";

interface AnthropicApiKeyDialogProps {
	open: boolean;
	apiKey: string;
	errorMessage: string | null;
	isPending: boolean;
	canClearApiKey: boolean;
	onOpenChange: (open: boolean) => void;
	onApiKeyChange: (value: string) => void;
	onSubmit: () => void;
	onClear: () => void;
}

export function AnthropicApiKeyDialog({
	open,
	apiKey,
	errorMessage,
	isPending,
	canClearApiKey,
	onOpenChange,
	onApiKeyChange,
	onSubmit,
	onClear,
}: AnthropicApiKeyDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Connect Anthropic</DialogTitle>
					<DialogDescription>
						Paste your Anthropic API key to enable Claude models in chat.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-2">
					<Label htmlFor="anthropic-api-key">API key</Label>
					<Input
						id="anthropic-api-key"
						type="password"
						placeholder="sk-ant-..."
						value={apiKey}
						onChange={(event) => onApiKeyChange(event.target.value)}
						disabled={isPending}
						className="h-11 font-mono"
					/>
				</div>

				{errorMessage ? (
					<p className="text-destructive text-sm">{errorMessage}</p>
				) : null}

				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isPending}
					>
						Back
					</Button>
					{canClearApiKey ? (
						<Button
							type="button"
							variant="outline"
							onClick={onClear}
							disabled={isPending}
						>
							Clear key
						</Button>
					) : null}
					<Button
						type="button"
						onClick={onSubmit}
						disabled={isPending || apiKey.trim().length === 0}
					>
						{isPending ? "Saving..." : "Save key"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
