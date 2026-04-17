# Collaborative IDE — Session Changelog

> **Session:** Running Collaborative IDE Project → Implementing Premium Multiplayer Cursors & Mobile Responsiveness
> **Date:** April 8–9, 2026
> **Branch:** `feature/yug`

---

## Overview

Two major phases of work were completed in this session:

1. **Phase 1 – 7 Core Feature Additions** (Live Preview + 5 premium IDE features)
2. **Phase 2 – Full Mobile Responsiveness Refactor**

All changes preserve existing real-time collaboration, AI agent, and role-based permission functionality.

---

## Phase 1: Core Feature Additions

### Feature 1 — Live HTML Preview Panel

A sandboxed, real-time HTML preview that renders your combined project files as you type.

**Files Created:**

| File | Description |
|------|-------------|
| `src/hooks/usePreviewBuilder.ts` | Combines all project files (HTML + CSS + JS) into a single `srcdoc` document. Prioritizes `index.html` as base, injects `.css` as `<style>` and `.js` as `<script>`. Falls back to a minimal wrapper if no HTML file exists. Intercepts `console.log/warn/error/info` via `postMessage`. Captures uncaught errors and unhandled promise rejections. Debounces rebuilds by 300ms. Merges in-memory (unsaved) edits for the active file. |
| `src/components/LivePreview.tsx` | Sandboxed `<iframe>` with `srcdoc` attribute (no external URLs). Toolbar with 4 viewport toggle modes: **Responsive**, **Desktop (1280px)**, **Tablet (768px)**, **Mobile (375px)**. Includes Refresh button, Open in New Tab button, and an empty state guiding users to create `index.html`. |

**Files Modified:**

| File | Change |
|------|--------|
| `src/pages/Project.tsx` | Wired `usePreviewBuilder` hook into the editor, added Live Preview panel toggle to the header and command palette. |

---

### Feature 2 — Multiplayer Cursors & Follow Mode

Figma-style real-time cursor sharing across collaborators.

**Files Modified:**

| File | Change |
|------|--------|
| `src/hooks/useRealtimeCode.ts` | Added `CursorPosition` interface. Added `cursor_update` broadcast event. Added `broadcastCursor()` function that throttles to 50ms to prevent network flooding. |
| `src/components/ActiveUsersPresence.tsx` | Added `onFollowUser` callback. User avatars in the header and sidebar are now clickable. |
| `src/pages/Project.tsx` | Monaco `deltaDecorations` renders remote cursors as colored vertical bars with floating username labels. `handleFollowUser` callback switches to the followed user's file and scrolls to their cursor. CSS is dynamically injected per-user via `getUserColor()`. |

**How it works:**
- Each keystroke broadcasts cursor line/column to all collaborators via Supabase realtime channel.
- Click any avatar → **Follow Mode** activates → switches to their active file and scrolls to their exact cursor position.

---

### Feature 3 — Command Palette (Cmd+K / Ctrl+K)

A VS Code-style command palette for fast keyboard-driven navigation.

**Files Created:**

| File | Description |
|------|-------------|
| `src/components/CommandPalette.tsx` | Global `Cmd+K` / `Ctrl+K` keyboard shortcut toggles the palette. Built using Shadcn `CommandDialog` (wrapping `cmdk`). Two groups: **Files** (fuzzy search all project files) and **Actions** (Run Code, Toggle AI, Toggle Preview, Export ZIP). Selecting a file triggers `handleFileSelect`. |

**Files Modified:**

| File | Change |
|------|--------|
| `src/pages/Project.tsx` | Wired `CommandPalette` with all necessary callbacks. |

---

### Feature 4 — Contextual AI Code Actions (Right-Click Menu)

AI shortcuts directly inside the Monaco editor context menu.

**Files Modified:**

| File | Change |
|------|--------|
| `src/pages/Project.tsx` | `handleEditorMount` registers 3 custom Monaco editor actions via `editor.addAction()` under the `ai` group. Right-clicking selected code reveals: **AI: Explain this code**, **AI: Find bugs**, **AI: Add comments**. Each action opens the AI chat panel and submits the selected code with the corresponding prompt to `aiAgent.generateCode()`. |

---

### Feature 5 — Export Project as ZIP

One-click download of the entire project as a `.zip` archive.

**Files Created:**

| File | Description |
|------|-------------|
| `src/utils/exportProject.ts` | `exportProjectAsZip()` utility. Uses `jszip` to build archive and `file-saver` to trigger browser download. Preserves full folder path structure from the project file tree. |

**Files Modified:**

| File | Change |
|------|--------|
| `src/pages/Project.tsx` | Export button added next to the Share button in the header. Also accessible via the Command Palette. |

---

### Feature 6 — Client-Side Code Formatting (Prettier, Shift+Alt+F)

Format any supported file directly in the browser with zero network requests.

**Files Created:**

| File | Description |
|------|-------------|
| `src/types/prettier.d.ts` | TypeScript type declarations for Prettier's dynamic imports. |

**Files Modified:**

