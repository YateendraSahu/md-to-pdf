"use client";

import React from 'react';
import { 
  Document, Page, Text, View, StyleSheet, 
  Image, pdf, Link 
} from '@react-pdf/renderer';
import { marked } from 'marked';
import emojiRegex from 'emoji-regex';

// 1. STYLES (Using only Standard PDF fonts for absolute stability)
const styles = StyleSheet.create({
  page: { padding: 35, backgroundColor: '#ffffff', fontFamily: 'Helvetica' },
  h1: { fontSize: 22, fontWeight: 'bold', color: '#1a1d35', marginBottom: 18, marginTop: 10, lineHeight: 1.2 },
  h2: { fontSize: 16, fontWeight: 'bold', color: '#1a1d35', marginBottom: 14, marginTop: 8, lineHeight: 1.2 },
  h3: { fontSize: 13, fontWeight: 'bold', color: '#1a1d35', marginBottom: 10, marginTop: 6, lineHeight: 1.2 },
  p: { fontSize: 11.5, color: '#2c313a', marginBottom: 12, lineHeight: 1.55 },
  strong: { fontWeight: 'bold' },
  em: { fontStyle: 'italic' },
  link: { color: '#0066cc', textDecoration: 'underline' },
  code: { 
    fontSize: 9, fontFamily: 'Courier', 
    backgroundColor: '#1a1b26', color: '#a9b1d6', 
    padding: 1, borderRadius: 3 
  },
  codespan: {
    fontSize: 9.5, backgroundColor: '#f0f2f5', color: '#315bc1', 
    padding: '1 3', borderRadius: 2, fontFamily: 'Courier'
  },
  hr: { borderBottomWidth: 1, borderBottomColor: '#e1e4e8', marginVertical: 20 },
  blockquote: {
    borderLeftWidth: 3, borderLeftColor: '#2b58d9', 
    paddingLeft: 14, marginVertical: 12, color: '#4a5568'
  },
  list: { marginLeft: 12, marginBottom: 12 },
  listItem: { flexDirection: 'row', marginBottom: 6 },
  bullet: { width: 15, fontSize: 10, color: '#718096' },
  listContent: { flex: 1 },
  codeBlock: {
    backgroundColor: '#1a1b26', borderRadius: 8, 
    marginVertical: 15, overflow: 'hidden'
  },
  codeHeader: {
    flexDirection: 'row', alignItems: 'center', 
    backgroundColor: '#16161e', padding: '8 12'
  },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  langTag: { marginLeft: 'auto', fontSize: 7, color: '#565f89', fontWeight: 'bold' },
  codeText: { padding: 12, fontSize: 8.5, color: '#cfc9c2', fontFamily: 'Courier', lineHeight: 1.4 },
  table: { marginVertical: 15 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#eef0f2', minHeight: 25, alignItems: 'center' },
  tableHeader: { backgroundColor: '#f8fafc', borderBottomWidth: 1.5, borderBottomColor: '#e2e8f0' },
  tableCell: { flex: 1, padding: '6 10', fontSize: 10, color: '#2d3748' },
  tableCellHeader: { fontWeight: 'bold', color: '#1e293b' },
  emoji: { width: 11, height: 11, marginHorizontal: 1 },
  footer: { 
    position: 'absolute', bottom: 20, left: 0, right: 0, 
    textAlign: 'center', fontSize: 8, color: '#94a3b8', fontFamily: 'Helvetica'
  }
});

// 2. ASSET RESOLVER
async function resolveAssets(tokens: any[]) {
  const emojiCache = new Map();
  const regex = emojiRegex();

  const getEmojiUrl = async (emoji: string) => {
    if (emojiCache.has(emoji)) return emojiCache.get(emoji);
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.font = '48px sans-serif';
      ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
      ctx.fillText(emoji, 32, 32);
      const dataUrl = canvas.toDataURL('image/png');
      emojiCache.set(emoji, dataUrl);
      return dataUrl;
    }
    return null;
  };

  const walk = async (ts: any[]) => {
    for (const t of ts) {
      if (t.type === 'text') {
        const emojis = t.text.match(regex) || [];
        t.emojiUrls = await Promise.all(emojis.map((e: string) => getEmojiUrl(e)));
      }
      if (t.tokens) await walk(t.tokens);
      if (t.items) for (const it of t.items) if (it.tokens) await walk(it.tokens);
      if (t.rows) for (const r of t.rows) for (const cell of r) if (cell.tokens) await walk(cell.tokens);
      if (t.header) for (const h of t.header) if (h.tokens) await walk(h.tokens);
    }
  };

  await walk(tokens);
}

