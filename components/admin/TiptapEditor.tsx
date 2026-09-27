"use client";

import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
  Undo2,
  Redo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TiptapEditorProps = {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
};

export function TiptapEditor({
  content,
  onChange,
  placeholder = "Write your post…",
  className,
}: TiptapEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-primary underline" } }),
      Placeholder.configure({ placeholder }),
    ],
    content,
    editorProps: {
      attributes: {
        class:
          "min-h-[280px] px-4 py-3 focus:outline-none prose-headings:font-semibold text-sm leading-relaxed",
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (content !== editor.getHTML()) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [content, editor]);

  if (!editor) return null;

  const setLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL", previous ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const tools = [
    { icon: Bold, action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive("bold") },
    { icon: Italic, action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive("italic") },
    { icon: Strikethrough, action: () => editor.chain().focus().toggleStrike().run(), active: editor.isActive("strike") },
    { icon: Heading2, action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive("heading", { level: 2 }) },
    { icon: List, action: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive("bulletList") },
    { icon: ListOrdered, action: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive("orderedList") },
    { icon: Quote, action: () => editor.chain().focus().toggleBlockquote().run(), active: editor.isActive("blockquote") },
    { icon: Link2, action: setLink, active: editor.isActive("link") },
    { icon: Undo2, action: () => editor.chain().focus().undo().run(), active: false },
    { icon: Redo2, action: () => editor.chain().focus().redo().run(), active: false },
  ];

  return (
    <div className={cn("overflow-hidden rounded-2xl border border-primary/15 bg-background", className)}>
      <div className="flex flex-wrap gap-1 border-b border-border/60 bg-muted/30 p-2">
        {tools.map(({ icon: Icon, action, active }, i) => (
          <Button
            key={i}
            type="button"
            variant="ghost"
            size="icon"
            className={cn("h-8 w-8 rounded-lg", active && "bg-primary/15 text-primary")}
            onClick={action}
          >
            <Icon className="h-4 w-4" />
          </Button>
        ))}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
