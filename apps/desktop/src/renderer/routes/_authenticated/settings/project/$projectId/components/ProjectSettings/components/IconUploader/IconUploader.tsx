import { Button } from "@superset/ui/button";
import { cn } from "@superset/ui/utils";
import { useCallback, useRef, useState } from "react";
import { HiOutlinePhoto, HiXMark } from "react-icons/hi2";
import { LuUpload } from "react-icons/lu";
import { processIconFile } from "./utils";

interface IconUploaderProps {
	projectId: string;
	projectName: string;
	iconUrl: string | null; // Auto-discovered
	iconOverride: string | null; // User-uploaded
	githubOwner: string | null;
	onIconChange: (icon: string | null) => void;
	isPending?: boolean;
}

function getGitHubAvatarUrl(owner: string): string {
	return `https://github.com/${owner}.png?size=64`;
}

export function IconUploader({
	projectName,
	iconUrl,
	iconOverride,
	githubOwner,
	onIconChange,
	isPending = false,
}: IconUploaderProps) {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [isDragOver, setIsDragOver] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isProcessing, setIsProcessing] = useState(false);

	// Determine which icon to show
	const effectiveIcon = iconOverride || iconUrl;
	const hasCustomIcon = !!iconOverride;
	const hasDiscoveredIcon = !!iconUrl && !iconOverride;

	const handleFileSelect = useCallback(
		async (file: File) => {
			setError(null);
			setIsProcessing(true);

			try {
				const processedIcon = await processIconFile(file);
				onIconChange(processedIcon);
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to process file");
			} finally {
				setIsProcessing(false);
			}
		},
		[onIconChange],
	);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragOver(true);
	}, []);

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragOver(false);
	}, []);

	const handleDrop = useCallback(
		async (e: React.DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
			setIsDragOver(false);

			const files = Array.from(e.dataTransfer.files);
			const imageFile = files.find((f) => f.type.startsWith("image/"));

			if (imageFile) {
				await handleFileSelect(imageFile);
			}
		},
		[handleFileSelect],
	);

	const handleInputChange = useCallback(
		async (e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (file) {
				await handleFileSelect(file);
			}
			// Reset input so same file can be selected again
			e.target.value = "";
		},
		[handleFileSelect],
	);

	const handleRemoveIcon = useCallback(() => {
		setError(null);
		onIconChange(null);
	}, [onIconChange]);

	const handleClickUpload = () => {
		fileInputRef.current?.click();
	};

	const firstLetter = projectName.charAt(0).toUpperCase();
	const isLoading = isPending || isProcessing;

	return (
		<div className="space-y-4">
			{/* Current Icon Preview */}
			<div className="flex items-start gap-4">
				{/* Preview */}
				<div
					className={cn(
						"relative size-16 rounded-lg overflow-hidden flex-shrink-0 border border-border",
						"flex items-center justify-center bg-muted",
					)}
				>
					{effectiveIcon ? (
						<img
							src={effectiveIcon}
							alt={`${projectName} icon`}
							className="size-full object-cover"
						/>
					) : githubOwner ? (
						<img
							src={getGitHubAvatarUrl(githubOwner)}
							alt={`${projectName} avatar`}
							className="size-full object-cover"
						/>
					) : (
						<span className="text-2xl font-medium text-muted-foreground">
							{firstLetter}
						</span>
					)}
				</div>

				{/* Info and Actions */}
				<div className="flex-1 min-w-0 space-y-2">
					<div className="text-sm">
						{hasCustomIcon && (
							<span className="text-muted-foreground">
								Custom icon uploaded
							</span>
						)}
						{hasDiscoveredIcon && (
							<span className="text-muted-foreground">
								Auto-discovered from project
							</span>
						)}
						{!effectiveIcon && githubOwner && (
							<span className="text-muted-foreground">Using GitHub avatar</span>
						)}
						{!effectiveIcon && !githubOwner && (
							<span className="text-muted-foreground">Using default icon</span>
						)}
					</div>

					<div className="flex gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={handleClickUpload}
							disabled={isLoading}
							className="gap-1.5"
						>
							<LuUpload className="h-4 w-4" />
							{effectiveIcon ? "Change Icon" : "Upload Icon"}
						</Button>

						{hasCustomIcon && (
							<Button
								variant="ghost"
								size="sm"
								onClick={handleRemoveIcon}
								disabled={isLoading}
								className="gap-1.5 text-muted-foreground hover:text-foreground"
							>
								<HiXMark className="h-4 w-4" />
								Remove
							</Button>
						)}
					</div>
				</div>
			</div>

			{/* Drop Zone */}
			{/* biome-ignore lint/a11y/useSemanticElements: Drop zone wrapper for drag-and-drop functionality */}
			<div
				role="button"
				tabIndex={0}
				onDragOver={handleDragOver}
				onDragLeave={handleDragLeave}
				onDrop={handleDrop}
				onClick={handleClickUpload}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						handleClickUpload();
					}
				}}
				className={cn(
					"relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
					isDragOver
						? "border-primary bg-primary/5"
						: "border-border hover:border-muted-foreground/50",
					isLoading && "opacity-50 pointer-events-none",
				)}
			>
				<div className="flex flex-col items-center gap-2">
					<HiOutlinePhoto className="h-8 w-8 text-muted-foreground" />
					<div className="text-sm text-muted-foreground">
						<span className="font-medium text-foreground">Click to upload</span>{" "}
						or drag and drop
					</div>
					<div className="text-xs text-muted-foreground">
						PNG, JPG, GIF, SVG, WebP, or ICO (max 500KB)
					</div>
				</div>

				{isDragOver && (
					<div className="absolute inset-0 flex items-center justify-center bg-primary/10 rounded-lg">
						<div className="flex items-center gap-2 text-primary text-sm font-medium">
							<LuUpload className="h-5 w-5" />
							Drop to upload
						</div>
					</div>
				)}

				{isLoading && (
					<div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-lg">
						<div className="text-sm text-muted-foreground">Processing...</div>
					</div>
				)}
			</div>

			{/* Hidden file input */}
			<input
				ref={fileInputRef}
				type="file"
				accept="image/png,image/jpeg,image/gif,image/svg+xml,image/webp,image/x-icon"
				onChange={handleInputChange}
				className="hidden"
			/>

			{/* Error message */}
			{error && <div className="text-sm text-destructive">{error}</div>}
		</div>
	);
}
