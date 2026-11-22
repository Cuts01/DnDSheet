/* Dibuja la hoja de personaje en PDF (A4, vectorial) con pdf-lib. Se carga solo al exportar. */
import { clip, endPath, popGraphicsState, pushGraphicsState, rectangle } from 'pdf-lib';
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';
import { t } from '../i18n.svelte';
import { levelName, type SheetData, type SpellRow, type TextItem } from './sheetData';

const W = 595.28;
const H = 841.89;
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

/* ---------- Página 1 ---------- */
async function drawFront(p: Painter, d: SheetData): Promise<Flow> {
  const page = p.doc.addPage([W, H]);
  const { reg, bold } = p.f;

  // Encabezado
  let tx = M;
  const top = M;
  if (d.photo) {
    try {
      const img = d.photo.startsWith('data:image/png') ? await p.doc.embedPng(d.photo) : await p.doc.embedJpg(d.photo);
      const s = 86;
      const k = Math.max(s / img.width, s / img.height);
      const iw = img.width * k;
      const ih = img.height * k;
      page.pushOperators(pushGraphicsState(), rectangle(M, H - top - s, s, s), clip(), endPath());
      page.drawImage(img, { x: M + (s - iw) / 2, y: H - top - s + (s - ih) / 2, width: iw, height: ih });
      page.pushOperators(popGraphicsState());
      p.box(page, M, top, s, s, { r: 0, border: LINE, bw: 0.8 });
      tx = M + s + 14;
    } catch {
      /* Foto ilegible: se omite. */
    }
  }
  p.right(page, t('Hoja de personaje').toUpperCase(), W - M, top, 7.5, bold, ACCENT);
  p.text(page, p.fit(d.name, bold, 24, W - M - tx - 110), tx, top + 14, 24, bold);
  p.text(page, p.fit(d.lines[0], reg, 12, W - M - tx), tx, top + 46, 12, reg);
  p.text(page, p.fit(d.lines[1], reg, 10, W - M - tx), tx, top + 64, 10, reg, MUTED);
  p.hline(page, M, top + 96, W - 2 * M, INK, 1);

  // Franja de stats
  const sy = top + 106;
  const n = d.stats.length;
  const gap = 6;
  const bw = (W - 2 * M - gap * (n - 1)) / n;
  d.stats.forEach((s, i) => {
    const x = M + i * (bw + gap);
    p.box(page, x, sy, bw, 54, { fill: FILL });
    p.center(page, s.label.toUpperCase(), x + bw / 2, sy + 7, 6.8, bold, MUTED);
    const vs = s.value.length > 9 ? 11 : 17;
    p.center(page, p.fit(s.value, bold, vs, bw - 8), x + bw / 2, sy + (vs > 12 ? 20 : 24), vs, bold);
    if (s.sub) p.center(page, p.fit(s.sub, reg, 6.2, bw - 8), x + bw / 2, sy + 43, 6.2, reg, MUTED);
  });

  // Columna 1: abilities
  const by = sy + 68;
  const aw = 74;
  d.abilities.forEach((a, i) => {
    const y = by + i * 80;
    p.box(page, M, y, aw, 72, { r: 8 });
    p.center(page, a.label, M + aw / 2, y + 7, 8.5, bold, ACCENT);
    p.center(page, a.mod, M + aw / 2, y + 22, 22, bold);
    p.box(page, M + aw / 2 - 17, y + 50, 34, 16, { fill: FILL, r: 8 });
    p.center(page, String(a.score), M + aw / 2, y + 53.5, 10, bold);
  });

  // Columna 2: saves, skills, pasivas
  const cx = M + aw + 10;
  const cw = 170;
  const rowH = 12.6;
  const listBox = (y: number, title: string, rows: { label: string; value: string; level: 'none' | 'prof' | 'expertise'; right?: string }[]) => {
    const h = 22 + rows.length * rowH + 4;
    p.box(page, cx, y, cw, h, { r: 8 });
    p.text(page, title.toUpperCase(), cx + 10, y + 7, 7.5, bold, ACCENT);
    rows.forEach((r, i) => {
      const ry = y + 22 + i * rowH;
      p.mark(page, cx + 13, ry + 4.2, r.level);
      p.right(page, r.value, cx + 44, ry, 8.6, bold);
      p.text(page, p.fit(r.label, reg, 8.6, cw - 82), cx + 50, ry, 8.6);
      if (r.right) p.right(page, r.right, cx + cw - 8, ry + 0.8, 7, reg, MUTED);
    });
    return y + h;
  };
  let y2 = listBox(
    by,
    'Saving throws',
    d.saves.map((s) => ({ label: s.label, value: s.value, level: s.prof ? 'prof' : 'none' }))
  );
  y2 = listBox(
    y2 + 8,
    'Skills',
    d.skills.map((s) => ({ label: s.label, value: s.value, level: s.level, right: s.ability }))
  );
  const ph = 14 + d.passives.length * 13;
  p.box(page, cx, y2 + 8, cw, ph, { r: 8, fill: FILL });
  d.passives.forEach((ps, i) => {
    const ry = y2 + 15 + i * 13;
    p.text(page, ps.label, cx + 10, ry, 8.2);
    p.right(page, String(ps.value), cx + cw - 10, ry, 8.6, bold);
  });
  p.text(page, `* ${t('Marcador lleno: proficiency. Con anillo: expertise.')}`, cx, y2 + 8 + ph + 6, 6.4, reg, MUTED);

  // Columna 3: fluye (y sigue en otras páginas si no entra)
  const x3 = cx + cw + 12;
  const flow = new Flow(p, `${d.name} · ${t('continuación')}`, { page, x: x3, y: by, top: by, w: W - M - x3, bottom: H - M - FOOT });
  return flow;
}

function drawCombat(flow: Flow, p: Painter, d: SheetData) {
  if (d.attacks.length) {
    flow.heading(t('Ataques y spells'));
    const r0 = flow.region;
    const c1 = r0.w * 0.4;
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
      const dmgL = wrap(p.clean(a.damage || '-'), p.f.reg, 8.2, r.w - c1 - c2);
      const lines = Math.max(nameL.length, dmgL.length);
      const h = lines * 10.6 + 4;
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
  if (d.resources.length) {
    flow.heading(t('Recursos'));
    for (const r of d.resources) flow.keyValue(r.name, r.detail);
  }
  if (d.profs.length || d.resistances) {
    flow.heading(t('Proficiencies e idiomas'));
    for (const r of d.profs) flow.keyValue(r.label, r.value);
    if (d.resistances) flow.keyValue('Resistances', d.resistances);
  }
  if (d.equipment.length || d.currency) {
    flow.heading(t('Equipado'));
    if (d.equipment.length) flow.para(d.equipment.join(', '), { after: 3 });
    if (d.currency) flow.keyValue(t('Monedas'), d.currency);
  }
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

  const flow = await drawFront(p, d);
  drawCombat(flow, p, d);

  if (d.features.length) {
    flow.newPage();
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

  if (d.inventory.length || d.notes.trim()) {
    if (d.inventory.length) {
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
    p.hline(pg, M, H - M - 10, W - 2 * M);
    p.text(pg, `${d.name} · DnDSheet · ${date}`, M, H - M - 4, 7, f.reg, MUTED);
    p.right(pg, `${i + 1} / ${pages.length}`, W - M, H - M - 4, 7, f.reg, MUTED);
  });
  return doc.save();
}
