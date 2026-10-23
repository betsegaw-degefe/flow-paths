---
name: flow-paths
description: "Build one standalone HTML page that shows several paths through the same system on a single diagram (for example a write path, a read path and a consent path), with a tab per path that animates its steps in order and explains each one in plain language. Use when someone wants to show how data, requests or work travel through a system and there is more than one route worth telling apart, especially for non-technical readers or a walkthrough. Not for a single linear process, sequence diagrams of one call, or dashboards."
license: MIT
---

# Flow paths

Turn a description of a system into one page: a stage-column diagram of its components, and
tabs that each play one path through it, step by step, with the rest of the diagram dimmed.
The **All** tab animates every path at once, each in its own colour.

The page is built from a JSON spec. You write the spec; `bin/build.mjs` checks it and writes the
page; `bin/snapshot.mjs` screenshots every tab so you can look before handing it over.

## Workflow

1. **Find the paths.** Ask, or work out from the material, which routes through the system matter
   to the reader (two to four is typical; six at most). Each path is an ordered list of hops
   between components. A hop used by several paths is one edge, shared.
2. **Write the spec** as `<name>.json` in the user's working folder (or a folder they name). Read
   `examples/photo-sharing.json` for a full example with three paths and
   `examples/online-order.json` for a small one. The fields are below.
3. **Build:**
   ```bash
   node <skill-dir>/bin/build.mjs <name>.json <name>.html
   ```
   Errors stop the build and name the field. Fix every warning too: each one is something a
   reader would see (text spilling out of a box, a line running behind a box).
4. **Look at it:**
   ```bash
   node <skill-dir>/bin/snapshot.mjs <name>.html <scratch-dir>/shots
   ```
   Open the PNGs (`all-light.png`, `<path>-dark.png`, …). Check that labels do not overlap boxes
   or each other, and that each path's highlighted route reads in order. The command also reports
   whether the page scrolls sideways at desktop and phone width; it must not.
5. **Fix and rebuild** until the shots are clean, then give the user the page. For a claude.ai
   Artifact, build with `--fragment` and publish that file.

## Spec

```jsonc
{
  "title": "How a photo travels",           // page heading; also names the remembered theme
  "pageTitle": "Photo Paths",               // browser tab; defaults to title
  "eyebrow": "Example · photo sharing",     // optional small line above the title
  "lede": "One or two sentences.",          // optional
  "diagramLabel": "…",                      // optional screen-reader name for the diagram
  "allLabel": "All paths",                  // optional; the first tab's text
  "stepSeconds": 4.2,                       // optional; autoplay pace, 1.5 to 30

  "columns": [ { "label": "Capture" }, … ],  // 1 to 7 stages, left to right

  "kinds": [                                 // optional legend; each node may name one
    { "id": "ours", "label": "Runs in the shop", "style": "solid" },   // solid | strong | dashed
    { "id": "partner", "label": "Run by a partner", "style": "dashed" }
  ],

  "nodes": {
    "orders": { "column": 1, "row": 1, "label": "Order service", "sub": "cart · checkout", "kind": "ours",
                "description": "Takes the cart, checks stock and price, and turns it into an order." }
    // row: 0 is the top slot, each row is 95px; fractions are fine (1.5).
    // Or give "y" in diagram pixels instead of "row" (the top slot is y 100).
    // description: optional; one to three plain sentences shown when the box is clicked.
  },

  "edges": {
    "pay": { "from": "orders", "to": "psp", "label": "charge card" }
    // optional "labelAt": 0–1, where along the line the label sits (default 0.5)
  },

  "paths": [
    {
      "id": "order", "name": "Order path", "tab": "Order",            // tab defaults to name
      "color": "blue",                     // green | rose | blue | amber | violet | teal
      "summary": "One sentence for the All tab's card.",
      "steps": [
        { "edge": "pay", "title": "The card is charged",
          "label": "charge card",          // optional; replaces the edge label during this step
          "text": "Two or three plain sentences: what happens and why it matters." }
      ]
    }
  ]
}
```

## Layout that reads well

- **Columns are stages**, in the order things happen for the main path. Put a component in the
  stage where it does its work, not where it is hosted.
- **One row apart at least** for boxes in the same column (the build refuses closer).
- **Keep edges to neighbouring columns** where you can. An edge that skips a column is drawn
  straight across it; the build warns when a box there sits in its way. Move one of them to
  another row.
- **Two-way traffic** between the same pair (request and reply) is two edges, `a→b` and `b→a`.
  They are split apart automatically. Never add a second edge in the same direction: reuse the
  edge and give each step its own `label`.
- **Descriptions** say what the component is and does for this system, in plain words; they are
  read when someone clicks the box, so they can carry detail the diagram has no room for.
- **Short text.** Box names fit about 19 characters, subtitles about 26, edge labels about 22.
  The build warns past those.
- **Crowded labels:** move one along its line with `labelAt` (for example 0.3 or 0.7), or move a
  box by half a row.

## Writing the steps

- Write for someone who has never seen the system. Name things by what they do ("the card
  processor"), and explain each technical term the first time it matters.
- One hop per step, in the order it happens. Title is a short sentence in the present tense
  ("The card is charged"); text says what happens, then why or what can go wrong.
- State only what is true of the system. If the material does not say, ask rather than guess.

## Notes

- The page is self-contained: inline CSS and JS, fonts from Google Fonts with system fallbacks.
  It works opened from disk, attached to an email, or hosted anywhere.
- It has light and dark themes and a switch in the corner; it follows the system theme until the
  reader picks one. Reduced-motion readers get the same page with no animation.
- `#<path-id>` at the end of the URL opens that path's tab directly.
- **Clicking a box** zooms the diagram onto it and its direct connections and opens a card with its
  `description`, what it receives and sends, and the paths that use it. The card can be dragged;
  Esc or a click on empty space closes it. Give every node a description for this to be useful.
- **Present** (or F) switches to a full-screen layout for presenting: the title, tabs, diagram and
  current step only. Esc exits. Where the host blocks full screen, the same layout fills the window.
