// The Passport Page of a Country That Isn't There — round 2 rebuild.
// Republic of Caldara — invented North Atlantic island, ferry only, no airport.
// Holder: Mara Ellin Voss, lighthouse keeper. Passport CD 4471 902.
// Everything is drawn programmatically from scratch: no assets, no network,
// no randomness. The program is fully deterministic: two runs produce
// byte-identical PNGs.
//
// Travel history (strictly chronological; every exit precedes its matching
// entry; nothing predates issue, 12 JUN 2024):
//   18 JUN 2024  EXIT  Caldara, Port Vey      ->  18 JUN 2024  ENTRY Meridia, Port Anselm
//   25 JUN 2024  EXIT  Meridia, Port Anselm   ->  25 JUN 2024  ENTRY Caldara, Port Vey
//   09 SEP 2024  EXIT  Caldara, Port Vey      ->  09 SEP 2024  ENTRY Isle of Tarn, Tarn Quay
//   16 SEP 2024  EXIT  Isle of Tarn, Tarn Quay -> 16 SEP 2024 ENTRY Caldara, Port Vey
//   02 MAR 2025  EXIT  Caldara, Port Vey      ->  03 MAR 2025  ENTRY Meridia, Port Anselm
//   10 MAR 2025  EXIT  Meridia, Port Anselm   ->  10 MAR 2025  ENTRY Caldara, Port Vey
// MRZ check digits are computed by the program (ICAO 9303 weights 7-3-1).

import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { Buffer } from "node:buffer";

// ---------------------------------------------------------------- canvas
const W = 1024;
const H = 1024;
const px = new Uint8ClampedArray(W * H * 4);

type RGB = [number, number, number];

function blend(x: number, y: number, c: RGB, a: number): void {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix < 0 || iy < 0 || ix >= W || iy >= H || a <= 0) return;
  if (a > 1) a = 1;
  const o = (iy * W + ix) * 4;
  const inv = 1 - a;
  px[o] = Math.round(c[0] * a + px[o] * inv);
  px[o + 1] = Math.round(c[1] * a + px[o + 1] * inv);
  px[o + 2] = Math.round(c[2] * a + px[o + 2] * inv);
  px[o + 3] = 255;
}

function fillRect(x: number, y: number, w: number, h: number, c: RGB, a = 1): void {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(W, Math.ceil(x + w));
  const y1 = Math.min(H, Math.ceil(y + h));
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const o = (yy * W + xx) * 4;
      if (a >= 1) {
        px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 255;
      } else {
        const inv = 1 - a;
        px[o] = Math.round(c[0] * a + px[o] * inv);
        px[o + 1] = Math.round(c[1] * a + px[o + 1] * inv);
        px[o + 2] = Math.round(c[2] * a + px[o + 2] * inv);
      }
    }
  }
}

function distToSeg(pxx: number, pyy: number, x0: number, y0: number, x1: number, y1: number): number {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((pxx - x0) * dx + (pyy - y0) * dy) / len2;
  if (t < 0) t = 0;
  if (t > 1) t = 1;
  const cx = x0 + t * dx;
  const cy = y0 + t * dy;
  return Math.hypot(pxx - cx, pyy - cy);
}

// Anti-aliased thick line with round caps.
function line(x0: number, y0: number, x1: number, y1: number, w: number, c: RGB, a = 1): void {
  const r = w / 2;
  const minX = Math.floor(Math.min(x0, x1) - r - 1);
  const maxX = Math.ceil(Math.max(x0, x1) + r + 1);
  const minY = Math.floor(Math.min(y0, y1) - r - 1);
  const maxY = Math.ceil(Math.max(y0, y1) + r + 1);
  for (let yy = minY; yy <= maxY; yy++) {
    for (let xx = minX; xx <= maxX; xx++) {
      const d = distToSeg(xx + 0.5, yy + 0.5, x0, y0, x1, y1);
      const cov = r + 0.55 - d;
      if (cov > 0) blend(xx, yy, c, Math.min(1, cov) * a);
    }
  }
}

function polyline(pts: number[][], w: number, c: RGB, a = 1): void {
  for (let i = 0; i + 1 < pts.length; i++) {
    line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], w, c, a);
  }
}

function fillCircle(cx: number, cy: number, r: number, c: RGB, a = 1): void {
  const minX = Math.floor(cx - r - 1);
  const maxX = Math.ceil(cx + r + 1);
  const minY = Math.floor(cy - r - 1);
  const maxY = Math.ceil(cy + r + 1);
  for (let yy = minY; yy <= maxY; yy++) {
    for (let xx = minX; xx <= maxX; xx++) {
      const d = Math.hypot(xx + 0.5 - cx, yy + 0.5 - cy);
      const cov = r + 0.55 - d;
      if (cov > 0) blend(xx, yy, c, Math.min(1, cov) * a);
    }
  }
}

