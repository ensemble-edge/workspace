# Guide: Add Tiptap Rich Text Editor to `@ensemble-edge/ui`

**For:** Claude Code  
**Repo:** `github.com/ensemble-edge/workspace`  
**Package:** `packages/ui`  
**Purpose:** Add a production-grade rich text editor component to `@ensemble-edge/ui` using Tiptap, styled to match existing shadcn-derived Preact components, usable by all projects that depend on `@ensemble-edge/ui` including `curalisto-app`.

---

## Context

`@ensemble-edge/ui` is a **React** + Tailwind component library. Components follow shadcn/ui design conventions and are built on Radix UI, which requires React. The rich text editor will be used in:

- **CuraListo CMS Guest App** — editing drug landing page content, email templates, consent text
- **Any future Ensemble Workspace app** that needs rich text input

The component must feel native to the existing library — same design tokens, same border/radius conventions, same focus states, same dark theme.

> **Earlier drafts of this doc said Preact. That was wrong.** `@ensemble-edge/ui` is React-only — see [`packages/ui/CLAUDE.md`](../packages/ui/CLAUDE.md). Use `@tiptap/react`, not `@tiptap/core` with hand-rolled hooks.

---

## Approach

Use the official `@tiptap/react` package. It wraps Tiptap's framework-agnostic core (`@tiptap/core`) with React hooks (`useEditor`, `EditorContent`) — exactly the pattern shadcn-style components want.

---

## Step 1 — Install Dependencies

From `packages/ui/`:

```bash
pnpm add @tiptap/react @tiptap/pm
pnpm add @tiptap/starter-kit
pnpm add @tiptap/extension-placeholder
pnpm add @tiptap/extension-character-count
pnpm add @tiptap/extension-link
pnpm add @tiptap/extension-image
pnpm add @tiptap/extension-underline
pnpm add @tiptap/extension-text-align
```

`@tiptap/react` provides `useEditor` and `EditorContent` — the canonical React hooks for Tiptap.

---

## Step 2 — File Structure

Add the following to `packages/ui/src/components/`:

```
components/
  RichTextEditor/
    index.tsx              ← main exported component
    Toolbar.tsx            ← formatting toolbar
    ToolbarButton.tsx      ← individual toolbar button
    extensions.ts          ← configured Tiptap extensions
    types.ts               ← TypeScript types
    styles.css             ← ProseMirror content styles
  index.ts                 ← add RichTextEditor to barrel exports
```

---

## Step 3 — Types

**`components/RichTextEditor/types.ts`**

```typescript
export interface RichTextEditorProps {
  // Value
  value?: string                    // HTML string
  onChange?: (html: string) => void

  // Configuration
  placeholder?: string
  maxLength?: number
  readonly?: boolean
  autofocus?: boolean

  // Toolbar features (all enabled by default)
  toolbar?: {
    bold?: boolean
    italic?: boolean
    underline?: boolean
    strike?: boolean
    link?: boolean
    bulletList?: boolean
    orderedList?: boolean
    blockquote?: boolean
    heading?: boolean                // h2, h3 only
    textAlign?: boolean
    undo?: boolean
    redo?: boolean
    characterCount?: boolean
  }

  // Styling
  minHeight?: string                 // CSS value, default '120px'
  maxHeight?: string                 // CSS value, default '400px'
  class?: string                     // additional classes on wrapper

  // Accessibility
  label?: string                     // aria-label for editor region
  id?: string
}

export type ToolbarFeature = keyof NonNullable<RichTextEditorProps['toolbar']>
```

---

## Step 4 — Extensions Config

**`components/RichTextEditor/extensions.ts`**

```typescript
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'

export function buildExtensions(options: {
  placeholder?: string
  maxLength?: number
}) {
  return [
    StarterKit.configure({
      // Disable h1 — only h2 and h3 allowed in content
      heading: { levels: [2, 3] },
      // Disable code blocks — not needed for CMS content
      codeBlock: false,
      code: false,
    }),
    Underline,
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        class: 'text-primary underline underline-offset-2',
        rel: 'noopener noreferrer',
        target: '_blank',
      },
    }),
    TextAlign.configure({
      types: ['heading', 'paragraph'],
    }),
    ...(options.placeholder
      ? [Placeholder.configure({ placeholder: options.placeholder })]
      : []),
    ...(options.maxLength
      ? [CharacterCount.configure({ limit: options.maxLength })]
      : []),
  ]
}
```

