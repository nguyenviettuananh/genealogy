## Goal
Build a small React app that reads `genealogy.md`, converts its nested Markdown list into a hierarchical data structure, and renders an expandable/collapsible family tree similar to the uploaded image.

## Project Setup
1. Initialize a React + TypeScript app (Vite). 
2. Place `genealogy.md` and the reference image in `public/` so the app can fetch them at runtime.
3. Add `react-d3-tree` for layout/edges and zoom/pan capabilities.

## Data Parsing
1. Read `genealogy.md` via `fetch('/genealogy.md')`.
2. Parse bullet list lines using indentation to determine depth: `^\s*-\s+` captures an item; leading spaces give the level.
3. Normalize text by stripping Markdown emphasis (`**`, `*`) while preserving the original label content (Vietnamese diacritics, notes in parentheses).
4. Support multi-name siblings separated by `|` on a single line (e.g., `Trần Đức Ngoạn | Trần Đức Tùng | …`) by splitting into multiple sibling nodes at the same depth.
5. Build a tree using a stack keyed by depth: parent is `stack[depth-1]`; push last created node as `stack[depth]`.
6. Output shape: `{ name: string, children?: Node[], id: string }`.

## Visualization
1. Render the tree with `react-d3-tree` in vertical orientation (top → bottom) to resemble the photo.
2. Provide a custom node renderer: rectangular boxes with borders and centered labels, auto width based on text.
3. Use built-in connectors for parent-child links; tweak separation so siblings have spacing similar to the chart.

## Interactions
1. Per-node expand/collapse by clicking a node, toggling its `collapsed` state.
2. Global controls: "Expand all" and "Collapse all" buttons.
3. Enable zoom and pan; default fit-to-screen on load.

## Styling
1. CSS variables for box size, border color, and spacing; light theme by default.
2. Handle long labels by wrapping and limiting to 2 lines with ellipsis; tooltip on hover shows full text.

## Validation
1. Load the app, fetch and parse `genealogy.md`, and render the tree.
2. Manually verify several levels display correctly and multi-name lines split into siblings.
3. Test expand/collapse behavior on deep branches.

## Deliverables
- A working React app with:
  - Markdown → tree parser.
  - Expandable/collapsible, zoomable tree that mirrors the structure in `genealogy.md`.
  - Minimal, clean UI with controls for expand/collapse.

## Notes
- Parser is resilient to uneven spacing and keeps all original node text.
- Future enhancements (optional): search/filter by name, print/export to PNG/PDF, left-to-right orientation toggle.

If you approve, I will scaffold the app, implement the parser and tree view, and run the dev server for you to preview.