/* Dibuja la hoja de personaje en PDF (A4, vectorial) con pdf-lib. Se carga solo al exportar. */
import { clip, endPath, popGraphicsState, pushGraphicsState, rectangle } from 'pdf-lib';
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';
import { t } from '../i18n.svelte';
import { levelName, type SheetData, type SpellRow, type TextItem } from './sheetData';
import templateUrl from '../../assets/sheet-template.jpg?url';

/* Carta (Letter), el tamaño de la plantilla. */
const W = 612;
const H = 792;
const M = 30;
const FOOT = 22;

const INK = rgb(0.12, 0.12, 0.14);
const MUTED = rgb(0.42, 0.42, 0.46);
const LINE = rgb(0.74, 0.74, 0.77);
const FILL = rgb(0.955, 0.955, 0.962);
const ACCENT = rgb(0.56, 0.4, 0.09);

interface Fonts {
  reg: PDFFont;
  bold: PDFFont;
  ital: PDFFont;
}

/* Helvetica estándar solo tiene WinAnsi: se reemplazan los símbolos que no existen ahí. */
const SWAP: Record<string, string> = {
  '−': '-',
  '–': '-',
  '‑': '-',
  '●': '*',
  '○': 'o',
  '◆': '*',
  '★': '*',
  '✓': 'x',
  '✕': 'x',
  '→': '->',
  '←': '<-',
  '≥': '>=',
  '≤': '<=',
  ' ': ' ',
  '\t': ' '
};
function cleaner(font: PDFFont) {
  const ok = new Set(font.getCharacterSet());
  return (s: string) =>
    [...(s ?? '')]
      .map((ch) => SWAP[ch] ?? (ch === '\n' || ok.has(ch.codePointAt(0)!) ? ch : '?'))
      .join('');
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    const words = para.split(/ +/).filter((w) => w.length);
    if (!words.length) {
      out.push('');
      continue;
    }
    let line = '';
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(next, size) <= width) {
        line = next;
        continue;
      }
      if (line) out.push(line);
      // Palabra más ancha que la columna: se corta.
      let rest = w;
      while (font.widthOfTextAtSize(rest, size) > width && rest.length > 1) {
        let n = rest.length - 1;
        while (n > 1 && font.widthOfTextAtSize(rest.slice(0, n), size) > width) n--;
        out.push(rest.slice(0, n));
        rest = rest.slice(n);
      }
      line = rest;
    }
    if (line) out.push(line);
  }
  return out;
}

function roundRect(w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  return `M ${r} 0 H ${w - r} Q ${w} 0 ${w} ${r} V ${h - r} Q ${w} ${h} ${w - r} ${h} H ${r} Q 0 ${h} 0 ${h - r} V ${r} Q 0 0 ${r} 0 Z`;
}

class Painter {
  constructor(
    public doc: PDFDocument,
    public f: Fonts,
    public clean: (s: string) => string
  ) {}
  text(page: PDFPage, s: string, x: number, top: number, size: number, font = this.f.reg, color: RGB = INK) {
    page.drawText(this.clean(s), { x, y: H - top - size * 0.8, size, font, color });
  }
  center(page: PDFPage, s: string, cx: number, top: number, size: number, font = this.f.reg, color: RGB = INK) {
    const c = this.clean(s);
    this.text(page, c, cx - font.widthOfTextAtSize(c, size) / 2, top, size, font, color);
  }
  right(page: PDFPage, s: string, rx: number, top: number, size: number, font = this.f.reg, color: RGB = INK) {
    const c = this.clean(s);
    this.text(page, c, rx - font.widthOfTextAtSize(c, size), top, size, font, color);
  }
  fit(s: string, font: PDFFont, size: number, width: number) {
    let c = this.clean(s);
    if (font.widthOfTextAtSize(c, size) <= width) return c;
    while (c.length > 1 && font.widthOfTextAtSize(`${c}...`, size) > width) c = c.slice(0, -1);
    return `${c.trimEnd()}...`;
  }
  box(page: PDFPage, x: number, top: number, w: number, h: number, opts: { fill?: RGB; border?: RGB; r?: number; bw?: number } = {}) {
    page.drawSvgPath(roundRect(w, h, opts.r ?? 6), {
      x,
      y: H - top,
      color: opts.fill,
      borderColor: opts.border ?? LINE,
      borderWidth: opts.bw ?? 0.8
    });
  }
  hline(page: PDFPage, x: number, top: number, w: number, color: RGB = LINE, th = 0.6) {
    page.drawLine({ start: { x, y: H - top }, end: { x: x + w, y: H - top }, thickness: th, color });
  }
  /* Marcador de proficiency: vacío, lleno o lleno con anillo (expertise). */
  mark(page: PDFPage, cx: number, cy: number, level: 'none' | 'prof' | 'expertise' | 'always') {
    const y = H - cy;
    if (level === 'always') {
      const s = 3.4;
      page.drawSvgPath(`M 0 ${-s} L ${s} 0 L 0 ${s} L ${-s} 0 Z`, { x: cx, y, color: ACCENT });
      return;
    }
    page.drawCircle({ x: cx, y, size: 2.9, borderColor: INK, borderWidth: 0.7, color: level === 'none' ? undefined : INK });
    if (level === 'expertise') page.drawCircle({ x: cx, y, size: 4.6, borderColor: INK, borderWidth: 0.6 });
  }
}

