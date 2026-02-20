import { chatServiceTrpc } from "@superset/chat/client";
import {
	PromptInputButton,
	usePromptInputController,
} from "@superset/ui/ai-elements/prompt-input";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@superset/ui/command";
import {
	Popover,
	PopoverAnchor,
	PopoverContent,
	PopoverTrigger,
} from "@superset/ui/popover";
import { cn } from "@superset/ui/utils";
import Fuse from "fuse.js";
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { HiMiniAtSymbol } from "react-icons/hi2";
import { LuSquareCheck } from "react-icons/lu";
import { apiTrpcClient } from "renderer/lib/api-trpc-client";
import { getFileIcon } from "renderer/screens/main/components/WorkspaceView/RightSidebar/FilesView/utils";

const MENTION_SEARCH_LIMIT = 20;

function findAtTriggerIndex(value: string, prevValue: string): number {
	if (value.length !== prevValue.length + 1) return -1;
	for (let i = 0; i < value.length; i++) {
		if (value[i] !== prevValue[i]) {
			if (value[i] !== "@") return -1;
			const charBefore = value[i - 1];
			if (
				charBefore === undefined ||
				charBefore === " " ||
				charBefore === "\n"
			) {
				return i;
			}
			return -1;
		}
	}
	return -1;
}

function getDirectoryPath(relativePath: string): string {
	const lastSlash = relativePath.lastIndexOf("/");
	if (lastSlash === -1) return "";
	return relativePath.slice(0, lastSlash);
}

interface MentionContextValue {
	open: boolean;
	setOpen: (open: boolean) => void;
}

const MentionContext = createContext<MentionContextValue | null>(null);

interface TaskItem {
	id: string;
	slug: string;
	title: string;
}