---

## Step 5 — Main Component

> **Note:** Code samples below are illustrative React-flavored sketches. The original draft of this doc used Preact-specific patterns (`class=`, `h()`, `preact/hooks`). When implementing, follow standard React conventions: `className=`, no `h()` import (with `jsx: react-jsx`), hooks from `react`, refs typed as `React.RefObject<...>`. Treat the samples as structure-level guidance, not copy-paste-ready code.


**`components/RichTextEditor/index.tsx`**

Use `@tiptap/react`'s `useEditor` hook for editor instance management. It handles the lifecycle, re-renders, and React-y patterns out of the box — no manual `useEffect` plumbing.

```typescript
import * as React from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { buildExtensions } from './extensions'
import { Toolbar } from './Toolbar'
import type { RichTextEditorProps } from './types'
import './styles.css'

export function RichTextEditor({
  value = '',
  onChange,
  placeholder,
  maxLength,
  readonly = false,
  autofocus = false,
  toolbar = {},
  minHeight = '120px',
  maxHeight = '400px',
  class: className,
  label,
  id,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [isFocused, setIsFocused] = useState(false)
  const [charCount, setCharCount] = useState(0)

  useEffect(() => {
    if (!editorRef.current) return

    const instance = new Editor({
      element: editorRef.current,
      extensions: buildExtensions({ placeholder, maxLength }),
      content: value,
      editable: !readonly,
      autofocus,
      onUpdate: ({ editor }) => {
        onChange?.(editor.getHTML())
        if (maxLength) {
          setCharCount(editor.storage.characterCount.characters())
        }
      },
      onFocus: () => setIsFocused(true),
      onBlur: () => setIsFocused(false),
    })

    setEditor(instance)

    return () => {
      instance.destroy()
    }
  }, []) // Initialize once only

  // Sync external value changes (e.g. loading saved content)
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, false)
    }
  }, [value])

  // Sync readonly changes
  useEffect(() => {
    editor?.setEditable(!readonly)
  }, [readonly])

  const toolbarConfig = {
    bold: true,
    italic: true,
    underline: true,
    strike: false,
    link: true,
    bulletList: true,
    orderedList: true,
    blockquote: false,
    heading: true,
    textAlign: false,
    undo: true,
    redo: true,
    characterCount: !!maxLength,
    ...toolbar,
  }

  return (
    <div
      class={[
        'rte-wrapper rounded-md border bg-background text-sm',
        'transition-colors',
        isFocused
          ? 'border-ring ring-1 ring-ring'
          : 'border-input',
        readonly && 'opacity-60 cursor-not-allowed',
        className,
      ].filter(Boolean).join(' ')}
      id={id}
    >
      {!readonly && editor && (
        <Toolbar editor={editor} config={toolbarConfig} />
      )}
      <div
        ref={editorRef}
        class="rte-content px-3 py-2 overflow-y-auto focus:outline-none"
        style={{ minHeight, maxHeight }}
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        aria-readonly={readonly}
      />
      {toolbarConfig.characterCount && maxLength && (
        <div class="rte-footer px-3 py-1.5 border-t border-border text-xs text-muted-foreground text-right">
          {charCount} / {maxLength}
        </div>
      )}
    </div>
  )
}

export default RichTextEditor
```

---

## Step 6 — Toolbar

**`components/RichTextEditor/Toolbar.tsx`**