/* ---------- Texto que fluye por columnas y páginas ---------- */
interface Region {
  page: PDFPage;
  x: number;
  y: number;
  top: number;
  w: number;
  bottom: number;
}

class Flow {
  region!: Region;
  private cols: Region[] = [];
  constructor(
    private p: Painter,
    private title: string,
    first?: Region
  ) {
    if (first) this.region = first;
    else this.newPage();
  }
  newPage() {
    const page = this.p.doc.addPage([W, H]);
    this.p.text(page, this.title, M, M - 4, 9, this.p.f.bold, MUTED);
    this.p.hline(page, M, M + 10, W - 2 * M);
    const gap = 18;
    const w = (W - 2 * M - gap) / 2;
    const top = M + 22;
    const bottom = H - M - FOOT;
    this.cols = [
      { page, x: M + w + gap, y: top, top, w, bottom },
      { page, x: M, y: top, top, w, bottom }
    ];
    this.region = this.cols.pop()!;
  }
  /* Baja el inicio de las columnas de la página actual (para dejar lugar a un encabezado). */
  shiftTop(dy: number) {
    for (const r of [this.region, ...this.cols]) {
      r.y += dy;
      r.top += dy;
    }
  }
  next() {
    const r = this.cols.pop();
    if (r) this.region = r;
    else this.newPage();
  }
  ensure(h: number) {
    if (this.region.y + h > this.region.bottom) this.next();
  }
  space(h: number) {
    this.region.y += h;
  }
  heading(s: string) {
    this.ensure(40);
    if (this.region.y > this.region.top + 1) this.space(8);
    const r = this.region;
    this.p.text(r.page, s.toUpperCase(), r.x, r.y, 9.5, this.p.f.bold, ACCENT);
    this.p.hline(r.page, r.x, r.y + 13, r.w, ACCENT, 0.8);
    this.space(19);
  }
  sub(s: string, size = 10.5) {
    this.ensure(size + 22);
    this.space(3);
    const r = this.region;
    for (const l of wrap(this.p.clean(s), this.p.f.bold, size, r.w)) {
      this.ensure(size + 3);
      this.p.text(this.region.page, l, this.region.x, this.region.y, size, this.p.f.bold);
      this.space(size + 3);
    }
    this.space(1);
  }
  para(s: string, opts: { size?: number; font?: PDFFont; color?: RGB; indent?: number; after?: number } = {}) {
    const size = opts.size ?? 8.6;
    const font = opts.font ?? this.p.f.reg;
    const indent = opts.indent ?? 0;
    const lh = size * 1.32;
    for (const l of wrap(this.p.clean(s), font, size, this.region.w - indent)) {
      this.ensure(lh);
      this.p.text(this.region.page, l, this.region.x + indent, this.region.y, size, font, opts.color ?? INK);
      this.space(lh);
    }
    this.space(opts.after ?? 0);
  }
  /* Título en negrita con etiqueta gris al lado (o debajo si no entra). */
  item(it: TextItem) {
    const size = 9.4;
    this.ensure(size + 16);
    const r = this.region;
    const title = this.p.clean(it.title);
    const tw = this.p.f.bold.widthOfTextAtSize(title, size);
    const tag = it.tag ? this.p.clean(it.tag) : '';
    const tagW = tag ? this.p.f.reg.widthOfTextAtSize(tag, 7.6) : 0;
    if (tw <= r.w && (!tag || tw + 8 + tagW <= r.w)) {
      this.p.text(r.page, title, r.x, r.y, size, this.p.f.bold);
      if (tag) this.p.text(r.page, tag, r.x + tw + 8, r.y + 1.3, 7.6, this.p.f.reg, MUTED);
      this.space(size + 3.5);
    } else {
      this.para(title, { size, font: this.p.f.bold });
      if (tag) this.para(tag, { size: 7.6, color: MUTED });
      this.space(1);
    }
    if (it.text) this.para(it.text);
    if (it.extra) this.para(it.extra, { size: 8.6, font: this.p.f.ital, color: ACCENT });
    this.space(5);
  }
  keyValue(k: string, v: string) {
    const size = 8.6;
    const kk = `${this.p.clean(k)}: `;
    const kw = this.p.f.bold.widthOfTextAtSize(kk, size);
    const lines = wrap(this.p.clean(v), this.p.f.reg, size, this.region.w - kw);
    lines.forEach((l, i) => {
      this.ensure(size * 1.32);
      const r = this.region;
      if (i === 0) this.p.text(r.page, kk, r.x, r.y, size, this.p.f.bold);
      this.p.text(r.page, l, r.x + kw, r.y, size);
      this.space(size * 1.32);
    });
    this.space(2);
  }
}

