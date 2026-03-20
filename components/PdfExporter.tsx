"use client";

import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from 'pdf-lib';
import * as fontkit from 'fontkit';
import { marked } from 'marked';
import emojiRegex from 'emoji-regex';

export async function exportToPdf(markdown: string, filename = "document.pdf") {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit as any);

  // START WITH STANDARD FONTS (Ensures zero-delay and offline stability)
  let fonts = {
    regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
    italic: await pdfDoc.embedFont(StandardFonts.HelveticaOblique),
    mono: await pdfDoc.embedFont(StandardFonts.Courier),
  };

  // ATTEMPT TO UPGRADE TO INTER (Non-blocking, silent failure)
  try {
    const fontUrls = {
      regular: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/inter/static/Inter-Regular.ttf',
      bold: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/inter/static/Inter-Bold.ttf',
    };
    const [regB, boldB] = await Promise.all([
      fetch(fontUrls.regular).then(r => r.ok ? r.arrayBuffer() : null).catch(() => null),
      fetch(fontUrls.bold).then(r => r.ok ? r.arrayBuffer() : null).catch(() => null),
    ]);
    if (regB) fonts.regular = await pdfDoc.embedFont(regB);
    if (boldB) fonts.bold = await pdfDoc.embedFont(boldB);
  } catch (e) {
    console.warn("Silent Upgrade failed: using standard fonts.");
  }

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
    h1: { size: 26, font: fonts.bold, spacing: 40, color: colors.primary, lineHeight: 1.2 },
    h2: { size: 20, font: fonts.bold, spacing: 32, color: colors.primary, lineHeight: 1.2 },
    h3: { size: 15, font: fonts.bold, spacing: 26, color: colors.primary, lineHeight: 1.2 },
    p: { size: 11, font: fonts.regular, spacing: 18, color: colors.text, lineHeight: 1.5 },
    mono: { size: 9, font: fonts.mono, spacing: 13, color: rgb(0.9, 0.92, 0.95), bg: rgb(0.08, 0.1, 0.16) }
  };

  const checkPageEdge = (needed: number) => {
    if (y - needed < margin + 40) {
      addFooter();
      page = pdfDoc.addPage(pageSize);
      y = height - margin;
    }
  };

  const addFooter = () => {
    const pageNum = pdfDoc.getPageCount();
    const footerText = `Page ${pageNum}`;
    const fontSize = 9;
    const textWidth = fonts.regular.widthOfTextAtSize(footerText, fontSize);
    page.drawText(footerText, {
      x: width / 2 - textWidth / 2, y: margin / 2,
      size: fontSize, font: fonts.regular, color: colors.subtle,
    });
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
          } catch(e) {
            const img = await getEmojiImage(word);
            if(img) page.drawImage(img, { x: currentX, y: y - size - (size*0.1), width: size*1.1, height: size*1.1 });
          }
          currentX += wordWidth;
        }
      } else {
        const img = await getEmojiImage(seg.content);
        if (img) {
          const imgSize = size * 1.1;
          if (currentX + imgSize > startX + maxWidth) {
            y -= size * lineHeight; currentX = startX; checkPageEdge(size * lineHeight);
          }
          page.drawImage(img, { x: currentX, y: y - size - (size * 0.1), width: imgSize, height: imgSize });
          currentX += imgSize + 1;
        }
      }
    }
    return currentX;
  }

  async function drawImageSafe(url: string, maxWidth: number) {
    try {
      const resp = await fetch(url);
      const bytes = new Uint8Array(await resp.arrayBuffer());
      let img = url.toLowerCase().endsWith('.png') ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
      const dims = img.scale(1);
      const scale = Math.min(maxWidth / dims.width, 1.0);
      const finalW = dims.width * scale; const finalH = dims.height * scale;
      checkPageEdge(finalH + 20);
      page.drawImage(img, { x: margin + (maxWidth - finalW) / 2, y: y - finalH - 5, width: finalW, height: finalH });
      y -= finalH + 15;
    } catch (e) {
      console.error("Image Draw Error:", e);
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
          page.drawLine({ start: { x: sX, y: y - baseStyle.size + (baseStyle.size/3) }, end: { x: currentX, y: y - baseStyle.size + (baseStyle.size/3) }, thickness: 0.5, color: baseStyle.color });
        } else if (t.type === 'codespan') {
          const w = safeWidth(fonts.mono, t.text, baseStyle.size * 0.9);
          if (currentX + w > x + maxWidth) { y -= baseStyle.size * baseStyle.lineHeight; currentX = x; checkPageEdge(baseStyle.size * baseStyle.lineHeight); }
          page.drawRectangle({ x: currentX - 1, y: y - baseStyle.size - 1, width: w + 2, height: baseStyle.size + 2, color: rgb(0.95, 0.96, 0.97) });
          await drawTextSafe(t.text, currentX, baseStyle.size * 0.9, fonts.mono, colors.primary, maxWidth, x, 1.0);
          currentX += w + 2;
        } else if (t.type === 'link') {
          const oldCol = baseStyle.color; baseStyle.color = colors.primary;
          await processTokens(t.tokens || []); baseStyle.color = oldCol;
        } else if (t.type === 'image') {
          await drawImageSafe(t.href, maxWidth);
          currentX = x;
        } else if (t.type === 'text' || t.type === 'escape') {
          if (t.tokens && t.tokens.length > 0) await processTokens(t.tokens);
          else currentX = await drawTextSafe(t.text, currentX, baseStyle.size, getFontForState(bold, italic), baseStyle.color, maxWidth, x, baseStyle.lineHeight);
        } else if (t.tokens) { await processTokens(t.tokens); }
      }
    };
    await processTokens(tokens);
  }

  async function renderList(items: any[], level = 0, ordered = false) {
    let index = 1;
    for (const item of items) {
      const indent = level * 24;
      checkPageEdge(styles.p.size * styles.p.lineHeight);
      
      const bX = margin + indent;
      if (ordered) {
        await drawTextSafe(`${index}. `, bX, styles.p.size, fonts.regular, colors.subtle, contentWidth, bX);
      } else {
        // Draw vector bullet instead of text bullet to avoid encoding crash
        page.drawCircle({ x: bX + 5, y: y - (styles.p.size/2) - 2, size: 2.5, color: colors.subtle });
      }
      
      let xOff = indent + 18;
      
      if (item.task) {
        const cbS = 9; const cbY = y - styles.p.size + 1;
        page.drawRectangle({ x: margin + xOff, y: cbY, width: cbS, height: cbS, borderWidth: 0.8, borderColor: colors.subtle });
        if (item.checked) {
          page.drawLine({ start: { x: margin + xOff + 2, y: cbY + 4 }, end: { x: margin + xOff + 4, y: cbY + 2 }, thickness: 1.2, color: colors.primary });
          page.drawLine({ start: { x: margin + xOff + 4, y: cbY + 2 }, end: { x: margin + xOff + 7, y: cbY + 7 }, thickness: 1.2, color: colors.primary });
        }
        xOff += cbS + 10;
      }

      await renderInlineTokens(item.tokens || [], margin + xOff, contentWidth - xOff, styles.p);
      y -= styles.p.size * styles.p.lineHeight;
      
      if (item.tokens) {
        const sub = item.tokens.find((t: any) => t.type === 'list');
        if (sub) await renderList(sub.items, level + 1, sub.ordered);
      }
      index++;
    }
  }

  const tokens = marked.lexer(markdown);
  for (const t of tokens) {
    switch (t.type) {
      case 'heading':
        const hS = t.depth === 1 ? styles.h1 : t.depth === 2 ? styles.h2 : styles.h3;
        checkPageEdge(hS.size + hS.spacing);
        if (t.tokens) await renderInlineTokens(t.tokens, margin, contentWidth, hS);
        else await drawTextSafe(t.text, margin, hS.size, hS.font, hS.color, contentWidth, margin);
        y -= hS.spacing;
        break;
      case 'paragraph':
        checkPageEdge(styles.p.size * 2.5);
        await renderInlineTokens(t.tokens || [], margin, contentWidth, styles.p);
        y -= styles.p.spacing;
        break;
      case 'list':
        await renderList(t.items, 0, t.ordered);
        y -= 12;
        break;
      case 'code':
        const lns = t.text.split('\n');
        const h = lns.length * styles.mono.spacing + 30;
        checkPageEdge(h);
        page.drawRectangle({ x: margin - 10, y: y - h, width: contentWidth + 20, height: h, color: styles.mono.bg });
        y -= 25;
        for (const l of lns) {
          await drawTextSafe(l, margin, styles.mono.size, fonts.mono, styles.mono.color, contentWidth, margin, 1.0);
          y -= styles.mono.spacing;
        }
        y -= 20;
        break;
      case 'table':
        const colW = contentWidth / t.header.length; const rowH = 28;
        checkPageEdge((t.rows.length + 1) * rowH + 20);
        page.drawRectangle({ x: margin, y: y - rowH, width: contentWidth, height: rowH, color: colors.headerBg });
        for (let i = 0; i < t.header.length; i++) {
          const oldY = y; y -= 9;
          await drawTextSafe(t.header[i].text || String(t.header[i]), margin + i * colW + 10, 10, fonts.bold, colors.primary, colW - 20, margin + i * colW + 10, 1.0);
          y = oldY;
        }
        y -= rowH;
        for (let ri = 0; ri < t.rows.length; ri++) {
          const row = t.rows[ri];
          const rowTopY = y;
          let maxRowHeight = rowH;

          // Track minY to determine how much space the row actually took
          const getMinY = () => y; 
          
          if (ri % 2 === 1) {
            // Pre-calculate if possible or just use rowH. For safety we draw a rowH stripe.
            page.drawRectangle({ x: margin, y: rowTopY - rowH, width: contentWidth, height: rowH, color: colors.stripe });
          }
          
          for (let ci = 0; ci < row.length; ci++) {
            const cell = row[ci];
            y = rowTopY - 9; // Reset Y to row top (minus padding) for each cell
            if (cell.tokens) {
              await renderInlineTokens(cell.tokens, margin + ci * colW + 10, colW - 20, { ...styles.p, size: 10 });
            } else {
              await drawTextSafe(cell.text || String(cell), margin + ci * colW + 10, 10, fonts.regular, colors.text, colW - 20, margin + ci * colW + 10, 1.0);
            }
            const cellBottomY = y - 10; // 10 is font size
            const reachedH = rowTopY - cellBottomY + 5;
            if (reachedH > maxRowHeight) maxRowHeight = reachedH;
          }
          y = rowTopY - maxRowHeight;
        }
        y -= 20;
        break;
      case 'hr':
        checkPageEdge(20);
        page.drawLine({ start: { x: margin, y: y - 10 }, end: { x: width - margin, y: y - 10 }, thickness: 1, color: colors.border });
        y -= 30;
        break;
      case 'blockquote':
        const startY = y;
        await renderInlineTokens(t.tokens || [], margin + 26, contentWidth - 26, { ...styles.p, color: colors.subtle });
        page.drawLine({ start: { x: margin + 10, y: startY }, end: { x: margin + 10, y: y + 10 }, thickness: 3, color: colors.primary });
        y -= 10;
        break;
      case 'image':
        await drawImageSafe(t.href, contentWidth);
        break;
    }
  }

  addFooter();
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
