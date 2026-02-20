import { db } from "@superset/db/client";
import {
	chatSessions,
	taskAssets,
	taskComments,
	tasks,
} from "@superset/db/schema";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";

interface BuildLinkedTaskContextOptions {
	sessionId: string;
	taskIds: string[];
}

function escapeXml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&apos;");
}

export async function buildLinkedTaskContext(
	options: BuildLinkedTaskContextOptions,
): Promise<string> {
	const uniqueTaskIds = [...new Set(options.taskIds)];
	if (uniqueTaskIds.length === 0) return "";

	try {
		// Secondary safety gate: resolve org from session, then scope all task lookups.
		const session = await db.query.chatSessions.findFirst({
			where: eq(chatSessions.id, options.sessionId),
			columns: { organizationId: true },
		});

		if (!session) return "";

		const linkedTasks = await db
			.select({
				id: tasks.id,
				slug: tasks.slug,
				title: tasks.title,
				description: tasks.description,
				priority: tasks.priority,
				statusId: tasks.statusId,
				externalUrl: tasks.externalUrl,
			})
			.from(tasks)
			.where(
				and(
					eq(tasks.organizationId, session.organizationId),
					inArray(tasks.id, uniqueTaskIds),
					isNull(tasks.deletedAt),
				),
			);

		if (linkedTasks.length === 0) return "";

		const linkedTaskIds = linkedTasks.map((task) => task.id);

		const [assetRows, commentRows] = await Promise.all([
			db
				.select({
					taskId: taskAssets.taskId,
					blobUrl: taskAssets.blobUrl,
					sourceUrl: taskAssets.sourceUrl,
					sourceKind: taskAssets.sourceKind,
					mimeType: taskAssets.mimeType,
				})
				.from(taskAssets)
				.where(
					and(
						eq(taskAssets.organizationId, session.organizationId),
						inArray(taskAssets.taskId, linkedTaskIds),
					),
				),
			db
				.select({
					taskId: taskComments.taskId,
					body: taskComments.body,
					authorName: taskComments.authorName,
					createdAt: taskComments.createdAt,
					externalUrl: taskComments.externalUrl,
				})
				.from(taskComments)
				.where(
					and(
						eq(taskComments.organizationId, session.organizationId),
						inArray(taskComments.taskId, linkedTaskIds),
						isNull(taskComments.deletedAt),
					),
				)
				.orderBy(asc(taskComments.createdAt)),
		]);

		const assetsByTaskId = new Map<string, typeof assetRows>();
		for (const asset of assetRows) {
			const existing = assetsByTaskId.get(asset.taskId) ?? [];
			existing.push(asset);
			assetsByTaskId.set(asset.taskId, existing);
		}

		const commentsByTaskId = new Map<string, typeof commentRows>();
		for (const comment of commentRows) {
			const existing = commentsByTaskId.get(comment.taskId) ?? [];
			existing.push(comment);
			commentsByTaskId.set(comment.taskId, existing);
		}

		const taskBlocks = linkedTasks.map((task) => {
			const taskAssetsForContext = assetsByTaskId.get(task.id) ?? [];
			const taskCommentsForContext = (
				commentsByTaskId.get(task.id) ?? []
			).slice(-20);

			const assetsBlock =
				taskAssetsForContext.length > 0
					? `<assets>\n${taskAssetsForContext
							.map((asset) => {
								return `<asset kind="${escapeXml(asset.sourceKind)}" blobUrl="${escapeXml(asset.blobUrl)}"${asset.mimeType ? ` mimeType="${escapeXml(asset.mimeType)}"` : ""} sourceUrl="${escapeXml(asset.sourceUrl)}" />`;
							})
							.join("\n")}\n</assets>`
					: "";

			const commentsBlock =
				taskCommentsForContext.length > 0
					? `<comments>\n${taskCommentsForContext
							.map((comment) => {
								const createdAt = comment.createdAt
									? new Date(comment.createdAt).toISOString()
									: "";
								const authorName = comment.authorName ?? "Unknown";
								const body = comment.body.slice(0, 2_000);
								return `<comment author="${escapeXml(authorName)}"${createdAt ? ` createdAt="${escapeXml(createdAt)}"` : ""}${comment.externalUrl ? ` url="${escapeXml(comment.externalUrl)}"` : ""}>${escapeXml(body)}</comment>`;
							})
							.join("\n")}\n</comments>`
					: "";

			return `<task id="${escapeXml(task.id)}" slug="${escapeXml(task.slug)}" title="${escapeXml(task.title)}" priority="${escapeXml(task.priority)}" statusId="${escapeXml(task.statusId)}"${task.externalUrl ? ` externalUrl="${escapeXml(task.externalUrl)}"` : ""}>
<description>${escapeXml(task.description ?? "")}</description>
${assetsBlock}
${commentsBlock}
</task>`;
		});

		return `\n\nThe user linked the following tasks. Use this task context when planning and implementing changes:\n\n${taskBlocks.join("\n\n")}`;
	} catch (error) {
		console.warn("[run-agent] Failed to build linked task context:", error);
		return "";
	}
}
