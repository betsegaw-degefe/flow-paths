#!/usr/bin/env node
// Builds a flow-paths page from a JSON spec.
//
//   node bin/build.mjs <spec.json> <out.html> [--fragment]
//
// The spec is checked first; any error stops the build and is printed with where it is.
// --fragment writes the page without <!doctype>/<html>/<head>/<body>, for hosts that add
// their own document skeleton (such as a claude.ai Artifact).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = resolve(here, "../assets/template.html");

export const COLORS = ["green", "rose", "blue", "amber", "violet", "teal"];
export const STYLES = ["solid", "strong", "dashed"];
const ID = /^[a-z][a-z0-9-]*$/i;

// Box geometry, as the template draws it.
const H = 62, ROW_H = 95, FIRST_Y = 100, MIN_GAP = 16;
// Roughly how many characters fit in a box: the name in the display face, the subtitle in mono.
const MAX_LABEL = 19, MAX_SUB = 26, MAX_EDGE_LABEL = 22;

export function check(spec) {
  const errors = [], warnings = [];
  const err = (where, msg) => errors.push(`${where}: ${msg}`);
  const warn = (where, msg) => warnings.push(`${where}: ${msg}`);
  const str = v => typeof v === "string" && v.trim().length > 0;

  if (!spec || typeof spec !== "object") return { errors: ["spec: must be a JSON object"], warnings };
  if (!str(spec.title)) err("title", "required");

  const cols = spec.columns;
  if (!Array.isArray(cols) || cols.length < 1 || cols.length > 7) err("columns", "1 to 7 columns are required");
  else cols.forEach((c, i) => { if (!str(c && c.label)) err(`columns[${i}].label`, "required"); });

  const kindIds = new Set();
  if (spec.kinds != null) {
    if (!Array.isArray(spec.kinds)) err("kinds", "must be an array");
    else spec.kinds.forEach((k, i) => {
      const at = `kinds[${i}]`;
      if (!str(k.id) || !ID.test(k.id)) err(`${at}.id`, "a simple id is required");
      else if (kindIds.has(k.id)) err(`${at}.id`, `"${k.id}" is used twice`);
      else kindIds.add(k.id);
      if (!str(k.label)) err(`${at}.label`, "required");
      if (k.style != null && !STYLES.includes(k.style)) err(`${at}.style`, `must be one of ${STYLES.join(", ")}`);
    });
  }

  const nodes = spec.nodes;
  const ys = {};
  if (!nodes || typeof nodes !== "object" || Array.isArray(nodes) || !Object.keys(nodes).length) err("nodes", "an object of nodes keyed by id is required");
  else for (const id in nodes) {
    const n = nodes[id], at = `nodes.${id}`;
    if (!ID.test(id)) err(at, "ids are letters, digits and dashes, starting with a letter");
    if (!str(n.label)) err(`${at}.label`, "required");
    else if (n.label.length > MAX_LABEL) warn(`${at}.label`, `"${n.label}" is ${n.label.length} characters; about ${MAX_LABEL} fit in a box`);
    if (n.description != null && !str(n.description)) err(`${at}.description`, "must be text when given");
    if (n.sub != null && n.sub.length > MAX_SUB) warn(`${at}.sub`, `"${n.sub}" is ${n.sub.length} characters; about ${MAX_SUB} fit in a box`);
    if (!Number.isInteger(n.column) || !Array.isArray(cols) || n.column < 0 || n.column >= cols.length) err(`${at}.column`, `must be a column index from 0 to ${(cols || []).length - 1}`);
    const hasY = typeof n.y === "number", hasRow = typeof n.row === "number";
    if (hasY === hasRow) err(at, "give exactly one of row or y");
    else {
      const y = hasY ? n.y : FIRST_Y + n.row * ROW_H;
      if (y < FIRST_Y - 10) err(at, `sits too high (y ${y}); the column headings need the space above y ${FIRST_Y - 10}`);
      ys[id] = y;
    }
    if (n.kind != null && !kindIds.has(n.kind)) err(`${at}.kind`, `"${n.kind}" is not one of the kinds`);
  }

  // Two boxes in one column must not touch.
  if (nodes && typeof nodes === "object") {
    const ids = Object.keys(ys);
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i], b = ids[j];
      if (nodes[a].column === nodes[b].column && Math.abs(ys[a] - ys[b]) < H + MIN_GAP) {
        err(`nodes.${a}`, `overlaps nodes.${b} in column ${nodes[a].column}; move them at least ${H + MIN_GAP} apart in y (or one row)`);
      }
    }
  }

  const edges = spec.edges;
  const seen = new Set();
  if (!edges || typeof edges !== "object" || Array.isArray(edges) || !Object.keys(edges).length) err("edges", "an object of edges keyed by id is required");
  else for (const id in edges) {
    const e = edges[id], at = `edges.${id}`;
    if (!ID.test(id)) err(at, "ids are letters, digits and dashes, starting with a letter");
    for (const end of ["from", "to"]) if (!nodes || !nodes[e[end]]) err(`${at}.${end}`, `"${e[end]}" is not a node`);
    if (e.from === e.to) err(at, "an edge must join two different nodes");
    const key = `${e.from}>${e.to}`;
    if (seen.has(key)) err(at, `a second edge from ${e.from} to ${e.to}; reuse the first one and give each step its own label`);
    seen.add(key);
    if (e.label != null && e.label.length > MAX_EDGE_LABEL) warn(`${at}.label`, `"${e.label}" is long and may collide with neighbours`);
    if (e.labelAt != null && !(e.labelAt > 0 && e.labelAt < 1)) err(`${at}.labelAt`, "must be between 0 and 1");
    // An edge that skips a column is drawn straight through it, so a box there at a height
    // between the two ends would sit on top of the line.
    const a = nodes && nodes[e.from], b = nodes && nodes[e.to];
    if (a && b && e.from in ys && e.to in ys && Math.abs(a.column - b.column) > 1) {
      const lo = Math.min(ys[e.from], ys[e.to]) - H / 2, hi = Math.max(ys[e.from], ys[e.to]) + H / 2;
      for (const other in ys) {
        const c = nodes[other].column;
        if (c > Math.min(a.column, b.column) && c < Math.max(a.column, b.column) && ys[other] > lo && ys[other] < hi) {
          warn(at, `runs behind nodes.${other}; move one of them to a different row`);
        }
      }
    }
  }

  const paths = spec.paths;
  const pathIds = new Set(), usedColors = new Set();
  if (!Array.isArray(paths) || paths.length < 1 || paths.length > COLORS.length) err("paths", `1 to ${COLORS.length} paths are required`);
  else paths.forEach((p, i) => {
    const at = `paths[${i}]`;
    if (!str(p.id) || !ID.test(p.id)) err(`${at}.id`, "a simple id is required");
    else if (p.id === "all") err(`${at}.id`, `"all" is reserved for the All tab`);
    else if (pathIds.has(p.id)) err(`${at}.id`, `"${p.id}" is used twice`);
    else pathIds.add(p.id);
    if (!str(p.name)) err(`${at}.name`, "required");
    if (!COLORS.includes(p.color)) err(`${at}.color`, `must be one of ${COLORS.join(", ")}`);
    else if (usedColors.has(p.color)) warn(`${at}.color`, `"${p.color}" is already used by another path`);
    else usedColors.add(p.color);
    if (!Array.isArray(p.steps) || !p.steps.length) err(`${at}.steps`, "at least one step is required");
    else p.steps.forEach((s, j) => {
      const sat = `${at}.steps[${j}]`;
      if (!edges || !edges[s.edge]) err(`${sat}.edge`, `"${s.edge}" is not an edge`);
      if (!str(s.title)) err(`${sat}.title`, "required");
      if (!str(s.text)) err(`${sat}.text`, "required");
      if (s.label != null && s.label.length > MAX_EDGE_LABEL) warn(`${sat}.label`, `"${s.label}" is long and may collide with neighbours`);
    });
  });

  // An edge no path uses is still drawn, but never animates; usually a leftover.
  if (edges && Array.isArray(paths)) {
    const used = new Set(paths.flatMap(p => (p.steps || []).map(s => s.edge)));
    for (const id in edges) if (!used.has(id)) warn(`edges.${id}`, "no step uses this edge");
  }
  if (spec.stepSeconds != null && !(spec.stepSeconds >= 1.5 && spec.stepSeconds <= 30)) err("stepSeconds", "must be between 1.5 and 30");

  return { errors, warnings };
}

