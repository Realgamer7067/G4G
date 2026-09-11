"use client";

import { useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Bold, Heading2, Heading3, Italic, Link2, List, ListOrdered, Quote, Redo2, Undo2, Unlink } from "lucide-react";
import { cn } from "@/lib/utils/cn";

function ToolButton({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn("rounded-md p-1.5 text-muted transition-colors hover:bg-raised hover:text-frost", active && "bg-raised text-leaf")}
    >
      {children}
    </button>
  );
}

function LinkControl({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const apply = () => {
    const value = url.trim();
    if (!value) editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else if (/^(https?:\/\/|mailto:|\/)/.test(value)) editor.chain().focus().extendMarkRange("link").setLink({ href: value }).run();
    setOpen(false);
  };
  if (!open) {
    return (
      <>
        <ToolButton
          label="Add link"
          active={editor.isActive("link")}
          onClick={() => {
            setUrl((editor.getAttributes("link").href as string | undefined) ?? "https://");
            setOpen(true);
          }}
        >
          <Link2 className="size-4" aria-hidden="true" />
        </ToolButton>
        {editor.isActive("link") && (
          <ToolButton label="Remove link" onClick={() => editor.chain().focus().unsetLink().run()}>
            <Unlink className="size-4" aria-hidden="true" />
          </ToolButton>
        )}
      </>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <input
        aria-label="Link address"
        autoFocus
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            apply();
          }
          if (e.key === "Escape") setOpen(false);
        }}
        className="h-7 w-56 rounded-md border border-line bg-night px-2 text-xs"
        placeholder="https://… or /events"
      />
      <button type="button" onClick={apply} className="rounded-md px-2 py-1 text-xs text-leaf hover:bg-raised">
        Apply
      </button>
    </span>
  );
}

/** Rich text for descriptions. Submits sanitised-on-server HTML through a hidden input named `name`. */
export function RichTextEditor({ id, name, initialHtml, placeholder }: { id: string; name: string; initialHtml: string; placeholder?: string }) {
  const [html, setHtml] = useState(initialHtml);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true, protocols: ["http", "https", "mailto"] },
      }),
      Placeholder.configure({ placeholder: placeholder ?? "Write the details people need…" }),
    ],
    content: initialHtml,
    onUpdate: ({ editor: e }) => setHtml(e.isEmpty ? "" : e.getHTML()),
    editorProps: {
      attributes: {
        id,
        role: "textbox",
        "aria-multiline": "true",
        "aria-labelledby": `${id}-label`,
        class: "rich-text min-h-48 px-3 py-3 focus:outline-none",
      },
    },
  });
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            h2: e.isActive("heading", { level: 2 }),
            h3: e.isActive("heading", { level: 3 }),
            bullet: e.isActive("bulletList"),
            ordered: e.isActive("orderedList"),
            quote: e.isActive("blockquote"),
          }
        : null,
  });

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-night focus-within:border-leaf focus-within:ring-2 focus-within:ring-leaf/30">
      <input type="hidden" name={name} value={html} />
      {editor && state && (
        <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-0.5 border-b border-line bg-pine/60 px-1.5 py-1">
          <ToolButton label="Bold" active={state.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
            <Bold className="size-4" aria-hidden="true" />
          </ToolButton>
          <ToolButton label="Italic" active={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
            <Italic className="size-4" aria-hidden="true" />
          </ToolButton>
          <span aria-hidden="true" className="mx-1 h-5 w-px bg-line" />
          <ToolButton label="Heading" active={state.h2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
            <Heading2 className="size-4" aria-hidden="true" />
          </ToolButton>
          <ToolButton label="Subheading" active={state.h3} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
            <Heading3 className="size-4" aria-hidden="true" />
          </ToolButton>
          <ToolButton label="Bulleted list" active={state.bullet} onClick={() => editor.chain().focus().toggleBulletList().run()}>
            <List className="size-4" aria-hidden="true" />
          </ToolButton>
          <ToolButton label="Numbered list" active={state.ordered} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
            <ListOrdered className="size-4" aria-hidden="true" />
          </ToolButton>
          <ToolButton label="Quote" active={state.quote} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
            <Quote className="size-4" aria-hidden="true" />
          </ToolButton>
          <span aria-hidden="true" className="mx-1 h-5 w-px bg-line" />
          <LinkControl editor={editor} />
          <span className="ml-auto flex">
            <ToolButton label="Undo" onClick={() => editor.chain().focus().undo().run()}>
              <Undo2 className="size-4" aria-hidden="true" />
            </ToolButton>
            <ToolButton label="Redo" onClick={() => editor.chain().focus().redo().run()}>
              <Redo2 className="size-4" aria-hidden="true" />
            </ToolButton>
          </span>
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
