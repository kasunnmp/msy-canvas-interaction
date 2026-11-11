import type { ReportCard, Tile, ViewRange } from './types';
import { comparisonLabel, formatNumber, tileData } from './data';
import { SOURCES } from './sampleReports';
import { kindOf } from './catalog';
import { CARBON_TYPES } from '../tiles/Charts';

/* Export (§16, §17). "Export" is the only verb for taking a Report Card or Tile out as a file. */

export type TileFormat = 'PDF' | 'PNG' | 'CSV';
export type CardFormat = 'PDF' | 'HTML' | 'Markdown' | 'CSV' | 'Print';

const safe = (s: string) => s.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'report';

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

const sourceNames = (t: Tile) => t.sources.map((id) => SOURCES[id]?.name ?? id).join(' + ') || '—';

export function relativeTime(ms: number, now = Date.now()): string {
  const d = Math.max(0, now - ms);
  if (d < 45_000) return 'just now';
  if (d < 3_600_000) return `${Math.round(d / 60_000)}m ago`;
  if (d < 86_400_000) return `${Math.round(d / 3_600_000)}h ago`;
  const days = Math.round(d / 86_400_000);
  return days === 1 ? '1 day ago' : `${days} days ago`;
}

function csvEscape(v: unknown) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** §17.2 CSV: underlying rows; Source, Refreshed and Comparison period are trailing columns on every row. */
function tileCsvRows(tile: Tile, range: ViewRange, refreshed: string) {
  const d = tileData(tile, range);
  return d.rows.map((r) => {
    const { Source: _s, Comparison: _c, ...rest } = r;
    return { tile: tile.name, ...rest, Source: sourceNames(tile), Refreshed: refreshed, 'Comparison period': comparisonLabel(range.key) };
  });
}

function toCsv(rows: Record<string, unknown>[]) {
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  return [cols.join(','), ...rows.map((r) => cols.map((c) => csvEscape(r[c])).join(','))].join('\n');
}

// ───────────────── image helpers ─────────────────

const STYLE_PROPS = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray', 'opacity', 'font-size', 'font-family', 'font-weight', 'text-anchor', 'visibility', 'display'];

function inlineSvg(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const src = [svg, ...svg.querySelectorAll('*')];
  const dst = [clone, ...clone.querySelectorAll('*')];
  src.forEach((el, i) => {
    const cs = getComputedStyle(el);
    const target = dst[i] as SVGElement;
    target.setAttribute('style', STYLE_PROPS.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(';'));
  });
  const r = svg.getBoundingClientRect();
  clone.setAttribute('width', String(r.width));
  clone.setAttribute('height', String(r.height));
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  return new XMLSerializer().serializeToString(clone);
}

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draw a Tile's data on a canvas region (used for card-level exports at the saved default range). */
function drawTileData(ctx: CanvasRenderingContext2D, tile: Tile, range: ViewRange, x: number, y: number, w: number, h: number) {
  ctx.save();
  roundRect(ctx, x, y, w, h, 14);
  ctx.fillStyle = tile.tone === 'alert' ? '#ffdbdc' : '#fff';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = tile.tone === 'alert' ? '#ce2c31' : 'rgba(0,0,0,0.6)';
  ctx.font = '500 12px Inter, sans-serif';
  ctx.fillText(tile.name.toUpperCase(), x + 14, y + 22);
  if (tile.type === 'text') {
    ctx.fillStyle = '#222';
    ctx.font = '500 16px Inter, sans-serif';
    ctx.fillText(tile.text || '', x + 14, y + 46);
    ctx.restore();
    return;
  }
  if (tile.status !== 'ok') {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.font = '13px Inter, sans-serif';
    ctx.fillText(tile.status === 'failed' ? 'Tile failed to load' : tile.status === 'noData' ? 'Nothing for this period' : 'Not connected', x + 14, y + 52);
    ctx.restore();
    return;
  }
  const d = tileData(tile, range);
  ctx.fillStyle = tile.tone === 'alert' ? '#ce2c31' : 'rgba(0,0,0,0.9)';
  ctx.font = '500 26px Inter, sans-serif';
  ctx.fillText(`${formatNumber(d.value)}${tile.unit ?? ''}`, x + 14, y + 58);
  const top = y + 72;
  const ch = h - 72 - 30;
  if (ch > 30 && kindOf(tile.type).min.h >= 3 && tile.type !== 'stat') {
    const pts = ['line', 'area', 'stream', 'stackedArea', 'scatter', 'histogram'].includes(tile.type) ? d.series : d.categories.map((c) => c.value);
    const max = Math.max(1, ...pts);
    ctx.strokeStyle = '#1734d6';
    ctx.fillStyle = '#1734d6';
    if (['line', 'area', 'stream', 'stackedArea'].includes(tile.type)) {
      ctx.beginPath();
      pts.forEach((v, i) => {
        const px = x + 16 + (i / Math.max(1, pts.length - 1)) * (w - 32);
        const py = top + ch - (v / max) * ch;
        if (i) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
      });
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      const bw = (w - 32) / pts.length;
      pts.forEach((v, i) => ctx.fillRect(x + 16 + i * bw + 3, top + ch - (v / max) * ch, Math.max(2, bw - 6), (v / max) * ch));
    }
  }
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.font = '11px Inter, sans-serif';
  ctx.fillText(`${sourceNames(tile)} · ${comparisonLabel(range.key)}`, x + 14, y + h - 12);
  ctx.restore();
}

