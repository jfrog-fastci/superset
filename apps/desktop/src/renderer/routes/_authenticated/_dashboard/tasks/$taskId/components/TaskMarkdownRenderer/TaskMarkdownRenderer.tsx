import { Blockquote } from "@tiptap/extension-blockquote";
import { Bold } from "@tiptap/extension-bold";
import { BulletList } from "@tiptap/extension-bullet-list";
import { Code } from "@tiptap/extension-code";
import { CodeBlock } from "@tiptap/extension-code-block";
import { Document } from "@tiptap/extension-document";
import { HardBreak } from "@tiptap/extension-hard-break";
import { Heading } from "@tiptap/extension-heading";
import { HorizontalRule } from "@tiptap/extension-horizontal-rule";
import Image from "@tiptap/extension-image";
import { Italic } from "@tiptap/extension-italic";
import Link from "@tiptap/extension-link";
import { ListItem } from "@tiptap/extension-list-item";
import { OrderedList } from "@tiptap/extension-ordered-list";
import { Paragraph } from "@tiptap/extension-paragraph";
import Placeholder from "@tiptap/extension-placeholder";
import { Strike } from "@tiptap/extension-strike";
import { Text } from "@tiptap/extension-text";
import { EditorContent, useEditor } from "@tiptap/react";
import { env } from "renderer/env.renderer";
import { Markdown } from "tiptap-markdown";

const LINEAR_IMAGE_HOST = "uploads.linear.app";

function isLinearImageUrl(src: string): boolean {
	try {
		const url = new URL(src);
		return url.host === LINEAR_IMAGE_HOST;
	} catch {
		return false;
	}
}

function getLinearProxyUrl(linearUrl: string): string {
	const proxyUrl = new URL(`${env.NEXT_PUBLIC_API_URL}/api/proxy/linear-image`);
	proxyUrl.searchParams.set("url", linearUrl);
	return proxyUrl.toString();
}

const LinearImage = Image.extend({
	addAttributes() {
		return {
			...this.parent?.(),
			src: {
				default: null,
				parseHTML: (element) => element.getAttribute("src"),
				renderHTML: (attributes) => {
					const src = attributes.src;
					if (!src) return { src: null };
					const proxiedSrc = isLinearImageUrl(src)
						? getLinearProxyUrl(src)
						: src;
					return {
						src: proxiedSrc,
						crossorigin: isLinearImageUrl(src) ? "use-credentials" : undefined,
					};
				},
			},
		};
	},
});

const HEADING_CLASSES: Record<number, string> = {
	1: "text-3xl font-bold leading-tight mt-0 mb-3",
	2: "text-2xl font-semibold leading-snug mt-6 mb-2",
	3: "text-xl font-semibold leading-snug mt-5 mb-2",
	4: "text-base font-semibold leading-normal mt-4 mb-2",
	5: "text-base font-semibold leading-normal mt-4 mb-2",
	6: "text-base font-semibold leading-normal mt-4 mb-2",
};

const StyledHeading = Heading.extend({
	renderHTML({ node, HTMLAttributes }) {
		const level = node.attrs.level as number;
		const classes = HEADING_CLASSES[level] || HEADING_CLASSES[1];
		return [`h${level}`, { ...HTMLAttributes, class: classes }, 0];
	},
});

interface TaskMarkdownRendererProps {
	content: string;
	onSave: (markdown: string) => void;
}

export function TaskMarkdownRenderer({
	content,
	onSave,
}: TaskMarkdownRendererProps) {
	const editor = useEditor({
		extensions: [
			Document,
			Text,
			Paragraph.configure({
				HTMLAttributes: { class: "mt-0 mb-3 leading-relaxed" },
			}),
			StyledHeading.configure({ levels: [1, 2, 3, 4, 5, 6] }),
			Bold.configure({
				HTMLAttributes: { class: "font-semibold" },
			}),
			Italic.configure({
				HTMLAttributes: { class: "italic" },
			}),
			Strike.configure({
				HTMLAttributes: { class: "line-through" },
			}),
			Code.configure({
				HTMLAttributes: {
					class: "font-mono text-sm px-1 py-0.5 rounded bg-muted",
				},
			}),
			CodeBlock.configure({
				HTMLAttributes: {
					class:
						"my-3 p-3 rounded-md bg-muted overflow-x-auto font-mono text-sm",
				},
			}),
			BulletList.configure({
				HTMLAttributes: { class: "mt-0 mb-3 pl-6 list-disc" },
			}),
			OrderedList.configure({
				HTMLAttributes: { class: "mt-0 mb-3 pl-6 list-decimal" },
			}),
			ListItem.configure({
				HTMLAttributes: { class: "mb-1 leading-relaxed" },
			}),
			Blockquote.configure({
				HTMLAttributes: {
					class: "my-3 pl-4 border-l-2 border-border text-muted-foreground",
				},
			}),
			HorizontalRule.configure({
				HTMLAttributes: { class: "my-6 border-none border-t border-border" },
			}),
			HardBreak,
			Link.configure({
				openOnClick: false,
				HTMLAttributes: { class: "text-primary underline" },
			}),
			LinearImage.configure({
				HTMLAttributes: { class: "max-w-full h-auto rounded-md my-3" },
			}),
			Placeholder.configure({
				placeholder: "Add description...",
				emptyNodeClass:
					"first:before:text-muted-foreground first:before:float-left first:before:h-0 first:before:pointer-events-none first:before:content-[attr(data-placeholder)]",
			}),
			Markdown.configure({
				html: true,
				transformPastedText: true,
				transformCopiedText: true,
			}),
		],
		content,
		editorProps: {
			attributes: {
				class: "focus:outline-none min-h-[100px]",
			},
		},
		onBlur: ({ editor }) => {
			const storage = editor.storage as unknown as Record<
				string,
				{ getMarkdown?: () => string }
			>;
			const markdown = storage.markdown?.getMarkdown?.() ?? "";
			onSave(markdown);
		},
	});

	return <EditorContent editor={editor} className="w-full" />;
}