function fillEllipse(cx: number, cy: number, rx: number, ry: number, c: RGB, a = 1): void {
  const minX = Math.floor(cx - rx - 1);
  const maxX = Math.ceil(cx + rx + 1);
  const minY = Math.floor(cy - ry - 1);
  const maxY = Math.ceil(cy + ry + 1);
  for (let yy = minY; yy <= maxY; yy++) {
    for (let xx = minX; xx <= maxX; xx++) {
      const nx = (xx + 0.5 - cx) / rx;
      const ny = (yy + 0.5 - cy) / ry;
      const d = Math.sqrt(nx * nx + ny * ny);
      const cov = 1.02 - d;
      if (cov > 0) blend(xx, yy, c, Math.min(1, cov * 2) * a);
    }
  }
}

// Even-odd scanline polygon fill (crisp edges, document style).
function fillPoly(pts: number[][], c: RGB, a = 1): void {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p[1] < minY) minY = p[1];
    if (p[1] > maxY) maxY = p[1];
  }
  for (let yy = Math.floor(minY); yy <= Math.ceil(maxY); yy++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const p0 = pts[i];
      const p1 = pts[(i + 1) % pts.length];
      if ((p0[1] <= yy + 0.5 && p1[1] > yy + 0.5) || (p1[1] <= yy + 0.5 && p0[1] > yy + 0.5)) {
        const t = (yy + 0.5 - p0[1]) / (p1[1] - p0[1]);
        xs.push(p0[0] + t * (p1[0] - p0[0]));
      }
    }
    xs.sort((m, n) => m - n);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let xx = Math.ceil(xs[k]); xx <= Math.floor(xs[k + 1]); xx++) {
        blend(xx, yy, c, a);
      }
    }
  }
}

function strokeRect(x: number, y: number, w: number, h: number, lw: number, c: RGB, a = 1): void {
  line(x, y, x + w, y, lw, c, a);
  line(x + w, y, x + w, y + h, lw, c, a);
  line(x + w, y + h, x, y + h, lw, c, a);
  line(x, y + h, x, y, lw, c, a);
}