```typescript
import { h } from 'preact'
import type { Editor } from '@tiptap/core'
import { ToolbarButton } from './ToolbarButton'

interface ToolbarProps {
  editor: Editor
  config: Record<string, boolean>
}

export function Toolbar({ editor, config }: ToolbarProps) {
  return (
    <div class="rte-toolbar flex flex-wrap items-center gap-0.5 p-1.5 border-b border-border">
      {config.heading && (
        <>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive('heading', { level: 2 })}
            title="Heading 2"
          >
            H2
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            active={editor.isActive('heading', { level: 3 })}
            title="Heading 3"
          >
            H3
          </ToolbarButton>
          <div class="w-px h-4 bg-border mx-0.5" />
        </>
      )}
      {config.bold && (
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          title="Bold"
        >
          <strong>B</strong>
        </ToolbarButton>
      )}
      {config.italic && (
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Italic"
        >
          <em>I</em>
        </ToolbarButton>
      )}
      {config.underline && (
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive('underline')}
          title="Underline"
        >
          <span class="underline">U</span>
        </ToolbarButton>
      )}
      {config.strike && (
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive('strike')}
          title="Strikethrough"
        >
          <span class="line-through">S</span>
        </ToolbarButton>
      )}
      {(config.bold || config.italic || config.underline) &&
        (config.bulletList || config.orderedList || config.link) && (
          <div class="w-px h-4 bg-border mx-0.5" />
        )}
      {config.bulletList && (
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="Bullet list"
        >
          ≡
        </ToolbarButton>
      )}
      {config.orderedList && (
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="Ordered list"
        >
          1.
        </ToolbarButton>
      )}
      {config.blockquote && (
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          title="Blockquote"
        >
          "
        </ToolbarButton>
      )}
      {(config.undo || config.redo) && (
        <>
          <div class="flex-1" />
          {config.undo && (
            <ToolbarButton
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              title="Undo"
            >
              ↩
            </ToolbarButton>
          )}
          {config.redo && (
            <ToolbarButton
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              title="Redo"
            >
              ↪
            </ToolbarButton>
          )}
        </>
      )}
    </div>
  )
}
```

---

## Step 7 — Toolbar Button

**`components/RichTextEditor/ToolbarButton.tsx`**

```typescript
import { h } from 'preact'
import type { ComponentChildren } from 'preact'

interface ToolbarButtonProps {
  onClick?: () => void
  active?: boolean
  disabled?: boolean
  title?: string
  children: ComponentChildren
}

export function ToolbarButton({
  onClick,
  active = false,
  disabled = false,
  title,
  children,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      class={[
        'rte-toolbar-btn',
        'inline-flex items-center justify-center',
        'h-7 min-w-7 px-1.5 rounded text-sm',
        'transition-colors',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        active
          ? 'bg-accent text-accent-foreground'
          : 'text-foreground hover:bg-accent hover:text-accent-foreground',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
```

---

## Step 8 — Content Styles

**`components/RichTextEditor/styles.css`**

ProseMirror renders content as plain HTML inside the editor div. These styles make that content look correct and match the design system.

```css
/* ProseMirror editor content styles */
.rte-content .ProseMirror {
  outline: none;
  min-height: inherit;
}

/* Placeholder */
.rte-content .ProseMirror p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  color: hsl(var(--muted-foreground));
  pointer-events: none;
  height: 0;
}

/* Typography */
.rte-content .ProseMirror > * + * {
  margin-top: 0.5em;
}

.rte-content .ProseMirror h2 {
  font-size: 1.125rem;
  font-weight: 600;
  line-height: 1.4;
  margin-top: 1em;
}

.rte-content .ProseMirror h3 {
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.4;
  margin-top: 0.75em;
}

.rte-content .ProseMirror p {
  line-height: 1.6;
}

.rte-content .ProseMirror ul,
.rte-content .ProseMirror ol {
  padding-left: 1.5em;
}

.rte-content .ProseMirror ul {
  list-style-type: disc;
}

.rte-content .ProseMirror ol {
  list-style-type: decimal;
}

.rte-content .ProseMirror li {
  line-height: 1.6;
}

.rte-content .ProseMirror blockquote {
  border-left: 3px solid hsl(var(--border));
  padding-left: 1em;
  color: hsl(var(--muted-foreground));
  font-style: italic;
}

.rte-content .ProseMirror a {
  color: hsl(var(--primary));
  text-decoration: underline;
  text-underline-offset: 2px;
}

.rte-content .ProseMirror strong {
  font-weight: 600;
}

/* Selection */
.rte-content .ProseMirror ::selection {
  background: hsl(var(--primary) / 0.2);
}
```