/** Minimal single-page PDF wrapping a JPEG (DCTDecode). */
async function canvasToPdf(canvas: HTMLCanvasElement): Promise<Blob> {
  const jpeg = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/jpeg', 0.92));
  const img = new Uint8Array(await jpeg.arrayBuffer());
  const W = canvas.width / 2;
  const H = canvas.height / 2;
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let len = 0;
  const push = (p: Uint8Array | string) => {
    const b = typeof p === 'string' ? enc.encode(p) : p;
    parts.push(b);
    len += b.length;
  };
  const obj = (n: number, body: string | (Uint8Array | string)[]) => {
    offsets[n] = len;
    push(`${n} 0 obj\n`);
    if (typeof body === 'string') push(body);
    else body.forEach(push);
    push('\nendobj\n');
  };
  push('%PDF-1.4\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  obj(4, [
    `<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.length} >>\nstream\n`,
    img,
    '\nendstream',
  ]);
  const content = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
  obj(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  const xref = len;
  push(`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`);
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(parts as BlobPart[], { type: 'application/pdf' });
}

/** Render a Tile as currently viewed (its on-screen footprint) plus full attribution text (§17.4). */
async function tileCanvas(el: HTMLElement, tile: Tile, range: ViewRange, refreshed: string) {
  const r = el.getBoundingClientRect();
  const scale = 2;
  const footer = 46;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(r.width * scale);
  canvas.height = Math.round((r.height + footer) * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, r.width, r.height + footer);
  const svg = el.querySelector<SVGSVGElement>('.cds--chart-holder svg.layout-svg-wrapper, .cds--chart-holder svg');
  if (svg && CARBON_TYPES.has(tile.type)) {
    // Draw the card frame + name, then the live chart SVG at its on-screen position.
    drawTileData(ctx, { ...tile, type: 'stat' }, range, 0, 0, r.width, r.height);
    const sr = svg.getBoundingClientRect();
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(inlineSvg(svg))}`;
    const img = await loadImage(url).catch(() => null);
    if (img) ctx.drawImage(img, sr.left - r.left, sr.top - r.top, sr.width, sr.height);
  } else {
    drawTileData(ctx, tile, range, 0, 0, r.width, r.height);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.font = '11px Inter, sans-serif';
  ctx.fillText(`Source: ${sourceNames(tile)}`, 6, r.height + 16);
  ctx.fillText(`Refreshed ${refreshed} · Comparison period: ${comparisonLabel(range.key)}`, 6, r.height + 32);
  return canvas;
}

export async function exportTileFile(format: TileFormat, el: HTMLElement | null, tile: Tile, range: ViewRange, refreshed: string) {
  const name = safe(tile.name);
  if (format === 'CSV') {
    download(new Blob([toCsv(tileCsvRows(tile, range, refreshed))], { type: 'text/csv' }), `${name}.csv`);
    return;
  }
  if (!el) return;
  const canvas = await tileCanvas(el, tile, range, refreshed);
  if (format === 'PNG') {
    canvas.toBlob((b) => b && download(b, `${name}.png`), 'image/png');
  } else {
    download(await canvasToPdf(canvas), `${name}.pdf`);
  }
}

// ───────────────── Report Card exports (saved default range & filters, §16) ─────────────────

function cardHtml(card: ReportCard, range: ViewRange) {
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
  const sections = card.tiles
    .slice()
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((t) => {
      if (t.type === 'text') return `<h3>${esc(t.text || '')}</h3>`;
      if (t.status !== 'ok') return `<section><h2>${esc(t.name)}</h2><p><em>${t.status === 'failed' ? 'Tile failed to load' : t.status === 'noData' ? 'Nothing for this period' : 'Not connected'}</em></p></section>`;
      const d = tileData(t, range);
      const cols = Object.keys(d.rows[0] ?? {});
      return `<section><h2>${esc(t.name)}</h2><p class="v">${formatNumber(d.value)}${t.unit ?? ''}</p><table><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr>${d.rows
        .map((r) => `<tr>${cols.map((c) => `<td>${esc(String(r[c]))}</td>`).join('')}</tr>`)
        .join('')}</table></section>`;
    })
    .join('\n');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(card.name)}</title><style>body{font:14px Inter,system-ui,sans-serif;margin:32px;color:#222}h1{font-weight:500}section{margin:24px 0}.v{font-size:24px;margin:4px 0}table{border-collapse:collapse}td,th{border:1px solid #ddd;padding:4px 8px;text-align:left}</style></head><body><h1>${esc(card.name)}</h1><p>Refreshed ${relativeTime(card.refreshedAt)} · ${comparisonLabel(range.key)}</p>${sections}</body></html>`;
}