// ---------------------------------------------------------------- stroke font
// Single-stroke capitals on a 5 x 7 grid (x 0..4, y 0..6). Each glyph is a
// list of strokes; each stroke is a flat [x0,y0,x1,y1,...] polyline.
const GLYPHS: Record<string, number[][]> = {
  A: [[0, 6, 2, 0, 4, 6], [1, 4, 3, 4]],
  B: [[0, 0, 0, 6], [0, 0, 2.5, 0, 3.5, 1, 3.5, 2, 2.5, 3, 0, 3], [0, 3, 2.5, 3, 3.5, 4, 3.5, 5, 2.5, 6, 0, 6]],
  C: [[4, 1, 3, 0, 1, 0, 0, 1, 0, 5, 1, 6, 3, 6, 4, 5]],
  D: [[0, 0, 0, 6, 2, 6, 4, 4, 4, 2, 2, 0, 0, 0]],
  E: [[4, 0, 0, 0, 0, 6, 4, 6], [0, 3, 3, 3]],
  F: [[4, 0, 0, 0, 0, 6], [0, 3, 3, 3]],
  G: [[4, 1, 3, 0, 1, 0, 0, 1, 0, 5, 1, 6, 3, 6, 4, 5, 4, 3, 2, 3]],
  H: [[0, 0, 0, 6], [4, 0, 4, 6], [0, 3, 4, 3]],
  I: [[2, 0, 2, 6], [1, 0, 3, 0], [1, 6, 3, 6]],
  J: [[3, 0, 3, 5, 2, 6, 1, 6, 0, 5]],
  K: [[0, 0, 0, 6], [4, 0, 0, 3, 4, 6]],
  L: [[0, 0, 0, 6, 4, 6]],
  M: [[0, 6, 0, 0, 2, 3, 4, 0, 4, 6]],
  N: [[0, 6, 0, 0, 4, 6, 4, 0]],
  O: [[1, 0, 3, 0, 4, 1, 4, 5, 3, 6, 1, 6, 0, 5, 0, 1, 1, 0]],
  P: [[0, 6, 0, 0, 3, 0, 4, 1, 4, 2, 3, 3, 0, 3]],
  Q: [[1, 0, 3, 0, 4, 1, 4, 5, 3, 6, 1, 6, 0, 5, 0, 1, 1, 0], [2.5, 4, 4, 6]],
  R: [[0, 6, 0, 0, 3, 0, 4, 1, 4, 2, 3, 3, 0, 3], [2, 3, 4, 6]],
  S: [[4, 1, 3, 0, 1, 0, 0, 1, 0, 2, 4, 4, 4, 5, 3, 6, 1, 6, 0, 5]],
  T: [[0, 0, 4, 0], [2, 0, 2, 6]],
  U: [[0, 0, 0, 5, 1, 6, 3, 6, 4, 5, 4, 0]],
  V: [[0, 0, 2, 6, 4, 0]],
  W: [[0, 0, 1, 6, 2, 3, 3, 6, 4, 0]],
  X: [[0, 0, 4, 6], [4, 0, 0, 6]],
  Y: [[0, 0, 2, 3, 4, 0], [2, 3, 2, 6]],
  Z: [[0, 0, 4, 0, 0, 6, 4, 6]],
  "0": [[1, 0, 3, 0, 4, 1, 4, 5, 3, 6, 1, 6, 0, 5, 0, 1, 1, 0], [1, 4, 3, 2]],
  "1": [[1, 1, 2, 0, 2, 6], [0, 6, 4, 6]],
  "2": [[0, 1, 1, 0, 3, 0, 4, 1, 4, 2, 0, 6, 4, 6]],
  "3": [[1, 0, 3, 0, 4, 1, 4, 2, 3, 3], [3, 3, 4, 4, 4, 5, 3, 6, 1, 6]],
  "4": [[3, 0, 0, 4, 4, 4], [3, 0, 3, 6]],
  "5": [[4, 0, 0, 0, 0, 3, 3, 3, 4, 4, 4, 5, 3, 6, 1, 6, 0, 5]],
  "6": [[3, 0, 1, 0, 0, 2, 0, 5, 1, 6, 3, 6, 4, 5, 4, 3, 3, 2, 1, 2, 0, 3]],
  "7": [[0, 0, 4, 0, 2, 6]],
  "8": [[0, 2, 0, 1, 1, 0, 3, 0, 4, 1, 4, 2, 3, 3, 1, 3, 0, 2], [0, 4, 0, 5, 1, 6, 3, 6, 4, 5, 4, 4, 3, 3, 1, 3, 0, 4]],
  "9": [[4, 6, 4, 1, 3, 0, 1, 0, 0, 1, 0, 3, 1, 4, 3, 4, 4, 3]],
  "<": [[4, 1, 1, 3, 4, 5]],
  ">": [[1, 1, 4, 3, 1, 5]],
  "-": [[0, 3, 4, 3]],
  ".": [[2, 5.4, 2, 6]],
  ",": [[2, 5, 2, 6, 1, 7]],
  ":": [[2, 1.8, 2, 2.4], [2, 4.8, 2, 5.4]],
  "/": [[4, 6, 0, 0]],
  "(": [[3, 0, 1, 2, 1, 4, 3, 6]],
  ")": [[1, 0, 3, 2, 3, 4, 1, 6]],
  "'": [[2, 0, 2, 2]],
  "+": [[2, 0, 2, 6], [0, 3, 4, 3]],
  "=": [[0, 2, 4, 2], [0, 4, 4, 4]],
  "!": [[2, 0, 2, 4], [2, 5.4, 2, 6]],
  "?": [[1, 1, 2, 0, 3, 0, 4, 1, 4, 2, 3, 3, 2, 3], [2, 5.4, 2, 6]],
  "&": [[4, 1, 3, 0, 1, 0, 0, 1, 0, 3, 2, 3, 4, 5, 4, 6, 3, 6], [2, 3, 0, 5]],
};
const NARROW: Record<string, number> = { ".": 3, ",": 3, ":": 3, "'": 3, "!": 3, I: 4, "1": 4.5, "/": 5, "(": 4, ")": 4 };

function glyphAdvance(ch: string): number {
  return NARROW[ch] ?? 6;
}

function textWidth(s: string, scale: number, tracking = 0): number {
  let w = 0;
  for (const ch of s) w += (glyphAdvance(ch) + tracking) * scale;
  return w - tracking * scale;
}

interface TextOpts {
  align?: "left" | "center" | "right";
  tracking?: number;
  rotate?: number; // degrees, about the anchor point
  lw?: number; // line width override
}

// Draw text; (x, y) is the top-left of the glyph box for left align,
// the top-center for center align, the top-right for right align.
function text(s: string, x: number, y: number, scale: number, c: RGB, opts: TextOpts = {}): void {
  const align = opts.align ?? "left";
  const tracking = opts.tracking ?? 0;
  const rot = ((opts.rotate ?? 0) * Math.PI) / 180;
  const lw = opts.lw ?? Math.max(1, scale * 0.42);
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  let startX = x;
  const total = textWidth(s, scale, tracking);
  if (align === "center") startX = x - total / 2;
  if (align === "right") startX = x - total;
  let cx = startX;
  for (const raw of s) {
    const ch = raw === " " ? " " : raw.toUpperCase();
    if (ch === " ") {
      cx += (6 + tracking) * scale;
      continue;
    }
    if (ch === "•") {
      const dotX = cx + 2 * scale;
      const dotY = y + 3.2 * scale;
      fillCircle(dotX, dotY, Math.max(1.4, scale * 0.55), c);
      cx += (6 + tracking) * scale;
      continue;
    }
    const strokes = GLYPHS[ch];
    if (strokes) {
      for (const st of strokes) {
        for (let i = 0; i + 3 < st.length; i += 2) {
          const ax = cx + st[i] * scale;
          const ay = y + st[i + 1] * scale;
          const bx = cx + st[i + 2] * scale;
          const by = y + st[i + 3] * scale;
          // rotate about anchor (x, y)
          const rax = x + (ax - x) * cos - (ay - y) * sin;
          const ray = y + (ax - x) * sin + (ay - y) * cos;
          const rbx = x + (bx - x) * cos - (by - y) * sin;
          const rby = y + (bx - x) * sin + (by - y) * cos;
          line(rax, ray, rbx, rby, lw, c);
        }
      }
    }
    cx += (glyphAdvance(ch) + tracking) * scale;
  }
}

