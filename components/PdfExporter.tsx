"use client";

import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from 'pdf-lib';
import * as fontkit from 'fontkit';
import { marked } from 'marked';

export async function exportToPdf(markdown: string, filename = "document.pdf") {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit as any);

  let fonts: any;
  try {
    const fetchFont = async (url: string) => {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`Failed to fetch font: ${url}`);
      return await resp.arrayBuffer();
    };

    // Load professional Inter font to support full Unicode (arrows, symbols, etc.)
    const baseUrl = 'https://cdn.jsdelivr.net/gh/rsms/inter@v3.19/docs/font-files';
    const [regBytes, boldBytes, italicBytes] = await Promise.all([
      fetchFont(`${baseUrl}/Inter-Regular.otf`),
      fetchFont(`${baseUrl}/Inter-Bold.otf`),
      fetchFont(`${baseUrl}/Inter-Italic.otf`),
    ]);

    fonts = {
      regular: await pdfDoc.embedFont(regBytes),
      bold: await pdfDoc.embedFont(boldBytes),
      italic: await pdfDoc.embedFont(italicBytes),
      boldItalic: await pdfDoc.embedFont(boldBytes), // Using bold as fallback if bold-italic fetch failed
      mono: await pdfDoc.embedFont(StandardFonts.Courier),
    };
  } catch (e) {
    console.warn("Custom fonts failed, falling back to standard Helvetica:", e);
    fonts = {
      regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
      bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
      italic: await pdfDoc.embedFont(StandardFonts.HelveticaOblique),
      boldItalic: await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique),
      mono: await pdfDoc.embedFont(StandardFonts.Courier),
    };
  }

  let page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  
  const margin = 25;
  let y = height - margin;
  const contentWidth = width - (margin * 2);

  const styles = {
    h1: { size: 24, font: fonts.bold, spacing: 32, color: rgb(0.10, 0.25, 0.45) },
    h2: { size: 18, font: fonts.bold, spacing: 28, color: rgb(0.10, 0.25, 0.45) },
    h3: { size: 14, font: fonts.bold, spacing: 24, color: rgb(0.10, 0.25, 0.45) },
    p: { size: 11, font: fonts.regular, spacing: 18, color: rgb(0.06, 0.09, 0.16), lineHeight: 1.5 },
    code: { 
      size: 9.5, 
      font: fonts.mono, 
      spacing: 13, 
      color: rgb(0.97, 0.98, 0.99), 
      bg: rgb(0.06, 0.09, 0.16),
      border: rgb(0.2, 0.22, 0.28)
    },
    blockquote: {
      bg: rgb(0.945, 0.96, 0.976),
      border: rgb(0.10, 0.25, 0.45),
      color: rgb(0.3, 0.35, 0.4)
    },
    link: {
      color: rgb(0.13, 0.35, 0.54)
    },
    hr: {
      color: rgb(0.88, 0.91, 0.94)
    }
  };

  const checkPageEdge = (needed: number) => {
    if (y - needed < margin) {
      page = pdfDoc.addPage([595.28, 841.89]);
      y = height - margin;
    }
  };

  async function embedImage(url: string) {
    return new Promise<any>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = async () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error("Could not get canvas context");
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL('image/png');
          const response = await fetch(dataUrl);
          const arrayBuffer = await response.arrayBuffer();
          const pngImage = await pdfDoc.embedPng(new Uint8Array(arrayBuffer));
          resolve(pngImage);
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => reject(new Error(`Failed to load image from ${url}`));
      img.src = url;
    });
  }

  function getFontForState(bold: boolean, italic: boolean) {
    if (bold && italic) return fonts.boldItalic;
    if (bold) return fonts.bold;
    if (italic) return fonts.italic;
    return fonts.regular;
  }

  async function renderInlineTokens(tokens: any[], x: number, maxWidth: number, baseStyle: any) {
    let currentX = x;
    let bold = false;
    let italic = false;

    const processTokens = async (inlineTokens: any[]) => {
      for (const token of inlineTokens) {
        if (token.type === 'strong') {
          bold = true;
          await processTokens(token.tokens || []);
          bold = false;
        } else if (token.type === 'em') {
          italic = true;
          await processTokens(token.tokens || []);
          italic = false;
        } else if (token.type === 'del') {
          const font = getFontForState(bold, italic);
          const text = token.text;
          const textWidth = font.widthOfTextAtSize(text, baseStyle.size);
          
          if (currentX + textWidth > x + maxWidth) {
            y -= baseStyle.size * baseStyle.lineHeight;
            currentX = x;
            checkPageEdge(baseStyle.size * baseStyle.lineHeight);
          }

          page.drawText(text, {
            x: currentX,
            y: y - baseStyle.size,
            size: baseStyle.size,
            font: font,
            color: baseStyle.color,
          });

          page.drawLine({
            start: { x: currentX, y: y - baseStyle.size + (baseStyle.size / 3) },
            end: { x: currentX + textWidth, y: y - baseStyle.size + (baseStyle.size / 3) },
            thickness: 0.5,
            color: baseStyle.color,
          });
          currentX += textWidth;
        } else if (token.type === 'image') {
          try {
            const image = await embedImage(token.href);
            const { width: imgW, height: imgH } = image.scale(1);
            const scale = Math.min(maxWidth / imgW, 1.0);
            const finalW = imgW * scale;
            const finalH = imgH * scale;

            checkPageEdge(finalH + 20);
            page.drawImage(image, {
              x: x + (maxWidth - finalW) / 2,
              y: y - finalH - 5,
              width: finalW,
              height: finalH,
            });
            y -= finalH + 15;
            currentX = x; // Reset X after image
          } catch (e) {
            console.error("Failed to load image:", e);
          }
        } else if (token.type === 'codespan') {
          const font = fonts.mono;
          const text = token.text;
          const textWidth = font.widthOfTextAtSize(text, baseStyle.size * 0.9);
          
          if (currentX + textWidth > x + maxWidth) {
            y -= baseStyle.size * baseStyle.lineHeight;
            currentX = x;
            checkPageEdge(baseStyle.size * baseStyle.lineHeight);
          }

          page.drawRectangle({
            x: currentX - 1,
            y: y - baseStyle.size - 1,
            width: textWidth + 2,
            height: baseStyle.size + 2,
            color: rgb(0.945, 0.96, 0.976),
          });

          page.drawText(text, {
            x: currentX,
            y: y - baseStyle.size,
            size: baseStyle.size * 0.9,
            font: font,
            color: rgb(0.8, 0.2, 0.4), // Professional Rose/Crimson
          });
          currentX += textWidth + 2;
        } else if (token.type === 'link') {
          const linkColor = styles.link.color;
          const textTokens = token.tokens;
          const originalColor = baseStyle.color;
          baseStyle.color = linkColor;
          await processTokens(textTokens || []);
          baseStyle.color = originalColor;
        } else if (token.type === 'text' || token.type === 'escape') {
          if (token.tokens && token.tokens.length > 0) {
            await processTokens(token.tokens);
          } else {
            const font = getFontForState(bold, italic);
            const words = token.text.split(/(\s+)/);
            
            for (const word of words) {
              const wordWidth = font.widthOfTextAtSize(word, baseStyle.size);
              
              if (currentX + wordWidth > x + maxWidth && word.trim().length > 0) {
                y -= baseStyle.size * baseStyle.lineHeight;
                currentX = x;
                checkPageEdge(baseStyle.size * baseStyle.lineHeight);
              }
              
              page.drawText(word, {
                x: currentX,
                y: y - baseStyle.size,
                size: baseStyle.size,
                font: font,
                color: baseStyle.color,
              });
              currentX += wordWidth;
            }
          }
        } else if (token.type === 'br') {
          y -= baseStyle.size * baseStyle.lineHeight;
          currentX = x;
          checkPageEdge(baseStyle.size * baseStyle.lineHeight);
        } else if (token.tokens) {
          await processTokens(token.tokens);
        }
      }
    };

    await processTokens(tokens);
    y -= baseStyle.size * baseStyle.lineHeight;
  }

  async function renderList(items: any[], level = 0, ordered = false) {
    let index = 1;
    for (const item of items) {
      const indent = level * 20;
      const bullet = ordered ? `${index}. ` : '• ';
      const bulletWidth = fonts.regular.widthOfTextAtSize(bullet, styles.p.size);
      
      checkPageEdge(styles.p.size * styles.p.lineHeight);
      page.drawText(bullet, {
        x: margin + indent,
        y: y - styles.p.size,
        size: styles.p.size,
        font: fonts.regular,
        color: styles.p.color,
      });

      let xOffset = indent + bulletWidth + 5;

      if (item.task) {
        const checkboxSize = 8;
        const checkboxY = y - styles.p.size + 1;
        
        page.drawRectangle({
          x: margin + xOffset,
          y: checkboxY,
          width: checkboxSize,
          height: checkboxSize,
          borderWidth: 0.5,
          borderColor: styles.p.color,
        });

        if (item.checked) {
          page.drawLine({
            start: { x: margin + xOffset + 2, y: checkboxY + 4 },
            end: { x: margin + xOffset + 3, y: checkboxY + 2 },
            thickness: 1,
            color: styles.p.color,
          });
          page.drawLine({
            start: { x: margin + xOffset + 3, y: checkboxY + 2 },
            end: { x: margin + xOffset + 6, y: checkboxY + 6 },
            thickness: 1,
            color: styles.p.color,
          });
        }
        xOffset += checkboxSize + 8;
      }

      await renderInlineTokens(item.tokens || [], margin + xOffset, contentWidth - xOffset, styles.p);
      
      if (item.tokens) {
        const subList = item.tokens.find((t: any) => t.type === 'list');
        if (subList) {
          await renderList(subList.items, level + 1, subList.ordered);
        }
      }
      
      index++;
    }
  }

  const tokens = marked.lexer(markdown);

  for (const token of tokens) {
    switch (token.type) {
      case 'heading': {
        const hStyle = token.depth === 1 ? styles.h1 : token.depth === 2 ? styles.h2 : styles.h3;
        checkPageEdge(hStyle.size + hStyle.spacing);
        page.drawText(token.text, {
          x: margin,
          y: y - hStyle.size,
          size: hStyle.size,
          font: hStyle.font,
          color: hStyle.color,
        });
        y -= hStyle.spacing;
        break;
      }
      
      case 'paragraph': {
        checkPageEdge(styles.p.size * styles.p.lineHeight);
        await renderInlineTokens(token.tokens || [], margin, contentWidth, styles.p);
        y -= 6;
        break;
      }

      case 'list': {
        await renderList(token.items, 0, token.ordered);
        y -= 10;
        break;
      }
      
      case 'image': {
        try {
          const image = await embedImage(token.href);
          const { width: imgW, height: imgH } = image.scale(1);
          const scale = Math.min(contentWidth / imgW, 1.0);
          const finalW = imgW * scale;
          const finalH = imgH * scale;

          checkPageEdge(finalH + 20);
          page.drawImage(image, {
            x: margin + (contentWidth - finalW) / 2,
            y: y - finalH - 5,
            width: finalW,
            height: finalH,
          });
          y -= finalH + 15;
        } catch (e) {
          console.error("Failed to load image:", e);
        }
        break;
      }

      case 'hr': {
        checkPageEdge(20);
        page.drawLine({
          start: { x: margin, y: y - 10 },
          end: { x: width - margin, y: y - 10 },
          thickness: 1,
          color: styles.hr.color,
        });
        y -= 30;
        break;
      }
      
      case 'code': {
        const codeLines = token.text.split('\n');
        const finalLines: string[] = [];
        for (const line of codeLines) {
          const words = line.split(/(\s+)/);
          let currentLine = '';
          for (const word of words) {
            const testLine = currentLine + word;
            if (fonts.mono.widthOfTextAtSize(testLine, styles.code.size) > contentWidth - 20) {
              finalLines.push(currentLine);
              currentLine = word;
            } else {
              currentLine = testLine;
            }
          }
          finalLines.push(currentLine);
        }

        const codeHeight = finalLines.length * styles.code.spacing + 24;
        checkPageEdge(codeHeight);
        
        page.drawRectangle({
          x: margin - 10,
          y: y - codeHeight,
          width: contentWidth + 20,
          height: codeHeight,
          color: styles.code.bg,
        });
        
        y -= 12;
        for (const line of finalLines) {
          page.drawText(line, {
            x: margin,
            y: y - styles.code.size,
            size: styles.code.size,
            font: fonts.mono,
            color: styles.code.color,
          });
          y -= styles.code.spacing;
        }
        y -= 12;
        break;
      }

      case 'table': {
        const colCount = token.header.length;
        const colWidth = contentWidth / colCount;
        const rowHeight = 25;
        
        const tableHeight = (token.rows.length + 1) * rowHeight;
        checkPageEdge(tableHeight + 20);

        const headerBg = rgb(0.945, 0.96, 0.976);
        const stripeBg = rgb(0.97, 0.98, 0.99);
        const borderColor = rgb(0.88, 0.91, 0.94);

        page.drawRectangle({
          x: margin,
          y: y - tableHeight,
          width: contentWidth,
          height: tableHeight,
          borderWidth: 0.5,
          borderColor: borderColor,
        });

        page.drawRectangle({
          x: margin,
          y: y - rowHeight,
          width: contentWidth,
          height: rowHeight,
          color: headerBg,
        });

        token.header.forEach((cell: any, i: number) => {
          page.drawText(cell.text || String(cell), {
            x: margin + i * colWidth + 5,
            y: y - rowHeight + 7,
            size: 10,
            font: fonts.bold,
            color: rgb(0.10, 0.25, 0.45),
          });

          if (i > 0) {
            page.drawLine({
              start: { x: margin + i * colWidth, y: y },
              end: { x: margin + i * colWidth, y: y - tableHeight },
              thickness: 0.5,
              color: borderColor,
            });
          }
        });

        y -= rowHeight;

        token.rows.forEach((row: any[], rowIndex: number) => {
          if (rowIndex % 2 === 0) {
            page.drawRectangle({
              x: margin + 0.5,
              y: y - rowHeight + 0.5,
              width: contentWidth - 1,
              height: rowHeight - 1,
              color: stripeBg,
            });
          }

          page.drawLine({
            start: { x: margin, y: y },
            end: { x: margin + contentWidth, y: y },
            thickness: 0.5,
            color: borderColor,
          });

          row.forEach((cell: any, i: number) => {
            page.drawText(cell.text || String(cell), {
              x: margin + i * colWidth + 5,
              y: y - rowHeight + 7,
              size: 10,
              font: fonts.regular,
              color: styles.p.color,
            });
          });
          y -= rowHeight;
        });

        y -= 20;
        break;
      }

      case 'blockquote': {
        const xOffset = 25;
        const startY = y;
        const quoteColor = styles.blockquote.color;
        const originalColor = styles.p.color;
        styles.p.color = quoteColor;
        
        await renderInlineTokens(token.tokens || [], margin + xOffset, contentWidth - xOffset, styles.p);
        const endY = y;
        
        page.drawLine({
          start: { x: margin + 8, y: startY },
          end: { x: margin + 8, y: endY + styles.p.size },
          thickness: 3,
          color: styles.blockquote.border,
        });
        
        styles.p.color = originalColor;
        y -= 10;
        break;
      }
    }
  }

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
