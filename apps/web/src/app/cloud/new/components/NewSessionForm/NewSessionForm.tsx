"use client";

import { Button } from "@superset/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@superset/ui/card";
import { Input } from "@superset/ui/input";
import { Label } from "@superset/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@superset/ui/select";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LuArrowLeft, LuCloud, LuLoader } from "react-icons/lu";

import { useTRPC } from "@/trpc/react";

interface Repository {
	id: string;
	name: string;
	repoOwner: string;
	repoName: string;
	defaultBranch: string;
}

interface NewSessionFormProps {
	repositories: Repository[];
}

const MODELS = [
	{
		id: "claude-sonnet-4",
		name: "Claude Sonnet 4",
		description: "Balanced performance and speed",
	},
	{
		id: "claude-opus-4",
		name: "Claude Opus 4",
		description: "Most capable, best for complex tasks",
	},
	{
		id: "claude-haiku-3-5",
		name: "Claude Haiku 3.5",
		description: "Fast and affordable",
	},
];

export function NewSessionForm({ repositories }: NewSessionFormProps) {
	const trpc = useTRPC();
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);

	const [selectedRepoId, setSelectedRepoId] = useState<string>("");
	const [title, setTitle] = useState("");
	const [model, setModel] = useState("claude-sonnet-4");
	const [baseBranch, setBaseBranch] = useState("main");

	const createMutation = useMutation(
		trpc.cloudWorkspace.create.mutationOptions({
			onSuccess: (workspace) => {
				if (workspace) {
					router.push(`/cloud/${workspace.sessionId}`);
				}
			},
			onError: (err) => {
				setError(err.message || "Failed to create session");
			},
		}),
	);

	const isCreating = createMutation.isPending;

	const selectedRepo = repositories.find((r) => r.id === selectedRepoId);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		if (!selectedRepo) {
			setError("Please select a repository");
			return;
		}

		const sessionTitle =
			title.trim() || `${selectedRepo.repoOwner}/${selectedRepo.repoName}`;

		createMutation.mutate({
			repositoryId: selectedRepo.id,
			repoOwner: selectedRepo.repoOwner,
			repoName: selectedRepo.repoName,
			title: sessionTitle,
			model: model as "claude-sonnet-4" | "claude-opus-4" | "claude-haiku-3-5",
			baseBranch: baseBranch || selectedRepo.defaultBranch,
		});
	};

	return (
		<div className="min-h-screen bg-background p-8">
			<div className="max-w-xl mx-auto">
				<Button variant="ghost" size="sm" asChild className="mb-6">
					<Link href="/cloud">
						<LuArrowLeft className="size-4 mr-2" />
						Back to Sessions
					</Link>
				</Button>

				<Card>
					<CardHeader>
						<div className="flex items-center gap-2">
							<LuCloud className="size-5" />
							<CardTitle>New Cloud Session</CardTitle>
						</div>
						<CardDescription>
							Create a new cloud session to run Claude in a sandboxed
							environment with full access to your repository.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form onSubmit={handleSubmit} className="space-y-6">
							{error && (
								<div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
									{error}
								</div>
							)}

							{/* Repository selection */}
							<div className="space-y-2">
								<Label htmlFor="repository">Repository *</Label>
								<Select
									value={selectedRepoId}
									onValueChange={setSelectedRepoId}
								>
									<SelectTrigger id="repository">
										<SelectValue placeholder="Select a repository" />
									</SelectTrigger>
									<SelectContent>
										{repositories.length === 0 ? (
											<div className="p-2 text-sm text-muted-foreground">
												No repositories found. Add a repository first.
											</div>
										) : (
											repositories.map((repo) => (
												<SelectItem key={repo.id} value={repo.id}>
													{repo.repoOwner}/{repo.repoName}
												</SelectItem>
											))
										)}
									</SelectContent>
								</Select>
								<p className="text-xs text-muted-foreground">
									The repository Claude will have access to.
								</p>
							</div>

							{/* Title */}
							<div className="space-y-2">
								<Label htmlFor="title">Title (optional)</Label>
								<Input
									id="title"
									value={title}
									onChange={(e) => setTitle(e.target.value)}
									placeholder="e.g., Add user authentication"
								/>
								<p className="text-xs text-muted-foreground">
									A title helps identify the session. If not provided, the
									repository name will be used.
								</p>
							</div>

							{/* Model selection */}
							<div className="space-y-2">
								<Label htmlFor="model">Model</Label>
								<Select value={model} onValueChange={setModel}>
									<SelectTrigger id="model">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{MODELS.map((m) => (
											<SelectItem key={m.id} value={m.id}>
												<div>
													<span className="font-medium">{m.name}</span>
													<span className="text-muted-foreground ml-2 text-xs">
														- {m.description}
													</span>
												</div>
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							{/* Base branch */}
							<div className="space-y-2">
								<Label htmlFor="baseBranch">Base Branch</Label>
								<Input
									id="baseBranch"
									value={baseBranch}
									onChange={(e) => setBaseBranch(e.target.value)}
									placeholder={selectedRepo?.defaultBranch || "main"}
								/>
								<p className="text-xs text-muted-foreground">
									The branch to base the work on. A new branch will be created
									from this.
								</p>
							</div>

							{/* Submit */}
							<div className="flex justify-end gap-3">
								<Button variant="outline" type="button" asChild>
									<Link href="/cloud">Cancel</Link>
								</Button>
								<Button type="submit" disabled={isCreating || !selectedRepoId}>
									{isCreating ? (
										<>
											<LuLoader className="size-4 mr-2 animate-spin" />
											Creating...
										</>
									) : (
										"Create Session"
									)}
								</Button>
							</div>
						</form>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
