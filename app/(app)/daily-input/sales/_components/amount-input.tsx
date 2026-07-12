'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';

/**
 * 金額入力欄（3桁ごとのカンマ表示）。
 *
 * - 画面表示は 3桁区切りのカンマ付き（例：100,000）。入力中もリアルタイムにカンマが付く。
 * - 外部（react-hook-form）が保持する値・送信する値は **数値**（例：100000）。表示だけを整形する。
 * - 計算・保存・バリデーションには関与しない（数値を素直に上流へ渡すだけ）。
 *
 * 客数など「カンマ不要の数値」には使わない（金額欄専用）。
 */

type AmountInputProps = {
  /** react-hook-form フィールドの現在値（数値）。未入力は undefined */
  value: number | undefined;
  /** 数値（またはクリア時 undefined）を上流へ通知 */
  onChange: (value: number | undefined) => void;
  onBlur?: () => void;
  id?: string;
  name?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  'aria-invalid'?: boolean;
};

/** カンマ・余分な文字を除いて数値化（未入力／不正は undefined） */
function parseAmount(display: string): number | undefined {
  const cleaned = display.replace(/,/g, '');
  if (cleaned === '' || cleaned === '.') return undefined;
  const n = Number(cleaned);
  return Number.isNaN(n) ? undefined : n;
}

/** 数値を undefined/NaN を吸収して正規化 */
function normalize(value: number | undefined): number | undefined {
  return value === undefined || Number.isNaN(value) ? undefined : value;
}

/**
 * 入力中の文字列に 3桁区切りのカンマを付与する（小数・途中入力の末尾ドットを保持）。
 * 数値ではなく「入力途中の文字列」を整形するため Intl ではなく自前で処理する。
 */
function formatDisplay(raw: string): string {
  if (raw === '') return '';
  // 数字とドットのみ残し、ドットは最初の1つだけ有効にする
  let s = raw.replace(/[^0-9.]/g, '');
  const firstDot = s.indexOf('.');
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '');
  }
  const hasDot = s.includes('.');
  const [intPart, decPart = ''] = s.split('.');
  // 先頭の余分なゼロを除去（"007" → "7"、"0" は維持）
  const intClean = intPart.replace(/^0+(?=\d)/, '');
  const intFmt = (intClean === '' ? '0' : intClean).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return hasDot ? `${intFmt}.${decPart}` : intFmt;
}

/** 数値 → カンマ付き表示文字列（フォーム reset 等の外部更新用） */
function displayFromValue(value: number | undefined): string {
  const v = normalize(value);
  return v === undefined ? '' : formatDisplay(String(v));
}

/** カンマ付き文字列内で、左から数えて n 桁目の数字の直後のインデックスを返す（キャレット復元用） */
function caretAfterNDigits(formatted: string, n: number): number {
  if (n <= 0) return 0;
  let digits = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (formatted[i] >= '0' && formatted[i] <= '9') {
      digits += 1;
      if (digits === n) return i + 1;
    }
  }
  return formatted.length;
}

export function AmountInput({
  value,
  onChange,
  onBlur,
  ...rest
}: AmountInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [display, setDisplay] = useState<string>(() => displayFromValue(value));
  // 整形後に復元すべきキャレット情報（数字基準）を一時保持
  const pendingCaret = useRef<{ formatted: string; digits: number } | null>(null);
  // 入力欄がフォーカス中（ユーザー編集中）かどうか。
  const focusedRef = useRef(false);

  // 外部（フォーム reset・店舗/日付切替で既存レコード読込・店休0クリア 等）で値が変わったら表示を同期。
  // ただし【編集中（フォーカス中）は同期しない】。
  //   理由：バックスペース連打などで自分が onChange した最新値が prop に届くのは1テンポ遅れるため、
  //   その遅延した古い value で表示を上書きすると「消している途中で前の数字（例:10000）が復活」する。
  //   フォーカスが外れている＝外部由来の変更だけを表示へ反映する。
  useEffect(() => {
    if (focusedRef.current) return;
    setDisplay(displayFromValue(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // 整形でカンマ位置がずれてもキャレットを「数字基準」で元の位置に戻す
  useLayoutEffect(() => {
    if (pendingCaret.current && inputRef.current) {
      const { formatted, digits } = pendingCaret.current;
      const pos = caretAfterNDigits(formatted, digits);
      inputRef.current.setSelectionRange(pos, pos);
      pendingCaret.current = null;
    }
  });

  // 入力文字列 raw（カンマ込み可）とキャレット位置から、整形・キャレット復元・上流通知をまとめて行う。
  const applyRaw = (raw: string, caretInRaw: number) => {
    // キャレットより左にある「数字の個数」を記録（カンマ・ドットは数えない）＝復元の基準
    const digitsBeforeCaret = (raw.slice(0, caretInRaw).match(/[0-9]/g) ?? []).length;
    const formatted = formatDisplay(raw);
    setDisplay(formatted);
    // 整数部が "0" だけになった場合はキャレットを 0 の直後に置く
    //（先頭に固定されると「0」をバックスペースで消せず張り付くため）。
    const targetDigits = formatted === '0' ? 1 : digitsBeforeCaret;
    pendingCaret.current = { formatted, digits: targetDigits };
    // 空欄は undefined ではなく 0 を通知する。
    //   undefined を渡すと react-hook-form が field.value を「読み込んだ元の保存値」に
    //   戻すため、消した直後に古い数字（保存値）が復活してしまう。0 を渡せば実値となり
    //   復活しない（金額欄なので空＝0 として扱って差し支えない）。表示は編集中は空欄のまま。
    const parsed = parseAmount(formatted);
    onChange(parsed === undefined ? 0 : parsed);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    applyRaw(el.value, el.selectionStart ?? el.value.length);
  };

  // キャレットがカンマの直後にある状態でのバックスペースは、カンマではなく
  // その左の「数字」を消す（カンマだけ消えて再付与され、削除が進まないのを防ぐ）。
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Backspace') return;
    const el = e.currentTarget;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    if (start === null || end === null || start !== end || start <= 0) return;
    if (display[start - 1] !== ',') return;
    const delIdx = start - 2; // カンマの左の数字
    if (delIdx < 0) return;
    e.preventDefault();
    applyRaw(display.slice(0, delIdx) + display.slice(delIdx + 1), delIdx);
  };

  const handleFocus = () => {
    focusedRef.current = true;
  };

  const handleBlur = () => {
    focusedRef.current = false;
    // 確定時は「現在の表示」を正規化する（外部 value は参照しない）。
    //   任意項目（総売上）は空にすると react-hook-form が field.value を
    //   「読み込んだ元の値」に戻すため、value から復元すると古い数字が復活してしまう。
    //   空欄のまま離れたら 0 として確定（onChange(0)）し、古い値の復活を断つ。
    const n = parseAmount(display);
    if (n === undefined) {
      setDisplay('0');
      onChange(0);
    } else {
      setDisplay(formatDisplay(String(n)));
    }
    onBlur?.();
  };

  return (
    <Input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={display}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      onBlur={handleBlur}
      {...rest}
    />
  );
}
