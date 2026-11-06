'use strict';
/**
 * Plantillas RTF -> impresion directa con EscPosBuilder (sin formato intermedio).
 *
 * Uso:
 *   const { renderRtfFile } = require('./rtfTemplate');
 *   const b = new EscPosBuilder(paperWidth);       // 58 u 80
 *   renderRtfFile(b, 'receipt_customer.rtf', data);
 *   const buffer = b.toBuffer();
 *
 * Lo que se lee del RTF (cada parrafo = una linea del ticket):
 *   \qc \qr \ql   -> b.align('center'|'right'|'left')
 *   \b            -> b.bold()            (si la mayoria del parrafo esta en negrita)
 *   \ul           -> b.underline()       (idem)
 *   \fsN          -> b.size(): >=1.8x el texto base = 'double', >=1.3x = 'double-height'
 *   \tab          -> b.twoColumn(izquierda, derecha)
 *   -----  =====  -> b.separator('-') / b.separator('=')   (una linea de "=" a la derecha se imprime literal)
 *   {VARIABLE}    -> dato (Word escapa las llaves solo: \{VARIABLE\})
 *   parrafo vacio -> b.feed(1)
 *   // texto      -> comentario, no se imprime
 *
 * Marcadores de control (van como texto en su propio parrafo):
 *   [ITEMS] ... [/ITEMS]   repite por cada producto  ({QTY} {NAME} {PRICE})
 *   [MODS]  ... [/MODS]    repite por cada modificador ({MOD_NAME} {MOD_PRICE})
 *   [NOTES] ... [/NOTES]   repite por cada nota del producto ({NOTE})
 *   [IF_XXX]... [/IF_XXX]  solo si data.XXX tiene valor  (IF_QR -> QR_URL, IF_NOTES -> ORDER_NOTES)
 *   [QR]{QR_URL}[/QR]  [QR=6]...   b.qr(url[, tamano])
 *   [FEED=n]  [CUT]  [DRAWER]      b.feed(n) / b.cut() / b.openCashDrawer()
 * Los bloques pueden ir en linea: [MODS]  + {MOD_NAME}\tab {MOD_PRICE}[/MODS]
 * Fuente, colores y margenes del RTF se ignoran.
 */
const fs = require('fs');
const path = require('path');

const TEMPLATES_DIR = path.join(__dirname, 'templates');
const IF_ALIASES = { QR: 'QR_URL', NOTES: 'ORDER_NOTES' };

/* =============================== 1. RTF ================================== */

const SKIP_DEST = new Set([
  'fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 'header', 'footer', 'footnote',
  'listtable', 'listoverridetable', 'rsidtbl', 'generator', 'themedata',
  'colorschememapping', 'latentstyles', 'datastore', 'xmlnstbl', 'fldinst', 'object',
]);
const SYMBOLS = {
  emdash: '-', endash: '-', lquote: "'", rquote: "'", ldblquote: '"', rdblquote: '"',
  bullet: '*', emspace: ' ', enspace: ' ',
};

function parseRtf(rtf) {
  const WORD = /\\([a-zA-Z]+)(-?\d+)? ?/y;
  const HEX = /\\'([0-9a-fA-F]{2})/y;
  const TEXT = /[^\\{}\r\n]+/y;

  const paras = [];
  const stack = [];
  let st = { bold: false, ul: false, fs: 24, skip: false, uc: 1 }; // 24 = 12pt (default del estandar)
  let para = { align: 0, runs: [] };
  let skipChars = 0; // caracteres de reemplazo tras \uN
  let i = 0;
  const n = rtf.length;

  const put = (t) => { if (!st.skip && t) para.runs.push({ t, bold: st.bold, ul: st.ul, fs: st.fs }); };
  const endPara = () => {
    if (st.skip) return;
    paras.push(para);
    para = { align: para.align, runs: [] };
  };

  while (i < n) {
    const c = rtf[i];
    if (c === '{') {
      stack.push({ ...st });
      i++;
      if (rtf[i] === '\\' && rtf[i + 1] === '*') { st.skip = true; i += 2; } // destino ignorable
    } else if (c === '}') {
      st = stack.pop() || st;
      i++;
    } else if (c === '\r' || c === '\n') {
      i++; // los saltos de linea del archivo no significan nada en RTF
    } else if (c === '\\') {
      const nx = rtf[i + 1];
      if (nx === undefined) break;
      if (/[a-zA-Z]/.test(nx)) {
        WORD.lastIndex = i;
        const m = WORD.exec(rtf);
        i = WORD.lastIndex;
        const w = m[1];
        const num = m[2] === undefined ? undefined : parseInt(m[2], 10);
        if (SKIP_DEST.has(w)) { st.skip = true; continue; }
        if (st.skip) continue;
        switch (w) {
          case 'par': case 'line': endPara(); break;
          case 'tab': put('\t'); break;
          case 'pard': para.align = 0; break;
          case 'qc': para.align = 1; break;
          case 'qr': para.align = 2; break;
          case 'ql': case 'qj': para.align = 0; break;
          case 'b': st.bold = num !== 0; break;
          case 'ul': st.ul = num !== 0; break;
          case 'ulnone': st.ul = false; break;
          case 'fs': st.fs = num; break;
          case 'plain': st.bold = false; st.ul = false; break;
          case 'uc': st.uc = num; break;
          case 'u': {
            put(String.fromCharCode(num < 0 ? num + 65536 : num));
            skipChars = st.uc;
            break;
          }
          default:
            if (w in SYMBOLS) put(SYMBOLS[w]);
        }
      } else if (nx === "'") {
        HEX.lastIndex = i;
        const m = HEX.exec(rtf);
        if (m) {
          i = HEX.lastIndex;
          if (skipChars > 0) skipChars--;
          else put(String.fromCharCode(parseInt(m[1], 16)));
        } else i += 2;
      } else if (nx === '\\' || nx === '{' || nx === '}') {
        if (skipChars > 0) skipChars--;
        else put(nx);
        i += 2;
      } else if (nx === '~') { put(' '); i += 2; }
      else if (nx === '-' || nx === '_') { put('-'); i += 2; }
      else if (nx === '\n' || nx === '\r') { endPara(); i += 2; }
      else i += 2;
    } else {
      TEXT.lastIndex = i;
      const m = TEXT.exec(rtf);
      i = TEXT.lastIndex;
      let t = m[0];
      while (skipChars > 0 && t.length) { t = t.slice(1); skipChars--; }
      put(t);
    }
  }
  if (para.runs.length) paras.push(para);
  return paras;
}

