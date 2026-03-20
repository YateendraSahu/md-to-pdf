"use client";

import { useState, useEffect } from "react";
import { marked } from "marked";

const SAMPLE = `# Professional Document Export

This is a **Premium** Markdown to PDF converter.

## ✨ Features
- **Instant Preview**: Toggle between Edit and Preview modes.
- **One-Click Clear**: Start over with a clean slate.
- **High Fidelity**: What you see is accurately reflected in the PDF.

| Status | Feature |
|---|---|
| ✅ | Bold/Italic |
| 🚀 | Fast Export |
| 🧠 | Smart Spacing |

> "This is explicitly not HTML-based, you construct PDFs directly." - (Internal Documentation)
`;

export default function MarkdownEditor() {
  const [markdown, setMarkdown] = useState(SAMPLE);
  const [filename, setFilename] = useState("document");
  const [exporting, setExporting] = useState(false);
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [previewHtml, setPreviewHtml] = useState("");

  useEffect(() => {
    const render = async () => {
      const html = await marked.parse(markdown);
      setPreviewHtml(html);
    };
    render();
  }, [markdown]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const { exportToPdf } = await import("./PdfExporter");
      await exportToPdf(markdown, `${filename || "document"}.pdf`);
    } finally {
      setExporting(false);
    }
  };

  const handleClear = () => {
    if (confirm("Are you sure you want to clear all content?")) {
      setMarkdown("");
    }
  };

  return (
    <main className="min-h-screen bg-[#f8fafc] p-4 md:p-8 font-sans selection:bg-blue-100">
      <style jsx global>{`
        .pdf-preview {
          font-family: 'Inter', sans-serif;
          line-height: 1.5;
          color: #1a1a1a;
        }
        .pdf-preview h1 { color: #1e3a8a; font-weight: 800; font-size: 2rem; margin-top: 1.5rem; margin-bottom: 1rem; }
        .pdf-preview h2 { color: #1e3a8a; font-weight: 800; font-size: 1.5rem; margin-top: 1.5rem; margin-bottom: 0.75rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem; }
        .pdf-preview h3 { color: #1e3a8a; font-weight: 700; font-size: 1.25rem; margin-top: 1.25rem; margin-bottom: 0.5rem; }
        .pdf-preview p { margin-bottom: 1rem; }
        .pdf-preview ul { margin-bottom: 1rem; padding-left: 1.5rem; list-style-type: disc; }
        .pdf-preview li { margin-bottom: 0.25rem; }
        .pdf-preview blockquote { border-left: 4px solid #1e3a8a; padding-left: 1rem; font-style: italic; color: #475569; margin: 1.5rem 0; background: #f1f5f9; padding: 1rem; border-radius: 0 0.5rem 0.5rem 0; }
        .pdf-preview table { width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; border-radius: 0.5rem; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .pdf-preview th { background: #f8fafc; color: #1e3a8a; text-align: left; padding: 0.75rem 1rem; font-weight: 700; border-bottom: 2px solid #e2e8f0; }
        .pdf-preview td { padding: 0.75rem 1rem; border-bottom: 1px solid #f1f5f9; }
        .pdf-preview tr:nth-child(even) { background: #fcfcfd; }
        .pdf-preview code { background: #f1f5f9; padding: 0.2rem 0.4rem; border-radius: 0.25rem; font-family: monospace; font-size: 0.9em; color: #1e3a8a; }
        .pdf-preview pre { background: #0f172a; color: #f8fafc; padding: 1.5rem; border-radius: 0.75rem; overflow-x: auto; margin-bottom: 1.5rem; }
        .pdf-preview pre code { background: transparent; color: inherit; padding: 0; }
        .pdf-preview img { max-width: 100%; border-radius: 0.5rem; margin: 1.5rem 0; }
        .pdf-preview hr { border: 0; border-top: 1px solid #e2e8f0; margin: 2rem 0; }
      `}</style>

      <div className="max-w-5xl mx-auto">
        <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-[#0f172a]">
              MD<span className="text-blue-600">.</span>PDF
            </h1>
            {/* <p className="text-slate-500 mt-1 font-medium italic">Premium Document Exporter</p> */}
          </div>

          <div className="flex gap-2 bg-white p-1 rounded-xl shadow-sm border border-slate-200">
            <button
              onClick={() => setView("edit")}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${view === "edit" ? "bg-slate-900 text-white shadow-md" : "text-slate-500 hover:text-slate-900"
                }`}
            >
              Edit
            </button>
            <button
              onClick={() => setView("preview")}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${view === "preview" ? "bg-slate-900 text-white shadow-md" : "text-slate-500 hover:text-slate-900"
                }`}
            >
              Preview
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6">
          <div className="relative group">
            {view === "edit" ? (
              <textarea
                className="w-full h-[600px] p-6 font-mono text-sm leading-relaxed text-slate-800 border-2 border-slate-200 rounded-2xl bg-white shadow-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none resize-none"
                value={markdown}
                onChange={(e) => setMarkdown(e.target.value)}
                placeholder="Start typing your content..."
              />
            ) : (
              <div
                className="w-full h-[600px] p-8 overflow-y-auto border-2 border-slate-200 rounded-2xl bg-white shadow-sm pdf-preview"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            )}

            <button
              onClick={handleClear}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
              title="Clear all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6" />
              </svg>
            </button>
          </div>

          <footer className="flex flex-col md:flex-row items-center justify-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 group">
              <div className="flex items-center px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10 transition-all">
                <input
                  type="text"
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  className="bg-transparent text-sm font-bold text-slate-700 outline-none w-48"
                  placeholder="filename"
                />
                <span className="text-slate-400 font-bold ml-1">.pdf</span>
              </div>
            </div>

            <button
              onClick={handleExport}
              disabled={exporting || !markdown}
              className="w-full md:w-auto group relative flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold px-8 py-3 rounded-xl shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all active:scale-95 disabled:scale-100 disabled:shadow-none overflow-hidden"
            >
              {exporting ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                  </svg>
                  <span>Export to PDF</span>
                </>
              )}
            </button>
          </footer>
        </div>
      </div>
    </main>
  );
}