// ---------------------------------------------------------------- palette
const INK: RGB = [29, 47, 69]; // deep navy ink
const INK_SOFT: RGB = [74, 92, 110];
const PAPER: RGB = [246, 239, 221];
const PAPER2: RGB = [242, 233, 210];
const GOLD: RGB = [176, 138, 58];
const BURGUNDY: RGB = [122, 42, 46];
const MERIDIA_BLUE: RGB = [36, 69, 126];
const TARN_GREEN: RGB = [44, 93, 63];
const DESK: RGB = [35, 39, 46];
const PORTRAIT_BG: RGB = [125, 152, 158];
const SKIN: RGB = [214, 176, 142];
const SKIN_DARK: RGB = [196, 152, 118];
const HAIR: RGB = [52, 40, 32];
const JACKET: RGB = [34, 54, 79];

// ---------------------------------------------------------------- MRZ (ICAO 9303)
const MRZ_VALUES: Record<string, number> = {};
for (let i = 0; i < 10; i++) MRZ_VALUES[String(i)] = i;
for (let i = 0; i < 26; i++) MRZ_VALUES[String.fromCharCode(65 + i)] = 10 + i;
MRZ_VALUES["<"] = 0;

function mrzCheck(s: string): number {
  const w = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < s.length; i++) sum += (MRZ_VALUES[s[i]] ?? 0) * w[i % 3];
  return sum % 10;
}

const DOC_NO = "CD4471902";
const DOC_CHECK = mrzCheck(DOC_NO);
const DOB = "880314";
const DOB_CHECK = mrzCheck(DOB);
const EXPIRY = "340612";
const EXP_CHECK = mrzCheck(EXPIRY);
const PERSONAL = "<<<<<<<<<<<<<<";
const PERSONAL_CHECK = mrzCheck(PERSONAL);
const COMPOSITE_SRC =
  DOC_NO + DOC_CHECK + DOB + DOB_CHECK + EXPIRY + EXP_CHECK + PERSONAL + PERSONAL_CHECK;
const COMPOSITE_CHECK = mrzCheck(COMPOSITE_SRC);

const MRZ1 = "P<CLDVOSS<<MARA<ELLIN<<<<<<<<<<<<<<<<<<<<<<<";
const MRZ2 =
  DOC_NO + DOC_CHECK + "CLD" + DOB + DOB_CHECK + "F" + EXPIRY + EXP_CHECK + PERSONAL + PERSONAL_CHECK + COMPOSITE_CHECK;

// ---------------------------------------------------------------- helpers
function rule(x: number, y: number, w: number, c: RGB, lw = 1.5): void {
  line(x, y, x + w, y, lw, c);
}

function labelValue(x: number, y: number, label: string, value: string, vScale: number, c: RGB = INK): void {
  text(label, x, y, 1.25, INK_SOFT, { tracking: 0.4 });
  text(value, x, y + 13, vScale, c, { tracking: 0.2 });
}

// Four-point star (for the arms).
function star(cx: number, cy: number, r: number, c: RGB): void {
  fillPoly(
    [
      [cx, cy - r], [cx + r * 0.28, cy - r * 0.28], [cx + r, cy],
      [cx + r * 0.28, cy + r * 0.28], [cx, cy + r], [cx - r * 0.28, cy + r * 0.28],
      [cx - r, cy], [cx - r * 0.28, cy - r * 0.28],
    ],
    c,
  );
}

