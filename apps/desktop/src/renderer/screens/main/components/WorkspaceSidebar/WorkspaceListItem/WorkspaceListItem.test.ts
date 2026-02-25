import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dir = dirname(__filename);

/**
 * Issue #1787: Branch hover popup can cover the context menu on a workspace.
 *
 * Steps to reproduce:
 *   1. Move mouse over a workspace in the sidebar (hover timer starts, 400ms delay)
 *   2. Before 400ms elapses, right-click the workspace (context menu opens immediately)
 *   3. After 400ms, the hover panel appears on top of the already-open context menu
 *
 * Root cause:
 *   `HoverCard` has no controlled `open` prop, so its internal timer fires and shows the
 *   hover panel regardless of whether the `ContextMenu` is currently open. The two
 *   components have no coordination mechanism.
 *
 * Fix:
 *   Track `ContextMenu` open state via its `onOpenChange` callback, and pass a controlled
 *   `open` prop to `HoverCard` that is `false` whenever the context menu is open.
 *
 *   Example:
 *     const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
 *     <HoverCard open={isContextMenuOpen ? false : undefined}>
 *       <ContextMenu onOpenChange={setIsContextMenuOpen}>
 */

describe("WorkspaceListItem — hover card / context menu coordination (issue #1787)", () => {
	test("WorkspaceListItem: HoverCard must have a controlled open prop to prevent covering ContextMenu", () => {
		const source = readFileSync(
			resolve(__dir, "WorkspaceListItem.tsx"),
			"utf-8",
		);

		// The HoverCard must expose a controlled `open` prop so the component can force it
		// closed when the ContextMenu is open. Without this, the 400ms hover timer fires
		// unconditionally and the hover panel covers the context menu.
		//
		// Correct pattern:  <HoverCard open={...} openDelay={...} closeDelay={...}>
		// Current (buggy):  <HoverCard openDelay={...} closeDelay={...}>
		//                    ^-- no `open` prop; cannot be suppressed
		const hoverCardHasControlledOpen = /<HoverCard[^>]*\sopen=\{/.test(source);
		expect(hoverCardHasControlledOpen).toBe(true);
	});

	test("WorkspaceListItem: ContextMenu must emit its open state so HoverCard can react", () => {
		const source = readFileSync(
			resolve(__dir, "WorkspaceListItem.tsx"),
			"utf-8",
		);

		// The ContextMenu must propagate its open/close events via `onOpenChange` so the
		// parent can track state and pass it to HoverCard.
		//
		// Correct pattern:  <ContextMenu onOpenChange={setIsContextMenuOpen}>
		// Current (buggy):  <ContextMenu>
		//                    ^-- no onOpenChange; HoverCard never learns context menu opened
		const contextMenuHasOnOpenChange = /ContextMenu[^>]*onOpenChange=/.test(
			source,
		);
		expect(contextMenuHasOnOpenChange).toBe(true);
	});

	test("CollapsedWorkspaceItem: HoverCard must have a controlled open prop to prevent covering ContextMenu", () => {
		const source = readFileSync(
			resolve(__dir, "CollapsedWorkspaceItem.tsx"),
			"utf-8",
		);

		// Same bug exists in the collapsed variant of the workspace item.
		const hoverCardHasControlledOpen = /<HoverCard[^>]*\sopen=\{/.test(source);
		expect(hoverCardHasControlledOpen).toBe(true);
	});

	test("CollapsedWorkspaceItem: ContextMenu must emit its open state so HoverCard can react", () => {
		const source = readFileSync(
			resolve(__dir, "CollapsedWorkspaceItem.tsx"),
			"utf-8",
		);

		const contextMenuHasOnOpenChange = /ContextMenu[^>]*onOpenChange=/.test(
			source,
		);
		expect(contextMenuHasOnOpenChange).toBe(true);
	});
});
