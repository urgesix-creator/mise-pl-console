import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight, AlertTriangle, Info } from 'lucide-react';
import { PrintButton } from './print-button';

// ====================================================================
// マニュアル本文のデータモデル＆レンダラ（設定／運用マニュアル共用）
//   - ページ側は SECTIONS（データ）を書くだけ。番号付け・目次・印刷は共通化。
// ====================================================================

export type Block =
  | { k: 'p'; text: ReactNode }
  | { k: 'ul'; items: ReactNode[] }
  | { k: 'ol'; items: ReactNode[] }
  | { k: 'steps'; items: ReactNode[] }
  | { k: 'note'; tone?: 'info' | 'warn'; title?: string; text: ReactNode }
  | { k: 'sub'; text: string }
  | { k: 'table'; head: string[]; rows: ReactNode[][] };

export type Section = { id: string; title: string; blocks: Block[] };

function BlockView({ block }: { block: Block }) {
  switch (block.k) {
    case 'p':
      return <p className="text-[13.5px] leading-relaxed text-slate-700">{block.text}</p>;
    case 'sub':
      return <h3 className="font-display text-[15px] font-bold text-slate-900 mt-5 mb-1">{block.text}</h3>;
    case 'ul':
      return (
        <ul className="list-disc pl-5 space-y-1 text-[13.5px] leading-relaxed text-slate-700 marker:text-slate-400">
          {block.items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      );
    case 'ol':
      return (
        <ol className="list-decimal pl-5 space-y-1 text-[13.5px] leading-relaxed text-slate-700 marker:text-slate-400">
          {block.items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ol>
      );
    case 'steps':
      return (
        <ol className="space-y-2">
          {block.items.map((it, i) => (
            <li key={i} className="flex gap-3 text-[13.5px] leading-relaxed text-slate-700">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-600 text-white text-[12px] font-bold font-num inline-flex items-center justify-center">
                {i + 1}
              </span>
              <span className="pt-0.5">{it}</span>
            </li>
          ))}
        </ol>
      );
    case 'note': {
      const warn = block.tone === 'warn';
      const Icon = warn ? AlertTriangle : Info;
      return (
        <div
          className={
            'manual-section rounded-xl border px-4 py-3 flex gap-2.5 text-[13px] leading-relaxed ' +
            (warn
              ? 'border-amber-200 bg-amber-50 text-amber-900'
              : 'border-sky-200 bg-sky-50 text-sky-900')
          }
        >
          <Icon className={'w-4 h-4 flex-shrink-0 mt-0.5 ' + (warn ? 'text-amber-600' : 'text-sky-600')} />
          <div>
            {block.title && <div className="font-bold mb-0.5">{block.title}</div>}
            <div>{block.text}</div>
          </div>
        </div>
      );
    }
    case 'table':
      return (
        <div className="manual-section overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-[12.5px] border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {block.head.map((h, i) => (
                  <th key={i} className="text-left font-semibold text-slate-600 px-3 py-2 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {block.rows.map((row, ri) => (
                <tr key={ri} className="align-top">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 text-slate-700">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

export function ManualDoc({
  kicker,
  title,
  intro,
  updated,
  sections,
}: {
  kicker: string;
  title: string;
  intro: string;
  updated: string;
  sections: Section[];
}) {
  return (
    <div className="manual-doc px-5 sm:px-8 py-8 sm:py-10 max-w-3xl mx-auto">
      {/* パンくず（印刷では非表示） */}
      <nav className="print:hidden flex items-center gap-1.5 text-xs text-slate-500 mb-4" aria-label="パンくず">
        <Link href="/dashboard" className="hover:text-slate-900 transition-colors">
          ホーム
        </Link>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <span className="text-slate-500">マニュアル</span>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <span className="text-slate-900 font-medium">{title}</span>
      </nav>

      {/* ヘッダー */}
      <header className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[11px] tracking-[0.2em] uppercase text-slate-500 font-semibold mb-2">{kicker}</div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 leading-tight">{title}</h1>
          </div>
          <PrintButton className="print:hidden flex-shrink-0" />
        </div>
        <p className="text-sm text-slate-600 mt-3 leading-relaxed">{intro}</p>
        <div className="mt-3 text-[11px] text-slate-400 font-num">
          KOGA Holdings · Sales Console ／ 最終更新 {updated}
        </div>
      </header>

      {/* 目次 */}
      <nav className="manual-section mb-8 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">目次</div>
        <ol className="space-y-1">
          {sections.map((s, i) => (
            <li key={s.id} className="text-[13px]">
              <a href={`#${s.id}`} className="text-slate-700 hover:text-slate-900">
                <span className="font-num font-semibold text-slate-500 mr-2">{i + 1}.</span>
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {/* 本文 */}
      <div className="space-y-9">
        {sections.map((s, i) => (
          <section key={s.id} id={s.id} className="manual-section scroll-mt-20">
            <h2 className="font-display text-xl font-bold text-slate-900 mb-3 pb-2 border-b border-slate-200 flex items-baseline gap-2.5">
              <span className="font-num text-slate-400 text-base">{i + 1}</span>
              {s.title}
            </h2>
            <div className="space-y-3">
              {s.blocks.map((b, bi) => (
                <BlockView key={bi} block={b} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <footer className="mt-12 pt-5 border-t border-slate-200 text-[11px] text-slate-400 leading-relaxed">
        本マニュアルは Sales Console の現行仕様に基づきます。仕様変更時は内容が更新されます。
        記載と実画面が食い違う場合は、実画面の動作と社内の最新指示を優先してください。
        <br />© KOGA Holdings — 海外飲食店 売上管理システム（Sales Console）
      </footer>
    </div>
  );
}
