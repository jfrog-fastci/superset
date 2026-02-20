import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LuArrowLeft } from "react-icons/lu";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { CloneRepoTab } from "./components/CloneRepoTab";
import { EmptyRepoTab } from "./components/EmptyRepoTab";
import { PathSelector } from "./components/PathSelector";
import { TemplateRepoTab } from "./components/TemplateRepoTab";
import type { NewProjectMode } from "./constants";

export const Route = createFileRoute(
	"/_authenticated/_onboarding/new-project/",
)({
	component: NewProjectPage,
});

const TABS: { mode: NewProjectMode; label: string }[] = [
	{ mode: "empty", label: "Empty" },
	{ mode: "clone", label: "Clone" },
	{ mode: "template", label: "Template" },
];

function NewProjectPage() {
	const navigate = useNavigate();
	const [mode, setMode] = useState<NewProjectMode>("empty");
	const [error, setError] = useState<string | null>(null);
	const [parentDir, setParentDir] = useState("");

	const { data: savedPath } =
		electronTrpc.settings.getDefaultProjectPath.useQuery();
	const { data: homeDir } = electronTrpc.window.getHomeDir.useQuery();

	useEffect(() => {
		if (parentDir) return;
		if (savedPath) {
			setParentDir(savedPath);
		} else if (homeDir) {
			setParentDir(`${homeDir}/Projects`);
		}
	}, [savedPath, homeDir, parentDir]);

	return (
		<div className="flex flex-1 items-center justify-center">
			<div className="w-full max-w-md px-6">
				<div className="flex items-center gap-2 mb-6">
					<button
						type="button"
						onClick={() => navigate({ to: "/", replace: true })}
						className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
					>
						<LuArrowLeft className="size-4" />
					</button>
					<h1 className="text-lg font-semibold text-foreground">New Project</h1>
				</div>

				<div className="mb-4">
					<div className="flex p-0.5 bg-muted rounded-md">
						{TABS.map((tab) => (
							<button
								key={tab.mode}
								type="button"
								onClick={() => {
									setMode(tab.mode);
									setError(null);
								}}
								className={`flex-1 px-3 py-1 text-xs font-medium rounded-sm transition-colors ${
									mode === tab.mode
										? "bg-background text-foreground shadow-sm"
										: "text-muted-foreground hover:text-foreground"
								}`}
							>
								{tab.label}
							</button>
						))}
					</div>
				</div>

				<div className="mb-4">
					<PathSelector value={parentDir} onChange={setParentDir} />
				</div>

				{mode === "empty" && (
					<EmptyRepoTab onError={setError} parentDir={parentDir} />
				)}
				{mode === "clone" && (
					<CloneRepoTab onError={setError} parentDir={parentDir} />
				)}
				{mode === "template" && (
					<TemplateRepoTab onError={setError} parentDir={parentDir} />
				)}

				{error && (
					<div className="mt-4 rounded-md px-4 py-3 bg-destructive/10 border border-destructive/20">
						<span className="text-sm text-destructive">{error}</span>
					</div>
				)}
			</div>
		</div>
	);
}
