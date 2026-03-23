"use client";

import { useState, useEffect, useRef } from "react";
import { marked } from "marked";
import TurndownService from "turndown";
// @ts-ignore
import { gfm } from "turndown-plugin-gfm";

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced'
});
turndownService.use(gfm);

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
  const [isPreviewFocused, setIsPreviewFocused] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const handlePreviewInput = (e: React.FormEvent<HTMLDivElement>) => {
    try {
      const newMarkdown = turndownService.turndown(e.currentTarget.innerHTML);
      // Update markdown state immediately for real-time sync with the editor
      if (newMarkdown !== markdown) {
        setMarkdown(newMarkdown);
      }
    } catch (err) {
      console.error("Failed to convert HTML to Markdown", err);
    }
  };

  useEffect(() => {
    const render = async () => {
      // Only re-render the HTML if the preview pane is NOT currently focused.
      // This prevents the cursor from jumping while typing in the preview pane.
      if (!isPreviewFocused && previewRef.current) {
        const html = await marked.parse(markdown);
        if (previewRef.current.innerHTML !== html) {
          previewRef.current.innerHTML = html;
        }
      }
    };
    render();
  }, [markdown, isPreviewFocused]);

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
    setIsClearModalOpen(true);
  };

  return (
    <main className="h-screen bg-[#f8fafc] p-2 md:p-4 font-sans selection:bg-blue-100 flex flex-col overflow-hidden">
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

      <div className="max-w-[100%] md:max-w-[98%] mx-auto w-full flex flex-col flex-1 min-h-0 relative">
        <header className="mb-2 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-black tracking-tight text-[#0f172a]">
              MD<span className="text-blue-600">to</span>PDF
            </h1>
          </div>

          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 md:gap-3">
            <div className="flex items-center px-3 py-2 bg-white border border-slate-200 rounded-xl focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10 transition-all shadow-sm">
              <input
                type="text"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                className="bg-transparent text-sm font-bold text-slate-700 outline-none w-full md:w-40"
                placeholder="filename"
              />
              <span className="text-slate-400 font-bold ml-1">.pdf</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex lg:hidden flex-1 gap-1 bg-white p-1 rounded-xl shadow-sm border border-slate-200">
                <button
                  onClick={() => setView("edit")}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${view === "edit" ? "bg-slate-900 text-white shadow-md" : "text-slate-500 hover:text-slate-900"
                    }`}
                >
                  Edit
                </button>
                <button
                  onClick={() => setView("preview")}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${view === "preview" ? "bg-slate-900 text-white shadow-md" : "text-slate-500 hover:text-slate-900"
                    }`}
                >
                  View
                </button>
              </div>

              <button
                onClick={handleExport}
                disabled={exporting || !markdown}
                className="flex items-center justify-center shrink-0 gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold px-4 py-2 rounded-xl shadow-sm hover:shadow transition-all active:scale-95 disabled:scale-100 disabled:shadow-none"
              >
                {exporting ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Exporting</span>
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                    </svg>
                    <span className="hidden sm:inline">Export PDF</span>
                    <span className="inline sm:hidden">Export</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8 flex-1 min-h-0 pb-2 md:pb-2">
          <div className={`relative group h-full ${view === "preview" ? "hidden lg:block" : "block"}`}>
            <textarea
              className="w-full h-full p-4 md:p-6 font-mono text-sm leading-relaxed text-slate-800 border-2 border-slate-200 rounded-2xl bg-white shadow-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none resize-none"
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              placeholder="Start typing your content..."
            />
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

          <div
            ref={previewRef}
            className={`w-full h-full p-6 md:p-8 overflow-y-auto border-2 border-slate-200 rounded-2xl bg-white shadow-sm pdf-preview outline-none ${view === "edit" ? "hidden lg:block" : "block"}`}
            contentEditable={true}
            suppressContentEditableWarning={true}
            onFocus={() => setIsPreviewFocused(true)}
            onBlur={() => setIsPreviewFocused(false)}
            onInput={handlePreviewInput}
          />
        </div>

      </div>

      {isClearModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setIsClearModalOpen(false)}
          ></div>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6">
              <h3 className="text-xl font-bold text-slate-900 mb-2">Clear Document</h3>
              <p className="text-slate-500 text-sm">
                Are you sure you want to clear all content? This action cannot be undone.
              </p>
            </div>
            <div className="flex bg-slate-50 p-4 gap-3 justify-end rounded-b-2xl border-t border-slate-100">
              <button
                onClick={() => setIsClearModalOpen(false)}
                className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setMarkdown("");
                  setIsClearModalOpen(false);
                }}
                className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 shadow-sm shadow-red-500/20 transition-all active:scale-95"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
