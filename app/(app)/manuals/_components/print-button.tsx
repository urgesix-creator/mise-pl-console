'use client';

import { Printer } from 'lucide-react';

/**
 * ブラウザの印刷ダイアログを開く（「PDFに保存」を選べば PDF 出力になる）。
 * Mac/iPhone/Android いずれも標準機能で PDF 保存が可能。
 */
export function PrintButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={
        'inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white px-3.5 py-2 text-sm font-semibold hover:bg-brand-700 transition-colors ' +
        (className ?? '')
      }
    >
      <Printer className="w-4 h-4" />
      PDFで保存 / 印刷
    </button>
  );
}