/* ---------- Página 1: plantilla ---------- */
/* La plantilla mide 1699 × 2184 px; las coordenadas de abajo están en esos píxeles. */
const SX = W / 1699;
const SY = H / 2184;
const SKILL_Y: Record<string, number> = {
  Athletics: 561,
  Acrobatics: 630,
  'Sleight of Hand': 668,
  Stealth: 705,
  Arcana: 774,
  History: 811,
  Investigation: 849,
  Nature: 886,
  Religion: 923,
  'Animal Handling': 992,
  Insight: 1030,
  Medicine: 1067,
  Perception: 1105,
  Survival: 1142,
  Deception: 1211,
  Intimidation: 1248,
  Performance: 1286,
  Persuasion: 1323
};
const SAVE_POS: Record<string, [number, number]> = { STR: [334, 377], CON: [334, 414], DEX: [334, 452], INT: [478, 377], WIS: [478, 414], CHA: [478, 452] };
const ABILITY_Y = [324, 505, 687, 868, 1049, 1230];
const lines = (from: number, step: number, n: number) => Array.from({ length: n }, (_, i) => Math.round(from + step * i));
const TRAIT_LINES = lines(986, 31.22, 37);
const INV_LINES = lines(1055, 31.25, 21);
const PROF_LINES = lines(1767, 31.2, 12);
const RES_LINES = [818, 849, 880, 911, 943, 974];
const ATK_ROWS = [1501, 1551, 1601, 1651, 1701];
const ATK_EXTRA = [1767, 1798, 1829];
const ARMOR_ROWS = [1920, 1970, 2020];

interface Overflow {
  attacks: boolean;
  resources: boolean;
  profs: boolean;
  inventory: boolean;
}