export function MentionProvider({
	cwd,
	organizationId,
	children,
}: {
	cwd: string;
	organizationId: string | null;
	children: ReactNode;
}) {
	const [open, setOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [triggerIndex, setTriggerIndex] = useState(-1);
	const { textInput } = usePromptInputController();
	const prevValueRef = useRef(textInput.value);

	useEffect(() => {
		const prev = prevValueRef.current;
		prevValueRef.current = textInput.value;
		const idx = findAtTriggerIndex(textInput.value, prev);
		if (idx !== -1) {
			setTriggerIndex(idx);
			setOpen(true);
		}
	}, [textInput.value]);

	// Detect @task: prefix for task search mode
	const isTaskSearch = searchQuery.startsWith("task:");
	const taskQuery = isTaskSearch ? searchQuery.slice(5) : "";
	const fileQuery = isTaskSearch ? "" : searchQuery;

	// File search via chatService (IPC to main process)
	const { data: fileResults } = chatServiceTrpc.workspace.searchFiles.useQuery(
		{
			rootPath: cwd,
			query: fileQuery,
			includeHidden: false,
			limit: MENTION_SEARCH_LIMIT,
		},
		{
			enabled: open && fileQuery.length > 0 && !!cwd,
			staleTime: 1000,
			placeholderData: (previous) => previous ?? [],
		},
	);

	// Task search — client-side with fuse.js over org tasks
	const [orgTasks, setOrgTasks] = useState<TaskItem[]>([]);
	useEffect(() => {
		if (!organizationId) return;
		apiTrpcClient.task.byOrganization
			.query(organizationId)
			.then((result) => {
				setOrgTasks(
					result.map((t) => ({ id: t.id, slug: t.slug, title: t.title })),
				);
			})
			.catch(() => {});
	}, [organizationId]);

	const taskResults = useMemo(() => {
		if (!isTaskSearch || !orgTasks.length) return [];
		if (!taskQuery) return orgTasks.slice(0, MENTION_SEARCH_LIMIT);
		const fuse = new Fuse(orgTasks, {
			keys: [
				{ name: "slug", weight: 3 },
				{ name: "title", weight: 2 },
			],
			threshold: 0.4,
			ignoreLocation: true,
		});
		return fuse
			.search(taskQuery, { limit: MENTION_SEARCH_LIMIT })
			.map((r) => r.item);
	}, [orgTasks, taskQuery, isTaskSearch]);

	const handleSelectFile = (relativePath: string) => {
		const current = textInput.value;
		const before = current.slice(0, triggerIndex);
		const after = current.slice(triggerIndex + 1);
		textInput.setInput(`${before}@${relativePath} ${after}`);
		setSearchQuery("");
		setTriggerIndex(-1);
		setOpen(false);
	};

	const handleSelectTask = (slug: string) => {
		const current = textInput.value;
		const before = current.slice(0, triggerIndex);
		const after = current.slice(triggerIndex + 1);
		textInput.setInput(`${before}@task:${slug} ${after}`);
		setSearchQuery("");
		setTriggerIndex(-1);
		setOpen(false);
	};

	const handleOpenChange = (nextOpen: boolean) => {
		setOpen(nextOpen);
		if (!nextOpen) setSearchQuery("");
	};

	const hasFileResults = (fileResults ?? []).length > 0;
	const hasTaskResults = taskResults.length > 0;
	const hasResults = hasFileResults || hasTaskResults;

	return (
		<MentionContext.Provider value={{ open, setOpen }}>
			<Popover open={open} onOpenChange={handleOpenChange}>
				{children}
				<PopoverContent
					side="top"
					align="start"
					sideOffset={0}
					className="w-80 p-0 text-xs"
				>
					<Command shouldFilter={false}>
						<CommandInput
							placeholder="Search files or type task:SLUG..."
							value={searchQuery}
							onValueChange={setSearchQuery}
						/>
						<CommandList className="max-h-[200px] [&::-webkit-scrollbar]:hidden">
							{!hasResults && (
								<CommandEmpty className="px-2 py-3 text-left text-xs text-muted-foreground">
									{searchQuery.length === 0
										? "Type to search files, or task: for tasks..."
										: "No results found."}
								</CommandEmpty>
							)}
							{hasFileResults && (
								<CommandGroup heading="Files">
									{(fileResults ?? []).map((file) => {
										const dirPath = getDirectoryPath(file.relativePath);
										const { icon: Icon, color } = getFileIcon(
											file.name,
											false,
											false,
										);
										return (
											<CommandItem
												key={file.id}
												value={file.relativePath}
												onSelect={() => handleSelectFile(file.relativePath)}
											>
												<Icon className={cn("size-3.5 shrink-0", color)} />
												<span className="truncate text-xs">{file.name}</span>
												{dirPath && (
													<span className="min-w-0 truncate font-mono text-xs text-muted-foreground">
														{dirPath}
													</span>
												)}
											</CommandItem>
										);
									})}
								</CommandGroup>
							)}
							{hasTaskResults && (
								<CommandGroup heading="Tasks">
									{taskResults.map((task) => (
										<CommandItem
											key={task.id}
											value={task.slug}
											onSelect={() => handleSelectTask(task.slug)}
										>
											<LuSquareCheck className="size-3.5 shrink-0 text-muted-foreground" />
											<span className="truncate text-xs font-medium">
												{task.slug}
											</span>
											<span className="min-w-0 truncate text-xs text-muted-foreground">
												{task.title}
											</span>
										</CommandItem>
									))}
								</CommandGroup>
							)}
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>
		</MentionContext.Provider>
	);
}

export function MentionAnchor({ children }: { children: ReactNode }) {
	return <PopoverAnchor asChild>{children}</PopoverAnchor>;
}

export function MentionTrigger() {
	const ctx = useContext(MentionContext);
	return (
		<PopoverTrigger asChild>
			<PromptInputButton onClick={() => ctx?.setOpen(!ctx.open)}>
				<HiMiniAtSymbol className="size-4" />
			</PromptInputButton>
		</PopoverTrigger>
	);
}
