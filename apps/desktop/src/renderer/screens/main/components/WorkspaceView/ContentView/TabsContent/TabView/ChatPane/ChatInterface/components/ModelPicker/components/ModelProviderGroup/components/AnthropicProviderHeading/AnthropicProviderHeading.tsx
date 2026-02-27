import { Button } from "@superset/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@superset/ui/tooltip";
import { KeyRoundIcon, Loader2Icon, Settings2Icon } from "lucide-react";

interface AnthropicProviderHeadingProps {
	heading: string;
	isConnected: boolean;
	isOAuthPending: boolean;
	isApiKeyPending: boolean;
	onStartOAuth: () => void;
	onConfigureApiKey: () => void;
}

export function AnthropicProviderHeading({
	heading,
	isConnected,
	isOAuthPending,
	isApiKeyPending,
	onStartOAuth,
	onConfigureApiKey,
}: AnthropicProviderHeadingProps) {
	const oauthTooltipLabel = isConnected
		? "Re-auth Anthropic"
		: "Connect Anthropic with OAuth";
	const apiKeyTooltipLabel = isConnected
		? "Update Anthropic key"
		: "Connect Anthropic API key";
	const disableOAuthButton = isOAuthPending || isApiKeyPending;
	const disableApiKeyButton = isApiKeyPending || isOAuthPending;

	return (
		<div className="text-muted-foreground flex items-center justify-between px-2 py-1.5 text-xs font-medium">
			<span>{heading}</span>
			<div className="flex items-center gap-0.5">
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							aria-label={apiKeyTooltipLabel}
							className="text-muted-foreground hover:text-foreground size-6"
							disabled={disableApiKeyButton}
							onClick={(event) => {
								event.preventDefault();
								event.stopPropagation();
								onConfigureApiKey();
							}}
						>
							{isApiKeyPending ? (
								<Loader2Icon className="size-4 animate-spin" />
							) : (
								<KeyRoundIcon className="size-4" />
							)}
						</Button>
					</TooltipTrigger>
					<TooltipContent side="top" sideOffset={6} showArrow={false}>
						{apiKeyTooltipLabel}
					</TooltipContent>
				</Tooltip>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							aria-label={oauthTooltipLabel}
							className="text-muted-foreground hover:text-foreground size-6"
							disabled={disableOAuthButton}
							onClick={(event) => {
								event.preventDefault();
								event.stopPropagation();
								onStartOAuth();
							}}
						>
							{isOAuthPending ? (
								<Loader2Icon className="size-4 animate-spin" />
							) : (
								<Settings2Icon className="size-4" />
							)}
						</Button>
					</TooltipTrigger>
					<TooltipContent side="top" sideOffset={6} showArrow={false}>
						{oauthTooltipLabel}
					</TooltipContent>
				</Tooltip>
			</div>
		</div>
	);
}