/* ============================ 2. Compilacion ============================= */

const BLOCK = 'ITEMS|MODS|NOTES|IF_[A-Z0-9_]+';
const OPEN_RE = new RegExp(`^\\[(${BLOCK})\\]$`);
const CLOSE_RE = new RegExp(`^\\[/(${BLOCK})\\]$`);
const INLINE_RE = new RegExp(`^\\[(${BLOCK})\\](.*)\\[/\\1\\]$`);

// Estilo de un parrafo: mayoria de caracteres visibles decide negrita/subrayado/tamano
function analyze(p, base) {
  const text = p.runs.map((r) => r.t).join('');
  let total = 0, bold = 0, ul = 0;
  const sizes = new Map();
  for (const r of p.runs) {
    const w = r.t.replace(/\s/g, '').length;
    total += w;
    if (r.bold) bold += w;
    if (r.ul) ul += w;
    sizes.set(r.fs, (sizes.get(r.fs) || 0) + w);
  }
  if (!total) return { blank: true, text };
  const fs = [...sizes.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const ratio = fs / base;
  return {
    text,
    style: {
      align: p.align,
      bold: bold * 2 >= total,
      ul: ul * 2 >= total,
      size: ratio >= 1.8 ? 'double' : ratio >= 1.3 ? 'double-height' : 'normal',
    },
  };
}

function leaf(text, style) {
  const t = text.trim();
  let m;
  if (t === '[CUT]') return { type: 'CUT' };
  if (t === '[DRAWER]') return { type: 'DRAWER' };
  if ((m = t.match(/^\[FEED=(\d+)\]$/))) return { type: 'FEED', n: Math.min(+m[1], 50) };
  if ((m = t.match(/^\[QR(?:=(\d+))?\](.*)\[\/QR\]$/))) return { type: 'QR', size: m[1] ? +m[1] : undefined, text: m[2] };
  if (style.align !== 2 && /^-{3,}$/.test(t)) return { type: 'SEP', char: '-' };
  if (style.align !== 2 && /^={3,}$/.test(t)) return { type: 'SEP', char: '=' };

  const node = { type: 'LINE', ...style };
  if (text.includes('\t')) {            // \tab -> dos columnas
    const [left, ...rest] = text.split('\t');
    node.left = left.trimEnd();
    node.right = rest.join(' ').trim();
  } else {
    node.text = style.align === 0 ? text.trimEnd() : text.trim();
  }
  return node;
}

function compile(rtf, { baseSize } = {}) {
  const paras = parseRtf(rtf);

  // tamano base = el que mas texto tiene en el documento
  const freq = new Map();
  for (const p of paras) for (const r of p.runs) {
    freq.set(r.fs, (freq.get(r.fs) || 0) + r.t.replace(/\s/g, '').length);
  }
  const base = baseSize || ([...freq.entries()].sort((a, b) => b[1] - a[1])[0] || [24])[0] || 24;

  const root = { type: 'ROOT', children: [] };
  const stack = [root];
  const add = (node) => stack[stack.length - 1].children.push(node);

  for (const p of paras) {
    const a = analyze(p, base);
    if (a.blank) { add({ type: 'FEED', n: 1, blank: true }); continue; }
    const t = a.text.trim();
    if (t.startsWith('//')) continue;

    let m;
    if ((m = t.match(OPEN_RE))) {
      const node = { type: m[1], children: [] };
      add(node);
      stack.push(node);
    } else if ((m = t.match(CLOSE_RE))) {
      if (stack.length < 2 || stack[stack.length - 1].type !== m[1]) {
        throw new Error(`Plantilla RTF: [/${m[1]}] sin su apertura`);
      }
      stack.pop();
    } else if ((m = t.match(INLINE_RE))) {
      add({ type: m[1], children: [leaf(m[2], a.style)] });
    } else {
      add(leaf(a.text, a.style));
    }
  }
  if (stack.length > 1) throw new Error(`Plantilla RTF: falta cerrar [/${stack[stack.length - 1].type}]`);

  // parrafos vacios al inicio/final del documento no cuentan
  const c = root.children;
  while (c.length && c[0].blank) c.shift();
  while (c.length && c[c.length - 1].blank) c.pop();
  return root.children;
}

/* ============================= 3. Impresion ============================== */

const fill = (tpl, ctx) =>
  tpl.replace(/\{([A-Z0-9_]+)\}/g, (_, k) => (ctx[k] == null ? '' : String(ctx[k])));

function wrap(text, w) {
  if (text.length <= w) return [text];
  const out = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (!line) line = word;
    else if ((line + ' ' + word).length <= w) line += ' ' + word;
    else { out.push(line); line = word; }
    while (line.length > w) { out.push(line.slice(0, w)); line = line.slice(w); }
  }
  if (line) out.push(line);
  return out;
}

