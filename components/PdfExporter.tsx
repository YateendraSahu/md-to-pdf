"use client";

type Token =
  | { type: "heading"; depth: number; text: string }
  | { type: "paragraph"; text: string; segments: TextSegment[] }
  | { type: "list_item"; text: string; segments: TextSegment[]; ordered: boolean; level: number; checked?: boolean }
  | { type: "hr" }
  | { type: "code"; text: string; language?: string }
  | { type: "blockquote"; text: string; segments: TextSegment[] }
  | { type: "table"; headers: string[]; rows: string[][] };

type TextSegment = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  strikethrough?: boolean;
  link?: string;
};

function parseInlineStyles(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let current = "";
  let i = 0;

  while (i < text.length) {
    // Bold **text** or __text__
    if ((text[i] === "*" && text[i + 1] === "*") || (text[i] === "_" && text[i + 1] === "_")) {
      if (current) {
        segments.push({ text: current });
        current = "";
      }
      const delimiter = text[i];
      i += 2;
      let boldText = "";
      while (i < text.length && !(text[i] === delimiter && text[i + 1] === delimiter)) {
        boldText += text[i++];
      }
      if (boldText) segments.push({ text: boldText, bold: true });
      i += 2;
      continue;
    }

    // Italic *text* or _text_
    if (text[i] === "*" || text[i] === "_") {
      if (current) {
        segments.push({ text: current });
        current = "";
      }
      const delimiter = text[i];
      i++;
      let italicText = "";
      while (i < text.length && text[i] !== delimiter) {
        italicText += text[i++];
      }
      if (italicText) segments.push({ text: italicText, italic: true });
      i++;
      continue;
    }

    // Inline code `text`
    if (text[i] === "`") {
      if (current) {
        segments.push({ text: current });
        current = "";
      }
      i++;
      let codeText = "";
      while (i < text.length && text[i] !== "`") {
        codeText += text[i++];
      }
      if (codeText) segments.push({ text: codeText, code: true });
      i++;
      continue;
    }

    // Strikethrough ~~text~~
    if (text[i] === "~" && text[i + 1] === "~") {
      if (current) {
        segments.push({ text: current });
        current = "";
      }
      i += 2;
      let strikeText = "";
      while (i < text.length && !(text[i] === "~" && text[i + 1] === "~")) {
        strikeText += text[i++];
      }
      if (strikeText) segments.push({ text: strikeText, strikethrough: true });
      i += 2;
      continue;
    }

    // Links [text](url)
    if (text[i] === "[") {
      if (current) {
        segments.push({ text: current });
        current = "";
      }
      i++;
      let linkText = "";
      while (i < text.length && text[i] !== "]") {
        linkText += text[i++];
      }
      i++; // skip ]
      if (text[i] === "(") {
        i++;
        let url = "";
        while (i < text.length && text[i] !== ")") {
          url += text[i++];
        }
        i++;
        if (linkText) segments.push({ text: linkText, link: url });
      }
      continue;
    }

    current += text[i++];
  }

  if (current) segments.push({ text: current });
  return segments.length > 0 ? segments : [{ text }];
}

