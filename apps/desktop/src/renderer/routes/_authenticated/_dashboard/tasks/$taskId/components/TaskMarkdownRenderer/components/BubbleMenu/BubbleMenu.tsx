import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@superset/ui/dropdown-menu";
import type { Editor } from "@tiptap/react";
import { BubbleMenu as TiptapBubbleMenu } from "@tiptap/react/menus";
import { useState } from "react";
import {
	HiOutlineBold,
	HiOutlineCodeBracket,
	HiOutlineItalic,
	HiOutlineLink,
	HiOutlineStrikethrough,
} from "react-icons/hi2";
import { RiDoubleQuotesL, RiUnderline } from "react-icons/ri";
import { TbChevronDown } from "react-icons/tb";

interface BubbleMenuProps {
	editor: Editor;
}

const HEADING_OPTIONS = [
	{ label: "Regular text", level: 0 },
	{ label: "Heading 1", level: 1 },
	{ label: "Heading 2", level: 2 },
	{ label: "Heading 3", level: 3 },
];

export function BubbleMenu({ editor }: BubbleMenuProps) {
	const [headingOpen, setHeadingOpen] = useState(false);

	const getCurrentHeading = () => {
		for (let i = 1; i <= 3; i++) {
			if (editor.isActive("heading", { level: i })) {
				return `H${i}`;
			}
		}
		return "Text";
	};

	const setHeading = (level: number) => {
		if (level === 0) {
			editor.chain().focus().setParagraph().run();
		} else {
			editor
				.chain()
				.focus()
				.toggleHeading({ level: level as 1 | 2 | 3 })
				.run();
		}
		setHeadingOpen(false);
	};

	const toggleLink = () => {
		if (editor.isActive("link")) {
			editor.chain().focus().unsetLink().run();
		} else {
			const url = window.prompt("Enter URL:");
			if (url) {
				editor.chain().focus().setLink({ href: url }).run();
			}
		}
	};

	return (
		<TiptapBubbleMenu
			editor={editor}
			className="flex items-center gap-0.5 bg-popover border border-border rounded-lg shadow-lg p-1"
		>
			{/* Heading Dropdown */}
			<DropdownMenu open={headingOpen} onOpenChange={setHeadingOpen}>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						className="flex items-center gap-1 h-7 px-2 text-sm rounded hover:bg-accent transition-colors"
					>
						{getCurrentHeading()}
						<TbChevronDown className="w-3 h-3" />
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" className="w-36">
					{HEADING_OPTIONS.map((option) => (
						<DropdownMenuItem
							key={option.level}
							onSelect={() => setHeading(option.level)}
							className="flex items-center justify-between"
						>
							<span>{option.label}</span>
							{(option.level === 0 && !editor.isActive("heading")) ||
							editor.isActive("heading", { level: option.level }) ? (
								<span className="text-xs">✓</span>
							) : null}
						</DropdownMenuItem>
					))}
				</DropdownMenuContent>
			</DropdownMenu>

			<div className="w-px h-5 bg-border mx-1" />

			{/* Bold */}
			<button
				type="button"
				onClick={() => editor.chain().focus().toggleBold().run()}
				className={`h-7 w-7 flex items-center justify-center rounded hover:bg-accent transition-colors ${
					editor.isActive("bold") ? "bg-accent" : ""
				}`}
				title="Bold"
			>
				<HiOutlineBold className="w-4 h-4" />
			</button>

			{/* Italic */}
			<button
				type="button"
				onClick={() => editor.chain().focus().toggleItalic().run()}
				className={`h-7 w-7 flex items-center justify-center rounded hover:bg-accent transition-colors ${
					editor.isActive("italic") ? "bg-accent" : ""
				}`}
				title="Italic"
			>
				<HiOutlineItalic className="w-4 h-4" />
			</button>

			{/* Underline */}
			<button
				type="button"
				onClick={() => editor.chain().focus().toggleUnderline().run()}
				className={`h-7 w-7 flex items-center justify-center rounded hover:bg-accent transition-colors ${
					editor.isActive("underline") ? "bg-accent" : ""
				}`}
				title="Underline"
			>
				<RiUnderline className="w-4 h-4" />
			</button>

			{/* Strikethrough */}
			<button
				type="button"
				onClick={() => editor.chain().focus().toggleStrike().run()}
				className={`h-7 w-7 flex items-center justify-center rounded hover:bg-accent transition-colors ${
					editor.isActive("strike") ? "bg-accent" : ""
				}`}
				title="Strikethrough"
			>
				<HiOutlineStrikethrough className="w-4 h-4" />
			</button>

			<div className="w-px h-5 bg-border mx-1" />

			{/* Link */}
			<button
				type="button"
				onClick={toggleLink}
				className={`h-7 w-7 flex items-center justify-center rounded hover:bg-accent transition-colors ${
					editor.isActive("link") ? "bg-accent" : ""
				}`}
				title="Link"
			>
				<HiOutlineLink className="w-4 h-4" />
			</button>

			{/* Code */}
			<button
				type="button"
				onClick={() => editor.chain().focus().toggleCode().run()}
				className={`h-7 w-7 flex items-center justify-center rounded hover:bg-accent transition-colors ${
					editor.isActive("code") ? "bg-accent" : ""
				}`}
				title="Inline Code"
			>
				<HiOutlineCodeBracket className="w-4 h-4" />
			</button>

			{/* Blockquote */}
			<button
				type="button"
				onClick={() => editor.chain().focus().toggleBlockquote().run()}
				className={`h-7 w-7 flex items-center justify-center rounded hover:bg-accent transition-colors ${
					editor.isActive("blockquote") ? "bg-accent" : ""
				}`}
				title="Quote"
			>
				<RiDoubleQuotesL className="w-4 h-4" />
			</button>
		</TiptapBubbleMenu>
	);
}