const itemCtx = (it) => ({
  QTY: it.qty,
  NAME: it.name,
  PRICE: it.price,
  __MODS: (it.mods || []).map((m) => ({ MOD_NAME: m.name, MOD_PRICE: m.price })),
  __NOTES: (it.notes || []).map((n) => ({ NOTE: n })),
});

function printLine(b, n, ctx) {
  const full = b.width;
  const w = n.size === 'double' ? Math.floor(full / 2) : full; // 2x ancho = mitad de columnas

  let left, right, text;
  if (n.left !== undefined) {
    left = fill(n.left, ctx);
    right = fill(n.right, ctx);
    if (!left.trim() && !right.trim()) return;
  } else {
    text = fill(n.text, ctx);
    if (!text.trim()) return; // variable vacia (ej. pie de pagina opcional): no imprime linea en blanco
  }

  b.width = w; // twoColumn() usa this.width
  try {
    b.align(n.align === 1 ? 'center' : n.align === 2 ? 'right' : 'left').bold(n.bold).size(n.size);
    if (n.ul) b.underline(true);
    if (left !== undefined) {
      const parts = wrap(left, Math.max(1, w - right.length - 1));
      b.twoColumn(parts[0], right);
      for (const extra of parts.slice(1)) b.line(extra);
    } else {
      for (const part of wrap(text, w)) b.line(part);
    }
  } finally {
    if (n.ul) b.underline(false);
    b.size('normal').bold(false).align('left');
    b.width = full;
  }
}

function renderNodes(b, nodes, ctx) {
  for (const n of nodes) {
    switch (n.type) {
      case 'LINE': printLine(b, n, ctx); break;
      case 'SEP': b.size('normal').bold(false).separator(n.char).align('left'); break;
      case 'FEED': b.feed(n.n); break;
      case 'CUT': b.cut(); break;
      case 'DRAWER': b.openCashDrawer(); break;
      case 'QR': {
        const url = fill(n.text, ctx);
        if (url) { n.size ? b.qr(url, n.size) : b.qr(url); b.align('left'); }
        break;
      }
      case 'ITEMS':
        for (const it of ctx.ITEMS || []) renderNodes(b, n.children, { ...ctx, ...itemCtx(it) });
        break;
      case 'MODS':
        for (const m of ctx.__MODS || []) renderNodes(b, n.children, { ...ctx, ...m });
        break;
      case 'NOTES':
        for (const x of ctx.__NOTES || []) renderNodes(b, n.children, { ...ctx, ...x });
        break;
      default:
        if (n.type.startsWith('IF_')) {
          const key = n.type.slice(3);
          if (ctx[IF_ALIASES[key] || key]) renderNodes(b, n.children, ctx);
        }
    }
  }
}

/* =============================== API ===================================== */

function renderRtfTemplate(builder, rtfText, data = {}, opts = {}) {
  renderNodes(builder, compile(rtfText, opts), data);
  return builder;
}

function renderRtfFile(builder, name, data = {}, opts = {}) {
  const file = path.isAbsolute(name) ? name : path.join(TEMPLATES_DIR, name);
  return renderRtfTemplate(builder, fs.readFileSync(file, 'utf8'), data, opts);
}

module.exports = { renderRtfTemplate, renderRtfFile, compile };
