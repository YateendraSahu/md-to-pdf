"use client";

import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from 'pdf-lib';
import * as fontkit from 'fontkit';
import { marked } from 'marked';
import emojiRegex from 'emoji-regex';

export async function exportToPdf(markdown: string, filename = "document.pdf") {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit as any);

  // 1. FONT INITIALIZATION
  let fonts = {
    regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
    italic: await pdfDoc.embedFont(StandardFonts.HelveticaOblique),
    mono: await pdfDoc.embedFont(StandardFonts.Courier),
  };

  try {
    const urls = {
      reg: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/inter/static/Inter-Regular.ttf',
      bold: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/inter/static/Inter-Bold.ttf',
    };
    const [rb, bb] = await Promise.all([
      fetch(urls.reg).then(r => r.ok ? r.arrayBuffer() : null).catch(() => null),
      fetch(urls.bold).then(r => r.ok ? r.arrayBuffer() : null).catch(() => null),
    ]);
    if (rb) fonts.regular = await pdfDoc.embedFont(rb);
    if (bb) fonts.bold = await pdfDoc.embedFont(bb);
  } catch (e) {
    console.warn("Silent Upgrade failed: using standard fonts.");
  }

  // 2. PAGE & STYLE SETUP
  const pageSize: [number, number] = [595.28, 841.89];
  let page = pdfDoc.addPage(pageSize);
  const { width, height } = page.getSize();
  const margin = 50;
  let y = height - margin;
  const contentWidth = width - (margin * 2);

  const colors = {
    primary: rgb(0.12, 0.24, 0.59),
    text: rgb(0.15, 0.17, 0.21),
    subtle: rgb(0.4, 0.45, 0.5),
    border: rgb(0.9, 0.92, 0.94),
    headerBg: rgb(0.96, 0.97, 0.98),
    stripe: rgb(0.98, 0.99, 1.0)
  };

  const styles = {
    h1: { size: 22, font: fonts.bold, spacing: 40, color: colors.primary, lineHeight: 1.2 },
    h2: { size: 16, font: fonts.bold, spacing: 32, color: colors.primary, lineHeight: 1.2 },
    h3: { size: 13, font: fonts.bold, spacing: 26, color: colors.primary, lineHeight: 1.2 },
    p: { size: 12, font: fonts.regular, spacing: 22, color: colors.text, lineHeight: 1.55 },
    mono: { size: 9, font: fonts.mono, spacing: 13, color: rgb(0.9, 0.92, 0.95), bg: rgb(0.08, 0.1, 0.16) }
  };

  // 3. CORE HELPERS
  const checkPageEdge = (needed: number) => {
    if (y - needed < margin + 40) {
      addFooter();
      page = pdfDoc.addPage(pageSize);
      y = height - margin;
      return true;
    }
    return false;
  };

  const addFooter = () => {
    const pageNum = pdfDoc.getPageCount();
    const txt = `Page ${pageNum}`;
    const sz = 9;
    const w = fonts.regular.widthOfTextAtSize(txt, sz);
    page.drawText(txt, { x: width / 2 - w / 2, y: margin / 2, size: sz, font: fonts.regular, color: colors.subtle });
  };

  const emojiCache = new Map<string, any>();
  async function getEmojiImage(emoji: string) {
    if (emojiCache.has(emoji)) return emojiCache.get(emoji);
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.font = '80px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
      ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
      ctx.fillText(emoji, 64, 64);
      const dataUrl = canvas.toDataURL('image/png');
      const response = await fetch(dataUrl);
      const image = await pdfDoc.embedPng(new Uint8Array(await response.arrayBuffer()));
      emojiCache.set(emoji, image);
      return image;
    }
    return null;
  }

  function getFontForState(bold: boolean, italic: boolean) {
    if (bold) return fonts.bold;
    if (italic) return fonts.italic;
    return fonts.regular;
  }

  const safeWidth = (font: PDFFont, text: string, size: number) => {
    try { return font.widthOfTextAtSize(text, size); }
    catch (e) { return text.length * (size * 0.6); }
  };

  async function drawTextSafe(text: string, xPos: number, size: number, font: PDFFont, color: any, maxWidth: number, startX: number, lineHeight: number = 1.4) {
    const regex = emojiRegex();
    let currentX = xPos;
    const pieces: { type: 'text' | 'image', content: string }[] = [];
    let lastIdx = 0; let match;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIdx) pieces.push({ type: 'text', content: text.slice(lastIdx, match.index) });
      pieces.push({ type: 'image', content: match[0] });
      lastIdx = regex.lastIndex;
    }
    if (lastIdx < text.length) pieces.push({ type: 'text', content: text.slice(lastIdx) });

    for (const seg of pieces) {
      if (seg.type === 'text') {
        const words = seg.content.split(/(\s+)/);
        for (const word of words) {
          if (!word) continue;
          let wordWidth = safeWidth(font, word, size);
          if (currentX + wordWidth > startX + maxWidth && word.trim().length > 0) {
            y -= size * lineHeight; currentX = startX; checkPageEdge(size * lineHeight);
          }
          try {
            page.drawText(word, { x: currentX, y: y - size, size, font, color });
          } catch (e) {
            const img = await getEmojiImage(word);
            if (img) {
              const eS = size * 0.85;
              const emojiY = (y - size) + (size * 0.35) - (eS / 2);
              page.drawImage(img, { x: currentX, y: emojiY, width: eS, height: eS });
            }
          }
          currentX += wordWidth;
        }
      } else {
        const img = await getEmojiImage(seg.content);
        if (img) {
          const imgSize = size * 0.85;
          if (currentX + imgSize > startX + maxWidth) {
            y -= size * lineHeight; currentX = startX; checkPageEdge(size * lineHeight);
          }
          const emojiY = (y - size) + (size * 0.35) - (imgSize / 2);
          page.drawImage(img, { x: currentX, y: emojiY, width: imgSize, height: imgSize });
          currentX += imgSize + 2;
        }
      }
    }
    return currentX;
  }

  async function drawImageSafe(url: string, maxWidth: number, startX: number) {
    try {
      const resp = await fetch(url, { mode: 'cors' });
      const contentType = resp.headers.get("content-type");
      const bytes = new Uint8Array(await resp.arrayBuffer());
      let img;
      const lowerUrl = url.toLowerCase();
      if (contentType?.includes("jpeg") || lowerUrl.endsWith(".jpg") || lowerUrl.endsWith(".jpeg")) img = await pdfDoc.embedJpg(bytes);
      else if (contentType?.includes("png") || lowerUrl.endsWith(".png")) img = await pdfDoc.embedPng(bytes);
      else { try { img = await pdfDoc.embedJpg(bytes); } catch { img = await pdfDoc.embedPng(bytes); } }

      const dims = img.scale(1);
      const scale = Math.min(maxWidth / dims.width, 1.0);
      const finalW = dims.width * scale; const finalH = dims.height * scale;
      checkPageEdge(finalH + 20);
      page.drawImage(img, { x: startX + (maxWidth - finalW) / 2, y: y - finalH - 5, width: finalW, height: finalH });
      y -= finalH + 15;
    } catch (e) {
      await drawTextSafe(`[Image Load Failed: ${url.slice(0, 30)}...]`, startX, 9, fonts.regular, rgb(1, 0, 0), maxWidth, startX, 1.0);
      y -= 15;
    }
  }

  async function renderInlineTokens(tokens: any[], x: number, maxWidth: number, baseStyle: any) {
    let currentX = x;
    let bold = baseStyle.font === fonts.bold;
    let italic = baseStyle.font === fonts.italic;
    const processTokens = async (ts: any[]) => {
      for (const t of ts) {
        if (t.type === 'strong') { bold = true; await processTokens(t.tokens || []); bold = false; }
        else if (t.type === 'em') { italic = true; await processTokens(t.tokens || []); italic = false; }
        else if (t.type === 'del') {
          const sX = currentX;
          currentX = await drawTextSafe(t.text, currentX, baseStyle.size, getFontForState(bold, italic), baseStyle.color, maxWidth, x, baseStyle.lineHeight);
          page.drawLine({ start: { x: sX, y: y - baseStyle.size + (baseStyle.size / 3) }, end: { x: currentX, y: y - baseStyle.size + (baseStyle.size / 3) }, thickness: 0.5, color: baseStyle.color });
        } else if (t.type === 'codespan') {
          const cw = safeWidth(fonts.regular, t.text, baseStyle.size * 0.9);
          if (currentX + cw > x + maxWidth) { y -= baseStyle.size * baseStyle.lineHeight; currentX = x; checkPageEdge(baseStyle.size * baseStyle.lineHeight); }
          page.drawRectangle({ x: currentX - 2, y: y - baseStyle.size - 2, width: cw + 4, height: baseStyle.size + 4, color: rgb(0.93, 0.95, 0.98) });
          await drawTextSafe(t.text, currentX, baseStyle.size * 0.9, fonts.regular, rgb(0.1, 0.3, 0.6), maxWidth, x, 1.0);
          currentX += cw + 4;
        } else if (t.type === 'link') {
          const oldCol = baseStyle.color; baseStyle.color = colors.primary;
          await processTokens(t.tokens || []); baseStyle.color = oldCol;
        } else if (t.type === 'image') {
          await drawImageSafe(t.href, maxWidth, x);
          currentX = x;
        } else if (t.type === 'text' || t.type === 'escape') {
          if (t.tokens && t.tokens.length > 0) await processTokens(t.tokens);
          else currentX = await drawTextSafe(t.text, currentX, baseStyle.size, getFontForState(bold, italic), baseStyle.color, maxWidth, x, baseStyle.lineHeight);
        } else if (t.tokens) { await processTokens(t.tokens); }
      }
    };
    await processTokens(tokens);
  }

  async function renderList(items: any[], level = 0, ordered = false, startX: number, width: number) {
    let index = 1;
    for (const item of items) {
      const indent = level * 24;
      checkPageEdge(styles.p.size * styles.p.lineHeight);
      const bX = startX + indent;
      if (ordered) await drawTextSafe(`${index}. `, bX, styles.p.size, fonts.regular, colors.subtle, width, bX);
      else {
        // Center bullets exactly like emojis
        const bRad = 2.5;
        const bY = (y - styles.p.size) + (styles.p.size * 0.35);
        page.drawCircle({ x: bX + 5, y: bY, size: bRad, color: colors.subtle });
      }
      let xOff = indent + 18;
      if (item.task) {
        const cbS = 9; const cbY = (y - styles.p.size) + (styles.p.size * 0.35) - (cbS / 2);
        page.drawRectangle({ x: startX + xOff, y: cbY, width: cbS, height: cbS, borderWidth: 0.8, borderColor: colors.subtle });
        if (item.checked) {
          page.drawLine({ start: { x: startX + xOff + 2, y: cbY + 4 }, end: { x: startX + xOff + 4, y: cbY + 2 }, thickness: 1.2, color: colors.primary });
          page.drawLine({ start: { x: startX + xOff + 4, y: cbY + 2 }, end: { x: startX + xOff + 7, y: cbY + 7 }, thickness: 1.2, color: colors.primary });
        }
        xOff += cbS + 10;
      }
      await renderInlineTokens(item.tokens || [], startX + xOff, width - xOff, styles.p);
      y -= styles.p.size * styles.p.lineHeight;
      if (item.tokens) {
        const sub = item.tokens.find((t: any) => t.type === 'list');
        if (sub) await renderList(sub.items, level + 1, sub.ordered, startX, width);
      }
      index++;
    }
  }

  async function renderTokens(ts: any[], startX: number, width: number) {
    for (const t of ts) {
      switch (t.type) {
        case 'heading': {
          const hS = t.depth === 1 ? styles.h1 : t.depth === 2 ? styles.h2 : styles.h3;
          checkPageEdge(hS.size + hS.spacing);
          if (t.tokens) await renderInlineTokens(t.tokens, startX, width, hS);
          else await drawTextSafe(t.text, startX, hS.size, hS.font, hS.color, width, startX);
          y -= hS.spacing;
          break;
        }
        case 'paragraph': {
          checkPageEdge(styles.p.size * 2.5);
          await renderInlineTokens(t.tokens || [], startX, width, styles.p);
          y -= styles.p.spacing;
          break;
        }
        case 'list': {
          await renderList(t.items, 0, t.ordered, startX, width);
          y -= 25;
          break;
        }
        case 'blockquote': {
          const bStart = y; const bIndent = 26;
          await renderTokens(t.tokens || [], startX + bIndent, width - bIndent);
          page.drawLine({ start: { x: startX + 10, y: bStart + 10 }, end: { x: startX + 10, y: y + 5 }, thickness: 3, color: colors.primary });
          y -= 30;
          break;
        }
        case 'image': await drawImageSafe(t.href, width, startX); y -= 20; break;
        case 'code': {
          const lns = t.text.split('\n');
          const headerH = 24; const initialY = y;
          y -= 10;
          let tempY = y - headerH - 15;
          for (const l of lns) {
            let cx = startX; const words = l.split(/(\s+)/);
            for (const w of words) {
              const ww = safeWidth(fonts.mono, w, styles.mono.size);
              if (cx + ww > startX + width && w.trim().length > 0) { tempY -= styles.mono.spacing; cx = startX; }
              cx += ww;
            }
            tempY -= styles.mono.spacing;
          }
          const totalH = y - tempY + 15;
          checkPageEdge(totalH);
          page.drawRectangle({ x: startX - 10, y: y - totalH, width: width + 20, height: totalH, color: styles.mono.bg });
          const barY = y - headerH;
          page.drawRectangle({ x: startX - 10, y: barY, width: width + 20, height: headerH, color: rgb(0.12, 0.15, 0.22) });
          const btnRadius = 2.5; const btnY = barY + headerH / 2;
          page.drawCircle({ x: startX + 5, y: btnY, size: btnRadius, color: rgb(0.98, 0.39, 0.33) });
          page.drawCircle({ x: startX + 13, y: btnY, size: btnRadius, color: rgb(0.98, 0.74, 0.18) });
          page.drawCircle({ x: startX + 21, y: btnY, size: btnRadius, color: rgb(0.15, 0.79, 0.26) });
          if (t.lang) {
            const langTxt = t.lang.toUpperCase(); const langSz = 7;
            const langW = fonts.bold.widthOfTextAtSize(langTxt, langSz);
            page.drawText(langTxt, { x: startX + width - langW - 5, y: barY + (headerH - langSz) / 2, size: langSz, font: fonts.bold, color: rgb(0.4, 0.45, 0.55) });
          }
          y -= headerH + 15;
          for (const l of lns) { await drawTextSafe(l, startX, styles.mono.size, fonts.mono, styles.mono.color, width, startX, 1.0); y -= styles.mono.spacing; }
          y -= 35;
          break;
        }
        case 'table': {
          const colW = width / t.header.length; const rowH = 28;
          const drawHeader = async () => {
            page.drawRectangle({ x: startX, y: y - rowH, width: width, height: rowH, color: colors.headerBg });
            for (let i = 0; i < t.header.length; i++) {
              const oY = y; y -= 9;
              await drawTextSafe(t.header[i].text || String(t.header[i]), startX + i * colW + 10, 10, fonts.bold, colors.primary, colW - 20, startX + i * colW + 10, 1.0);
              y = oY;
            }
            y -= rowH;
          };
          await drawHeader();
          for (let ri = 0; ri < t.rows.length; ri++) {
            if (checkPageEdge(rowH + 20)) await drawHeader();
            const row = t.rows[ri]; const rTop = y; let rowMaxH = rowH;
            if (ri % 2 === 1) page.drawRectangle({ x: startX, y: rTop - rowH, width: width, height: rowH, color: colors.stripe });
            // Track max height across all cells in this row
            for (let ci = 0; ci < row.length; ci++) {
              y = rTop - 9;
              const cell = row[ci];
              if (cell.tokens) await renderInlineTokens(cell.tokens, startX + ci * colW + 10, colW - 20, { ...styles.p, size: 10 });
              else await drawTextSafe(cell.text || String(cell), startX + ci * colW + 10, 10, fonts.regular, colors.text, colW - 20, startX + ci * colW + 10, 1.0);
              const cellH = rTop - y + 5;
              if (cellH > rowMaxH) rowMaxH = cellH;
            }
            y = rTop - rowMaxH;
          }
          y -= 30;
          break;
        }
        case 'hr': {
          checkPageEdge(20);
          page.drawLine({ start: { x: startX, y: y - 10 }, end: { x: startX + width, y: y - 10 }, thickness: 1, color: colors.border });
          y -= 35;
          break;
        }
      }
    }
  }

  const tokens = marked.lexer(markdown);
  await renderTokens(tokens, margin, contentWidth);
  addFooter();
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
