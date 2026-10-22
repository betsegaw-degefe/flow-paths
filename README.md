# flow-paths

An agent skill that turns a description of a system into one interactive page: a diagram of its
components, with a tab for each path through it. Choosing a path dims everything else and plays
that path step by step, with a short plain-language note for each step. The **All** tab animates
every path at once, each in its own colour.

It suits systems where more than one route matters, such as a write path, a read path and a
permission path through the same services, and readers who are not engineers.

| All paths | One path, step by step |
|---|---|
| Every route animates in its own colour | The rest dims; each hop is narrated in order |

Open [`examples/photo-sharing.html`](examples/photo-sharing.html) or
[`examples/online-order.html`](examples/online-order.html) in a browser to see it.

## Install

The skill is the folder itself. Clone it where your agent looks for skills.

**Claude Code, for every project:**
```bash
git clone https://github.com/betsegaw-degefe/flow-paths.git ~/.claude/skills/flow-paths
```

**Claude Code, for one project** (shared with everyone who uses the repo):
```bash
git clone https://github.com/betsegaw-degefe/flow-paths.git .claude/skills/flow-paths
```

Then ask for it in plain words, for example: *"Show the upload, sharing and viewing paths through
our photo service as a flow-paths page."*

Other agents that read `SKILL.md` skills can use it the same way. Without an agent, you can write
a spec by hand and build it yourself (below).

## Requirements

- Node.js 18 or later, to build. No packages to install.
- Google Chrome or Chromium, only for `snapshot.mjs`. Set `CHROME_PATH` if it is somewhere unusual.

## Use without an agent

```bash
node bin/build.mjs examples/online-order.json out/online-order.html
node bin/snapshot.mjs out/online-order.html out/shots
```

`build.mjs` checks the spec first. It refuses a spec with errors (an unknown node, overlapping
boxes, an unknown colour) and warns about things a reader would notice (text too long for its
box, a line running behind a box). `--fragment` writes the page without its outer document tags,
for hosts that add their own.

`snapshot.mjs` writes a screenshot of every tab in light and dark, and reports whether the page
scrolls sideways at desktop or phone width.

The spec format, layout advice and writing guidance are in [`SKILL.md`](SKILL.md).

## What the page does

- Tabs for **All** and each path; `#<path-id>` in the URL opens a path directly.
- Previous, Next, Play/Pause, a clickable step list, and the left and right arrow keys.
- Light and dark themes, following the system until the reader chooses.
- Works at phone width; the diagram scrolls inside its own frame.
- Respects reduced motion: no animation, same content.
- One self-contained HTML file; nothing to host.

## Layout of the repo

```
SKILL.md                 instructions the agent follows
assets/template.html     the page; the spec is injected into it
bin/build.mjs            checks a spec and writes the page
bin/snapshot.mjs         screenshots every tab, checks for sideways scroll
examples/                specs and the pages built from them
```

## Licence

MIT. See [`LICENSE`](LICENSE).