// ---------------------------------------------------------------- coat of arms
function coatOfArms(cx: number, top: number, s: number): void {
  // Shield outline.
  const sh: number[][] = [
    [cx - 30 * s, top], [cx + 30 * s, top], [cx + 30 * s, top + 34 * s],
    [cx + 22 * s, top + 56 * s], [cx, top + 70 * s], [cx - 22 * s, top + 56 * s],
    [cx - 30 * s, top + 34 * s],
  ];
  fillPoly(sh, [232, 226, 205]);
  polyline([...sh, sh[0]], 2.2, INK);
  // Sea at the foot of the shield.
  for (let i = 0; i < 3; i++) {
    const wy = top + (52 + i * 5) * s;
    line(cx - 20 * s, wy, cx - 8 * s, wy - 3 * s, 1.6, INK);
    line(cx - 6 * s, wy, cx + 6 * s, wy - 3 * s, 1.6, INK);
    line(cx + 8 * s, wy, cx + 20 * s, wy - 3 * s, 1.6, INK);
  }
  // Lighthouse tower.
  fillPoly(
    [
      [cx - 7 * s, top + 52 * s], [cx + 7 * s, top + 52 * s],
      [cx + 4.5 * s, top + 16 * s], [cx - 4.5 * s, top + 16 * s],
    ],
    INK,
  );
  // Lamp room and dome.
  fillRect(cx - 6.5 * s, top + 8 * s, 13 * s, 8 * s, GOLD);
  fillPoly([[cx - 7 * s, top + 8 * s], [cx + 7 * s, top + 8 * s], [cx, top + 1 * s]], GOLD);
  // Light beams.
  fillPoly(
    [[cx - 6 * s, top + 11 * s], [cx - 28 * s, top + 4 * s], [cx - 28 * s, top + 14 * s]],
    GOLD, 0.75,
  );
  fillPoly(
    [[cx + 6 * s, top + 11 * s], [cx + 28 * s, top + 4 * s], [cx + 28 * s, top + 14 * s]],
    GOLD, 0.75,
  );
  // Three stars above the lamp.
  star(cx - 16 * s, top + 6 * s, 3.4 * s, GOLD);
  star(cx, top + 0.5 * s, 3.4 * s, GOLD);
  star(cx + 16 * s, top + 6 * s, 3.4 * s, GOLD);
  // Motto ribbon.
  const my = top + 76 * s;
  fillPoly(
    [[cx - 34 * s, my], [cx + 34 * s, my], [cx + 30 * s, my + 11 * s], [cx - 30 * s, my + 11 * s]],
    INK,
  );
  text("LUX IN MARE", cx, my + 2.2 * s, 1.05, PAPER, { align: "center", tracking: 0.3 });
}

// ---------------------------------------------------------------- portrait
function portrait(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, PORTRAIT_BG);
  // Faint lighthouse silhouette behind the sitter (her workplace).
  const lx = x + w - 34;
  fillPoly([[lx - 7, y + 96], [lx + 7, y + 96], [lx + 4, y + 34], [lx - 4, y + 34]], [96, 122, 128]);
  fillRect(lx - 8, y + 26, 16, 8, [96, 122, 128]);
  fillPoly([[lx - 8, y + 26], [lx + 8, y + 26], [lx, y + 18]], [96, 122, 128]);
  line(lx - 8, y + 30, lx - 24, y + 24, 1.4, [160, 178, 182], 0.8);
  line(lx + 8, y + 30, lx + 24, y + 24, 1.4, [160, 178, 182], 0.8);
  for (let i = 0; i < 3; i++) {
    line(x + 8, y + h - 14 - i * 6, x + w - 8, y + h - 14 - i * 6, 1.2, [96, 122, 128], 0.7);
  }
  // Hair bun.
  fillCircle(x + w / 2 + 4, y + 22, 10, HAIR);
  // Neck and shoulders: keeper's navy jacket.
  fillRect(x + w / 2 - 9, y + 84, 18, 22, SKIN_DARK);
  fillPoly(
    [
      [x + 6, y + h], [x + 6, y + 152], [x + 34, y + 118], [x + w / 2 - 10, y + 106],
      [x + w / 2 + 10, y + 106], [x + w - 34, y + 118], [x + w - 6, y + 152], [x + w - 6, y + h],
    ],
    JACKET,
  );
  // White shirt V and collar.
  fillPoly([[x + w / 2 - 10, y + 106], [x + w / 2 + 10, y + 106], [x + w / 2, y + 134]], [240, 236, 224]);
  line(x + w / 2 - 10, y + 106, x + w / 2, y + 122, 1.4, INK_SOFT);
  line(x + w / 2 + 10, y + 106, x + w / 2, y + 122, 1.4, INK_SOFT);
  // Brass button and a tiny lighthouse pin on the lapel.
  fillCircle(x + w / 2, y + 158, 3, GOLD);
  fillCircle(x + w - 40, y + 140, 2.2, GOLD);
  line(x + w - 40, y + 140, x + w - 40, y + 132, 1.6, GOLD);
  // Head.
  fillEllipse(x + w / 2, y + 60, 25, 31, SKIN);
  fillPoly(
    [
      [x + w / 2 - 25, y + 52], [x + w / 2 - 22, y + 78], [x + w / 2 - 12, y + 90],
      [x + w / 2 + 12, y + 90], [x + w / 2 + 22, y + 78], [x + w / 2 + 25, y + 52],
    ],
    SKIN,
  );
  // Hair: swept back, tied.
  fillPoly(
    [
      [x + w / 2 - 26, y + 58], [x + w / 2 - 27, y + 34], [x + w / 2 - 16, y + 20],
      [x + w / 2 + 14, y + 18], [x + w / 2 + 26, y + 32], [x + w / 2 + 26, y + 56],
      [x + w / 2 + 20, y + 42], [x + w / 2 + 8, y + 32], [x + w / 2 - 8, y + 32],
      [x + w / 2 - 20, y + 42],
    ],
    HAIR,
  );
  // Face: brows, eyes, nose, mouth.
  line(x + w / 2 - 17, y + 50, x + w / 2 - 8, y + 48, 1.6, HAIR);
  line(x + w / 2 + 8, y + 48, x + w / 2 + 17, y + 50, 1.6, HAIR);
  line(x + w / 2 - 16, y + 57, x + w / 2 - 8, y + 57, 1.8, [40, 32, 26]);
  line(x + w / 2 + 8, y + 57, x + w / 2 + 16, y + 57, 1.8, [40, 32, 26]);
  fillCircle(x + w / 2 - 12, y + 58.5, 1.7, [40, 32, 26]);
  fillCircle(x + w / 2 + 12, y + 58.5, 1.7, [40, 32, 26]);
  polyline([[x + w / 2 + 1, y + 59], [x + w / 2 - 1, y + 68], [x + w / 2 + 3, y + 70]], 1.5, SKIN_DARK);
  polyline([[x + w / 2 - 7, y + 79], [x + w / 2, y + 81], [x + w / 2 + 7, y + 79]], 1.6, [146, 90, 78]);
  // Small gold earring.
  fillCircle(x + w / 2 - 24, y + 66, 1.8, GOLD);
  strokeRect(x, y, w, h, 2, INK);
}