async function drawTemplate(p: Painter, d: SheetData): Promise<Overflow> {
  const page = p.doc.addPage([W, H]);
  const { reg, bold } = p.f;
  const bytes = new Uint8Array(await (await fetch(templateUrl)).arrayBuffer());
  const img = await p.doc.embedJpg(bytes);
  page.drawImage(img, { x: 0, y: 0, width: W, height: H });

  // Tamaño que entra en el ancho (en px de la plantilla), sin bajar de min.
  const sized = (s: string, font: PDFFont, size: number, maxPx: number, min = 5.5) => {
    const c = p.clean(s);
    let z = size;
    while (z > min && font.widthOfTextAtSize(c, z) > maxPx * SX) z -= 0.25;
    return { c: font.widthOfTextAtSize(c, z) > maxPx * SX ? p.fit(c, font, z, maxPx * SX) : c, z };
  };
  const center = (s: string, cx: number, cy: number, size: number, font = bold, maxPx = 400) => {
    const { c, z } = sized(s, font, size, maxPx);
    p.text(page, c, cx * SX - font.widthOfTextAtSize(c, z) / 2, cy * SY - z * 0.44, z, font);
  };
  const left = (s: string, x: number, cy: number, size: number, font = reg, maxPx = 400, color: RGB = INK) => {
    const { c, z } = sized(s, font, size, maxPx);
    p.text(page, c, x * SX, cy * SY - z * 0.44, z, font, color);
  };
  // Texto sobre una línea del renglón (baseline apenas arriba de la línea).
  const onLine = (s: string, x: number, lineY: number, size: number, font = reg, maxPx = 400, color: RGB = INK, min = size) => {
    const { c, z } = sized(s, font, size, maxPx, min);
    p.text(page, c, x * SX, lineY * SY - 2.2 - z * 0.8, z, font, color);
  };
  const dot = (x: number, y: number, rPx: number) => page.drawCircle({ x: x * SX, y: H - y * SY, size: rPx * SX, color: INK });

  // Encabezado
  // Banner NAME: el jugador. Recuadro de arriba a la derecha: el PJ y su edad.
  if (d.front.player) center(d.front.player, 850, 134, 13, bold, 420);
  left(d.name, 1238, 133, 12, bold, 285);
  if (d.front.age) center(d.front.age, 1586, 121, 8, bold, 60);
  // Recuadro libre de arriba a la izquierda: altura, peso y tamaño.
  const body = [
    d.front.height ? `${t('Altura')}: ${d.front.height}` : '',
    d.front.weight ? `${t('Peso')}: ${d.front.weight}` : '',
    `${t('Tamaño')}: ${d.front.size}`
  ].filter(Boolean);
  body.forEach((x, i) => left(x, 98, 100 + i * 21, 7, reg, 188));
  center(d.front.ac, 850, 252, 20, bold, 110);
  center(d.front.prof, 450, 206, 12, bold, 70);
  center(String(d.front.perception), 155, 263, 12, bold, 70);
  // Level/Class en hasta dos renglones si es largo (multiclass).
  const cl = wrap(p.clean(d.front.classLine), reg, 8, 370 * SX);
  if (cl.length <= 1) left(d.front.classLine, 1225, 222, 9.5, reg, 385);
  else {
    left(cl[0], 1240, 208, 8, reg, 370);
    left(cl.slice(1).join(' '), 1240, 230, 8, reg, 370);
  }
  left(d.front.originLine, 1150, 306, 9.5, reg, 455);

  // Abilities
  d.abilities.forEach((a, i) => {
    center(a.mod, 181, ABILITY_Y[i] + 64, 20, bold, 150);
    center(String(a.score), 181, ABILITY_Y[i] + 114, 9.5, bold, 60);
  });

  // Saves
  for (const s of d.saves) {
    const [x, y] = SAVE_POS[s.label];
    if (s.prof) dot(x, y, 8);
    center(s.value, x + 38, y - 4, 8.5, bold, 34);
  }

  // Skills: círculo grande = proficiency, chico = expertise
  for (const s of d.skills) {
    const y = SKILL_Y[s.label];
    if (y === undefined) continue;
    if (s.level !== 'none') dot(336, y + 5, 8.5);
    if (s.level === 'expertise') dot(343.5, y - 6, 5);
    center(s.value, 378, y - 2, 8.5, bold, 34);
  }

  // HP, iniciativa, speed, hit dice
  center(d.front.maxHp, 718, 352, 18, bold, 160);
  center(d.front.init, 722, 478, 18, bold, 160);
  center(d.front.speed, 975, 478, 15, bold, 170);
  left(d.front.hitDice, 763, 712, 8.5, bold, 95);
  left(String(d.front.hitDiceTotal), 742, 764, 10, bold, 50);

  // Recursos (los círculos quedan para marcar a mano)
  d.resources.slice(0, RES_LINES.length).forEach((r, i) => onLine(`${r.name} · ${r.short}`, 652, RES_LINES[i], 7.2, reg, 272, INK, 5.8));

  // Monedas
  const coin = (v: number, cx: number) => v && center(String(v), cx, 1431, 8.5, bold, 90);
  coin(d.coins.pp, 169);
  coin(d.coins.gp, 294);
  coin(d.coins.sp, 419);
  coin(d.coins.cp, 544);

  // Armas y ataques
  d.attacks.slice(0, ATK_ROWS.length).forEach((a, i) => {
    const y = ATK_ROWS[i];
    left(a.name, 99, y, 7.5, bold, 128);
    center(a.range, 278, y, 6.8, reg, 76);
    center(a.hit, 366, y, 8.5, bold, 76);
    const dl = wrap(p.clean(a.damage), reg, 6.6, 182 * SX);
    if (dl.length <= 1) left(a.damage, 417, y, 6.8, reg, 182);
    else {
      p.text(page, dl[0], 417 * SX, y * SY - 7.3, 6.6, reg);
      p.text(page, p.fit(dl.slice(1).join(' '), reg, 6.6, 182 * SX), 417 * SX, y * SY + 0.8, 6.6, reg);
    }
  });
  const rest = d.attacks.slice(ATK_ROWS.length);
  rest.slice(0, ATK_EXTRA.length).forEach((a, i) => {
    const more = i === ATK_EXTRA.length - 1 && rest.length > ATK_EXTRA.length;
    onLine(more ? `${t('Más ataques en la página 2')}` : `${a.name} · ${a.range} · ${a.hit} · ${a.damage}`, 92, ATK_EXTRA[i], 7, more ? p.f.ital : reg, 510);
  });

  // Armor y consumibles
  d.armor.slice(0, ARMOR_ROWS.length).forEach((a, i) => {
    left(`${a.name}${a.equipped ? '' : ` (${t('sin equipar')})`}`, 99, ARMOR_ROWS[i], 7.5, a.equipped ? bold : reg, 148);
    center(a.ac, 296, ARMOR_ROWS[i], 8.5, bold, 76);
  });
  d.consumables.slice(0, ARMOR_ROWS.length).forEach((cn, i) => {
    left(cn.name, 361, ARMOR_ROWS[i], 7.5, reg, 148);
    center(String(cn.qty), 559, ARMOR_ROWS[i], 8.5, bold, 76);
  });

  // Inventario
  const inv = [...d.inventory];
  if (d.coins.ep) inv.push(`${d.coins.ep} ep`);
  const invShown = inv.length > INV_LINES.length ? [...inv.slice(0, INV_LINES.length - 1), t('... el resto en la página de equipo')] : inv;
  invShown.forEach((x, i) => onLine(x, 640, INV_LINES[i], 7.2, reg, 422));

  // Proficiencies (texto corrido por renglones, con sangría bajo cada título)
  const profLines: { k: string; v: string; kw: number }[] = [];
  for (const r of d.profs) {
    const kk = `${p.clean(r.label)}: `;
    const kw = bold.widthOfTextAtSize(kk, 7.2);
    wrap(p.clean(r.value), reg, 7.2, 420 * SX - kw).forEach((l, i) => profLines.push({ k: i ? '' : kk, v: l, kw }));
  }
  profLines.slice(0, PROF_LINES.length).forEach((l, i) => {
    const y = PROF_LINES[i] * SY - 2.2 - 7.2 * 0.8;
    if (l.k) p.text(page, l.k, 640 * SX, y, 7.2, bold);
    p.text(page, l.v, 640 * SX + l.kw, y, 7.2, reg);
  });

  // Traits and features: nombres (el texto completo va en la página 2)
  const tl = d.traitLines;
  const shown = tl.length > TRAIT_LINES.length ? [...tl.slice(0, TRAIT_LINES.length - 1), { text: t('... sigue en la página 2'), head: false }] : tl;
  shown.forEach((l, i) => onLine(l.text, 1096, TRAIT_LINES[i], l.head ? 7.6 : 7.2, l.head ? bold : reg, 512, l.head ? ACCENT : INK));

  return { attacks: d.attacks.length > ATK_ROWS.length + ATK_EXTRA.length, resources: d.resources.length > RES_LINES.length, profs: profLines.length > PROF_LINES.length, inventory: inv.length > INV_LINES.length };
}

