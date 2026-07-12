'use client';

// ====================================================================
// 月次PL 変動費の計算式 編集ダイアログ（追加・編集）
//
//   - calc_type（一律％/段階制/固定額/固定額＋％）を選び、タイプ別パラメータを入力。
//   - 率は％で入力（例 3.5）→ 保存時に小数へ変換（3.5% → 0.035）。編集時は小数→％で表示。
//   - 保存は upsertExpenseFormula（F4・"use server"）を呼ぶだけ（F4は変更しない）。
//   - 定数・型は formula-constants.ts（非 "use server"）から使用。
//   - DELETE はしない（追加・編集のみ。削除は F5-3）。
// ====================================================================

import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
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
import { CATEGORY_TAGS, TAG_LABELS, type CategoryTag } from '../_lib/expense-constants';
import { CALC_TYPES, CALC_TYPE_LABELS, type CalcType } from '../_lib/formula-constants';
import { upsertExpenseFormula } from '../_lib/formula-actions';
import { calcExpenseFromFormula } from '../_lib/expense-formula';

/** ダイアログの初期値（編集時。新規は null） */
export type FormulaDialogInitial = {
  account_name: string;
  category_tag: CategoryTag;
  calc_type: CalcType;
  rate1: number | null;
  rate2: number | null;
  threshold: number | null;
  fixed_amount: number | null;
} | null;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  initial: FormulaDialogInitial;
  /** 保存成功時（呼び出し側で router.refresh 等） */
  onSaved: () => void;
};

const SAMPLE_NET = 1_000_000;

function fmt(n: number): string {
  return Math.round(n).toLocaleString('ja-JP');
}

/** 小数（rate）→ ％表示文字列（0.035 → '3.5'）。null は空 */
function rateToPctStr(r: number | null): string {
  if (r === null) return '';
  return String(Number((r * 100).toFixed(3)));
}
/** ％文字列 → 小数（'3.5' → 0.035）。NUMERIC(8,5) に合わせ小数5桁に丸める */
function pctStrToRate(s: string): number | null {
  const t = s.trim();
  if (t === '') return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return Number((n / 100).toFixed(5));
}
/** 金額文字列 → 数値（カンマ許容）。空・不正は null */
function amountStrToNumber(s: string): number | null {
  const t = s.replace(/[,\s]/g, '');
  if (t === '') return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return n;
}