// Signature squiggle (holder's hand).
function signature(x: number, y: number, s: number): void {
  const pts: number[][] = [
    [0, 10], [4, 2], [8, 8], [12, 0], [14, 12], [18, 4], [22, 10], [26, 2],
    [30, 8], [34, 4], [38, 10], [44, 6], [48, 10], [54, 2], [58, 8], [62, 4],
    [68, 10], [74, 6], [80, 10], [86, 4], [92, 9], [98, 5], [104, 10],
  ].map(([a, b]) => [x + a * s, y + b * s]);
  polyline(pts, 1.8, INK);
}

// ---------------------------------------------------------------- stamps
interface Stamp {
  kind: "ENTRY" | "EXIT";
  place: string;
  port: string;
  date: string;
  color: RGB;
}

const STAMPS: Stamp[] = [
  { kind: "EXIT", place: "CALDARA", port: "PORT VEY", date: "18 JUN 2024", color: BURGUNDY },
  { kind: "ENTRY", place: "MERIDIA", port: "PORT ANSELM", date: "18 JUN 2024", color: MERIDIA_BLUE },
  { kind: "EXIT", place: "MERIDIA", port: "PORT ANSELM", date: "25 JUN 2024", color: MERIDIA_BLUE },
  { kind: "ENTRY", place: "CALDARA", port: "PORT VEY", date: "25 JUN 2024", color: BURGUNDY },
  { kind: "EXIT", place: "CALDARA", port: "PORT VEY", date: "09 SEP 2024", color: BURGUNDY },
  { kind: "ENTRY", place: "ISLE OF TARN", port: "TARN QUAY", date: "09 SEP 2024", color: TARN_GREEN },
  { kind: "EXIT", place: "ISLE OF TARN", port: "TARN QUAY", date: "16 SEP 2024", color: TARN_GREEN },
  { kind: "ENTRY", place: "CALDARA", port: "PORT VEY", date: "16 SEP 2024", color: BURGUNDY },
  { kind: "EXIT", place: "CALDARA", port: "PORT VEY", date: "02 MAR 2025", color: BURGUNDY },
  { kind: "ENTRY", place: "MERIDIA", port: "PORT ANSELM", date: "03 MAR 2025", color: MERIDIA_BLUE },
  { kind: "EXIT", place: "MERIDIA", port: "PORT ANSELM", date: "10 MAR 2025", color: MERIDIA_BLUE },
  { kind: "ENTRY", place: "CALDARA", port: "PORT VEY", date: "10 MAR 2025", color: BURGUNDY },
];

const STAMP_ROT = [-7, 5, -4, 6, 4, -6, 7, -5, 5, -7, 6, -4];

