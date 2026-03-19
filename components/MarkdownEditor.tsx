"use client";

import { useState } from "react";

const SAMPLE = `# Professional Markdown to PDF Converter

Convert your markdown documents into **beautiful**, *professional* PDFs with full formatting support.

## Key Features

- **Bold** and *italic* text styling
- ~~Strikethrough~~ text
- \`inline code\` with syntax highlighting
- [Clickable links](https://example.com)
- Task lists with checkboxes
- Tables with alternating row colors
- Nested lists and more!

## Task List Example

- [x] Support all markdown elements
- [x] Add professional styling
- [ ] Deploy to production
- [ ] Add custom themes

## Code Block with Syntax

\`\`\`javascript
function calculateTotal(items) {
  return items.reduce((sum, item) => {
    return sum + item.price * item.quantity;
  }, 0);
}
\`\`\`

## Table Example

| Feature | Status | Priority |
|---------|--------|----------|
| Bold/Italic | Done | High |
| Tables | Done | High |
| Links | Done | Medium |
| Code Blocks | Done | Low |

> **Pro Tip:** This blockquote demonstrates how quoted text appears with a beautiful accent border and background.

---

## Nested Lists

1. First level item
   - Nested bullet point
   - Another nested item
2. Second level item
   - More nesting
     - Even deeper nesting

### Typography & Spacing

The PDF uses **Helvetica font** for a clean, professional look with carefully tuned spacing, colors, and layout. Headings have proper hierarchy, code blocks use dark themes, and tables are clean and readable.

**Premium Design** • **Fast Export** • **100% Client-Side**
`;

export default function MarkdownEditor() {
  const [markdown, setMarkdown] = useState(SAMPLE);
  const [filename, setFilename] = useState("document");
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const { exportToPdf } = await import("./PdfExporter");
      await exportToPdf(markdown, `${filename || "document"}.pdf`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2 text-gray-800">MD → PDF</h1>
        <p className="text-gray-500 mb-6 text-sm">Paste your markdown, export to PDF via jsPDF — no canvas, no screenshots.</p>

        <div className="grid grid-cols-1 gap-4">
          <textarea
            className="w-full h-96 p-4 font-mono text-black text-sm border border-gray-300 rounded-lg bg-white resize-y focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            placeholder="Paste your markdown here..."
            aria-label="Markdown input"
          />

          <div className="flex items-center gap-3">
            <input
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              className="border border-gray-300 rounded-lg text-black px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="filename"
              aria-label="Output filename"
            />
            <span className="text-gray-400 text-sm">.pdf</span>

            <button
              onClick={handleExport}
              disabled={exporting}
              className="ml-auto bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exporting ? "Exporting..." : "Export PDF"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