function cardMarkdown(card: ReportCard, range: ViewRange) {
  const lines = [`# ${card.name}`, '', `Refreshed ${relativeTime(card.refreshedAt)} · ${comparisonLabel(range.key)}`, ''];
  for (const t of card.tiles.slice().sort((a, b) => a.y - b.y || a.x - b.x)) {
    if (t.type === 'text') {
      lines.push(`### ${t.text || ''}`, '');
      continue;
    }
    lines.push(`## ${t.name}`, '');
    if (t.status !== 'ok') {
      lines.push(`_${t.status === 'failed' ? 'Tile failed to load' : t.status === 'noData' ? 'Nothing for this period' : 'Not connected'}_`, '');
      continue;
    }
    const d = tileData(t, range);
    const cols = Object.keys(d.rows[0] ?? {});
    lines.push(`**${formatNumber(d.value)}${t.unit ?? ''}**`, '', `| ${cols.join(' | ')} |`, `| ${cols.map(() => '---').join(' | ')} |`);
    d.rows.forEach((r) => lines.push(`| ${cols.map((c) => String(r[c])).join(' | ')} |`));
    lines.push('');
  }
  return lines.join('\n');
}

async function cardPdf(card: ReportCard, range: ViewRange) {
  const W = 900;
  const col = (W - 48) / 12;
  const row = 64;
  const tiles = card.tiles;
  const H = 110 + tiles.reduce((m, t) => Math.max(m, t.y + t.h), 0) * row + 24;
  const canvas = document.createElement('canvas');
  canvas.width = W * 2;
  canvas.height = H * 2;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(2, 2);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.font = '500 26px Inter, sans-serif';
  ctx.fillText(card.name, 24, 48);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.font = '13px Inter, sans-serif';
  ctx.fillText(`Refreshed ${relativeTime(card.refreshedAt)} · ${comparisonLabel(range.key)}`, 24, 72);
  for (const t of tiles) drawTileData(ctx, t, range, 24 + t.x * col + 4, 96 + t.y * row + 4, t.w * col - 8, t.h * row - 8);
  return canvasToPdf(canvas);
}

export async function exportCardFile(format: CardFormat, card: ReportCard, range: ViewRange) {
  const name = safe(card.name);
  switch (format) {
    case 'CSV': {
      const refreshed = relativeTime(card.refreshedAt);
      const rows = card.tiles.filter((t) => t.type !== 'text' && t.status === 'ok').flatMap((t) => tileCsvRows(t, range, refreshed));
      download(new Blob([toCsv(rows)], { type: 'text/csv' }), `${name}.csv`);
      return;
    }
    case 'HTML':
      download(new Blob([cardHtml(card, range)], { type: 'text/html' }), `${name}.html`);
      return;
    case 'Markdown':
      download(new Blob([cardMarkdown(card, range)], { type: 'text/markdown' }), `${name}.md`);
      return;
    case 'PDF':
      download(await cardPdf(card, range), `${name}.pdf`);
      return;
    case 'Print': {
      const frame = document.createElement('iframe');
      frame.style.cssText = 'position:fixed;width:0;height:0;border:0;opacity:0';
      document.body.appendChild(frame);
      frame.srcdoc = cardHtml(card, range);
      frame.onload = () => {
        try {
          frame.contentWindow?.print();
        } finally {
          window.setTimeout(() => frame.remove(), 1000);
        }
      };
    }
  }
}