/* Encabezado de la página 2: foto, nombre y líneas de clase y origen. */
async function drawHeader(p: Painter, page: PDFPage, d: SheetData): Promise<number> {
  const { reg, bold } = p.f;
  const top = M + 20;
  let tx = M;
  const s = 70;
  if (d.photo) {
    try {
      const img = d.photo.startsWith('data:image/png') ? await p.doc.embedPng(d.photo) : await p.doc.embedJpg(d.photo);
      const k = Math.max(s / img.width, s / img.height);
      const iw = img.width * k;
      const ih = img.height * k;
      page.pushOperators(pushGraphicsState(), rectangle(M, H - top - s, s, s), clip(), endPath());
      page.drawImage(img, { x: M + (s - iw) / 2, y: H - top - s + (s - ih) / 2, width: iw, height: ih });
      page.pushOperators(popGraphicsState());
      p.box(page, M, top, s, s, { r: 0, border: LINE, bw: 0.8 });
      tx = M + s + 12;
    } catch {
      /* Foto ilegible: se omite. */
    }
  }
  p.text(page, p.fit(d.name, bold, 20, W - M - tx), tx, top + 8, 20, bold);
  p.text(page, p.fit(d.lines[0], reg, 11, W - M - tx), tx, top + 34, 11, reg);
  p.text(page, p.fit(d.lines[1], reg, 9.5, W - M - tx), tx, top + 50, 9.5, reg, MUTED);
  if (d.lines[2]) p.text(page, p.fit(d.lines[2], reg, 8.5, W - M - tx), tx, top + 63, 8.5, reg, MUTED);
  return (d.photo ? s : 74) + 12;
}

