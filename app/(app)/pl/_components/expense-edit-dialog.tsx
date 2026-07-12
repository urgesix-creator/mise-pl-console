'use client';

// ====================================================================
// 月次PL 手入力販管費科目の編集ダイアログ（区分タグの編集）
//
//   - 表から区分タグのドロップダウンを外したため、区分の設定/変更をここで行う。
//   - 科目名は読み取り専用（account_name は UNIQUE キーの一部。クリーンなリネームは
//     新Action/DELETE が要るため今回は対象外。表内の科目名入力は従来どおり）。
//   - 保存は呼び出し側の handleTagChange（既存 upsertMonthlyExpense を使う）に委譲する。
//     新しい Action・DB変更はしない。
// ====================================================================

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CATEGORY_TAGS, TAG_LABELS, type CategoryTag } from '../_lib/expense-constants';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 編集対象の科目名（読み取り専用表示） */
  accountName: string;
  /** 現在の区分（未設定は ''） */
  initialTag: CategoryTag | '';
  /** 区分を保存（呼び出し側で handleTagChange を呼ぶ） */
  onSave: (tag: CategoryTag) => void;
};

export function ExpenseEditDialog({ open, onOpenChange, accountName, initialTag, onSave }: Props) {
  const [tag, setTag] = useState<CategoryTag | ''>('');

  useEffect(() => {
    if (open) setTag(initialTag);
  }, [open, initialTag]);

  const handleSave = () => {
    if (tag === '') {
      toast.error('区分を選択してください');
      return;
    }
    onSave(tag);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold mb-1">
            Edit Expense Account
          </div>
          <DialogTitle className="font-display text-xl font-bold">販管費科目を編集</DialogTitle>
          <DialogDescription>区分（人件費／家賃／減価償却／その他）を設定します。</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-600">科目名</Label>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
              {accountName.trim() || <span className="text-slate-400">（未入力）</span>}
            </div>
            <p className="text-[10px] text-slate-400">
              科目名の変更は表内の科目名欄で行います（このダイアログでは区分のみ）。
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-slate-600">区分</Label>
            <Select value={tag || undefined} onValueChange={(v) => setTag(v as CategoryTag)}>
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
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>キャンセル</Button>
          <Button onClick={handleSave}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
