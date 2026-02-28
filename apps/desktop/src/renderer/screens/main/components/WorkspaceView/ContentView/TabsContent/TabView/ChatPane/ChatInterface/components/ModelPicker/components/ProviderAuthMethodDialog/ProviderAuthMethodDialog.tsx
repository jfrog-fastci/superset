import { Button } from "@superset/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@superset/ui/dialog";

type AuthProvider = "anthropic" | "openai";

interface ProviderAuthMethodDialogProps {
	open: boolean;
	provider: AuthProvider | null;
	isPending: boolean;
	onOpenChange: (open: boolean) => void;
	onSelectApiKey: () => void;
	onSelectOAuth: () => void;
}

export function ProviderAuthMethodDialog({
	open,
	provider,
	isPending,
	onOpenChange,
	onSelectApiKey,
	onSelectOAuth,
}: ProviderAuthMethodDialogProps) {
	const providerName =
		provider === "anthropic"
			? "Anthropic"
			: provider === "openai"
				? "OpenAI"
				: "Provider";

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{`Connect ${providerName}`}</DialogTitle>
					<DialogDescription>
						Choose an authentication method.
					</DialogDescription>
				</DialogHeader>

				<div className="grid gap-2">
					<Button
						type="button"
						variant="outline"
						onClick={onSelectApiKey}
						disabled={isPending || !provider}
					>
						Use API key
					</Button>
					<Button
						type="button"
						variant="outline"
						onClick={onSelectOAuth}
						disabled={isPending || !provider}
					>
						Use OAuth
					</Button>
				</div>

				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isPending}
					>
						Close
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