function drawSummary(flow: Flow, p: Painter, d: SheetData, over: Overflow) {
  if (over.attacks) {
    flow.heading(t('Ataques y spells'));
    const c1 = flow.region.w * 0.38;
    const c2 = 40;
    const header = () => {
      const r = flow.region;
      p.text(r.page, t('Nombre').toUpperCase(), r.x, r.y, 6.8, p.f.bold, MUTED);
      p.text(r.page, t('Ataque').toUpperCase(), r.x + c1, r.y, 6.8, p.f.bold, MUTED);
      p.text(r.page, t('Daño / efecto').toUpperCase(), r.x + c1 + c2, r.y, 6.8, p.f.bold, MUTED);
      flow.space(11);
    };
    header();
    for (const a of d.attacks) {
      const r = flow.region;
      const nameL = wrap(p.clean(a.name), p.f.bold, 8.6, c1 - 6);
      const dmgL = wrap(p.clean([a.range, a.damage].filter(Boolean).join(' · ') || '-'), p.f.reg, 8.2, r.w - c1 - c2);
      const h = Math.max(nameL.length, dmgL.length) * 10.6 + 4;
      const before = flow.region;
      flow.ensure(h);
      if (flow.region !== before) header();
      const rr = flow.region;
      p.hline(rr.page, rr.x, rr.y - 2, rr.w, FILL, 0.8);
      nameL.forEach((l, i) => p.text(rr.page, l, rr.x, rr.y + i * 10.6, 8.6, p.f.bold));
      p.text(rr.page, a.hit, rr.x + c1, rr.y, 8.6, p.f.bold);
      dmgL.forEach((l, i) => p.text(rr.page, l, rr.x + c1 + c2, rr.y + i * 10.6 + 0.4, 8.2));
      flow.space(h);
    }
  }
  if (d.casting.length || d.slots.length || d.pact) {
    flow.heading('Spellcasting');
    for (const c of d.casting) flow.keyValue(c.label, `${c.ability} · Attack ${c.attack} · DC ${c.dc}`);
    if (d.slots.length) flow.keyValue(t('Spell slots'), d.slots.map((s) => `${t('Nv')} ${s.level}: ${s.count}`).join('  ·  '));
    if (d.pact) flow.keyValue('Pact Magic', `${d.pact.count} slots ${t('de nivel')} ${d.pact.level}`);
  }
  if (over.resources) {
    flow.heading(t('Recursos'));
    for (const r of d.resources) flow.keyValue(r.name, r.detail);
  }
  flow.heading(t('Otros datos'));
  for (const ps of d.passives.slice(1)) flow.keyValue(ps.label, String(ps.value));
  if (d.resistances) flow.keyValue('Resistances', d.resistances);
  if (over.profs) for (const r of d.profs) flow.keyValue(r.label, r.value);
}

