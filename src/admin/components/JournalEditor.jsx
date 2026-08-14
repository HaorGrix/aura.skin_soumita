/* =================================================================== *
 * skin.theory admin — Journal article rich-text editor
 * -------------------------------------------------------------------
 * Tiptap (headless, built on ProseMirror) restyled with the admin's own
 * Tailwind tokens rather than any default editor chrome — chosen over
 * react-quill/Slate/Lexical for being the lightest path to exactly what
 * this feature needs: headings, bold/italic, bullet lists, inline images,
 * outputting clean HTML that's stored as-is (body_html) and sanitized
 * with DOMPurify at render time on the storefront (see ArticleProse.jsx).
 * =================================================================== */
import { useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TiptapImage from "@tiptap/extension-image";
import TiptapLink from "@tiptap/extension-link";
import {
  Bold, Heading1, Heading2, Image as ImageIcon, Italic, Link as LinkIcon,
  List, ListOrdered, Redo, Undo,
} from "lucide-react";
import { uploadJournalImage, journalImageUrl, MAX_IMAGE_BYTES } from "../../lib/api/admin/journal.js";
import { Label, Spinner } from "./kit.jsx";

function ToolbarBtn({ active, onClick, disabled, children, label }) {
  return (
    <button
      type="button"
      // A plain click blurs the ProseMirror contenteditable on mousedown
      // BEFORE the click handler runs, collapsing/losing whatever text
      // selection the admin just made — so "select text, click Bold"
      // would silently no-op. Preventing default on mousedown keeps focus
      // (and the selection) in the editor the whole time.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? "bg-petal text-magenta-deep" : "text-ink-soft hover:bg-snow hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

export default function JournalEditor({ label, hint, value, onChange }) {
  const inputRef = useRef(null);
  const uploadingRef = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TiptapImage.configure({ HTMLAttributes: { class: "rounded-xl" } }),
      TiptapLink.configure({ openOnClick: false, HTMLAttributes: { class: "text-magenta underline" } }),
    ],
    content: value || "<p></p>",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class:
          "min-h-64 max-w-none px-4 py-3 text-sm text-ink outline-none " +
          "[&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:font-serif [&_h1]:text-2xl [&_h1]:text-ink " +
          "[&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:font-serif [&_h2]:text-xl [&_h2]:text-ink " +
          "[&_p]:mb-3 [&_p]:leading-relaxed " +
          "[&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 " +
          "[&_img]:my-3 [&_img]:max-w-full [&_a]:text-magenta [&_a]:underline " +
          "[&_strong]:font-semibold",
      },
    },
  });

  async function insertImage(file) {
    if (!file || uploadingRef.current) return;
    if (file.size > MAX_IMAGE_BYTES) {
      alert(`"${file.name}" is over the 5 MB limit.`);
      return;
    }
    uploadingRef.current = true;
    const { path, error } = await uploadJournalImage(file);
    uploadingRef.current = false;
    if (error) { alert(error.message); return; }
    editor?.chain().focus().setImage({ src: journalImageUrl(path) }).run();
  }

  if (!editor) return null;

  return (
    <div>
      {label && <Label hint={hint}>{label}</Label>}
      <div className="overflow-hidden rounded-xl ring-1 ring-line">
        <div className="flex flex-wrap items-center gap-0.5 border-b border-line bg-snow/60 px-2 py-1.5">
          <ToolbarBtn label="Heading 1" active={editor.isActive("heading", { level: 1 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
            <Heading1 className="h-4 w-4" strokeWidth={1.8} />
          </ToolbarBtn>
          <ToolbarBtn label="Heading 2" active={editor.isActive("heading", { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
            <Heading2 className="h-4 w-4" strokeWidth={1.8} />
          </ToolbarBtn>
          <span className="mx-1 h-5 w-px bg-line" />
          <ToolbarBtn label="Bold" active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}>
            <Bold className="h-4 w-4" strokeWidth={1.8} />
          </ToolbarBtn>
          <ToolbarBtn label="Italic" active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}>
            <Italic className="h-4 w-4" strokeWidth={1.8} />
          </ToolbarBtn>
          <span className="mx-1 h-5 w-px bg-line" />
          <ToolbarBtn label="Bullet list" active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}>
            <List className="h-4 w-4" strokeWidth={1.8} />
          </ToolbarBtn>
          <ToolbarBtn label="Numbered list" active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}>
            <ListOrdered className="h-4 w-4" strokeWidth={1.8} />
          </ToolbarBtn>
          <span className="mx-1 h-5 w-px bg-line" />
          <ToolbarBtn label="Link" active={editor.isActive("link")}
            onClick={() => {
              const url = window.prompt("Link URL", editor.getAttributes("link").href ?? "https://");
              if (url === null) return;
              if (!url) editor.chain().focus().unsetLink().run();
              else editor.chain().focus().setLink({ href: url }).run();
            }}>
            <LinkIcon className="h-4 w-4" strokeWidth={1.8} />
          </ToolbarBtn>
          <ToolbarBtn label="Insert image" onClick={() => inputRef.current?.click()}>
            {uploadingRef.current ? <Spinner className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" strokeWidth={1.8} />}
          </ToolbarBtn>
          <span className="mx-1 h-5 w-px bg-line" />
          <ToolbarBtn label="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
            <Undo className="h-4 w-4" strokeWidth={1.8} />
          </ToolbarBtn>
          <ToolbarBtn label="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
            <Redo className="h-4 w-4" strokeWidth={1.8} />
          </ToolbarBtn>
        </div>
        <EditorContent editor={editor} className="bg-white" />
      </div>
      <input
        ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
        onChange={(e) => { insertImage(e.target.files?.[0]); e.target.value = ""; }}
      />
    </div>
  );
}
