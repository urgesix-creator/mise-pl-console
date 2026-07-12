'use client';

// ====================================================================
// 日次売上（統合）インポート プレビュー UI（サブステップ2）
//
//   - ドライランAction dryRunIntegratedImport（書き込まない）を呼び、ImportPreview を表示する。
//   - 【厳守】この段階はプレビュー表示まで。実書き込みはしない（「取込実行」は無効・次サブステップ）。
//   - 既存のエクスポート/部門別パネルには一切触れない。
// ====================================================================

import { useState } from 'react';
import type { Store, Role } from './types';
import { dryRunIntegratedImport, commitIntegratedImport } from '../_lib/integrated-import-actions';
import type {
  ImportPreview,
  ImportPreviewRow,
  DiffValue,
  CommitReport,
} from '../_lib/integrated-import-types';

// インポート可能ロール（staff は不可＝セクション自体を非表示）
const IMPORT_ROLES: Role[] = ['executive', 'country_rep', 'accounting', 'store_manager'];

type Props = {
  stores: Store[];
  selectedStoreId: string | null;
  userRole: Role;
};

/** 差分・再計算の項目名（日本語表示） */
const FIELD_LABEL: Record<string, string> = {
  net_sales: '税抜売上',
  gross_sales: '税込売上',
  customer_count: '客数',
  weather: '天気',
  event_note: '備考',
  service_fee: 'サービス料',
  tax_amount: '税額',
  avg_per_customer: '客単価',
};

/** 差分値の表示（数値はカンマ区切り、null は「—」、空文字は「（空）」） */
function fmt(v: DiffValue): string {
  if (v === null) return '—';
  if (typeof v === 'number') return v.toLocaleString('ja-JP');
  if (v === '') return '（空）';
  return v;
}