function drawSpell(flow: Flow, p: Painter, s: SpellRow) {
  flow.ensure(28);
  const r = flow.region;
  p.mark(r.page, r.x + 3.5, r.y + 4.4, s.mark === 'always' ? 'always' : s.mark === 'prepared' ? 'prof' : 'none');
  const title = s.source ? `${s.name}` : s.name;
  const tw = p.f.bold.widthOfTextAtSize(p.clean(title), 9.4);
  p.text(r.page, p.fit(title, p.f.bold, 9.4, r.w - 12), r.x + 11, r.y, 9.4, p.f.bold);
  if (s.source && 11 + tw + 8 + p.f.reg.widthOfTextAtSize(p.clean(s.source), 7.6) <= r.w) p.text(r.page, s.source, r.x + 11 + tw + 8, r.y + 1.3, 7.6, p.f.reg, MUTED);
  flow.space(12.5);
  if (s.meta) flow.para(s.meta, { size: 7.4, color: MUTED, indent: 11 });
  if (s.text) flow.para(s.text, { size: 8.3, indent: 11 });
  flow.space(5);
}

export async function renderSheetPdf(d: SheetData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${d.name} - ${t('Hoja de personaje')}`);
  doc.setSubject('D&D 5e');
  doc.setCreator('DnDSheet');
  doc.setProducer('DnDSheet');
  const f: Fonts = {
    reg: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    ital: await doc.embedFont(StandardFonts.HelveticaOblique)
  };
  const p = new Painter(doc, f, cleaner(f.reg));

  const over = await drawTemplate(p, d);
  const flow = new Flow(p, `${d.name} · ${t('continuación')}`);
  flow.shiftTop(await drawHeader(p, flow.region.page, d));
  drawSummary(flow, p, d, over);

  if (d.features.length) {
    flow.heading(t('Rasgos y features'));
    for (const g of d.features) {
      flow.sub(g.heading);
      for (const it of g.items) flow.item(it);
    }
  }

  if (d.spells.length) {
    // Spells en una columna nueva (o página, si ya se usaron las dos).
    if (flow.region.y > flow.region.top + 1) flow.next();
    flow.heading('Spells');
    for (const c of d.casting) flow.keyValue(c.label, `${c.ability} · Attack ${c.attack} · DC ${c.dc}`);
    flow.para(t('Marcador lleno: preparada. Rombo: siempre preparada (subclass, feat o raza). Vacío: conocida, no preparada.'), {
      size: 7.4,
      color: MUTED,
      after: 4
    });
    let lvl = -1;
    for (const s of d.spells) {
      if (s.level !== lvl) {
        lvl = s.level;
        const slots = d.slots.find((x) => x.level === lvl)?.count;
        flow.sub(`${levelName(lvl)}${slots ? ` · ${slots} slots` : ''}`, 10);
      }
      drawSpell(flow, p, s);
    }
  }

  if (over.inventory || d.notes.trim()) {
    if (over.inventory) {
      flow.heading(t('Equipo'));
      for (const i of d.inventory) flow.para(`• ${i}`, { size: 8.6, after: 1.5 });
      if (d.currency) {
        flow.space(4);
        flow.keyValue(t('Monedas'), d.currency);
      }
    }
    if (d.notes.trim()) {
      flow.heading(t('Notas'));
      flow.para(d.notes, { size: 8.8 });
    }
  }

  // Pie de página
  const pages = doc.getPages();
  const date = new Date().toLocaleDateString();
  pages.forEach((pg, i) => {
    if (i === 0) return; // la plantilla ya tiene su propio marco
    p.hline(pg, M, H - M - 10, W - 2 * M);
    p.text(pg, `${d.name} · DnDSheet · ${date}`, M, H - M - 4, 7, f.reg, MUTED);
    p.right(pg, `${i + 1} / ${pages.length}`, W - M, H - M - 4, 7, f.reg, MUTED);
  });
  return doc.save();
}
