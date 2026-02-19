"use client";

import { useEffect, type ReactNode } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Pilcrow,
  Underline as UnderlineIcon,
  Unlink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  className?: string;
}

function normalizeHtml(input: string): string {
  const value = input.trim();
  return value === "<p></p>" ? "" : value;
}

interface ToolbarButtonProps {
  active?: boolean;
  disabled?: boolean;
  title: string;
  onClick: () => void;
  children: ReactNode;
}

function ToolbarButton({
  active = false,
  disabled = false,
  title,
  onClick,
  children,
}: ToolbarButtonProps) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "outline"}
      size="icon"
      onClick={onClick}
      disabled={disabled}
      className="h-8 w-8"
      title={title}
      aria-label={title}
    >
      {children}
    </Button>
  );
}

export function RichTextEditor({ value, onChange, disabled = false, className }: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        defaultProtocol: "https",
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
    ],
    content: value || "",
    editable: !disabled,
    onUpdate: ({ editor: activeEditor }) => {
      onChange(activeEditor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (!editor) return;

    const current = normalizeHtml(editor.getHTML());
    const next = normalizeHtml(value || "");

    if (current !== next) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [editor, value]);

  const setLink = () => {
    if (!editor || disabled) return;

    const previousUrl = (editor.getAttributes("link").href as string | undefined) ?? "https://";
    const url = window.prompt("Link URL", previousUrl);

    if (url === null) {
      return;
    }

    const trimmed = url.trim();

    if (!trimmed) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: trimmed }).run();
  };

  return (
    <div className={cn("rounded-md border border-input bg-background", className)}>
      <div className="flex flex-wrap gap-2 border-b border-border p-2">
        <ToolbarButton
          title="Kalın"
          active={editor?.isActive("bold")}
          disabled={!editor || disabled}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          title="İtalik"
          active={editor?.isActive("italic")}
          disabled={!editor || disabled}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          title="Altı Çizili"
          active={editor?.isActive("underline")}
          disabled={!editor || disabled}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          title="Paragraf"
          active={editor?.isActive("paragraph")}
          disabled={!editor || disabled}
          onClick={() => editor?.chain().focus().setParagraph().run()}
        >
          <Pilcrow className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          title="Başlık 2"
          active={editor?.isActive("heading", { level: 2 })}
          disabled={!editor || disabled}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          title="Başlık 3"
          active={editor?.isActive("heading", { level: 3 })}
          disabled={!editor || disabled}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          title="Madde Listesi"
          active={editor?.isActive("bulletList")}
          disabled={!editor || disabled}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          title="Numaralı Liste"
          active={editor?.isActive("orderedList")}
          disabled={!editor || disabled}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          title="Link Ekle / Düzenle"
          active={editor?.isActive("link")}
          disabled={!editor || disabled}
          onClick={setLink}
        >
          <Link2 className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          title="Link Kaldır"
          active={false}
          disabled={!editor || disabled || !editor?.isActive("link")}
          onClick={() => editor?.chain().focus().extendMarkRange("link").unsetLink().run()}
        >
          <Unlink className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          title="Sola Hizala"
          active={editor?.isActive({ textAlign: "left" })}
          disabled={!editor || disabled}
          onClick={() => editor?.chain().focus().setTextAlign("left").run()}
        >
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          title="Ortala"
          active={editor?.isActive({ textAlign: "center" })}
          disabled={!editor || disabled}
          onClick={() => editor?.chain().focus().setTextAlign("center").run()}
        >
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          title="Sağa Hizala"
          active={editor?.isActive({ textAlign: "right" })}
          disabled={!editor || disabled}
          onClick={() => editor?.chain().focus().setTextAlign("right").run()}
        >
          <AlignRight className="h-4 w-4" />
        </ToolbarButton>
      </div>

      <EditorContent
        editor={editor}
        className={cn(
          "min-h-[220px] px-3 py-2 text-sm",
          "[&_.ProseMirror]:min-h-[200px] [&_.ProseMirror]:outline-none",
          "[&_.ProseMirror_h2]:mt-3 [&_.ProseMirror_h2]:text-lg [&_.ProseMirror_h2]:font-semibold",
          "[&_.ProseMirror_h3]:mt-3 [&_.ProseMirror_h3]:text-base [&_.ProseMirror_h3]:font-semibold",
          "[&_.ProseMirror_p]:my-2",
          "[&_.ProseMirror_ul]:my-2 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-6",
          "[&_.ProseMirror_ol]:my-2 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-6",
          "[&_.ProseMirror_a]:text-primary [&_.ProseMirror_a]:underline",
          disabled ? "cursor-not-allowed opacity-80" : ""
        )}
      />
    </div>
  );
}