---

## Step 9 — Barrel Export

Add to `packages/ui/src/components/index.ts`:

```typescript
export { RichTextEditor } from './RichTextEditor'
export type { RichTextEditorProps } from './RichTextEditor/types'
```

Also add to the main `packages/ui/src/index.ts` if it re-exports from components.

---

## Step 10 — Package Dependencies

Add Tiptap packages to `packages/ui/package.json` dependencies:

```json
{
  "dependencies": {
    "@tiptap/core": "^2.4.0",
    "@tiptap/pm": "^2.4.0",
    "@tiptap/starter-kit": "^2.4.0",
    "@tiptap/extension-placeholder": "^2.4.0",
    "@tiptap/extension-character-count": "^2.4.0",
    "@tiptap/extension-link": "^2.4.0",
    "@tiptap/extension-underline": "^2.4.0",
    "@tiptap/extension-text-align": "^2.4.0"
  }
}
```

---

## Step 11 — Usage Example

Once built, usage in any Preact component or Astro island:

```typescript
import { RichTextEditor } from '@ensemble-edge/ui'

// Basic usage
<RichTextEditor
  value={content}
  onChange={(html) => setContent(html)}
  placeholder="Start writing..."
/>

// CMS drug description — with character limit
<RichTextEditor
  value={drug.description}
  onChange={(html) => updateDrug({ description: html })}
  placeholder="Describe este medicamento..."
  maxLength={2000}
  toolbar={{ heading: true, bold: true, italic: true, bulletList: true }}
/>

// Email template editor — simplified toolbar
<RichTextEditor
  value={template.body}
  onChange={(html) => updateTemplate({ body: html })}
  placeholder="Escribe el contenido del correo..."
  minHeight="200px"
  toolbar={{
    bold: true,
    italic: true,
    bulletList: true,
    orderedList: true,
    link: true,
    undo: true,
    redo: true,
  }}
/>

// Read-only content display
<RichTextEditor
  value={savedContent}
  readonly
  toolbar={{}}
/>
```

---

## Step 12 — Validation Checklist

- [ ] `bun install` from workspace root runs clean
- [ ] `bun run typecheck` passes with zero errors
- [ ] `RichTextEditor` renders in Storybook or demo app
- [ ] Toolbar buttons activate/deactivate correctly reflecting editor state
- [ ] Bold, italic, underline, bullet list, ordered list all work
- [ ] Heading H2 and H3 toggle correctly
- [ ] Placeholder text appears when editor is empty
- [ ] Character count displays and enforces maxLength
- [ ] `onChange` fires with correct HTML on every content change
- [ ] External `value` updates (loading saved content) sync correctly
- [ ] `readonly` mode disables editing and hides toolbar
- [ ] Focus state shows ring using design system tokens
- [ ] Styles match existing `@ensemble-edge/ui` component aesthetics
- [ ] No `any` types, no `@ts-ignore`
- [ ] Component exported from `packages/ui/src/index.ts`
- [ ] `curalisto-app` can import `RichTextEditor` from `@ensemble-edge/ui` after running `bun install`

---

## Notes for Claude Code

- **Use `@tiptap/react`'s `useEditor` hook.** Don't roll your own `useEffect`/`useRef` editor wiring — the official hook handles re-renders and SSR concerns correctly.
- CSS variables for colors (`hsl(var(--primary))` etc.) come from the existing Tailwind/shadcn token system in `@ensemble-edge/ui` — do not hardcode colors
- The toolbar is intentionally minimal — resist adding more extensions unless explicitly needed
- `@tiptap/pm` is ProseMirror — it's a peer dependency required by Tiptap core, always install it alongside `@tiptap/react`
- Test with both light and dark themes if the workspace supports theme switching