function stamp(x: number, y: number, w: number, h: number, s: Stamp, rot: number): void {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const rotRad = (rot * Math.PI) / 180;
  const cos = Math.cos(rotRad);
  const sin = Math.sin(rotRad);
  const rp = (pxx: number, pyy: number): [number, number] => {
    const dx = pxx - cx;
    const dy = pyy - cy;
    return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
  };
  // Double border, rotated.
  const corners = [rp(x, y), rp(x + w, y), rp(x + w, y + h), rp(x, y + h)];
  polyline([...corners, corners[0]], 2.2, s.color, 0.92);
  const inset = 5;
  const inner = [rp(x + inset, y + inset), rp(x + w - inset, y + inset), rp(x + w - inset, y + h - inset), rp(x + inset, y + h - inset)];
  polyline([...inner, inner[0]], 1.1, s.color, 0.85);
  // Text lines, rotated about their own anchors.
  const t = (str: string, tx: number, ty: number, scale: number, lw?: number): void => {
    text(str, tx, ty, scale, s.color, { align: "center", rotate: rot, lw });
  };
  t(s.kind, cx, y + 12, 1.7, 2);
  t(s.place, cx, y + 32, 1.45);
  // Small circle emblem with a lighthouse mark.
  const ex = cx;
  const ey = y + 58;
  const [erx, ery] = rp(ex, ey);
  const ecr = 9;
  const minX = Math.floor(erx - ecr - 1);
  const maxX = Math.ceil(erx + ecr + 1);
  const minY = Math.floor(ery - ecr - 1);
  const maxY = Math.ceil(ery + ecr + 1);
  for (let yy = minY; yy <= maxY; yy++) {
    for (let xx = minX; xx <= maxX; xx++) {
      const d = Math.hypot(xx + 0.5 - erx, yy + 0.5 - ery);
      if (Math.abs(d - ecr) < 0.9) blend(xx, yy, s.color, 0.9);
    }
  }
  line(erx - 2.5, ery + 5, erx + 2.5, ery + 5, 1.4, s.color, 0.9);
  line(erx - 1.5, ery + 5, erx - 1.5, ery - 4, 1.4, s.color, 0.9);
  line(erx + 1.5, ery + 5, erx + 1.5, ery - 4, 1.4, s.color, 0.9);
  line(erx - 2.2, ery - 4, erx + 2.2, ery - 4, 1.4, s.color, 0.9);
  fillCircle(erx, ery - 5.5, 1.4, s.color, 0.9);
  t(s.date, cx, y + 74, 1.75, 2);
  t(s.port, cx, y + 94, 1.2);
}

// Small ferry silhouette for the visa slip.
function ferry(x: number, y: number, s: number, c: RGB): void {
  fillPoly(
    [[x, y], [x + 62 * s, y], [x + 54 * s, y + 11 * s], [x + 8 * s, y + 11 * s]],
    c,
  );
  fillRect(x + 14 * s, y - 12 * s, 30 * s, 12 * s, c);
  fillRect(x + 24 * s, y - 22 * s, 4 * s, 10 * s, c);
  fillRect(x + 18 * s, y - 9 * s, 6 * s, 5 * s, PAPER2);
  fillRect(x + 28 * s, y - 9 * s, 6 * s, 5 * s, PAPER2);
  fillRect(x + 38 * s, y - 9 * s, 6 * s, 5 * s, PAPER2);
  line(x - 4 * s, y + 16 * s, x + 66 * s, y + 16 * s, 1.4, c);
  line(x + 4 * s, y + 21 * s, x + 58 * s, y + 21 * s, 1.4, c);
}