// 3. TRANSFORM COMPONENTS
const MarkdownText = ({ tokens }: { tokens: any[] }) => {
  return (
    <>
      {tokens.map((t: any, i) => {
        if (t.type === 'strong') return <Text key={i} style={styles.strong}><MarkdownText tokens={t.tokens || []} /></Text>;
        if (t.type === 'em') return <Text key={i} style={styles.em}><MarkdownText tokens={t.tokens || []} /></Text>;
        if (t.type === 'link') return <Link key={i} src={t.href} style={styles.link}><MarkdownText tokens={t.tokens || []} /></Link>;
        if (t.type === 'codespan') return <Text key={i} style={styles.codespan}>{t.text}</Text>;
        if (t.type === 'text' || t.type === 'escape') {
          if (t.tokens && t.tokens.length > 0) return <MarkdownText key={i} tokens={t.tokens} />;
          const regex = emojiRegex();
          const parts = t.text.split(regex);
          const urls = t.emojiUrls || [];
          return (
            <React.Fragment key={i}>
              {parts.map((p: string, pi: number) => (
                <React.Fragment key={pi}>
                  <Text>{p}</Text>
                  {urls[pi] && <Image src={urls[pi]} style={styles.emoji} />}
                </React.Fragment>
              ))}
            </React.Fragment>
          );
        }
        return null;
      })}
    </>
  );
};

const MarkdownDoc = ({ tokens }: { tokens: any[] }) => (
  <Document title="Exported Document">
    <Page size="A4" style={styles.page}>
      {tokens.map((t: any, i) => {
        switch (t.type) {
          case 'heading': {
            const hStyle = t.depth === 1 ? styles.h1 : t.depth === 2 ? styles.h2 : styles.h3;
            return <Text key={i} style={hStyle}><MarkdownText tokens={t.tokens || []} /></Text>;
          }
          case 'paragraph': return <View key={i}><Text style={styles.p}><MarkdownText tokens={t.tokens || []} /></Text></View>;
          case 'blockquote': return (
            <View key={i} style={styles.blockquote}>
              {t.tokens?.map((bt: any, j: number) => {
                if (bt.type === 'paragraph') return <Text key={j} style={styles.p}><MarkdownText tokens={bt.tokens || []} /></Text>;
                return null;
              })}
            </View>
          );
          case 'list': return (
            <View key={i} style={styles.list}>
              {t.items.map((item: any, idx: number) => (
                <View key={idx} style={styles.listItem}>
                  <Text style={styles.bullet}>{t.ordered ? `${idx + 1}.` : '•'}</Text>
                  <View style={styles.listContent}>
                    <Text style={styles.p}><MarkdownText tokens={item.tokens || []} /></Text>
                  </View>
                </View>
              ))}
            </View>
          );
          case 'code': return (
            <View key={i} style={styles.codeBlock} wrap={false}>
              <View style={styles.codeHeader}>
                <View style={[styles.dot, { backgroundColor: '#ff5f56' }]} />
                <View style={[styles.dot, { backgroundColor: '#ffbd2e' }]} />
                <View style={[styles.dot, { backgroundColor: '#27c93f' }]} />
                {t.lang && <Text style={styles.langTag}>{t.lang.toUpperCase()}</Text>}
              </View>
              <Text style={styles.codeText}>{t.text}</Text>
            </View>
          );
          case 'table': return (
            <View key={i} style={styles.table}>
              <View style={[styles.tableRow, styles.tableHeader]}>
                {t.header?.map((h: any, hi: number) => (
                  <Text key={hi} style={[styles.tableCell, styles.tableCellHeader]}>{h.text}</Text>
                ))}
              </View>
              {t.rows?.map((row: any, ri: number) => (
                <View key={ri} style={[styles.tableRow, ri % 2 === 1 ? { backgroundColor: '#fafbfd' } : {}]}>
                  {row.map((c: any, ci: number) => (
                    <View key={ci} style={styles.tableCell}>
                      <Text><MarkdownText tokens={c.tokens || []} /></Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          );
          case 'hr': return <View key={i} style={styles.hr} />;
          case 'image': return <Image key={i} src={t.href} style={{ width: '100%', marginBottom: 15 }} />;
          default: return null;
        }
      })}
      <Text style={styles.footer} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} fixed />
    </Page>
  </Document>
);

// 4. EXPORT FUNCTION
export async function exportToPdf(markdown: string, filename = "document.pdf") {
  const tokens = marked.lexer(markdown);
  await resolveAssets(tokens);
  
  const blob = await pdf(<MarkdownDoc tokens={tokens} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); 
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