const escapeHtml = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function render(spec, { fragment = false } = {}) {
  // "</" is escaped so text in the spec cannot close the script it is embedded in.
  const json = JSON.stringify(spec).replace(/<\//g, "<\\/").replace(/[\u2028\u2029]/g, c => `\\u${c.charCodeAt(0).toString(16)}`);
  const page = readFileSync(TEMPLATE, "utf8")
    .replace("__PAGE_TITLE__", () => escapeHtml(spec.pageTitle || spec.title))
    .replace("/*__FLOW_SPEC__*/null", () => json);
  if (fragment) return page;
  const end = page.indexOf("</style>") + "</style>".length;
  return `<!doctype html>
<html lang="${escapeHtml(spec.lang || "en")}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${page.slice(0, end)}
</head>
<body>
${page.slice(end).trimStart()}</body>
</html>
`;
}

function main(argv) {
  const args = argv.filter(a => !a.startsWith("--"));
  const fragment = argv.includes("--fragment");
  if (args.length !== 2) {
    console.error("usage: node bin/build.mjs <spec.json> <out.html> [--fragment]");
    return 2;
  }
  const [specPath, outPath] = args;
  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, "utf8"));
  } catch (e) {
    console.error(`Could not read ${specPath}: ${e.message}`);
    return 1;
  }
  const { errors, warnings } = check(spec);
  for (const w of warnings) console.warn(`warning  ${w}`);
  if (errors.length) {
    for (const e of errors) console.error(`error    ${e}`);
    console.error(`\n${errors.length} error(s); nothing written.`);
    return 1;
  }
  mkdirSync(dirname(resolve(outPath)), { recursive: true });
  writeFileSync(outPath, render(spec, { fragment }));
  console.log(`Wrote ${outPath}${fragment ? " (fragment)" : ""}: ${spec.paths.length} path(s), ${Object.keys(spec.nodes).length} nodes, ${Object.keys(spec.edges).length} edges.`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
