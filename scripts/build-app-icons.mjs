/**
 * Renders the alternate app icons (expo-alternate-app-icons) from their SVG sources.
 *
 * Each source in assets/images/app-icons/source/ has a `<g id="background">` and a `<g id="foreground">` (the F and
 * what is attached to it). Per icon this writes, in assets/images/app-icons/:
 *   <name>.png             iOS icon: the whole artwork, 1024x1024
 *   <name>-foreground.png  Android adaptive foreground: the foreground layer, transparent
 *   <name>-background.png  Android adaptive background: the background layer over the `data-bleed` color
 *   <name>-preview.png     PREVIEW_SIZE copy for the in-app picker (also default-preview.png, from the default icon)
 * Both Android layers are scaled down to ADAPTIVE_SCALE, so the launcher mask (the central 72 of 108 dp) shows the
 * whole artwork, as the iOS icon does.
 *
 * Needs rsvg-convert (brew install librsvg). Run: node scripts/build-app-icons.mjs
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DIR = path.join(import.meta.dirname, "..", "assets", "images", "app-icons");
const SOURCE = path.join(DIR, "source");
const SIZE = 1024;
const ADAPTIVE_SCALE = 0.68;
const PREVIEW_SIZE = 144;

const scaled = (content) =>
  `<g transform="translate(${SIZE / 2} ${SIZE / 2}) scale(${ADAPTIVE_SCALE}) translate(${-SIZE / 2} ${-SIZE / 2})">${content}</g>`;

function render(svg, out, size = SIZE) {
  const tmp = path.join(os.tmpdir(), `fastmemo-icon-${process.pid}.svg`);
  fs.writeFileSync(tmp, svg);
  execFileSync("rsvg-convert", ["-w", String(size), "-h", String(size), "-o", out, tmp]);
  fs.rmSync(tmp);
  console.log("wrote", path.relative(process.cwd(), out));
}

for (const file of fs.readdirSync(SOURCE).filter((f) => f.endsWith(".svg"))) {
  const name = path.basename(file, ".svg");
  const svg = fs.readFileSync(path.join(SOURCE, file), "utf8");

  const bgStart = svg.indexOf('<g id="background">');
  const fgStart = svg.indexOf('<g id="foreground">');
  const end = svg.lastIndexOf("</svg>");
  const bleed = svg.match(/data-bleed="([^"]+)"/)?.[1];
  if (bgStart < 0 || fgStart < bgStart || !bleed) throw new Error(`${file}: needs a background, a foreground and data-bleed`);

  const head = svg.slice(0, bgStart);
  const background = svg.slice(bgStart, fgStart);
  const foreground = svg.slice(fgStart, end);

  render(svg, path.join(DIR, `${name}.png`));
  render(svg, path.join(DIR, `${name}-preview.png`), PREVIEW_SIZE);
  render(`${head}${scaled(foreground)}</svg>`, path.join(DIR, `${name}-foreground.png`));
  render(
    `${head}<rect width="${SIZE}" height="${SIZE}" fill="${bleed}"/>${scaled(background)}</svg>`,
    path.join(DIR, `${name}-background.png`)
  );
}

const defaultIcon = fs.readFileSync(path.join(DIR, "..", "icon.png")).toString("base64");
render(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}"><image width="${SIZE}" height="${SIZE}" href="data:image/png;base64,${defaultIcon}"/></svg>`,
  path.join(DIR, "default-preview.png"),
  PREVIEW_SIZE
);