export function FormulaDialog({ open, onOpenChange, storeId, initial, onSaved }: Props) {
  const [accountName, setAccountName] = useState('');
  const [categoryTag, setCategoryTag] = useState<CategoryTag | ''>('');
  const [calcType, setCalcType] = useState<CalcType | ''>('');
  const [rate1Pct, setRate1Pct] = useState('');
  const [rate2Pct, setRate2Pct] = useState('');
  const [thresholdStr, setThresholdStr] = useState('');
  const [fixedStr, setFixedStr] = useState('');
  const [isPending, startTransition] = useTransition();

  // 開いたとき・対象が変わったときに初期化（編集時は小数→％へ戻す）
  useEffect(() => {
    if (!open) return;
    if (initial) {
      setAccountName(initial.account_name);
      setCategoryTag(initial.category_tag);
      setCalcType(initial.calc_type);
      setRate1Pct(rateToPctStr(initial.rate1));
      setRate2Pct(rateToPctStr(initial.rate2));
      setThresholdStr(initial.threshold === null ? '' : String(initial.threshold));
      setFixedStr(initial.fixed_amount === null ? '' : String(initial.fixed_amount));
    } else {
      setAccountName('');
      setCategoryTag('');
      setCalcType('');
      setRate1Pct('');
      setRate2Pct('');
      setThresholdStr('');
      setFixedStr('');
    }
  }, [open, initial]);

  const isEdit = initial !== null;
  const needsRate1 = calcType === 'percent' || calcType === 'tiered' || calcType === 'fixed_plus_percent';
  const needsRate2 = calcType === 'tiered';
  const needsThreshold = calcType === 'tiered';
  const needsFixed = calcType === 'fixed' || calcType === 'fixed_plus_percent';

  // プレビュー用の計算式（小数）。サンプル売上での金額を表示
  const previewFormula =
    calcType === ''
      ? null
      : {
          calc_type: calcType,
          rate1: pctStrToRate(rate1Pct),
          rate2: pctStrToRate(rate2Pct),
          threshold: amountStrToNumber(thresholdStr),
          fixed_amount: amountStrToNumber(fixedStr),
        };
  const previewValue = previewFormula ? calcExpenseFromFormula(previewFormula, SAMPLE_NET) : null;

  /** 入力検証（F4サーバ側と同じ条件をクライアントでも一次チェック） */
  function validate(): string | null {
    if (accountName.trim() === '') return '科目名を入力してください';
    if (accountName.trim().length > 100) return '科目名は100文字以内で入力してください';
    if (categoryTag === '') return '区分を選択してください';
    if (calcType === '') return '計算タイプを選択してください';

    if (needsRate1) {
      const r = pctStrToRate(rate1Pct);
      if (r === null) return '率（％）を入力してください';
      if (r < 0 || r > 1) return '率は0〜100％で入力してください';
    }
    if (needsRate2) {
      const r = pctStrToRate(rate2Pct);
      if (r === null) return '2段階目の率（％）を入力してください';
      if (r < 0 || r > 1) return '率は0〜100％で入力してください';
    }
    if (needsThreshold) {
      const t = amountStrToNumber(thresholdStr);
      if (t === null) return '境目の金額を入力してください';
      if (t < 0) return '境目の金額は0以上で入力してください';
    }
    if (needsFixed) {
      const f = amountStrToNumber(fixedStr);
      if (f === null) return '固定額を入力してください';
      if (f < 0) return '固定額は0以上で入力してください';
    }
    return null;
  }

  const handleSave = () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    // 上の validate で calcType/categoryTag は確定済み
    const ct = calcType as CalcType;
    startTransition(async () => {
      const result = await upsertExpenseFormula({
        store_id: storeId,
        account_name: accountName.trim(),
        category_tag: categoryTag as CategoryTag,
        calc_type: ct,
        rate1: needsRate1 ? pctStrToRate(rate1Pct) : null,
        rate2: needsRate2 ? pctStrToRate(rate2Pct) : null,
        threshold: needsThreshold ? amountStrToNumber(thresholdStr) : null,
        fixed_amount: needsFixed ? amountStrToNumber(fixedStr) : null,
      });
      if (result.success) {
        toast.success(isEdit ? '計算式を更新しました' : '計算式の科目を追加しました');
        onOpenChange(false);
        onSaved();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && isPending) return; // 保存中は閉じない
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold mb-1">
            Variable Cost Formula
          </div>
          <DialogTitle className="font-display text-xl font-bold">
            {isEdit ? '計算式を編集' : '計算式の科目を追加'}
          </DialogTitle>
          <DialogDescription>
            売上高（税抜・net）から自動計算する変動費の科目です。率は％で入力します（例：3.5）。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {/* 科目名 */}
          <div className="space-y-1.5">
            <Label htmlFor="fml-name" className="text-xs text-slate-600">科目名</Label>
            <Input
              id="fml-name"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="例：FCロイヤリティ"
              maxLength={100}
              className="h-8 text-sm"
            />
            {isEdit && (
              <p className="text-[10px] text-slate-400">
                科目名を変えると別科目として保存されます（旧名は残ります）。
              </p>
            )}
          </div>

          {/* 区分 */}
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-600">区分</Label>
            <Select value={categoryTag || undefined} onValueChange={(v) => setCategoryTag(v as CategoryTag)}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="区分を選択..." />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_TAGS.map((t) => (
                  <SelectItem key={t} value={t} className="text-sm">{TAG_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 計算タイプ */}
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-600">計算タイプ</Label>
            <Select value={calcType || undefined} onValueChange={(v) => setCalcType(v as CalcType)}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="計算タイプを選択..." />
              </SelectTrigger>
              <SelectContent>
                {CALC_TYPES.map((t) => (
                  <SelectItem key={t} value={t} className="text-sm">{CALC_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* タイプ別パラメータ */}
          {needsFixed && (
            <div className="space-y-1.5">
              <Label htmlFor="fml-fixed" className="text-xs text-slate-600">固定額（現地通貨）</Label>
              <Input
                id="fml-fixed"
                value={fixedStr}
                onChange={(e) => setFixedStr(e.target.value)}
                inputMode="decimal"
                placeholder="例：120000"
                className="h-8 text-sm text-right font-num"
              />
            </div>
          )}
          {needsThreshold && (
            <div className="space-y-1.5">
              <Label htmlFor="fml-th" className="text-xs text-slate-600">境目の金額（これ以下は1段階目の率）</Label>
              <Input
                id="fml-th"
                value={thresholdStr}
                onChange={(e) => setThresholdStr(e.target.value)}
                inputMode="decimal"
                placeholder="例：1000000"
                className="h-8 text-sm text-right font-num"
              />
            </div>
          )}
          {needsRate1 && (
            <div className="space-y-1.5">
              <Label htmlFor="fml-r1" className="text-xs text-slate-600">
                {needsRate2 ? '率（％・1段階目）' : '率（％）'}
              </Label>
              <div className="flex items-center gap-1.5">
                <Input
                  id="fml-r1"
                  value={rate1Pct}
                  onChange={(e) => setRate1Pct(e.target.value)}
                  inputMode="decimal"
                  placeholder="例：3.5"
                  className="h-8 text-sm text-right font-num"
                />
                <span className="text-sm text-slate-500">％</span>
              </div>
            </div>
          )}
          {needsRate2 && (
            <div className="space-y-1.5">
              <Label htmlFor="fml-r2" className="text-xs text-slate-600">率（％・2段階目／境目超過分）</Label>
              <div className="flex items-center gap-1.5">
                <Input
                  id="fml-r2"
                  value={rate2Pct}
                  onChange={(e) => setRate2Pct(e.target.value)}
                  inputMode="decimal"
                  placeholder="例：3"
                  className="h-8 text-sm text-right font-num"
                />
                <span className="text-sm text-slate-500">％</span>
              </div>
            </div>
          )}

          {/* プレビュー（サンプル売上での金額） */}
          {calcType !== '' && (
            <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs">
              <span className="text-slate-500">プレビュー（売上 {fmt(SAMPLE_NET)} のとき）：</span>
              <span className="ml-1.5 font-num font-semibold text-slate-800">
                {previewValue === null ? '—（入力を確認）' : fmt(previewValue)}
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            キャンセル
          </Button>
          <Button onClick={handleSave} disabled={isPending} className="gap-1.5">
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? '更新する' : '追加する'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