export function IntegratedImportPanel({ stores, selectedStoreId, userRole }: Props) {
  const canImport = IMPORT_ROLES.includes(userRole);
  const [storeId, setStoreId] = useState<string>(selectedStoreId ?? stores[0]?.id ?? '');
  const [fileName, setFileName] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  // 取込先店舗のサービス料モード（true=込み）。プレビューでどちらで解釈するか明示するため
  const [serviceFeeIncluded, setServiceFeeIncluded] = useState<boolean>(false);

  // 取込実行（書き込み）まわりの状態
  const [showConfirm, setShowConfirm] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [commitReport, setCommitReport] = useState<CommitReport | null>(null);

  if (!canImport) return null;

  // 書き込み対象（新規＋上書き）件数。0なら取込実行は無効
  const writableCount = preview ? preview.summary.newCount + preview.summary.updateCount : 0;
  const overwriteCount = preview?.summary.updateCount ?? 0;
  const canCommit = !!preview && writableCount > 0 && !committing;

  /** 状態をリセット（ファイル・店舗変更時／取込完了後） */
  function resetResults() {
    setPreview(null);
    setCommitReport(null);
    setCommitError(null);
    setShowConfirm(false);
  }

  async function handlePreview() {
    setError(null);
    setCommitError(null);
    setCommitReport(null);
    setPreview(null);

    if (!storeId) {
      setError('取込先の店舗を選択してください');
      return;
    }
    if (!file) {
      setError('ファイルを選択してください');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('storeId', storeId);
      formData.append('file', file);
      const result = await dryRunIntegratedImport(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setPreview(result.preview);
      setServiceFeeIncluded(result.serviceFeeIncluded);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'プレビューの生成に失敗しました');
    } finally {
      setLoading(false);
    }
  }

  /** 確認ダイアログで「取込実行」を押したときに実書き込みする */
  async function handleCommit() {
    if (!storeId || !file) {
      setShowConfirm(false);
      return;
    }
    setCommitting(true);
    setCommitError(null);
    setCommitReport(null);
    try {
      // プレビューと同一のファイル・店舗を送る。サーバ側で再検証・再計算してから書き込む。
      const formData = new FormData();
      formData.append('storeId', storeId);
      formData.append('file', file);
      const result = await commitIntegratedImport(formData);
      setShowConfirm(false);
      if (!result.success) {
        const partial = result.partial
          ? `（経営データ：${result.partial.salesCommitted ? '反映済み' : '未反映'} ／ 部門別：${result.partial.deptCommitted ? '反映済み' : '未反映'}）`
          : '';
        setCommitError(`${result.error}${partial}`);
        return;
      }
      setCommitReport(result.report);
      // 取込完了後はプレビューを破棄（二重送信防止。再取込は再プレビューから）
      setPreview(null);
    } catch (e) {
      setShowConfirm(false);
      setCommitError(e instanceof Error ? e.message : '取込に失敗しました');
    } finally {
      setCommitting(false);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">日次売上（統合）インポート</h2>
      <p className="mt-1 text-sm text-slate-500">
        エクスポートした統合フォーマット（.xlsx）を取り込みます。まず内容を確認（プレビュー）してください。
        この段階では<strong className="text-slate-700">保存（書き込み）は行いません</strong>。
      </p>

      {/* --- 取込先店舗・ファイル選択 --- */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700">取込先の店舗</label>
          <select
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={storeId}
            onChange={(e) => {
              setStoreId(e.target.value);
              resetResults();
            }}
          >
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-400">
            ファイル内の store_id がこの店舗と一致するか検証します（誤ファイル防止）。
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">ファイル（.xlsx）</label>
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="mt-1 block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              setFileName(f?.name ?? '');
              resetResults();
            }}
          />
          {fileName && <p className="mt-1 text-xs text-slate-500">選択中：{fileName}</p>}
        </div>
      </div>

      {/* --- アクション --- */}
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={handlePreview}
          disabled={loading}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? '確認中…' : 'プレビュー（確認）'}
        </button>
        {/* 取込実行：プレビュー成功かつ書込対象>0 のときだけ有効 */}
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          disabled={!canCommit}
          className="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          {committing ? '取込中…' : '取込実行'}
        </button>
        {preview && writableCount === 0 && (
          <span className="text-xs text-slate-500">書き込み対象の行がありません</span>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
      {commitError && (
        <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {commitError}
        </div>
      )}

      {commitReport && <CommitResultView report={commitReport} />}

      {/* 取込モードの明示（誤入力防止）：この店舗のサービス料設定でどう解釈するか */}
      {preview && (
        <div
          className={
            'rounded-xl border px-4 py-3 text-sm ' +
            (serviceFeeIncluded
              ? 'border-indigo-200 bg-indigo-50 text-indigo-900'
              : 'border-slate-200 bg-slate-50 text-slate-700')
          }
        >
          <span className="font-bold">
            {serviceFeeIncluded ? 'サービス料込みモードで読み込みます' : 'サービス料別モードで読み込みます'}
          </span>
          ：
          {serviceFeeIncluded
            ? '「税抜売上」列の金額にはサービス料が含まれる前提です。本体（÷(1+料率)）を売上(net)として保存し、差額をサービス料に分離します。'
            : '「税抜売上」列の金額は税抜本体として、そのまま売上(net)に保存します（サービス料は別途上乗せ算出）。'}
          <span className="block text-[11px] mt-1 opacity-80">
            ※モードは取込先店舗の設定（売上入力の「サービス料込み/別」）に従います。変更は売上入力画面のトグルから。
          </span>
        </div>
      )}

      {preview && <PreviewResult preview={preview} />}

      {/* 確認ダイアログ（必須・上書き件数を強調） */}
      {showConfirm && preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">取込の確認</h3>
            <p className="mt-3 text-sm text-slate-700">
              <strong className="text-slate-900">{writableCount}件</strong>を書き込みます
              （うち<strong className="text-rose-600">上書き {overwriteCount}件</strong>）。
            </p>
            {overwriteCount > 0 && (
              <p className="mt-2 rounded-md bg-rose-50 p-2 text-xs text-rose-700">
                上書きは既存の経営データ（daily_sales）を新しい値に置き換えます。元の値には戻せません。
              </p>
            )}
            <p className="mt-2 text-xs text-slate-500">
              内訳：新規 {preview.summary.newCount}件／上書き {overwriteCount}件
              {preview.summary.errorCount > 0 ? `／エラー除外 ${preview.summary.errorCount}件` : ''}
              {preview.summary.skipCount > 0 ? `／スキップ ${preview.summary.skipCount}件` : ''}
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={committing}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleCommit}
                disabled={committing}
                className="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {committing ? '取込中…' : '取込実行'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function CommitResultView({ report }: { report: CommitReport }) {
  return (
    <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-4">
      <p className="text-sm font-semibold text-emerald-800">取込が完了しました</p>
      <ul className="mt-2 space-y-0.5 text-sm text-emerald-700">
        <li>経営データ：新規 {report.salesNew}件／上書き {report.salesUpdate}件</li>
        <li>部門別売上：{report.deptWritten}件</li>
        {report.errorRows > 0 && <li>エラーで除外：{report.errorRows}件</li>}
        {report.skippedRows > 0 && <li>スキップ（重複等）：{report.skippedRows}件</li>}
        {report.skippedDepartments.length > 0 && (
          <li>未登録でスキップした部門：{report.skippedDepartments.join('・')}</li>
        )}
      </ul>
      <p className="mt-2 text-xs text-emerald-600">
        再度取り込む場合は、ファイルを選び直して「プレビュー（確認）」からやり直してください。
      </p>
    </div>
  );
}

// --------------------------------------------------------------------
// プレビュー結果の表示
// --------------------------------------------------------------------

function PreviewResult({ preview }: { preview: ImportPreview }) {
  const { meta, summary, rows } = preview;
  const updateRows = rows.filter((r) => r.status === 'update');
  const newRows = rows.filter((r) => r.status === 'new');
  const errorRows = rows.filter((r) => r.status === 'error');
  const skipRows = rows.filter((r) => r.status === 'skip');
  const warningRows = rows.filter((r) => r.warnings.length > 0);

  return (
    <div className="mt-6 border-t border-slate-200 pt-6">
      <h3 className="text-base font-semibold text-slate-900">プレビュー結果</h3>
      <p className="mt-1 text-xs text-slate-500">
        取込先：{meta.storeName}
        {meta.periodFrom && meta.periodTo ? `／対象期間：${meta.periodFrom} 〜 ${meta.periodTo}` : ''}
        ／検出部門列：{meta.deptHeaderNames.length > 0 ? meta.deptHeaderNames.join('・') : 'なし'}
      </p>

      {/* --- サマリ --- */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <SummaryCard label="新規" value={summary.newCount} tone="emerald" />
        <SummaryCard label="上書き" value={summary.updateCount} tone="slate" />
        <SummaryCard label="エラー" value={summary.errorCount} tone="rose" />
        <SummaryCard label="スキップ行" value={summary.skipCount} tone="amber" />
        <SummaryCard label="スキップ部門" value={summary.skippedDepartments.length} tone="amber" />
      </div>

      {/* --- スキップされた部門（未登録） --- */}
      {summary.skippedDepartments.length > 0 && (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-800">未登録のためスキップした部門</p>
          <p className="mt-1 text-sm text-amber-700">{summary.skippedDepartments.join('・')}</p>
          <p className="mt-1 text-xs text-amber-600">
            部門マスタに未登録の列です。自動登録はしません（取り込むには先に部門を登録してください）。
          </p>
        </div>
      )}

      {/* --- ファイル内キー重複（後続行優先） --- */}
      {summary.duplicateKeys.length > 0 && (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-800">
            ファイル内で重複したキー（後続行を優先・先行行はスキップ）
          </p>
          <p className="mt-1 text-xs text-amber-700">{summary.duplicateKeys.join(' / ')}</p>
        </div>
      )}

      {/* --- エラー行 --- */}
      {errorRows.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-semibold text-rose-700">エラー行（取込対象外）</h4>
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-1 pr-4 font-medium">Excel行</th>
                  <th className="py-1 pr-4 font-medium">エラー内容</th>
                </tr>
              </thead>
              <tbody>
                {errorRows.map((r) => (
                  <tr key={r.excelRow} className="border-b border-slate-100 align-top">
                    <td className="py-1 pr-4 font-mono text-slate-700">{r.excelRow}</td>
                    <td className="py-1 pr-4 text-rose-700">{r.errors.join(' / ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- 上書き行の差分 --- */}
      {updateRows.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-semibold text-slate-900">上書き行の差分（現在値 → 新値）</h4>
          <div className="mt-2 space-y-3">
            {updateRows.map((r) => (
              <UpdateRowCard key={r.excelRow} row={r} />
            ))}
          </div>
        </div>
      )}

      {/* --- 新規行 --- */}
      {newRows.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-semibold text-emerald-700">新規行</h4>
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-1 pr-4 font-medium">Excel行</th>
                  <th className="py-1 pr-4 font-medium">日付</th>
                  <th className="py-1 pr-4 font-medium text-right">税抜</th>
                  <th className="py-1 pr-4 font-medium text-right">税込</th>
                  <th className="py-1 pr-4 font-medium text-right">客数</th>
                  <th className="py-1 pr-4 font-medium text-right">サービス料</th>
                  <th className="py-1 pr-4 font-medium text-right">税額</th>
                  <th className="py-1 pr-4 font-medium text-right">客単価</th>
                </tr>
              </thead>
              <tbody>
                {newRows.map((r) => (
                  <tr key={r.excelRow} className="border-b border-slate-100">
                    <td className="py-1 pr-4 font-mono text-slate-700">{r.excelRow}</td>
                    <td className="py-1 pr-4 text-slate-700">{r.key?.businessDate ?? '—'}</td>
                    <td className="py-1 pr-4 text-right">{fmt(r.input.netSales)}</td>
                    <td className="py-1 pr-4 text-right">{fmt(r.input.grossSales)}</td>
                    <td className="py-1 pr-4 text-right">{fmt(r.input.customerCount)}</td>
                    <td className="py-1 pr-4 text-right text-sky-700">{fmt(r.recalc?.serviceFee ?? null)}</td>
                    <td className="py-1 pr-4 text-right text-sky-700">{fmt(r.recalc?.taxAmount ?? null)}</td>
                    <td className="py-1 pr-4 text-right text-sky-700">{fmt(r.recalc?.avgPerCustomer ?? null)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            サービス料・税額・客単価は取り込まず、サーバ側で再計算した値（青字）です。
          </p>
        </div>
      )}

      {/* --- スキップ行（重複の先行行） --- */}
      {skipRows.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-semibold text-amber-700">スキップ行</h4>
          <ul className="mt-2 space-y-1 text-sm text-amber-700">
            {skipRows.map((r) => (
              <li key={r.excelRow}>
                Excel行 {r.excelRow}：{r.warnings.join(' / ') || '取込対象外'}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* --- 警告（ブロックしない） --- */}
      {warningRows.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-semibold text-amber-700">警告（保存はブロックしません）</h4>
          <ul className="mt-2 space-y-1 text-sm text-amber-700">
            {warningRows.map((r) => (
              <li key={r.excelRow}>
                Excel行 {r.excelRow}：{r.warnings.join(' / ')}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-6 rounded-md bg-slate-50 p-3 text-xs text-slate-500">
        これは確認用のプレビューです。データベースへの書き込みは行っていません。
        実際の取り込みは次のステップで実行できるようになります。
      </p>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'emerald' | 'slate' | 'rose' | 'amber';
}) {
  const toneClass = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
  }[tone];
  return (
    <div className={`rounded-md border p-3 text-center ${toneClass}`}>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="mt-1 text-xs">{label}</div>
    </div>
  );
}

function UpdateRowCard({ row }: { row: ImportPreviewRow }) {
  const diffEntries = row.diff ? Object.entries(row.diff) : [];
  const deptDiffs = row.departments.filter((d) => d.action === 'apply' && d.status === 'update' && d.diff);
  const deptNews = row.departments.filter((d) => d.action === 'apply' && d.status === 'new' && d.gross !== null);

  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-800">
          {row.key?.businessDate ?? '—'}{' '}
          <span className="font-mono text-xs text-slate-400">(Excel行 {row.excelRow})</span>
        </p>
        {diffEntries.length === 0 && deptDiffs.length === 0 && deptNews.length === 0 && (
          <span className="text-xs text-slate-400">変更なし</span>
        )}
      </div>

      {diffEntries.length > 0 && (
        <table className="mt-2 min-w-full text-sm">
          <tbody>
            {diffEntries.map(([field, d]) => (
              <tr key={field} className="border-b border-slate-100 last:border-0">
                <td className="py-1 pr-4 text-slate-500">{FIELD_LABEL[field] ?? field}</td>
                <td className="py-1 pr-2 text-right text-slate-400 line-through">{fmt(d.current)}</td>
                <td className="py-1 pr-2 text-slate-400">→</td>
                <td className="py-1 text-right font-medium text-slate-900">{fmt(d.next)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {(deptDiffs.length > 0 || deptNews.length > 0) && (
        <div className="mt-2 text-xs text-slate-600">
          <span className="font-medium text-slate-500">部門：</span>
          {deptDiffs.map((d) => (
            <span key={d.departmentId} className="mr-3">
              {d.name} {fmt(d.diff?.current ?? null)} → {fmt(d.diff?.next ?? null)}
            </span>
          ))}
          {deptNews.map((d) => (
            <span key={d.departmentId} className="mr-3 text-emerald-700">
              {d.name} 新規 {fmt(d.gross)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