// ---------------------------------------------------------------- spread
function drawSpread(): void {
  fillRect(0, 0, W, H, DESK);
  // Soft shadows under the pages.
  fillRect(37 + 6, 110 + 8, 470, 800, [0, 0, 0], 0.45);
  fillRect(517 + 6, 110 + 8, 470, 800, [0, 0, 0], 0.45);

  // ================= LEFT PAGE — data page =================
  const L = 37;
  const T = 110;
  fillRect(L, T, 470, 800, PAPER);
  fillRect(L, T, 470, 800, PAPER2, 0.25);
  // Spine shading on the inner edge.
  fillRect(L + 462, T, 8, 800, [0, 0, 0], 0.06);
  // Faint guilloche arcs behind the header.
  for (let i = 0; i < 5; i++) {
    const yy = T + 96 + i * 4;
    line(L + 30, yy, L + 440, yy, 0.8, [120, 140, 160], 0.16);
  }

  text("REPUBLIC OF CALDARA", L + 235, T + 26, 3.1, INK, { align: "center", tracking: 0.5 });
  text("PASSPORT  •  PASSEPORT", L + 235, T + 56, 1.55, INK_SOFT, { align: "center", tracking: 0.5 });
  rule(L + 30, T + 82, 410, INK, 1.5);

  coatOfArms(L + 235, T + 96, 1.05);

  rule(L + 30, T + 210, 410, INK, 1.2);
  labelValue(L + 30, T + 222, "TYPE", "P", 1.9);
  labelValue(L + 130, T + 222, "CODE", "CLD", 1.9);
  labelValue(L + 250, T + 222, "PASSPORT NO.", "CD 4471 902", 1.9);
  rule(L + 30, T + 258, 410, INK, 1.2);

  // Portrait + identity fields.
  portrait(L + 30, T + 274, 150, 190);
  const fx = L + 204;
  labelValue(fx, T + 274, "SURNAME", "VOSS", 2.1);
  labelValue(fx, T + 318, "GIVEN NAMES", "MARA ELLIN", 2.1);
  labelValue(fx, T + 362, "NATIONALITY", "CALDARIAN", 2.1);
  labelValue(fx, T + 406, "OCCUPATION", "LIGHTHOUSE KEEPER", 1.9);

  // Second row of fields, full width.
  labelValue(L + 30, T + 482, "DATE OF BIRTH", "14 MAR 1988", 1.9);
  labelValue(L + 190, T + 482, "PLACE OF BIRTH", "PORT VEY", 1.9);
  labelValue(L + 360, T + 482, "SEX", "F", 1.9);
  labelValue(L + 30, T + 528, "DATE OF ISSUE", "12 JUN 2024", 1.9);
  labelValue(L + 190, T + 528, "DATE OF EXPIRY", "12 JUN 2034", 1.9);
  labelValue(L + 360, T + 528, "HEIGHT", "1.71 M", 1.9);
  labelValue(L + 30, T + 574, "AUTHORITY", "PORT VEY HARBOUR OFFICE", 1.9);

  // Holder's signature.
  text("HOLDER'S SIGNATURE", L + 30, T + 620, 1.25, INK_SOFT, { tracking: 0.4 });
  signature(L + 34, T + 636, 1.15);
  rule(L + 30, T + 656, 200, INK_SOFT, 1);

  // MRZ.
  rule(L + 30, T + 690, 410, INK, 1.2);
  text(MRZ1, L + 30, T + 702, 1.55, INK, { tracking: 0 });
  text(MRZ2, L + 30, T + 724, 1.55, INK, { tracking: 0 });
  text("THIS PASSPORT REMAINS THE PROPERTY OF THE REPUBLIC OF CALDARA", L + 235, T + 762, 1.05, INK_SOFT, { align: "center", tracking: 0.2 });

  // ================= RIGHT PAGE — visas & stamps =================
  const R = 517;
  fillRect(R, T, 470, 800, PAPER);
  fillRect(R, T, 470, 800, PAPER2, 0.25);
  fillRect(R, T, 8, 800, [0, 0, 0], 0.06);

  text("VISAS", R + 24, T + 24, 2.3, INK, { tracking: 0.4 });
  text("12", R + 446, T + 24, 2.3, INK, { align: "right" });
  rule(R + 24, T + 52, 422, INK, 1.5);
  text("FERRY ARRIVAL ONLY — THE REPUBLIC HAS NO AIRPORT", R + 235, T + 62, 1.3, BURGUNDY, { align: "center", tracking: 0.3 });

  // Stamp grid, 3 x 4, chronological left-to-right, top-to-bottom.
  const gx = R + 8;
  const gy = T + 88;
  const cw = 146;
  const ch = 116;
  const gapX = 8;
  const gapY = 8;
  for (let i = 0; i < STAMPS.length; i++) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    stamp(gx + col * (cw + gapX), gy + row * (ch + gapY), cw, ch, STAMPS[i], STAMP_ROT[i]);
  }

  // Visa slip — the telling detail: Meridia only lets her in by ferry,
  // because Caldara has no airport to fly out of.
  const vx = R + 8;
  const vy = T + 584;
  const vw = 454;
  const vh = 178;
  fillRect(vx, vy, vw, vh, [250, 244, 228]);
  strokeRect(vx, vy, vw, vh, 2, MERIDIA_BLUE);
  strokeRect(vx + 5, vy + 5, vw - 10, vh - 10, 1, MERIDIA_BLUE, 0.8);
  text("MERIDIA — SHORT-STAY VISA", vx + 16, vy + 14, 1.8, MERIDIA_BLUE, { tracking: 0.3 });
  // Diagonal endorsement, top-right where the header leaves room.
  text("FERRY ONLY", vx + vw - 14, vy + 12, 1.6, BURGUNDY, { align: "right", rotate: -11, lw: 2 });
  ferry(vx + vw - 92, vy + 52, 1.05, MERIDIA_BLUE);
  text("HOLDER", vx + 16, vy + 46, 1.2, INK_SOFT, { tracking: 0.4 });
  text("VOSS, MARA ELLIN", vx + 16, vy + 60, 1.75, INK);
  text("VALID", vx + 16, vy + 88, 1.2, INK_SOFT, { tracking: 0.4 });
  text("02 MAR 2025 — 10 MAR 2025", vx + 16, vy + 102, 1.75, INK);
  text("CONDITION", vx + 16, vy + 128, 1.2, INK_SOFT, { tracking: 0.4 });
  text("FERRY ARRIVAL ONLY — NO AIR ENTRY", vx + 16, vy + 142, 1.75, BURGUNDY);
  text("No. MV-4471   ISSUED 24 FEB 2025   PORT ANSELM", vx + 16, vy + 162, 1.2, INK_SOFT, { tracking: 0.2 });
}

drawSpread();

// ---------------------------------------------------------------- PNG encode
const CRC_TABLE: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function encodePNG(): Buffer {
  const stride = W * 4 + 1;
  const raw = Buffer.alloc(stride * H);
  for (let y = 0; y < H; y++) {
    const rowStart = y * stride;
    raw[rowStart] = 1; // Sub filter
    const srcRow = y * W * 4;
    for (let x = 0; x < W * 4; x++) {
      const left = x >= 4 ? px[srcRow + x - 4] : 0;
      raw[rowStart + 1 + x] = (px[srcRow + x] - left) & 0xff;
    }
  }
  const idat = deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
mkdirSync(outDir, { recursive: true });
writeFileSync(`${outDir}/entry.png`, encodePNG());
