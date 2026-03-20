"use client";

import { useState } from "react";

const SAMPLE = `Yes — what you’re looking for is **programmatic PDF generation (not screenshot / not HTML rendering)**. There are several libraries that generate **true text-based PDFs** (vector text, selectable, searchable).

Here are the best ones depending on your stack:

---

# Node.js / JavaScript

### 1. **PDFKit**

* Pure programmatic PDF generation (no HTML, no screenshots)
* You manually write text, layout, fonts

\`\`\`js
const PDFDocument = require('pdfkit');
const doc = new PDFDocument();

doc.text('Hello world');
doc.end();
\`\`\`

 Pros:

* Lightweight
* Full control over layout
* True text (selectable/searchable)

 Cons:

* You must handle layout manually

 It’s explicitly **not HTML-based**, you construct PDFs directly ([Medium][1])

---

### 2. **PDF-lib**

* Pure JS (no native deps)
* Works in Node + browser

 Pros:

* Modify + create PDFs
* No external engine

 Cons:

* Low-level API

 Works directly with PDF structure (not rendering HTML) ([PDFBolt][2])

---

### 3. **jsPDF**

* Mostly frontend
* Can write text directly

 Good for:

* Simple client-side PDFs

 Not ideal for:

* Complex layouts / backend

---

# Java

### 4. **Apache PDFBox**

* Mature, pure Java library
* Full control over text, fonts, layout

 Can create, edit, and extract PDFs programmatically ([Wikipedia][3])

---

### 5. **iText**

* Very powerful (enterprise-level)
* Supports forms, encryption, signatures

 Widely used for generating PDFs programmatically ([Wikipedia][4])

---

### 6. **OpenPDF**

* Open-source alternative to iText
* Similar API

 Fork created due to licensing changes ([Wikipedia][5])

---

# PHP

### 7. **TCPDF**

* Pure PHP PDF generation
* Strong Unicode support

 Widely used in CMS systems ([Wikipedia][6])

---

# C / C++

### 8. **libHaru**

* Lightweight C/C++ library
* Generates PDFs with text, fonts, images

 Designed specifically for creating PDFs (not editing) ([Wikipedia][7])

---

# Key distinction (important)

| Approach           | Example        | Output            |
| ------------------ | -------------- | ----------------- |
| Screenshot-based | Puppeteer      | Image-like PDF    |
| HTML rendering   | wkhtmltopdf    | HTML → PDF        |
| Programmatic     | PDFKit, PDFBox | **Pure text PDF** |

---

# Recommendation (based on your background)

Since you’re a **Next.js / Angular dev**:

 Best choice:

* **PDFKit** → if you want backend generation
* **PDF-lib** → if you want browser + backend flexibility

---

# Simple rule

If you want:

* **Selectable text → use these libraries **
* **Pixel-perfect UI copy → use Puppeteer **

---

If you tell me your exact use case (invoice, report, table-heavy, multilingual, etc.), I can suggest the *best library + structure* for your project.

[1]: https://medium.com/%40froala.insights/generate-pdf-from-html-content-in-node-js-applications-f31f0e036ffe?utm_source=chatgpt.com "Generate PDF from HTML Content in Node.js Applications | by Froala | Mar, 2026 | Medium"
[2]: https://pdfbolt.com/blog/generate-pdf-pdf-lib-nodejs?utm_source=chatgpt.com "Generate PDF Using PDF-lib in Node.js | PDFBolt"
[3]: https://en.wikipedia.org/wiki/Apache_PDFBox?utm_source=chatgpt.com "Apache PDFBox"
[4]: https://es.wikipedia.org/wiki/IText?utm_source=chatgpt.com "IText"
[5]: https://en.wikipedia.org/wiki/OpenPDF?utm_source=chatgpt.com "OpenPDF"
[6]: https://en.wikipedia.org/wiki/TCPDF?utm_source=chatgpt.com "TCPDF"
[7]: https://en.wikipedia.org/wiki/LibHaru?utm_source=chatgpt.com "LibHaru"
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
            onChange={(e) => {
              const val = e.target.value;
              // Emojis still need a specialized font, but we now allow arrows and all standard Unicode symbols
              const cleaned = val.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E6}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F3FB}-\u{1F3FF}\u{200D}\u{FE0F}]/gu, '');
              setMarkdown(cleaned);
            }}
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