function parseMarkdown(md: string): Token[] {
  const tokens: Token[] = [];
  const lines = md.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
      tokens.push({ type: "heading", depth: headingMatch[1].length, text: headingMatch[2].trim() });
      i++;
      continue;
    }

    // HR
    if (/^[-*_]{3,}$/.test(line.trim())) {
      tokens.push({ type: "hr" });
      i++;
      continue;
    }

    // Code block
    if (line.startsWith("```")) {
      const langMatch = line.match(/```(\w+)?/);
      const language = langMatch?.[1];
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      tokens.push({ type: "code", text: codeLines.join("\n"), language });
      i++;
      continue;
    }

    // Table
    if (line.includes("|") && lines[i + 1]?.match(/^\|?[\s:-]+\|/)) {
      const headers = line
        .split("|")
        .map((h) => h.trim())
        .filter((h) => h);
      i += 2; // skip header and separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|")) {
        const row = lines[i]
          .split("|")
          .map((c) => c.trim())
          .filter((c) => c);
        if (row.length > 0) rows.push(row);
        i++;
      }
      tokens.push({ type: "table", headers, rows });
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      const text = line.slice(2).trim();
      tokens.push({ type: "blockquote", text, segments: parseInlineStyles(text) });
      i++;
      continue;
    }

    // Task list or List item
    const taskMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+\[([x ])\]\s+(.*)/);
    if (taskMatch) {
      const level = Math.floor(taskMatch[1].length / 2);
      const checked = taskMatch[3] === "x";
      const text = taskMatch[4].trim();
      tokens.push({
        type: "list_item",
        text,
        segments: parseInlineStyles(text),
        ordered: /^\d+\./.test(taskMatch[2]),
        level,
        checked,
      });
      i++;
      continue;
    }

    const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)/);
    if (listMatch) {
      const level = Math.floor(listMatch[1].length / 2);
      const text = listMatch[3].trim();
      tokens.push({
        type: "list_item",
        text,
        segments: parseInlineStyles(text),
        ordered: /^\d+\./.test(listMatch[2]),
        level,
      });
      i++;
      continue;
    }

    // Paragraph (skip blank lines)
    if (line.trim() !== "") {
      tokens.push({ type: "paragraph", text: line.trim(), segments: parseInlineStyles(line.trim()) });
    }
    i++;
  }

  return tokens;
}

// Load professional fonts (TTF format for jsPDF compatibility)
async function loadFonts() {
  try {
    // Using Roboto from Google Fonts as TTF
    const [regularFont, boldFont] = await Promise.all([
      fetch("https://github.com/google/fonts/raw/main/apache/roboto/static/Roboto-Regular.ttf").then(
        (r) => r.arrayBuffer()
      ),
      fetch("https://github.com/google/fonts/raw/main/apache/roboto/static/Roboto-Bold.ttf").then(
        (r) => r.arrayBuffer()
      ),
    ]);

    const toBase64 = (buffer: ArrayBuffer) =>
      btoa(new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ""));

    return {
      regular: toBase64(regularFont),
      bold: toBase64(boldFont),
    };
  } catch (error) {
    console.warn("Failed to load fonts:", error);
    return null;
  }
}

export async function exportToPdf(markdown: string, filename = "document.pdf") {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  // Use built-in fonts for maximum compatibility
  const useCustomFont = false;

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  let y = margin + 10;
  let pageNumber = 1;

  const colors = {
    primary: [30, 41, 59] as [number, number, number], // slate-800
    secondary: [71, 85, 105] as [number, number, number], // slate-600
    accent: [59, 130, 246] as [number, number, number], // blue-500
    muted: [148, 163, 184] as [number, number, number], // slate-400
    background: [248, 250, 252] as [number, number, number], // slate-50
    border: [226, 232, 240] as [number, number, number], // slate-200
    codeBackground: [30, 41, 59] as [number, number, number], // slate-800
    codeText: [226, 232, 240] as [number, number, number], // slate-200
  };

  function addPageNumber() {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...colors.muted);
    doc.text(`${pageNumber}`, pageWidth / 2, pageHeight - 30, { align: "center" });
    pageNumber++;
  }

  function checkPage(needed: number) {
    if (y + needed > pageHeight - 50) {
      addPageNumber();
      doc.addPage();
      y = margin + 10;
    }
  }

  function setFont(bold = false, italic = false) {
    if (useCustomFont) {
      doc.setFont("Roboto", bold ? "bold" : "normal");
    } else {
      doc.setFont("helvetica", bold ? "bold" : italic ? "italic" : "normal");
    }
  }

  function renderSegments(segments: TextSegment[], x: number, maxWidth: number) {
    let currentX = x;
    const startY = y;
    setFont();
    doc.setFontSize(11);

    for (const segment of segments) {
      if (segment.code) {
        doc.setFont("courier", "normal");
        doc.setFontSize(10);
        const textWidth = doc.getTextWidth(segment.text);
        
        // Check if we need to wrap to next line
        if (currentX + textWidth + 8 > x + maxWidth && currentX > x) {
          y += 16;
          currentX = x;
        }
        
        doc.setFillColor(...colors.background);
        doc.rect(currentX - 2, y - 10, textWidth + 4, 14, "F");
        doc.setTextColor(...colors.accent);
        doc.text(segment.text, currentX, y);
        doc.setTextColor(...colors.primary);
        currentX += textWidth + 4;
        setFont();
        doc.setFontSize(11);
      } else {
        setFont(segment.bold, segment.italic);
        if (segment.link) doc.setTextColor(...colors.accent);
        
        // Split text into words for proper wrapping
        const words = segment.text.split(' ');
        
        for (let i = 0; i < words.length; i++) {
          const word = words[i] + (i < words.length - 1 ? ' ' : '');
          const wordWidth = doc.getTextWidth(word);
          
          // Check if word fits on current line
          if (currentX + wordWidth > x + maxWidth && currentX > x) {
            y += 16;
            currentX = x;
          }
          
          doc.text(word, currentX, y);
          
          if (segment.strikethrough) {
            doc.setDrawColor(...colors.muted);
            doc.line(currentX, y - 4, currentX + wordWidth, y - 4);
          }
          
          if (segment.link) {
            doc.setDrawColor(...colors.accent);
            doc.line(currentX, y + 1, currentX + wordWidth, y + 1);
          }
          
          currentX += wordWidth;
        }
        
        if (segment.link) {
          doc.setTextColor(...colors.primary);
        }
      }
    }
  }

  const tokens = parseMarkdown(markdown);

  for (const token of tokens) {
    switch (token.type) {
      case "heading": {
        const sizes = { 1: 28, 2: 22, 3: 18, 4: 15, 5: 13, 6: 12 };
        const size = sizes[token.depth as keyof typeof sizes] ?? 12;
        const spacing = { 1: 20, 2: 16, 3: 12, 4: 10, 5: 8, 6: 6 };
        
        checkPage(size + 30);
        y += spacing[token.depth as keyof typeof spacing] ?? 8;
        
        setFont(true);
        doc.setFontSize(size);
        doc.setTextColor(...colors.primary);
        
        const lines = doc.splitTextToSize(token.text, contentWidth);
        for (let i = 0; i < lines.length; i++) {
          doc.text(lines[i], margin, y);
          if (i < lines.length - 1) {
            y += size + 2;
          }
        }
        
        if (token.depth <= 2) {
          y += 6; // Small gap between text and line
          doc.setDrawColor(...colors.border);
          doc.setLineWidth(token.depth === 1 ? 2 : 1);
          doc.line(margin, y, pageWidth - margin, y);
          y += token.depth === 1 ? 12 : 10; // More space after H1 underline
        } else {
          y += 4;
        }
        
        y += token.depth === 1 ? 4 : 8; // Less space after H1, normal for others
        break;
      }

      case "paragraph": {
        setFont();
        doc.setFontSize(11);
        doc.setTextColor(...colors.primary);
        
        // Calculate approximate height needed
        const textLength = token.text.length;
        const approxLines = Math.ceil(textLength / 80);
        checkPage(approxLines * 16 + 10);
        
        renderSegments(token.segments, margin, contentWidth);
        y += 18;
        break;
      }

      case "list_item": {
        const indent = margin + token.level * 20;
        setFont();
        doc.setFontSize(11);
        doc.setTextColor(...colors.primary);
        checkPage(20);

        if (token.checked !== undefined) {
          // Task list checkbox
          doc.setDrawColor(...colors.border);
          doc.setLineWidth(1);
          doc.rect(indent, y - 9, 10, 10);
          if (token.checked) {
            // Draw checkmark using lines instead of unicode
            doc.setDrawColor(...colors.accent);
            doc.setLineWidth(2);
            doc.line(indent + 2, y - 3, indent + 4, y - 1);
            doc.line(indent + 4, y - 1, indent + 8, y - 7);
            doc.setTextColor(...colors.primary);
          }
          renderSegments(token.segments, indent + 16, contentWidth - token.level * 20 - 16);
        } else {
          const bullet = token.ordered ? "•" : "•";
          doc.text(bullet, indent, y);
          renderSegments(token.segments, indent + 12, contentWidth - token.level * 20 - 12);
        }
        
        y += 18;
        break;
      }

      case "blockquote": {
        setFont(false, true);
        doc.setFontSize(11);
        doc.setTextColor(...colors.secondary);
        
        // Calculate height needed
        const tempY = y;
        y += 4;
        renderSegments(token.segments, margin + 16, contentWidth - 32);
        const quoteHeight = y - tempY + 12;
        y = tempY;
        
        checkPage(quoteHeight);
        
        // Background and border
        doc.setFillColor(...colors.background);
        doc.rect(margin, y - 8, contentWidth, quoteHeight, "F");
        doc.setDrawColor(...colors.accent);
        doc.setLineWidth(4);
        doc.line(margin, y - 8, margin, y - 8 + quoteHeight);
        
        y += 4;
        renderSegments(token.segments, margin + 16, contentWidth - 32);
        y += 12;
        doc.setTextColor(...colors.primary);
        break;
      }

      case "code": {
        doc.setFont("courier", "normal");
        doc.setFontSize(9);
        
        const lines = token.text.split("\n");
        const blockHeight = lines.length * 13 + (token.language ? 34 : 20);
        checkPage(blockHeight);
        
        // Dark background with rounded corners
        doc.setFillColor(...colors.codeBackground);
        doc.roundedRect(margin, y - 10, contentWidth, blockHeight, 4, 4, "F");
        
        // Language label
        if (token.language) {
          doc.setFontSize(8);
          doc.setTextColor(...colors.muted);
          doc.text(token.language.toUpperCase(), margin + 10, y + 2);
          y += 18;
        } else {
          y += 4;
        }
        
        // Code content
        doc.setFontSize(9);
        doc.setTextColor(...colors.codeText);
        for (const line of lines) {
          doc.text(line || " ", margin + 10, y);
          y += 13;
        }
        
        y += 12;
        doc.setTextColor(...colors.primary);
        break;
      }

      case "table": {
        const colWidth = contentWidth / token.headers.length;
        const rowHeight = 28;
        const tableHeight = (token.rows.length + 1) * rowHeight;
        
        checkPage(tableHeight + 10);
        
        // Header row
        doc.setFillColor(...colors.primary);
        doc.rect(margin, y, contentWidth, rowHeight, "F");
        setFont(true);
        doc.setFontSize(10);
        doc.setTextColor(255, 255, 255);
        
        token.headers.forEach((header, i) => {
          const cellText = doc.splitTextToSize(header, colWidth - 20);
          doc.text(cellText[0] || "", margin + i * colWidth + 10, y + 18);
        });
        
        y += rowHeight;
        
        // Data rows
        setFont();
        doc.setFontSize(10);
        doc.setTextColor(...colors.primary);
        
        token.rows.forEach((row, rowIndex) => {
          // Alternating row colors
          if (rowIndex % 2 === 0) {
            doc.setFillColor(...colors.background);
            doc.rect(margin, y, contentWidth, rowHeight, "F");
          }
          
          // Cell borders
          doc.setDrawColor(...colors.border);
          doc.setLineWidth(0.5);
          for (let i = 0; i <= token.headers.length; i++) {
            doc.line(margin + i * colWidth, y, margin + i * colWidth, y + rowHeight);
          }
          
          // Cell content with proper wrapping
          row.forEach((cell, i) => {
            const cellText = doc.splitTextToSize(cell, colWidth - 20);
            doc.text(cellText[0] || "", margin + i * colWidth + 10, y + 18);
          });
          
          y += rowHeight;
        });
        
        // Bottom border
        doc.setDrawColor(...colors.border);
        doc.line(margin, y, pageWidth - margin, y);
        
        y += 16;
        break;
      }

      case "hr": {
        checkPage(24);
        y += 4;
        doc.setDrawColor(...colors.border);
        doc.setLineWidth(1);
        const hrWidth = contentWidth * 0.6;
        const hrStart = margin + (contentWidth - hrWidth) / 2;
        doc.line(hrStart, y, hrStart + hrWidth, y);
        y += 20;
        break;
      }
    }
  }

  // Add page number to last page
  addPageNumber();

  doc.save(filename);
}
