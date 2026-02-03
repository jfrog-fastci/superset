import { cn } from "@superset/ui/utils";
import { useState } from "react";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { PROJECT_COLOR_DEFAULT } from "shared/constants/project-colors";

interface ProjectThumbnailProps {
	projectId: string;
	projectName: string;
	projectColor: string;
	githubOwner: string | null;
	iconUrl?: string | null; // Auto-discovered favicon
	iconOverride?: string | null; // User-uploaded icon (takes priority)
	className?: string;
}

function getGitHubAvatarUrl(owner: string): string {
	return `https://github.com/${owner}.png?size=64`;
}

/**
 * Converts a hex color to rgba with the specified alpha.
 */
function hexToRgba(hex: string, alpha: number): string {
	const r = Number.parseInt(hex.slice(1, 3), 16);
	const g = Number.parseInt(hex.slice(3, 5), 16);
	const b = Number.parseInt(hex.slice(5, 7), 16);
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Checks if a color value is a custom hex color (not the "default" value).
 */
function isCustomColor(color: string): boolean {
	return color !== PROJECT_COLOR_DEFAULT && color.startsWith("#");
}

export function ProjectThumbnail({
	projectId,
	projectName,
	projectColor,
	githubOwner,
	iconUrl,
	iconOverride,
	className,
}: ProjectThumbnailProps) {
	const [imageError, setImageError] = useState(false);
	const [iconError, setIconError] = useState(false);

	// Determine which icon to show
	const effectiveIcon = iconOverride || iconUrl;

	// Only fetch GitHub avatar if no icon is set
	const { data: avatarData } = electronTrpc.projects.getGitHubAvatar.useQuery(
		{ id: projectId },
		{
			staleTime: 1000 * 60 * 5,
			refetchOnWindowFocus: false,
			enabled: !effectiveIcon,
		},
	);

	const owner = avatarData?.owner ?? githubOwner;
	const firstLetter = projectName.charAt(0).toUpperCase();
	const hasCustomColor = isCustomColor(projectColor);

	// Border: gray by default, custom color with slight transparency when set
	const borderClasses = cn(
		"border-[1.5px]",
		hasCustomColor ? undefined : "border-border",
	);
	const borderStyle = hasCustomColor
		? { borderColor: hexToRgba(projectColor, 0.6) }
		: undefined;

	// Priority 1: Show project icon (override or discovered)
	if (effectiveIcon && !iconError) {
		return (
			<div
				className={cn(
					"relative size-6 rounded overflow-hidden flex-shrink-0 bg-muted",
					borderClasses,
					className,
				)}
				style={borderStyle}
			>
				<img
					src={effectiveIcon}
					alt={`${projectName} icon`}
					className="size-full object-cover"
					onError={() => setIconError(true)}
				/>
			</div>
		);
	}

	// Priority 2: Show GitHub avatar if available
	if (owner && !imageError) {
		return (
			<div
				className={cn(
					"relative size-6 rounded overflow-hidden flex-shrink-0 bg-muted",
					borderClasses,
					className,
				)}
				style={borderStyle}
			>
				<img
					src={getGitHubAvatarUrl(owner)}
					alt={`${projectName} avatar`}
					className="size-full object-cover"
					onError={() => setImageError(true)}
				/>
			</div>
		);
	}

	// Priority 3: Fallback to first letter
	return (
		<div
			className={cn(
				"size-6 rounded flex items-center justify-center flex-shrink-0",
				"bg-muted text-muted-foreground text-xs font-medium",
				borderClasses,
				className,
			)}
			style={borderStyle}
		>
			{firstLetter}
		</div>
	);
}
