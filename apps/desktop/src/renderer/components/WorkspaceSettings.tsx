import { useState } from "react";
import type { CreateWorkspaceInput } from "shared/types";

interface WorkspaceSettingsProps {
	onClose: () => void;
	onCreate: (input: CreateWorkspaceInput) => Promise<void>;
}

export default function WorkspaceSettings({
	onClose,
	onCreate,
}: WorkspaceSettingsProps) {
	const [name, setName] = useState("");
	const [repoPath, setRepoPath] = useState("");
	const [branch, setBranch] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setError(null);

		try {
			await onCreate({
				name,
				repoPath,
				branch,
			});
			onClose();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
			<div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
				<div className="flex items-center justify-between mb-4">
					<h2 className="text-xl font-semibold text-white">
						Create New Workspace
					</h2>
					<button
						type="button"
						onClick={onClose}
						className="text-gray-400 hover:text-white"
					>
						<svg
							className="w-6 h-6"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</button>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<label
							htmlFor="name"
							className="block text-sm font-medium text-gray-300 mb-1"
						>
							Workspace Name
						</label>
						<input
							id="name"
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
							placeholder="My Feature Branch"
							required
						/>
					</div>

					<div>
						<label
							htmlFor="repoPath"
							className="block text-sm font-medium text-gray-300 mb-1"
						>
							Repository Path
						</label>
						<input
							id="repoPath"
							type="text"
							value={repoPath}
							onChange={(e) => setRepoPath(e.target.value)}
							className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
							placeholder="/path/to/your/repo"
							required
						/>
						<p className="text-xs text-gray-400 mt-1">
							Path to your main git repository
						</p>
					</div>

					<div>
						<label
							htmlFor="branch"
							className="block text-sm font-medium text-gray-300 mb-1"
						>
							Current Branch
						</label>
						<input
							id="branch"
							type="text"
							value={branch}
							onChange={(e) => setBranch(e.target.value)}
							className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
							placeholder="main"
							required
						/>
						<p className="text-xs text-gray-400 mt-1">
							Current branch in the main repository
						</p>
					</div>

					{error && (
						<div className="p-3 bg-red-900 bg-opacity-50 border border-red-700 rounded text-red-200 text-sm">
							{error}
						</div>
					)}

					<div className="flex justify-end space-x-3 mt-6">
						<button
							type="button"
							onClick={onClose}
							className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
							disabled={loading}
						>
							Cancel
						</button>
						<button
							type="submit"
							className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
							disabled={loading}
						>
							{loading ? "Creating..." : "Create Workspace"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
