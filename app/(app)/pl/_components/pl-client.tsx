'use client';

// ====================================================================
// 月次PL（損益）画面 S1：骨組み＋売上高・売上原価・売上総利益（現地通貨）
//
//   - 1店舗×決算12ヶ月（fiscal_year_start_month 起点）を横並び表示。
//   - 売上高=forecastMonthlySales / 売上原価=forecastMonthlyCost（lib/pl・呼ぶだけ）。
//   - 売上総利益=売上高−売上原価（両方が値のときのみ・どちらか計算不可なら「—」）。
//   - 計算不可（Estimate.ok=false）・未評価（未来月）は「—」。現地通貨のみ（円換算はS6）。
//   - S2以降（営業日数・販管費・利益・指標・通貨トグル）はこの画面では未実装。
// ====================================================================

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronRight as Crumb,
  ArrowDown,
  ArrowUp,
  Copy,
  Download,
  Loader2,
  Pencil,
  Plus,
  Sigma,
  Store as StoreIcon,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { CostResult, Estimate, SalesForecastResult } from '@/lib/pl/types';
import { setBusinessDays } from '../_lib/business-days-actions';
import { setBankBalance } from '../_lib/bank-balance-actions';
import { AmountInput } from '@/app/(app)/daily-input/sales/_components/amount-input';
import {
  deleteMonthlyExpenseAccount,
  moveExpenseAccountOrder,
  upsertMonthlyExpense,
  bulkFillMonthlyExpense,
  copyMonthlyExpenses,
} from '../_lib/expense-actions';
// 定数・型・ラベルは通常モジュールから import（'use server' ファイルからは配列が渡らないため）
import { TAG_LABELS, CATEGORY_TAGS, type CategoryTag } from '../_lib/expense-constants';
import { exportMonthlyPl } from '../_lib/pl-export-actions';
import type { PlExportRow, PlExportMeta } from '../_lib/pl-export';
import { base64ToUint8Array } from '@/lib/xlsx-utils';
import { ExpenseIoPanel } from './expense-io-panel';
import { calcExpenseFromFormula } from '../_lib/expense-formula';
import { CALC_TYPE_LABELS, type CalcType } from '../_lib/formula-constants';
import { deleteExpenseFormula, moveExpenseFormulaOrder } from '../_lib/formula-actions';
import { FormulaDialog, type FormulaDialogInitial } from './formula-dialog';
import { ExpenseEditDialog } from './expense-edit-dialog';
import { useGridNavigation } from '@/hooks/use-grid-navigation';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** base64(.xlsx) を Blob 化してダウンロード（売上予算エクスポートと同方式・DOM操作） */
function downloadBase64Xlsx(base64: string, filename: string): void {
  const blob = new Blob([base64ToUint8Array(base64)], { type: XLSX_MIME });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** 既存販管費の科目（server から渡す初期値） */
export type ExpenseAccountInit = {
  account_name: string;
  category_tag: CategoryTag;
  /** 'YYYY-MM' → 金額 */
  amounts: Record<string, number>;
  /** 表示順序（店舗×科目で1つ・全月共通） */
  display_order: number;
};

/** 計算式の科目（expense_formulas・server から渡す。読み取り専用・金額は都度計算） */
export type FormulaAccountInit = {
  account_name: string;
  category_tag: CategoryTag;
  calc_type: CalcType;
  rate1: number | null;
  rate2: number | null;
  threshold: number | null;
  fixed_amount: number | null;
  display_order: number;
};

/** クライアント内部の編集用科目行 */
type ExpenseRowState = {
  key: string;
  accountName: string;
  categoryTag: CategoryTag | '';
  amounts: Record<string, number | undefined>;
  /** 最後に保存された科目名（削除/上書きの対象。未保存は null） */
  savedName: string | null;
};

export type PlStore = {
  id: string;
  name: string;
  currency_id: string;
  fiscal_year_start_month: number;
  /** サービス料率（S4：サービス料＝売上高×この率） */
  service_fee_rate: number;
  /** 社員還付金率（S4：社員還付金＝売上高×この率） */
  employee_rebate_rate: number;
};

export type PlMonth = {
  year: number;
  month: number; // 1-12
  yearMonth: string; // 'YYYY-MM'
  /** 評価対象か（未来月は false＝—） */
  evaluated: boolean;
  sales: Estimate<SalesForecastResult> | null;
  cost: Estimate<CostResult> | null;
  /** S5：客数の実績合計（当月〜asOf・人数）。未評価は null */
  customerCount: number | null;
  /** S5：税込売上(gross_sales)の実績合計（客単価の分子）。未評価は null */
  grossActual: number | null;
};

type PlClientProps = {
  stores: PlStore[];
  selectedStoreId: string | null;
  fyStartYear: number;
  months: PlMonth[];
  /** 既存の営業日数：'YYYY-MM' → business_days */
  businessDays: Record<string, number>;
  /** 既存の通帳残高：'YYYY-MM' → balance（現地通貨・手入力・040） */
  bankBalances: Record<string, number>;
  /** 既存の販管費科目（account_name ごと） */
  expenseAccounts: ExpenseAccountInit[];
  /** 計算式の科目（expense_formulas・display_order 昇順・読み取り専用） */
  formulaAccounts: FormulaAccountInit[];
  /** 営業日数・販管費を編集できるか（can_write） */
  canEdit: boolean;
  currencyCode: string;
  /** S6：現地通貨→円のレート（JPY/1現地通貨・最新1値）。無ければ null（円トグル無効） */
  jpyRate: number | null;
};

const DASH = '—';

function fmt(n: number): string {
  return Math.round(n).toLocaleString('ja-JP');
}

/** 率（小数）を % 表示に */
function pctText(r: number | null): string {
  if (r === null) return DASH;
  return `${(r * 100).toLocaleString('ja-JP', { maximumFractionDigits: 3 })}%`;
}

/** 計算式を分かりやすい文章にする（計算根拠の脚注用・小数は％へ戻す） */
function formulaSummary(f: FormulaAccountInit): string {
  switch (f.calc_type) {
    case 'percent':
      return `売上×${pctText(f.rate1)}`;
    case 'tiered':
      return `${fmt(f.threshold ?? 0)}まで${pctText(f.rate1)}・超過分${pctText(f.rate2)}`;
    case 'fixed':
      return `固定 ${fmt(f.fixed_amount ?? 0)}`;
    case 'fixed_plus_percent':
      return `固定 ${fmt(f.fixed_amount ?? 0)} ＋ 売上×${pctText(f.rate1)}`;
    default:
      return '';
  }
}

/** 売上高セルの表示値（計算不可・未評価は—） */
function salesValue(m: PlMonth): number | null {
  if (!m.evaluated || !m.sales || !m.sales.ok) return null;
  return m.sales.value.forecast;
}
/** 売上原価セルの表示値 */
function costValue(m: PlMonth): number | null {
  if (!m.evaluated || !m.cost || !m.cost.ok) return null;
  return m.cost.value.cost;
}
/** 売上総利益＝売上高−売上原価（どちらか—なら—） */
function grossProfit(m: PlMonth): number | null {
  const s = salesValue(m);
  const c = costValue(m);
  if (s === null || c === null) return null;
  return s - c;
}

/** 売上高比率（その月/年間の金額 ÷ 売上高 ×100・小数第1位）。0除算・—は出さない（null） */
function ratioPct(value: number | null, net: number | null): string | null {
  if (value === null || net === null || net <= 0) return null;
  return `${((value / net) * 100).toFixed(1)}%`;
}

/** セル内の比率ラベル（金額の下に小さく）。色は「計算式の科目を追加」と同じ青（indigo-700）。
 *  サイズは金額（最小 text-xs=12px）より小さい 11px。位置は金額より約2文字分右（-mr-2）。
 *  prefix は表示記号（社員還付金の Δ 等・比率計算には影響しない）。
 *  比率が出せない場合は何も描画しない */
function RatioLabel({
  value,
  net,
  prefix,
}: {
  value: number | null;
  net: number | null;
  prefix?: string;
}) {
  const r = ratioPct(value, net);
  if (r === null) return null;
  return (
    <div className="mt-0.5 -mr-2 text-[11px] leading-none font-num text-indigo-700">
      {prefix ?? ''}
      {r}
    </div>
  );
}

export function PlClient({
  stores,
  selectedStoreId,
  fyStartYear,
  months,
  businessDays,
  bankBalances,
  expenseAccounts,
  formulaAccounts,
  canEdit,
  currencyCode,
  jpyRate,
}: PlClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  // 当年度12ヶ月（'YYYY-MM' と 月初DATE）
  const monthYms = months.map((m) => m.yearMonth);
  const yearMonthStarts = months.map((m) => `${m.yearMonth}-01`);

  // 販管費の科目行（編集用）。DB（保存済み）＋ sessionStorage（未保存の下書き）から構築する。
  // 未保存の下書きを sessionStorage に退避することで、router.refresh・再マウント・リロードでも
  // 入力途中の行（科目名・分類・金額が未完でも）が画面から消えないようにする。
  const draftKey = `pl-exp-drafts:${selectedStoreId ?? ''}:${fyStartYear}`;

  // DB（保存済み）由来の行
  const buildDbRows = (): ExpenseRowState[] =>
    expenseAccounts.map((a, i) => ({
      key: `acct-${i}-${a.account_name}`,
      accountName: a.account_name,
      categoryTag: a.category_tag,
      amounts: { ...a.amounts },
      savedName: a.account_name,
    }));

  // sessionStorage に退避した未保存の下書き行
  const loadDraftRows = (): ExpenseRowState[] => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.sessionStorage.getItem(draftKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as ExpenseRowState[];
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((d) => !d.savedName) // 未保存のみ
        .map((d, i) => ({ ...d, key: `draft-${i}` })); // キー再生成（new- と衝突回避）
    } catch {
      return [];
    }
  };

  // DB行＋下書き行（保存済み科目名と重複する下書きは除外）
  const buildInitialRows = (): ExpenseRowState[] => {
    const dbRows = buildDbRows();
    const dbNames = new Set(dbRows.map((r) => r.accountName.trim()));
    const drafts = loadDraftRows().filter(
      (d) => d.accountName.trim() === '' || !dbNames.has(d.accountName.trim()),
    );
    return [...dbRows, ...drafts];
  };

  const [rows, setRows] = useState<ExpenseRowState[]>(buildInitialRows);
  const [newCounter, setNewCounter] = useState(0);
  // 販管費グリッドの Excel風フォーカス移動（Enter=下／Tab=右）。値・保存には非干渉。
  const gridNav = useGridNavigation();
  const [busy, setBusy] = useState(false);
  // 科目削除の確認ダイアログ対象（保存済み科目のみ・物理削除のため確認必須）
  const [deleteTarget, setDeleteTarget] = useState<ExpenseRowState | null>(null);
  // 販管費の折りたたみ（表示のみ・DB保存なし）。初期=展開。折りたたみ時は各科目行・「科目を追加」を隠し販管費計だけ表示
  const [expCollapsed, setExpCollapsed] = useState(false);
  // S6：表示通貨トグル（現地通貨／円・ローカルstate・DB保存なし）。初期＝現地通貨。
  const [showJpy, setShowJpy] = useState(false);
  // レートが数値のときだけ円モード（!= null で null・undefined の両方を弾く）
  const hasJpyRate = jpyRate != null && Number.isFinite(jpyRate);
  const jpyMode = showJpy && hasJpyRate;
  // 金額の円換算（表示のみ・jpyMode のときレートを掛ける。比率・客数・日数・%には使わない）
  const toJpy = (v: number | null): number | null =>
    jpyMode && v !== null && jpyRate != null ? v * jpyRate : v;
  // 計算式編集ダイアログ（追加＝null／編集＝初期値）
  const [formulaDialogOpen, setFormulaDialogOpen] = useState(false);
  const [formulaEditTarget, setFormulaEditTarget] = useState<FormulaDialogInitial>(null);
  // 手入力科目の編集ダイアログ（区分の編集・対象行のキー）
  const [manualEditKey, setManualEditKey] = useState<string | null>(null);
  // 計算式科目の削除確認ダイアログ（物理DELETE＝復元不可のため確認必須）
  const [formulaDeleteTarget, setFormulaDeleteTarget] = useState<FormulaAccountInit | null>(null);
  const [formulaBusy, setFormulaBusy] = useState(false);

  // 計算式科目の並び替え（隣接スワップ・moveExpenseFormulaOrder を呼び成功で refresh）。
  // 表示順は server（page.tsx）が display_order 昇順で渡すため、refresh で反映される。
  const handleMoveFormula = (accountName: string, direction: 'up' | 'down') => {
    if (!selectedStoreId || !canEdit) return;
    setFormulaBusy(true);
    startTransition(async () => {
      const result = await moveExpenseFormulaOrder({
        store_id: selectedStoreId,
        account_name: accountName,
        direction,
      });
      setFormulaBusy(false);
      if (result.success) {
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  // 計算式科目を削除（確認後・deleteExpenseFormula＝物理DELETE を呼ぶだけ）
  const confirmDeleteFormula = () => {
    const f = formulaDeleteTarget;
    if (!f || !selectedStoreId) return;
    setFormulaBusy(true);
    startTransition(async () => {
      const result = await deleteExpenseFormula({
        store_id: selectedStoreId,
        account_name: f.account_name,
      });
      setFormulaBusy(false);
      if (result.success) {
        setFormulaDeleteTarget(null);
        toast.success(`計算式「${f.account_name}」を削除しました`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const openAddFormula = () => {
    setFormulaEditTarget(null);
    setFormulaDialogOpen(true);
  };
  const openEditFormula = (f: FormulaAccountInit) => {
    setFormulaEditTarget({
      account_name: f.account_name,
      category_tag: f.category_tag,
      calc_type: f.calc_type,
      rate1: f.rate1,
      rate2: f.rate2,
      threshold: f.threshold,
      fixed_amount: f.fixed_amount,
    });
    setFormulaDialogOpen(true);
  };

  // 店舗・年度の切替時のみ DB＋下書きから再構築する。
  // （router.refresh では再構築しない＝入力中の行を保持。下書きは sessionStorage にも退避）
  useEffect(() => {
    setRows(buildInitialRows());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStoreId, fyStartYear]);

  // 未保存の下書き（科目名・分類・金額のいずれかが入った未保存行）を sessionStorage に退避。
  // 金額が空でも、科目名や分類だけでも保持される（保存条件は別途・揃ったときのみ UPSERT）。
  useEffect(() => {
    if (typeof window === 'undefined' || !selectedStoreId) return;
    const drafts = rows.filter(
      (r) =>
        !r.savedName &&
        (r.accountName.trim() !== '' ||
          r.categoryTag !== '' ||
          Object.values(r.amounts).some((v) => v !== undefined)),
    );
    try {
      if (drafts.length > 0) window.sessionStorage.setItem(draftKey, JSON.stringify(drafts));
      else window.sessionStorage.removeItem(draftKey);
    } catch {
      /* storage 利用不可は無視（保持は state にも残る） */
    }
  }, [rows, draftKey, selectedStoreId]);
  // 'YYYY-MM' → 入力中の営業日数文字列（編集用）
  const [days, setDays] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(businessDays).map(([k, v]) => [k, String(v)])),
  );
  const [savingMonth, setSavingMonth] = useState<string | null>(null);

  // 店舗・年度切替で初期値を再同期
  useEffect(() => {
    setDays(Object.fromEntries(Object.entries(businessDays).map(([k, v]) => [k, String(v)])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStoreId, fyStartYear]);

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.set(key, value);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  // 営業日数の即時保存（monthly_business_days へ UPSERT）→ 保存後に原価が再計算される
  const handleSaveDays = (yearMonth: string) => {
    if (!selectedStoreId || !canEdit) return;
    const raw = (days[yearMonth] ?? '').trim();
    const saved = businessDays[yearMonth];
    // 空欄で既存もなければ何もしない
    if (raw === '' && saved === undefined) return;
    // 値が変わっていなければ保存しない
    if (raw !== '' && Number(raw) === saved) return;
    if (raw === '') return; // 空欄クリアは何もしない（削除はしない）

    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > 31) {
      toast.error('営業日数は1〜31の整数で入力してください');
      return;
    }
    setSavingMonth(yearMonth);
    startTransition(async () => {
      const result = await setBusinessDays({
        store_id: selectedStoreId,
        year_month: `${yearMonth}-01`,
        business_days: n,
      });
      setSavingMonth(null);
      if (result.success) {
        toast.success(`${yearMonth} の営業日数を保存しました`);
        router.refresh(); // 原価の再計算を反映
      } else {
        toast.error(result.error);
      }
    });
  };

  // ---- 通帳残高（指標欄・客単価の下／即時保存→monthly_bank_balances・040）----
  // 'YYYY-MM' → 入力中の通帳残高文字列（編集用）。現地通貨・PL計算には使わない参考メモ。
  const [balances, setBalances] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(bankBalances).map(([k, v]) => [k, String(v)])),
  );
  const [savingBalanceMonth, setSavingBalanceMonth] = useState<string | null>(null);

  // 店舗・年度切替で初期値を再同期
  useEffect(() => {
    setBalances(Object.fromEntries(Object.entries(bankBalances).map(([k, v]) => [k, String(v)])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStoreId, fyStartYear]);

  // 通帳残高の即時保存（monthly_bank_balances へ UPSERT）。空欄は何もしない（削除しない）。
  const handleSaveBalance = (yearMonth: string) => {
    if (!selectedStoreId || !canEdit) return;
    const raw = (balances[yearMonth] ?? '').trim().replace(/,/g, '');
    const saved = bankBalances[yearMonth];
    if (raw === '' && saved === undefined) return; // 空欄かつ未保存は何もしない
    if (raw === '') return; // 空欄クリアは何もしない（削除はしない）
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      toast.error('通帳残高は数値で入力してください');
      return;
    }
    if (saved !== undefined && n === saved) return; // 値が変わっていなければ保存しない

    setSavingBalanceMonth(yearMonth);
    startTransition(async () => {
      const result = await setBankBalance({
        store_id: selectedStoreId,
        year_month: `${yearMonth}-01`,
        balance: n,
      });
      setSavingBalanceMonth(null);
      if (result.success) {
        toast.success(`${yearMonth} の通帳残高を保存しました`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const cell = (v: number | null) =>
    v === null ? (
      <span className="text-slate-300">{DASH}</span>
    ) : (
      <span className="font-num">{fmt(v)}</span>
    );

  // ---- 全月一括入力（#6 A案・固定費の年間一括入力）----
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkName, setBulkName] = useState('');
  const [bulkTag, setBulkTag] = useState<CategoryTag>('labor');
  const [bulkAmount, setBulkAmount] = useState<number | undefined>(undefined);
  const [bulkBusy, setBulkBusy] = useState(false);

  const handleBulkFill = () => {
    if (!selectedStoreId || !canEdit) return;
    const name = bulkName.trim();
    if (!name) {
      toast.error('科目名を入力してください');
      return;
    }
    setBulkBusy(true);
    startTransition(async () => {
      const result = await bulkFillMonthlyExpense({
        store_id: selectedStoreId,
        account_name: name,
        category_tag: bulkTag,
        year_months: yearMonthStarts,
        amount: bulkAmount ?? 0,
      });
      setBulkBusy(false);
      if (result.success) {
        setBulkOpen(false);
        setBulkName('');
        setBulkAmount(undefined);
        toast.success(`「${name}」を全月（${months.length}ヶ月）に一括入力しました`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  // ---- 前月引き継ぎ（販管費をコピー元の月→コピー先の月へコピー）----
  const [copyOpen, setCopyOpen] = useState(false);
  // 既定：コピー先＝当月（無ければ先頭）／コピー元＝その前月（先頭なら同じになるので submit 抑止）
  const defaultToIdx = (() => {
    const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const nowYm = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const i = months.findIndex((m) => m.yearMonth === nowYm);
    return i >= 0 ? i : months.length - 1;
  })();
  const [copyToIdx, setCopyToIdx] = useState<number>(defaultToIdx);
  const [copyFromIdx, setCopyFromIdx] = useState<number>(Math.max(0, defaultToIdx - 1));
  const [copyBusy, setCopyBusy] = useState(false);

  const handleCopyExpenses = () => {
    if (!selectedStoreId || !canEdit) return;
    const from = yearMonthStarts[copyFromIdx];
    const to = yearMonthStarts[copyToIdx];
    if (!from || !to || from === to) {
      toast.error('コピー元とコピー先に別々の月を選んでください');
      return;
    }
    setCopyBusy(true);
    startTransition(async () => {
      const result = await copyMonthlyExpenses({
        store_id: selectedStoreId,
        from_year_month: from,
        to_year_month: to,
      });
      setCopyBusy(false);
      if (result.success) {
        setCopyOpen(false);
        toast.success(
          `${months[copyFromIdx].yearMonth} の販管費 ${result.copied} 科目を ${months[copyToIdx].yearMonth} に引き継ぎました`,
        );
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  // ---- 販管費（monthly_expenses）の操作 ----
  const addAccount = () => {
    setRows((prev) => [
      ...prev,
      { key: `new-${newCounter}`, accountName: '', categoryTag: '', amounts: {}, savedName: null },
    ]);
    setNewCounter((c) => c + 1);
  };

  const patchRow = (key: string, patch: Partial<ExpenseRowState>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  // 金額セルの即時保存（科目名・区分が揃っているときのみ）
  const saveAmount = (key: string, ym: string) => {
    if (!selectedStoreId || !canEdit) return;
    const row = rows.find((r) => r.key === key);
    if (!row) return;
    const name = row.accountName.trim();
    const amt = row.amounts[ym];
    if (name === '' || row.categoryTag === '') return; // 科目名・区分が揃うまで保存しない
    if (amt === undefined) return; // 空欄はスキップ（削除はしない）
    if (amt < 0) {
      toast.error('金額は0以上で入力してください');
      return;
    }
    setBusy(true);
    startTransition(async () => {
      const result = await upsertMonthlyExpense({
        store_id: selectedStoreId,
        year_month: `${ym}-01`,
        account_name: name,
        category_tag: row.categoryTag as CategoryTag,
        amount: amt,
      });
      setBusy(false);
      if (result.success) {
        patchRow(key, { savedName: name });
      } else {
        toast.error(result.error);
      }
    });
  };

  // 行に科目名 or 金額が入っているか（区分未選択の促し表示の判定に使う）
  const rowHasContent = (row: ExpenseRowState): boolean =>
    row.accountName.trim() !== '' || monthYms.some((ym) => row.amounts[ym] !== undefined);

  // 区分タグを選択：state を更新し、科目名と入力済み金額が揃っていれば即時保存する
  const handleTagChange = (key: string, tag: CategoryTag) => {
    patchRow(key, { categoryTag: tag });
    if (!selectedStoreId || !canEdit) return;
    const row = rows.find((r) => r.key === key);
    if (!row) return;
    const name = row.accountName.trim();
    if (name === '') return; // 科目名がまだなら保存しない（入力は保持）
    const targets = monthYms.filter((ym) => {
      const a = row.amounts[ym];
      return a !== undefined && a >= 0;
    });
    if (targets.length === 0) return; // 金額未入力なら保存対象なし
    setBusy(true);
    startTransition(async () => {
      for (const ym of targets) {
        const amt = row.amounts[ym] as number;
        const result = await upsertMonthlyExpense({
          store_id: selectedStoreId,
          year_month: `${ym}-01`,
          account_name: name,
          category_tag: tag,
          amount: amt,
        });
        if (!result.success) {
          toast.error(result.error);
          break;
        }
      }
      setBusy(false);
      patchRow(key, { savedName: name });
    });
  };

  // 科目行のゴミ箱クリック：未保存・保存済みのどちらも常に確認ダイアログを開く
  const handleDeleteClick = (key: string) => {
    if (!canEdit) return;
    const row = rows.find((r) => r.key === key);
    if (!row) return;
    setDeleteTarget(row);
  };

  // 確認後に削除：保存済みはサーバDELETE、未保存はローカル削除のみ
  const confirmDelete = () => {
    const row = deleteTarget;
    if (!row || !canEdit) return;

    // 未保存（DBに無い）行：サーバを呼ばずローカル削除のみ
    if (!row.savedName) {
      setRows((prev) => prev.filter((r) => r.key !== row.key));
      setDeleteTarget(null);
      return;
    }

    // 保存済み：物理DELETE（monthly_expenses・従来どおり）
    if (!selectedStoreId) return;
    setBusy(true);
    startTransition(async () => {
      const result = await deleteMonthlyExpenseAccount({
        store_id: selectedStoreId,
        account_name: row.savedName as string,
        year_months: yearMonthStarts,
      });
      setBusy(false);
      if (result.success) {
        setRows((prev) => prev.filter((r) => r.key !== row.key));
        setDeleteTarget(null);
        toast.success(`科目「${row.savedName}」を削除しました`);
      } else {
        toast.error(result.error);
      }
    });
  };

  // 保存済み科目（並び替え対象）。未保存の下書きは末尾・矢印対象外。
  const savedRows = rows.filter((r) => r.savedName);
  const firstSavedKey = savedRows[0]?.key;
  const lastSavedKey = savedRows[savedRows.length - 1]?.key;

  // 表示順を1つ上/下へ（account_name 単位で全月の display_order を一括更新）
  const handleMove = (key: string, direction: 'up' | 'down') => {
    if (!selectedStoreId || !canEdit) return;
    const i = savedRows.findIndex((r) => r.key === key);
    const j = direction === 'up' ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= savedRows.length) return;
    const a = savedRows[i];
    const b = savedRows[j];
    if (!a.savedName) return;

    // ローカルの rows 配列で a と b の位置を入れ替える（楽観的更新／失敗時の復元で共用）
    const swap = () =>
      setRows((prev) => {
        const next = [...prev];
        const ia = next.findIndex((r) => r.key === a.key);
        const ib = next.findIndex((r) => r.key === b.key);
        if (ia >= 0 && ib >= 0) [next[ia], next[ib]] = [next[ib], next[ia]];
        return next;
      });

    // 楽観的更新：先に表示を入れ替えて即時反映（押した瞬間に動く）。保存はバックグラウンド。
    swap();
    setBusy(true);
    startTransition(async () => {
      const result = await moveExpenseAccountOrder({
        store_id: selectedStoreId,
        account_name: a.savedName as string,
        direction,
      });
      setBusy(false);
      if (!result.success) {
        swap(); // 失敗：入れ替えを元に戻す
        toast.error(result.error);
      }
    });
  };

  // 計算式科目のその月の金額（売上高 net から都度計算・計算不可は null）
  const formulaCellValue = (f: FormulaAccountInit, m: PlMonth): number | null =>
    calcExpenseFromFormula(f, salesValue(m));

  // 手入力科目の合計（その月）
  const manualTotalByMonth = (ym: string): number =>
    rows.reduce((sum, r) => sum + (r.amounts[ym] ?? 0), 0);

  // 計算式科目の合計（その月・「—」は加算しない＝0扱い）
  const formulaTotalByMonth = (m: PlMonth): number =>
    formulaAccounts.reduce((sum, f) => sum + (formulaCellValue(f, m) ?? 0), 0);

  // 販管費計（各月）＝手入力合計 ＋ 計算式合計
  const expenseTotalByMonth = (m: PlMonth): number =>
    manualTotalByMonth(m.yearMonth) + formulaTotalByMonth(m);

  // 売上高の年間計（各行の年間計比率の分母・—は0扱い）。表示用の比率計算にのみ使用。
  const salesYearTotal = months.reduce((s, m) => s + (salesValue(m) ?? 0), 0);

  // 計算式科目の並び替え端判定（display_order 昇順で渡される前提）
  const firstFormulaName = formulaAccounts[0]?.account_name;
  const lastFormulaName = formulaAccounts[formulaAccounts.length - 1]?.account_name;

  // S4：利益行（表示合成・新規DB書込なし）。store の率は読み取り。依存値が — ならその行も —。
  const selectedStore = stores.find((s) => s.id === selectedStoreId) ?? null;
  const serviceFeeRate = selectedStore?.service_fee_rate ?? 0;
  const employeeRebateRate = selectedStore?.employee_rebate_rate ?? 0;

  // 営業利益 ＝ 売上総利益 − 販管費計（売上総利益が—なら—。販管費計は手入力＋計算式の合計）
  const operatingProfit = (m: PlMonth): number | null => {
    const gp = grossProfit(m);
    if (gp === null) return null;
    return gp - expenseTotalByMonth(m);
  };
  // サービス料 ＝ 売上高 × service_fee_rate（売上高が—なら—）
  const serviceFee = (m: PlMonth): number | null => {
    const s = salesValue(m);
    return s === null ? null : s * serviceFeeRate;
  };
  // 社員還付金 ＝ 売上高 × employee_rebate_rate（売上高が—なら—）
  const employeeRebate = (m: PlMonth): number | null => {
    const s = salesValue(m);
    return s === null ? null : s * employeeRebateRate;
  };
  // 経常利益 ＝ 営業利益 ＋ サービス料 − 社員還付金（いずれかが—なら—）
  const ordinaryProfit = (m: PlMonth): number | null => {
    const op = operatingProfit(m);
    const sf = serviceFee(m);
    const er = employeeRebate(m);
    if (op === null || sf === null || er === null) return null;
    return op + sf - er;
  };

  // ---- S5：指標（表示合成・新規DB書込なし） ----
  // 区分タグ別の販管費合計（その月・手入力科目＋計算式科目）。— は0扱い（評価月のみ呼ぶ前提）。
  const tagSumByMonth = (m: PlMonth, tag: CategoryTag): number => {
    const manual = rows.reduce(
      (s, r) => s + (r.categoryTag === tag ? (r.amounts[m.yearMonth] ?? 0) : 0),
      0,
    );
    const formula = formulaAccounts.reduce(
      (s, f) => s + (f.category_tag === tag ? (formulaCellValue(f, m) ?? 0) : 0),
      0,
    );
    return manual + formula;
  };

  // FL比率 ＝ (売上原価 ＋ 人件費labor) ÷ 売上高 ×100
  const flRatio = (m: PlMonth): number | null => {
    const s = salesValue(m);
    const c = costValue(m);
    if (s === null || c === null || s <= 0) return null;
    return ((c + tagSumByMonth(m, 'labor')) / s) * 100;
  };
  // FLR比率 ＝ (売上原価 ＋ 人件費 ＋ 家賃rent) ÷ 売上高 ×100
  const flrRatio = (m: PlMonth): number | null => {
    const s = salesValue(m);
    const c = costValue(m);
    if (s === null || c === null || s <= 0) return null;
    return ((c + tagSumByMonth(m, 'labor') + tagSumByMonth(m, 'rent')) / s) * 100;
  };
  // EBITDA ＝ 経常利益 ＋ 減価償却depreciation
  const ebitda = (m: PlMonth): number | null => {
    const ord = ordinaryProfit(m);
    if (ord === null) return null;
    return ord + tagSumByMonth(m, 'depreciation');
  };
  // 客数（実績合計・未評価は—）
  const customerCountOf = (m: PlMonth): number | null => m.customerCount;
  // 客単価 ＝ 税込売上(gross)実績合計 ÷ 客数実績合計（客数0は—・0除算回避）
  const avgPerCustomer = (m: PlMonth): number | null => {
    const cust = m.customerCount;
    const gross = m.grossActual;
    if (cust === null || gross === null || cust <= 0) return null;
    return gross / cust;
  };

  // 指標の年間計（FL/FLRは年間ベース・EBITDA/客数は合計・客単価は年間gross÷年間客数）
  const yearCost = months.reduce((s, m) => s + (costValue(m) ?? 0), 0);
  const yearLabor = months.reduce((s, m) => s + tagSumByMonth(m, 'labor'), 0);
  const yearRent = months.reduce((s, m) => s + tagSumByMonth(m, 'rent'), 0);
  const flYear = salesYearTotal > 0 ? ((yearCost + yearLabor) / salesYearTotal) * 100 : null;
  const flrYear = salesYearTotal > 0 ? ((yearCost + yearLabor + yearRent) / salesYearTotal) * 100 : null;
  const ebitdaYear = months.reduce((s, m) => s + (ebitda(m) ?? 0), 0);
  const customerYear = months.reduce((s, m) => s + (m.customerCount ?? 0), 0);
  const grossYear = months.reduce((s, m) => s + (m.grossActual ?? 0), 0);
  const avgYear = customerYear > 0 ? grossYear / customerYear : null;

  // ---- Excel出力（方針A：画面に表示中の値をそのまま出力・DB再読込なし） ----
  const [exporting, setExporting] = useState(false);

  // 画面の各行を行定義配列（PlExportRow[]）へ。S4/S5実装時はここに push を足すだけで拡張可能。
  const buildExportRows = (): PlExportRow[] => {
    const out: PlExportRow[] = [];
    // 年間計：各月の値を合計（— は 0 扱い・値がある月だけ）＝画面の年間計と同じ規則
    const sumVals = (vals: (number | null)[]): number =>
      vals.reduce<number>((s, v) => s + (v ?? 0), 0);

    const salesVals = months.map(salesValue);
    out.push({ label: '売上高', kind: 'normal', values: salesVals, yearTotal: sumVals(salesVals) });
    const costVals = months.map(costValue);
    out.push({ label: '売上原価', kind: 'normal', values: costVals, yearTotal: sumVals(costVals) });
    const gpVals = months.map(grossProfit);
    out.push({ label: '売上総利益', kind: 'emphasis', values: gpVals, yearTotal: sumVals(gpVals) });

    // 販管費見出し（値なし）
    out.push({ label: '販管費（科目別）', kind: 'section', values: months.map(() => null), yearTotal: null });

    // 各販管費科目（画面の表示順＝rows。下書き・未保存行も画面どおり含める）
    for (const row of rows) {
      const vals = months.map((m) => {
        const a = row.amounts[m.yearMonth];
        return a === undefined ? null : a; // 未入力は空欄
      });
      out.push({
        label: row.accountName.trim() || '(未入力科目)',
        kind: 'normal',
        values: vals,
        yearTotal: months.reduce((s, m) => s + (row.amounts[m.yearMonth] ?? 0), 0),
      });
    }

    // 計算式の科目（変動費・読み取り専用・各月は売上高から自動計算）
    for (const f of formulaAccounts) {
      const vals = months.map((m) => formulaCellValue(f, m));
      out.push({ label: f.account_name, kind: 'normal', values: vals, yearTotal: sumVals(vals) });
    }

    // 販管費計（手入力＋計算式）
    const expTotals = months.map((m) => expenseTotalByMonth(m));
    out.push({ label: '販管費計', kind: 'total', values: expTotals, yearTotal: sumVals(expTotals) });

    // S4：利益行（表示合成・金額のみ。比率はExcelに出さない＝既存通り）。
    // 率0の店舗ではサービス料・社員還付金の行を出さない（画面と整合）。
    // 社員還付金は「引く」項目のため Excel では負数で出力（画面の Δ と整合・列合計が経常利益に一致）。
    const opVals = months.map(operatingProfit);
    out.push({ label: '営業利益', kind: 'emphasis', values: opVals, yearTotal: sumVals(opVals) });
    if (serviceFeeRate > 0) {
      const sfVals = months.map(serviceFee);
      out.push({ label: 'サービス料', kind: 'normal', values: sfVals, yearTotal: sumVals(sfVals) });
    }
    if (employeeRebateRate > 0) {
      const erVals = months.map((m) => {
        const v = employeeRebate(m);
        return v === null ? null : -v; // 引く項目＝負数で出力（Δ表示と整合）
      });
      out.push({ label: '社員還付金', kind: 'normal', values: erVals, yearTotal: sumVals(erVals) });
    }
    const ordVals = months.map(ordinaryProfit);
    out.push({ label: '経常利益', kind: 'emphasis', values: ordVals, yearTotal: sumVals(ordVals) });

    // 営業日数（画面そのまま：days を数値化・無効は空欄。年間計は画面に無いので null）
    const dayVals = months.map((m) => {
      const raw = (days[m.yearMonth] ?? '').trim();
      if (raw === '') return null;
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    });
    out.push({ label: '営業日数', kind: 'input', values: dayVals, yearTotal: null });

    return out;
  };

  const handleExport = () => {
    if (!selectedStoreId) return;
    const store = stores.find((s) => s.id === selectedStoreId);
    const meta: PlExportMeta = {
      storeName: store?.name ?? '',
      fiscalYearLabel: `${fyStartYear}年度`,
      currencyCode: currencyCode || '',
      monthLabels: months.map((m) => `${m.year}/${String(m.month).padStart(2, '0')}`),
      generatedAt: '', // 出力日時はサーバ側で確定（クライアント時計に依存しない）
    };
    setExporting(true);
    startTransition(async () => {
      const result = await exportMonthlyPl({ rows: buildExportRows(), meta });
      setExporting(false);
      if (result.success) {
        downloadBase64Xlsx(result.base64Xlsx, result.filename);
        toast.success('PLをExcelに出力しました');
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="px-5 sm:px-8 py-8 sm:py-10 max-w-[1400px] mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-4" aria-label="パンくず">
        <Link href="/dashboard" className="hover:text-slate-900 transition-colors">
          ホーム
        </Link>
        <Crumb className="w-3 h-3 text-slate-400" />
        <span className="text-slate-900 font-medium">月次PL（損益）</span>
      </nav>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold mb-3">
          <div className="w-8 h-px bg-slate-300" />
          <span>Monthly P/L</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 leading-tight mb-2 flex items-center gap-2.5">
          <BarChart3 className="w-7 h-7 text-slate-700" />
          月次PL（損益計算書）
        </h1>
        <p className="text-sm text-slate-600">
          決算期の12ヶ月を横並び表示します（現地通貨）。売上高は予算ベース予測、売上原価は営業日数ベース予測です。計算できない月は「—」。
        </p>
      </div>

      {/* 店舗・年度セレクタ */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 mb-5">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
          <div className="space-y-1.5">
            <Label htmlFor="pl-store" className="text-xs text-slate-600">
              <StoreIcon className="w-3 h-3 inline mr-1" />
              店舗
            </Label>
            <Select value={selectedStoreId ?? ''} onValueChange={(v) => updateParam('store', v)}>
              <SelectTrigger id="pl-store">
                <SelectValue placeholder="店舗を選択..." />
              </SelectTrigger>
              <SelectContent>
                {stores.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-slate-500">アクセス可能な店舗がありません</div>
                ) : (
                  stores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-slate-600">決算期（年度）</Label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="前年度"
                onClick={() => updateParam('fy', String(fyStartYear - 1))}
                className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-slate-200 hover:bg-slate-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="font-display font-bold text-slate-900 w-32 text-center">
                {fyStartYear}年度
              </div>
              <button
                type="button"
                aria-label="翌年度"
                onClick={() => updateParam('fy', String(fyStartYear + 1))}
                className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-slate-200 hover:bg-slate-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        {/* S6：表示通貨トグル（現地通貨／円・表示のみ・DB保存なし） */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-slate-500">表示通貨：</span>
          <div className="inline-flex rounded-md border border-slate-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowJpy(false)}
              className={cn(
                'px-3 py-1 text-xs transition-colors',
                !jpyMode ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              現地通貨（{currencyCode || '—'}）
            </button>
            <button
              type="button"
              onClick={() => setShowJpy(true)}
              disabled={!hasJpyRate}
              className={cn(
                'px-3 py-1 text-xs border-l border-slate-200 transition-colors',
                jpyMode ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50',
                !hasJpyRate && 'opacity-40 cursor-not-allowed hover:bg-white',
              )}
            >
              円（JPY）
            </button>
          </div>
          {jpyMode && typeof jpyRate === 'number' && (
            <span className="text-[11px] text-indigo-700">
              1 {currencyCode} ＝ {jpyRate.toLocaleString('ja-JP', { maximumFractionDigits: 5 })}円 で換算（最新レート1値・全月共通・参考値）
            </span>
          )}
          {!hasJpyRate && (
            <span className="text-[11px] text-amber-600">
              円換算レート未設定（{currencyCode || '—'}→JPY）。円表示は使えません。
            </span>
          )}
        </div>
      </div>

      {/* 販管費の Excel 入出力（テンプレ出力＋2段階インポート・店長以上） */}
      {selectedStoreId && canEdit && (
        <ExpenseIoPanel
          storeId={selectedStoreId}
          fyStartYear={fyStartYear}
          currencyCode={currencyCode}
        />
      )}

      {/* ツールバー：Excel出力（画面の値をそのまま出力・読み取り専用） */}
      {selectedStoreId && (
        <div className="flex items-center justify-end mb-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exporting || isPending}
            className="gap-1.5"
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Excel出力
          </Button>
        </div>
      )}

      {/* PL表（科目行 × 12ヶ月） */}
      {!selectedStoreId ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 px-5 py-12 text-center text-sm text-slate-500">
          店舗を選択してください
        </div>
      ) : (
        <div
          className="rounded-2xl border border-slate-200 bg-white overflow-x-auto"
          onKeyDown={gridNav.onKeyDown}
        >
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="sticky left-0 z-10 bg-slate-50 text-left px-4 py-2.5 font-semibold text-slate-700 min-w-[140px]">
                  科目（{currencyCode}）
                </th>
                {months.map((m) => (
                  <th
                    key={m.yearMonth}
                    className={cn(
                      'text-right px-3 py-2.5 font-semibold text-slate-600 min-w-[92px] whitespace-nowrap',
                      !m.evaluated && 'text-slate-400',
                    )}
                  >
                    {m.year}/{String(m.month).padStart(2, '0')}
                  </th>
                ))}
                <th className="text-right px-3 py-2.5 font-bold text-slate-700 min-w-[104px] whitespace-nowrap border-l-2 border-slate-200 bg-slate-100/70">
                  年間計
                </th>
              </tr>
            </thead>
            <tbody>
              {/* 営業日数（即時保存→monthly_business_days・原価予測の前提）。表の最上部に配置。
                  別途の「INPUT」見出しは廃し、行ラベルに (1〜31) を併記する。年間計は空欄（合計しない）。 */}
              <tr className="border-b border-slate-200 bg-slate-50/30">
                <td className="sticky left-0 z-10 bg-slate-50/30 px-4 py-2 text-slate-700 whitespace-nowrap">
                  営業日数<span className="text-[10px] text-slate-400 ml-1">(1〜31)</span>
                </td>
                {months.map((m) => (
                  <td key={m.yearMonth} className="px-2 py-1.5 text-right">
                    <input
                      type="number"
                      min={1}
                      max={31}
                      step={1}
                      disabled={!canEdit || (isPending && savingMonth === m.yearMonth)}
                      value={days[m.yearMonth] ?? ''}
                      onChange={(e) =>
                        setDays((prev) => ({ ...prev, [m.yearMonth]: e.target.value }))
                      }
                      onBlur={() => handleSaveDays(m.yearMonth)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      }}
                      placeholder="—"
                      className="w-16 h-7 rounded border border-slate-200 px-1.5 text-right font-num text-xs focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-slate-50 disabled:text-slate-400"
                    />
                  </td>
                ))}
                <td className="border-l-2 border-slate-200 bg-slate-50/30" />
              </tr>

              <PlRow label="売上高" months={months} pick={salesValue} cell={cell} convert={toJpy} toneClass="bg-orange-50" />
              <PlRow label="売上原価" months={months} pick={costValue} cell={cell} convert={toJpy} toneClass="bg-blue-50" />
              <PlRow
                label="売上総利益"
                months={months}
                pick={grossProfit}
                cell={cell}
                emphasize
                convert={toJpy}
                toneClass="bg-green-50"
              />

              {/* 販管費セクション（科目別・即時保存）。見出し行をクリックで折りたたみ／展開（表示のみ） */}
              <tr className="border-t border-slate-200 bg-slate-50/40">
                <td colSpan={months.length + 2} className="sticky left-0 px-4 py-1.5">
                  <button
                    type="button"
                    onClick={() => setExpCollapsed((v) => !v)}
                    aria-expanded={!expCollapsed}
                    className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-slate-500 font-semibold hover:text-slate-800 transition-colors"
                  >
                    {expCollapsed ? (
                      <ChevronRight className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                    販管費（科目別・現地通貨）
                    {expCollapsed && (
                      <span className="ml-1 normal-case tracking-normal text-slate-400">
                        — 折りたたみ中（{rows.length + formulaAccounts.length}科目）
                      </span>
                    )}
                  </button>
                </td>
              </tr>

              {!expCollapsed &&
                rows.map((row, rowIndex) => (
                <tr key={row.key} className="border-b border-slate-100 align-top">
                  <td className="sticky left-0 z-10 bg-white px-2 py-2 min-w-[220px]">
                    <div className="flex items-start gap-1">
                      {/* G：上下矢印を行の左端へ（保存済み科目のみ・端は無効） */}
                      {canEdit && row.savedName && (
                        <div className="flex flex-col shrink-0">
                          <button
                            type="button"
                            aria-label="上へ"
                            disabled={busy || row.key === firstSavedKey}
                            onClick={() => handleMove(row.key, 'up')}
                            className="inline-flex items-center justify-center w-5 h-4 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            aria-label="下へ"
                            disabled={busy || row.key === lastSavedKey}
                            onClick={() => handleMove(row.key, 'down')}
                            className="inline-flex items-center justify-center w-5 h-4 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <Input
                            value={row.accountName}
                            onChange={(e) => patchRow(row.key, { accountName: e.target.value })}
                            onBlur={() => patchRow(row.key, { accountName: row.accountName.trim() })}
                            disabled={!canEdit}
                            placeholder="科目名（自由入力）"
                            maxLength={100}
                            className="h-7 text-xs flex-1"
                          />
                          {/* F：区分の編集ダイアログを開く（区分は表から非表示・E） */}
                          {canEdit && (
                            <button
                              type="button"
                              aria-label="区分を編集"
                              onClick={() => setManualEditKey(row.key)}
                              className="inline-flex items-center justify-center w-6 h-6 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 shrink-0"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canEdit && (
                            <button
                              type="button"
                              aria-label="科目を削除"
                              disabled={busy}
                              onClick={() => handleDeleteClick(row.key)}
                              className="inline-flex items-center justify-center w-6 h-6 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-50 shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        {/* 区分は表内非表示（E・データは保持）。未設定で内容ありのみ注意を促す */}
                        {row.categoryTag === '' && rowHasContent(row) && (
                          <p className="mt-1 text-[10px] text-amber-600">
                            区分が未設定です（鉛筆で編集・未保存）
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  {months.map((m, colIndex) => (
                    <td
                      key={m.yearMonth}
                      className="px-2 py-2 text-right"
                      data-nav-row={rowIndex}
                      data-nav-col={colIndex}
                    >
                      {/* 円表示時は読み取り換算値・現地表示時は入力欄（編集は現地通貨でのみ） */}
                      {jpyMode ? (
                        <span className="font-num text-xs text-slate-800">
                          {cell(toJpy(row.amounts[m.yearMonth] ?? null))}
                        </span>
                      ) : (
                        <AmountInput
                          disabled={!canEdit}
                          placeholder="—"
                          className="w-[84px] h-7 text-right font-num text-xs px-1.5 ml-auto"
                          value={row.amounts[m.yearMonth]}
                          onChange={(v) =>
                            patchRow(row.key, { amounts: { ...row.amounts, [m.yearMonth]: v } })
                          }
                          onBlur={() => saveAmount(row.key, m.yearMonth)}
                        />
                      )}
                      <RatioLabel value={row.amounts[m.yearMonth] ?? null} net={salesValue(m)} />
                    </td>
                  ))}
                  {/* 科目の年間計（各月金額の合計・空欄は0扱い） */}
                  <td className="text-right px-3 py-2 border-l-2 border-slate-200 bg-slate-50/50 font-num text-xs font-semibold">
                    {fmt(toJpy(months.reduce((s, m) => s + (row.amounts[m.yearMonth] ?? 0), 0)) ?? 0)}
                    <RatioLabel
                      value={months.reduce((s, m) => s + (row.amounts[m.yearMonth] ?? 0), 0)}
                      net={salesYearTotal}
                    />
                  </td>
                </tr>
              ))}

              {/* 科目を追加（折りたたみ時は隠す） */}
              {!expCollapsed && canEdit && (
                <tr className="border-b border-slate-100">
                  <td colSpan={months.length + 2} className="sticky left-0 bg-white px-2 py-1.5">
                    <button
                      type="button"
                      onClick={addAccount}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-slate-900"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      科目を追加
                    </button>
                    <button
                      type="button"
                      onClick={() => setBulkOpen(true)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 ml-4"
                      title="固定費などを全月へ同額で一括入力（後で各月を個別に編集できます）"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      全月一括入力
                    </button>
                    <button
                      type="button"
                      onClick={() => setCopyOpen(true)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 ml-4"
                      title="ある月の販管費を、別の月（例：前月）から引き継いで入力します"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      前月を引き継ぐ
                    </button>
                    {busy && <Loader2 className="w-3.5 h-3.5 animate-spin inline ml-2 text-slate-400" />}
                  </td>
                </tr>
              )}

              {/* 計算式の科目（変動費・読み取り専用・売上高から自動計算）。折りたたみ時は隠す */}
              {!expCollapsed && (formulaAccounts.length > 0 || canEdit) && (
                <>
                  {/* D：手入力科目群と計算式科目群の境目（見出しテキストなし・薄い破線で区切る） */}
                  <tr aria-hidden="true">
                    <td colSpan={months.length + 2} className="p-0">
                      <div className="border-t border-dashed border-slate-300 mx-4 my-1" />
                    </td>
                  </tr>
                  {formulaAccounts.map((f) => (
                    <tr key={`fml-${f.account_name}`} className="border-b border-slate-100">
                      {/* 行は科目名（＋並び替え・編集・削除）と各月の金額のみ。計算根拠は表下に脚注表記 */}
                      <td className="sticky left-0 z-10 bg-white px-2 py-2 min-w-[220px]">
                        <div className="flex items-start gap-1">
                          {/* G/F5-4：上下矢印を行の左端へ（手入力科目と同じ見た目・位置・端は無効） */}
                          {canEdit && (
                            <div className="flex flex-col shrink-0">
                              <button
                                type="button"
                                aria-label="上へ"
                                disabled={formulaBusy || f.account_name === firstFormulaName}
                                onClick={() => handleMoveFormula(f.account_name, 'up')}
                                className="inline-flex items-center justify-center w-5 h-4 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                aria-label="下へ"
                                disabled={formulaBusy || f.account_name === lastFormulaName}
                                onClick={() => handleMoveFormula(f.account_name, 'down')}
                                className="inline-flex items-center justify-center w-5 h-4 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-800 whitespace-nowrap">{f.account_name}</span>
                              {canEdit && (
                                <button
                                  type="button"
                                  aria-label="計算式を編集"
                                  onClick={() => openEditFormula(f)}
                                  className="inline-flex items-center justify-center w-5 h-5 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                              )}
                              {canEdit && (
                                <button
                                  type="button"
                                  aria-label="計算式の科目を削除"
                                  disabled={formulaBusy}
                                  onClick={() => setFormulaDeleteTarget(f)}
                                  className="inline-flex items-center justify-center w-5 h-5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      {months.map((m) => (
                        <td key={m.yearMonth} className="px-3 py-2 text-right">
                          {cell(toJpy(formulaCellValue(f, m)))}
                          <RatioLabel value={formulaCellValue(f, m)} net={salesValue(m)} />
                        </td>
                      ))}
                      {/* 計算式科目の年間計（各月の自動計算金額の合計・—は0扱い） */}
                      <td className="text-right px-3 py-2 border-l-2 border-slate-200 bg-slate-50/50 font-num font-semibold">
                        {fmt(toJpy(months.reduce((s, m) => s + (formulaCellValue(f, m) ?? 0), 0)) ?? 0)}
                        <RatioLabel
                          value={months.reduce((s, m) => s + (formulaCellValue(f, m) ?? 0), 0)}
                          net={salesYearTotal}
                        />
                      </td>
                    </tr>
                  ))}
                  {/* 計算式の科目を追加 */}
                  {canEdit && (
                    <tr className="border-b border-slate-100">
                      <td colSpan={months.length + 2} className="sticky left-0 bg-white px-4 py-1.5">
                        <button
                          type="button"
                          onClick={openAddFormula}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-700 hover:text-indigo-900"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          計算式の科目を追加
                        </button>
                      </td>
                    </tr>
                  )}
                </>
              )}

              {/* 販管費計（手入力＋計算式） */}
              <tr className="border-b border-slate-200 bg-purple-50 font-semibold">
                <td className="sticky left-0 z-10 bg-purple-50 px-4 py-2.5 text-slate-800 whitespace-nowrap">
                  販管費計
                </td>
                {months.map((m) => (
                  <td key={m.yearMonth} className="text-right px-3 py-2.5">
                    <span className="font-num">{fmt(toJpy(expenseTotalByMonth(m)) ?? 0)}</span>
                    <RatioLabel value={expenseTotalByMonth(m)} net={salesValue(m)} />
                  </td>
                ))}
                <td className="text-right px-3 py-2.5 border-l-2 border-slate-200 bg-purple-50 font-num font-bold">
                  {fmt(toJpy(months.reduce((s, m) => s + expenseTotalByMonth(m), 0)) ?? 0)}
                  <RatioLabel
                    value={months.reduce((s, m) => s + expenseTotalByMonth(m), 0)}
                    net={salesYearTotal}
                  />
                </td>
              </tr>

              {/* S4：利益行（表示合成・既存の比率/年間計の方針に従う）。
                  営業利益・経常利益は常に表示。サービス料・社員還付金は率0の店舗では非表示。
                  社員還付金は「引く」項目のため Δ 表示（計算は従来どおり引く・表示記号のみ）。 */}
              <PlRow label="営業利益" months={months} pick={operatingProfit} cell={cell} emphasize convert={toJpy} toneClass="bg-orange-50" />
              {serviceFeeRate > 0 && (
                <PlRow label="サービス料" months={months} pick={serviceFee} cell={cell} convert={toJpy} />
              )}
              {employeeRebateRate > 0 && (
                <PlRow label="社員還付金" months={months} pick={employeeRebate} cell={cell} deltaPrefix convert={toJpy} />
              )}
              <PlRow label="経常利益" months={months} pick={ordinaryProfit} cell={cell} emphasize convert={toJpy} toneClass="bg-pink-50" />

              {/* S5：指標（FL比率・FLR比率・EBITDA・客数・客単価）。指標自体が値＝売上高比の小ラベルは付けない */}
              <tr className="border-t-2 border-slate-200 bg-slate-50/40">
                <td
                  colSpan={months.length + 2}
                  className="sticky left-0 px-4 py-1.5 text-[10px] uppercase tracking-widest text-slate-500 font-semibold"
                >
                  指標（参考・現地通貨）
                </td>
              </tr>
              <MetricRow
                label="FL比率"
                months={months}
                valueFor={flRatio}
                yearValue={flYear}
                format={(v) => `${v.toFixed(1)}%`}
              />
              <MetricRow
                label="FLR比率"
                months={months}
                valueFor={flrRatio}
                yearValue={flrYear}
                format={(v) => `${v.toFixed(1)}%`}
              />
              <MetricRow
                label="EBITDA"
                months={months}
                valueFor={ebitda}
                yearValue={ebitdaYear}
                format={fmt}
                convert={toJpy}
                accentClass="text-blue-600"
              />
              <MetricRow
                label="客数"
                months={months}
                valueFor={customerCountOf}
                yearValue={customerYear}
                format={(v) => `${fmt(v)}人`}
              />
              <MetricRow
                label="客単価"
                months={months}
                valueFor={avgPerCustomer}
                yearValue={avgYear}
                format={fmt}
                convert={toJpy}
              />

              {/* 通帳残高（手入力・即時保存→monthly_bank_balances）。現地通貨の参考メモで
                  PL/税計算には使わない。客単価の下に配置。年間計は合計しない（残高はストック値）。 */}
              <tr className="border-t border-slate-100 bg-slate-50/30">
                <td className="sticky left-0 z-10 bg-slate-50/30 px-4 py-2 text-slate-700 whitespace-nowrap">
                  通帳残高<span className="text-[10px] text-slate-400 ml-1">（{currencyCode || '現地通貨'}・手入力）</span>
                </td>
                {months.map((m) => (
                  <td key={m.yearMonth} className="px-2 py-1.5 text-right">
                    <input
                      type="number"
                      step="any"
                      disabled={!canEdit || (isPending && savingBalanceMonth === m.yearMonth)}
                      value={balances[m.yearMonth] ?? ''}
                      onChange={(e) =>
                        setBalances((prev) => ({ ...prev, [m.yearMonth]: e.target.value }))
                      }
                      onBlur={() => handleSaveBalance(m.yearMonth)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      }}
                      placeholder="—"
                      className="w-28 h-7 rounded border border-slate-200 px-1.5 text-right font-num text-xs focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-slate-50 disabled:text-slate-400"
                    />
                  </td>
                ))}
                <td className="border-l-2 border-slate-200 bg-slate-50/30" />
              </tr>

            </tbody>
          </table>
        </div>
      )}

      {/* 推移グラフ（表の数字の下・12ヶ月）。表示のみ＝P/L表と同じ計算値を使用。
          単位が異なるため用途別に3枚（金額／客数・客単価／原価率）。通貨トグルに追従（金額系のみ換算）。 */}
      {selectedStoreId && (
        <PlTrendCharts
          chartData={months.map((m) => {
            const sLocal = salesValue(m); // 原価率は通貨非依存（現地のまま）
            const cLocal = costValue(m);
            const costRate =
              sLocal !== null && sLocal > 0 && cLocal !== null
                ? Math.round((cLocal / sLocal) * 1000) / 10
                : null;
            return {
              label: `${Number(m.yearMonth.slice(5, 7))}月`,
              sales: toJpy(salesValue(m)),
              operating: toJpy(operatingProfit(m)),
              ordinary: toJpy(ordinaryProfit(m)),
              customers: customerCountOf(m),
              avg: toJpy(avgPerCustomer(m)),
              costRate,
            };
          })}
          moneyUnit={jpyMode ? '円' : currencyCode}
        />
      )}

      {/* 計算根拠（計算式の科目の式を文章化・0件のときは非表示） */}
      {selectedStoreId && formulaAccounts.length > 0 && (
        <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/30 px-4 py-3">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-indigo-500 font-semibold mb-2">
            <Sigma className="w-3 h-3" />
            計算式の科目の計算根拠
          </div>
          <ul className="space-y-1 text-xs text-slate-700">
            {formulaAccounts.map((f) => (
              <li key={`rationale-${f.account_name}`} className="flex flex-wrap gap-x-1.5">
                <span className="font-medium text-slate-800">{f.account_name}</span>
                <span className="text-slate-400">＝</span>
                <span className="font-num">{formulaSummary(f)}</span>
                <span className="text-[10px] text-slate-400">（{TAG_LABELS[f.category_tag]}・{CALC_TYPE_LABELS[f.calc_type]}）</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] text-slate-400">
            ※ 計算は各月の売上高（税抜・net）に対して適用されます。率は％表示（保存は小数）。
          </p>
        </div>
      )}

      <div className="mt-4 px-1 text-[11px] leading-relaxed text-slate-500 space-y-1">
        <p>· 「—」は計算不可（予算未入力・営業日数未入力・経過営業日数0 等）または未来月（評価対象外）です。</p>
        <p>· 営業日数を入力すると即時保存され、その月の売上原価（仕入累計÷経過営業日数×当月営業日数）が再計算されます。</p>
        <p>· 売上総利益は売上高・売上原価の両方が算出できた月のみ表示します。</p>
        <p>· 販管費は「科目を追加」→科目名（自由）・区分（人件費/家賃/減価償却/その他）を入れ、各月の金額を入力すると即時保存されます。</p>
        <p>· 科目名を変更したあとに金額を保存すると新しい科目名で保存されます（旧名の行が残る場合は科目削除で整理してください）。</p>
        <p>· 科目名・分類・金額が揃うまでは保存されませんが、入力途中の行は画面に保持されます（金額が空でも消えません）。</p>
        <p>· 「販管費（科目別…）」の見出し（▼/▶）をクリックすると、各科目を折りたたんで「販管費計」だけ表示できます（表示の切替のみ・データは変わりません）。</p>
        <p>· 「Excel出力」は、いま画面に表示されている値（12ヶ月＋年間計）をそのまま .xlsx に書き出します（読み取り専用・計算不可の月は空欄・現地通貨）。</p>
        <p>· 「計算式の科目（変動費）」は、その月の売上高（net）から自動計算する読み取り専用の科目です（販管費計に加算。売上が「—」の月はその科目も「—」で加算しません）。式の追加・編集・削除は次の段階で実装します。</p>
        {canEdit && (
          <p>· 「販管費の入出力（Excel）」から、テンプレートを出力 → 記入 → プレビュー → 取り込み（UPSERT）ができます。空欄の月は取り込まれません（既存は変更なし）。</p>
        )}
        <p>· 指標：FL比率＝(売上原価＋人件費)÷売上高、FLR比率＝(売上原価＋人件費＋家賃)÷売上高、EBITDA＝経常利益＋減価償却。客数・客単価は daily_sales の実績（当月は今日まで）。客数0の月の客単価は「—」。年間計は FL/FLR・客単価は年間ベース、EBITDA・客数は合計です。</p>
        <p>· 通帳残高：手入力の参考メモ（現地通貨{currencyCode ? `・${currencyCode}` : ''}）。各月で月末などの銀行残高を記録できます。PL・税計算には使わず、円表示トグルでも換算しません（常に現地通貨）。空欄のままにすると保存されません。</p>
        {!canEdit && <p>· 閲覧のみ（営業日数・販管費の編集権限がありません）。</p>}
      </div>

      {/* 科目削除の確認ダイアログ（物理削除＝復元不可のため確認必須） */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold mb-1">
              Delete Expense Account
            </div>
            <DialogTitle className="font-display text-xl font-bold">販管費科目を削除</DialogTitle>
            <DialogDescription>
              この科目の当年度（12ヶ月分）の販管費データを完全に削除します。元に戻せません。
            </DialogDescription>
          </DialogHeader>

          {deleteTarget && (
            <div className="py-2">
              <div className="text-xs text-slate-500 mb-1">削除対象の科目</div>
              <div className="font-display text-lg font-bold text-slate-900">
                {deleteTarget.savedName ?? deleteTarget.accountName.trim() ?? ''}
                {!deleteTarget.savedName && (
                  <span className="text-xs font-normal text-slate-400 ml-2">（未保存の行）</span>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={busy}>
              キャンセル
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={busy}>
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              削除する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 計算式の追加・編集ダイアログ（保存は upsertExpenseFormula・成功で refresh） */}
      {selectedStoreId && (
        <FormulaDialog
          open={formulaDialogOpen}
          onOpenChange={setFormulaDialogOpen}
          storeId={selectedStoreId}
          initial={formulaEditTarget}
          onSaved={() => router.refresh()}
        />
      )}

      {/* 手入力科目の編集ダイアログ（区分のみ・保存は既存 handleTagChange→upsertMonthlyExpense） */}
      {(() => {
        const target = manualEditKey ? rows.find((r) => r.key === manualEditKey) : null;
        return (
          <ExpenseEditDialog
            open={target !== null && target !== undefined}
            onOpenChange={(o) => {
              if (!o) setManualEditKey(null);
            }}
            accountName={target?.accountName ?? ''}
            initialTag={target?.categoryTag ?? ''}
            onSave={(tag) => {
              if (target) handleTagChange(target.key, tag);
            }}
          />
        );
      })()}

      {/* 計算式科目の削除確認ダイアログ（物理削除＝復元不可のため確認必須） */}
      <Dialog
        open={formulaDeleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !formulaBusy) setFormulaDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold mb-1">
              Delete Formula Account
            </div>
            <DialogTitle className="font-display text-xl font-bold">計算式の科目を削除</DialogTitle>
            <DialogDescription>
              この計算式の科目を削除します。元に戻せません（販管費計からも外れます）。
            </DialogDescription>
          </DialogHeader>

          {formulaDeleteTarget && (
            <div className="py-2">
              <div className="text-xs text-slate-500 mb-1">削除対象の科目</div>
              <div className="font-display text-lg font-bold text-slate-900">
                {formulaDeleteTarget.account_name}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {TAG_LABELS[formulaDeleteTarget.category_tag]}・{formulaSummary(formulaDeleteTarget)}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setFormulaDeleteTarget(null)}
              disabled={formulaBusy}
            >
              キャンセル
            </Button>
            <Button variant="destructive" onClick={confirmDeleteFormula} disabled={formulaBusy}>
              {formulaBusy && <Loader2 className="w-4 h-4 animate-spin" />}
              削除する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 全月一括入力（#6 A案） */}
      <Dialog
        open={bulkOpen}
        onOpenChange={(o) => {
          if (!o && bulkBusy) return;
          setBulkOpen(o);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold">全月へ一括入力</DialogTitle>
            <DialogDescription>
              科目を当年度の全月（{months.length}ヶ月）に同額で入力します。固定費（給与・家賃など）に便利です。
              入力後は各月のセルを個別に上書き編集できます（途中月の変動に対応）。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="bulk-name">科目名</Label>
              <Input
                id="bulk-name"
                value={bulkName}
                onChange={(e) => setBulkName(e.target.value)}
                placeholder="例：社員給与"
                maxLength={100}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bulk-tag">区分</Label>
              <select
                id="bulk-tag"
                value={bulkTag}
                onChange={(e) => setBulkTag(e.target.value as CategoryTag)}
                className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 outline-none"
              >
                {CATEGORY_TAGS.map((t) => (
                  <option key={t} value={t}>
                    {TAG_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bulk-amount">金額（各月とも同額・現地通貨）</Label>
              <AmountInput
                id="bulk-amount"
                value={bulkAmount}
                onChange={setBulkAmount}
                placeholder="0"
                className="font-num text-right"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setBulkOpen(false)} disabled={bulkBusy}>
              キャンセル
            </Button>
            <Button onClick={handleBulkFill} disabled={bulkBusy}>
              {bulkBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              全月に入力
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 前月引き継ぎ（販管費を別の月からコピー） */}
      <Dialog
        open={copyOpen}
        onOpenChange={(o) => {
          if (!o && copyBusy) return;
          setCopyOpen(o);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold">販管費を引き継ぐ</DialogTitle>
            <DialogDescription>
              「コピー元の月」の販管費（手入力科目）を「コピー先の月」へ引き継ぎます（科目名・区分・金額をそのままコピー）。
              計算式の科目は対象外（自動計算のまま）。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="copy-from">コピー元の月（引き継ぎ元）</Label>
              <select
                id="copy-from"
                value={copyFromIdx}
                onChange={(e) => setCopyFromIdx(Number(e.target.value))}
                className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 outline-none"
              >
                {months.map((m, i) => (
                  <option key={m.yearMonth} value={i}>
                    {m.yearMonth.replace('-', '/')}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="copy-to">コピー先の月（入力する月）</Label>
              <select
                id="copy-to"
                value={copyToIdx}
                onChange={(e) => setCopyToIdx(Number(e.target.value))}
                className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 outline-none"
              >
                {months.map((m, i) => (
                  <option key={m.yearMonth} value={i}>
                    {m.yearMonth.replace('-', '/')}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[11px] text-amber-600">
              ※ コピー先の同名科目は上書きされます。コピー先にしか無い科目は残ります。
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCopyOpen(false)} disabled={copyBusy}>
              キャンセル
            </Button>
            <Button onClick={handleCopyExpenses} disabled={copyBusy || copyFromIdx === copyToIdx}>
              {copyBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
              引き継ぐ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PlRow({
  label,
  months,
  pick,
  cell,
  emphasize,
  deltaPrefix,
  convert,
  toneClass,
}: {
  label: string;
  months: PlMonth[];
  pick: (m: PlMonth) => number | null;
  cell: (v: number | null) => React.ReactNode;
  emphasize?: boolean;
  /** 社員還付金など「引く」項目に Δ を付けて表示（表示記号のみ・計算は不変） */
  deltaPrefix?: boolean;
  /** 表示値の換算（S6・円表示時のみ。比率は現地ベースで不変＝レートが相殺するため） */
  convert?: (v: number | null) => number | null;
  /** 行の背景色（Tailwind bg クラス）。指定時は強調の灰背景に優先して適用（表示のみ） */
  toneClass?: string;
}) {
  // 年間計：各月の値を合計（— は 0 扱い・値がある月だけ加算）。常に表示。
  const yearTotal = months.reduce((sum, m) => sum + (pick(m) ?? 0), 0);
  // 売上高比率の分母（年間）。表示専用。
  const salesYearTotal = months.reduce((sum, m) => sum + (salesValue(m) ?? 0), 0);
  const disp = (v: number | null) => (convert ? convert(v) : v);
  // Δ表示：— はそのまま、数値は「Δ◯」で表示（cell の通常表示を置き換える）。表示値は換算後。
  const renderCell = (v: number | null) => {
    const d = disp(v);
    if (!deltaPrefix || d === null) return cell(d);
    return <span className="font-num">Δ{fmt(d)}</span>;
  };
  const prefix = deltaPrefix ? 'Δ' : undefined;
  const yearDisp = disp(yearTotal) ?? 0;
  // 背景：toneClass 指定時はそれを優先。未指定時は従来（emphasize=灰／通常=白）。
  const rowBg = toneClass ?? (emphasize ? 'bg-slate-50/60' : '');
  const labelBg = toneClass ?? (emphasize ? 'bg-slate-50/60' : 'bg-white');
  const yearBg = toneClass ?? 'bg-slate-50/50';
  // 色付き行（toneClass）または強調行は、文字・数字を太字で強調（font-weight は子セルに継承）。
  const strong = emphasize || !!toneClass;
  return (
    <tr className={cn('border-b border-slate-100', strong && 'font-semibold', rowBg)}>
      <td
        className={cn(
          'sticky left-0 z-10 px-4 py-2.5 whitespace-nowrap',
          strong ? 'font-semibold text-slate-900' : 'text-slate-800',
          labelBg,
        )}
      >
        {label}
      </td>
      {months.map((m) => (
        <td key={m.yearMonth} className="text-right px-3 py-2.5">
          {renderCell(pick(m))}
          {/* 比率は現地ベース（レートが分子分母で相殺するため換算しても同値） */}
          <RatioLabel value={pick(m)} net={salesValue(m)} prefix={prefix} />
        </td>
      ))}
      <td
        className={cn(
          'text-right px-3 py-2.5 border-l-2 border-slate-200 font-num font-semibold',
          yearBg,
        )}
      >
        {deltaPrefix ? `Δ${fmt(yearDisp)}` : fmt(yearDisp)}
        <RatioLabel value={yearTotal} net={salesYearTotal} prefix={prefix} />
      </td>
    </tr>
  );
}

/** S5 指標の行（値そのものを表示。単位は format で出し分け。売上高比率の小ラベルは付けない）。
 *  年間計は呼び出し側で算出した yearValue を表示（FL/FLR は年間ベース等）。 */
function MetricRow({
  label,
  months,
  valueFor,
  yearValue,
  format,
  convert,
  accentClass,
}: {
  label: string;
  months: PlMonth[];
  valueFor: (m: PlMonth) => number | null;
  yearValue: number | null;
  format: (v: number) => string;
  /** 金額系指標（EBITDA・客単価）のみ円換算。％・人数は渡さない */
  convert?: (v: number | null) => number | null;
  /** ラベル・数値の文字色（Tailwind text クラス。例 EBITDA を青く）。表示のみ */
  accentClass?: string;
}) {
  const disp = (v: number | null) => (convert ? convert(v) : v);
  const renderVal = (v: number | null) => {
    const d = disp(v);
    return d === null ? (
      <span className="text-slate-300">{DASH}</span>
    ) : (
      <span className={cn('font-num', accentClass)}>{format(d)}</span>
    );
  };
  return (
    <tr className="border-b border-slate-100">
      <td className={cn('sticky left-0 z-10 bg-white px-4 py-2 whitespace-nowrap', accentClass ?? 'text-slate-700')}>{label}</td>
      {months.map((m) => (
        <td key={m.yearMonth} className="text-right px-3 py-2">
          {renderVal(valueFor(m))}
        </td>
      ))}
      <td className="text-right px-3 py-2 border-l-2 border-slate-200 bg-slate-50/50 font-num font-semibold">
        {renderVal(yearValue)}
      </td>
    </tr>
  );
}

/** 月次P/L の推移グラフ（表の下・12ヶ月）。値は P/L 表と同じ計算結果（表示のみ）。 */
type PlChartPoint = {
  label: string;
  sales: number | null;
  operating: number | null;
  ordinary: number | null;
  customers: number | null;
  avg: number | null;
  costRate: number | null;
};

function PlTrendCharts({ chartData, moneyUnit }: { chartData: PlChartPoint[]; moneyUnit: string }) {
  const tick = { fontSize: 11, fill: '#64748b' } as const;
  const compact = (v: number): string =>
    Math.abs(v) >= 10000
      ? Number(v).toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 })
      : Number(v).toLocaleString('ja-JP');
  const money = (v: number): string => `${Number(v).toLocaleString('ja-JP')} ${moneyUnit}`;
  const sectionCls = 'rounded-2xl border border-slate-200 bg-white p-4';
  const titleCls = 'text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2';

  return (
    <section className="mt-8">
      <h2 className="font-display text-lg font-bold text-slate-900 mb-3">推移グラフ（12ヶ月）</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* 1. 売上高・利益（金額） */}
        <div className={sectionCls}>
          <div className={titleCls}>売上高・利益（{moneyUnit}）</div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={tick} />
                <YAxis tick={tick} width={48} tickFormatter={(v) => compact(Number(v))} />
                <Tooltip formatter={(v) => money(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="sales" name="売上高" fill="#4f46e5" radius={[3, 3, 0, 0]} maxBarSize={26} />
                <Line dataKey="operating" name="営業利益" stroke="#f59e0b" strokeWidth={2} dot={false} connectNulls={false} />
                <Line dataKey="ordinary" name="経常利益" stroke="#ec4899" strokeWidth={2} dot={false} connectNulls={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. 客数・客単価（2軸） */}
        <div className={sectionCls}>
          <div className={titleCls}>客数（人）・客単価（{moneyUnit}）</div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={tick} />
                <YAxis yAxisId="cust" tick={tick} width={40} />
                <YAxis yAxisId="avg" orientation="right" tick={tick} width={48} tickFormatter={(v) => compact(Number(v))} />
                <Tooltip
                  formatter={(v, name) =>
                    name === '客単価' ? money(Number(v)) : `${Number(v).toLocaleString('ja-JP')} 人`
                  }
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="cust" dataKey="customers" name="客数" fill="#94a3b8" radius={[3, 3, 0, 0]} maxBarSize={26} />
                <Line yAxisId="avg" dataKey="avg" name="客単価" stroke="#4f46e5" strokeWidth={2} dot={false} connectNulls={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3. 原価率（％・通貨非依存） */}
        <div className={sectionCls}>
          <div className={titleCls}>原価率（%・売上原価÷売上高）</div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={tick} />
                <YAxis tick={tick} width={44} tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} />
                <Line dataKey="costRate" name="原価率" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 2 }} connectNulls={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  );
}