| File | Change |
|------|--------|
| `src/pages/Project.tsx` | `handleEditorMount` registers a `Shift+Alt+F` keybinding. All Prettier plugins loaded lazily via dynamic `import()` — zero impact on initial bundle. Supports: TypeScript, JavaScript, HTML, CSS/SCSS, JSON, Markdown. Uses `editor.executeEdits()` to preserve full undo history. Cursor position is restored after formatting. |

---

### Dependencies Added (Phase 1)

| Package | Purpose |
|---------|---------|
| `jszip` | ZIP archive generation for project export |
| `file-saver` | Browser file download trigger |
| `prettier` | Client-side code formatting engine |
| `@types/file-saver` | TypeScript types for file-saver |

---

## Phase 2: Mobile Responsiveness Refactor

A comprehensive rebuild of the layout architecture for touch devices (< 768px).

---

### Change 1 — Mobile Sidebar via Sheet (Left Drawer)

**File Modified:** `src/pages/Project.tsx`

| Before | After |
|--------|-------|
| Sidebar was a fixed panel in the desktop flex layout | On mobile, the hamburger `PanelLeft` icon in the header opens a `<Sheet side="left" className="w-[280px] p-0">` containing the full `sidebarContent` (Files, Users, AI tabs) |
| Sidebar closed manually | Auto-closes after a file is selected on mobile via `setSidebarOpen(false)` |

---

### Change 2 — Header Action Buttons Hidden on Mobile

**File Modified:** `src/pages/Project.tsx`

Heavy desktop actions are hidden below 768px using Tailwind responsive utilities:

| Element | Mobile Behaviour |
|---------|-----------------|
| Share button | `hidden sm:flex` — hidden below 640px |
| AI button | `hidden sm:flex` — hidden below 640px |
| Active users presence | `hidden md:block` — hidden below 768px |
| Public/Private toggle | `hidden lg:flex` — hidden below 1024px |
| Role indicator badge | `hidden sm:flex` — hidden below 640px |

---

### Change 3 — Mobile Overflow Dropdown Menu

**File Modified:** `src/pages/Project.tsx`

A `<DropdownMenu>` triggered by the `MoreVertical` icon appears **only on mobile**. It consolidates all squashed header actions:

- Role indicator (display only)
- Share
- Make Public / Make Private (owner only)
- Request Access (collaborators)
- Online user count

---

### Change 4 — Terminal as Bottom Sheet

**File Modified:** `src/pages/Project.tsx`

| Before | After |
|--------|-------|
| Terminal was a static 128px fixed footer panel | On mobile, a `<Sheet side="bottom">` launches at `50vh` height |
| Always visible | Triggered programmatically the moment **Run Code** executes |
| Blocked editor space | Slides up over the editor, dismisses cleanly with a swipe |

---

### Change 5 — Monaco `automaticLayout: true`

**File Modified:** `src/pages/Project.tsx`

`automaticLayout: true` was injected into the `options` prop of **all** `<Editor>` and `<DiffEditor>` instances. This allows Monaco to use `ResizeObserver` internally to recalculate line layouts dynamically whenever the virtual keyboard appears, panels resize, or sheet drawers open/close. Eliminates the need for manual `editor.layout()` calls or unmount/remount hacks.

---

### Change 6 — Touch Target Optimization in FileExplorer

**File Modified:** `src/components/FileExplorer.tsx`

All interactive nodes (file items, directory chevrons, action buttons) were given `max-md:min-h-[44px]` class mappings to comply with iOS/Android touch target minimum size standards (Fitts's Law). This ensures accurate tapping on small screens.

---

### Change 7 — Supabase RLS Migration Fix

**File Created:** `supabase/migrations/20260409000000_fix_join_room_rls.sql`

A migration that patches the Row Level Security policy on the `join_room` function/table to ensure collaborators can properly join projects without permission errors — supporting the new mobile-first use cases.

---

## Files Summary

| File | Status | Phase |
|------|--------|-------|
| `src/hooks/usePreviewBuilder.ts` | Created | Phase 1 |
| `src/components/LivePreview.tsx` | Created | Phase 1 |
| `src/components/CommandPalette.tsx` | Created | Phase 1 |
| `src/utils/exportProject.ts` | Created | Phase 1 |
| `src/types/prettier.d.ts` | Created | Phase 1 |
| `supabase/migrations/20260409000000_fix_join_room_rls.sql` | Created | Phase 2 |
| `src/pages/Project.tsx` | Modified | Phase 1 + 2 |
| `src/hooks/useRealtimeCode.ts` | Modified | Phase 1 |
| `src/components/ActiveUsersPresence.tsx` | Modified | Phase 1 |
| `src/components/FileExplorer.tsx` | Modified | Phase 2 |
| `src/pages/Index.tsx` | Modified | Phase 2 |

**Total:** 5 new files · 6 modified files · 24 file changes · 2,685 insertions

---

## Verification

- Vite dev server starts clean — no build errors
- No TypeScript type errors
- All Monaco Editor instances have `onMount` handler and `automaticLayout: true`
- Real-time code sync, AI agent, live preview remain fully functional
- Role-based permissions (owner / full_access / edit / view) all preserved
