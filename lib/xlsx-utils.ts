// ====================================================================
// Excel 往復で共有する純関数ユーティリティ（DB非依存・副作用なし）
//
//   前回の日次売上Excel（app/(app)/data/_lib/integrated-*）から、汎用の純関数を
//   コピーして切り出したもの。前回ファイルは変更しない（将来の共通化は別タスク）。
//   売上予算（daily_targets）の Excel 往復がこのモジュールを使用する。
// ====================================================================

import type { CellValue } from 'exceljs';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * from〜to（YYYY-MM-DD）の全日付を昇順で列挙する（記入テンプレ用）。
 * 文字列ベースで1日ずつ進めるため、タイムゾーンずれの影響を受けない。
 */
export function enumerateDates(from: string, to: string): string[] {
  const out: string[] = [];
  if (!DATE_PATTERN.test(from) || !DATE_PATTERN.test(to) || from > to) return out;
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  let cur = Date.UTC(fy, fm - 1, fd);
  const end = Date.UTC(ty, tm - 1, td);
  let guard = 0;
  while (cur <= end && guard < 100000) {
    const dt = new Date(cur);
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dt.getUTCDate()).padStart(2, '0');
    out.push(`${y}-${m}-${d}`);
    cur += 86400000;
    guard++;
  }
  return out;
}

/** YYYY-MM-DD が形式・実在日として正しいか */
export function isValidDateString(s: string): boolean {
  if (!DATE_PATTERN.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** 曜日（日本語1文字）を返す。不正日付は '' */
export function weekdayJa(dateStr: string): string {
  if (!isValidDateString(dateStr)) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return ['日', '月', '火', '水', '木', '金', '土'][dow];
}

/** 見出しタグ（【必須】等）を除去して前後空白を落とす */
export function normalizeHeader(raw: string): string {
  return raw.replace(/【[^】]*】/g, '').trim();
}

/** ExcelJS のセル値を文字列へ（空・null は null）。日付は YYYY-MM-DD に整形 */
export function readCellString(value: CellValue): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const t = value.trim();
    return t === '' ? null : t;
  }
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value instanceof Date) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof value === 'object') {
    const v = value as { text?: string; result?: CellValue; richText?: { text: string }[] };
    if (Array.isArray(v.richText)) {
      const t = v.richText.map((r) => r.text).join('').trim();
      return t === '' ? null : t;
    }
    if (typeof v.text === 'string') {
      const t = v.text.trim();
      return t === '' ? null : t;
    }
    if (v.result !== undefined && v.result !== null) return readCellString(v.result);
  }
  return null;
}

/** 金額の生文字列を数値へ。空は null、数値化不能は invalid */
export function parseAmount(raw: string | null): { ok: true; value: number | null } | { ok: false } {
  if (raw === null) return { ok: true, value: null };
  const cleaned = raw.replace(/[,\s¥￥$]/g, '');
  if (cleaned === '') return { ok: true, value: null };
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return { ok: false };
  return { ok: true, value: n };
}

/** ファイル名に使えない文字を除去 */
export function sanitizeFilenamePart(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_').trim();
}

/** base64 文字列を Uint8Array へ（ブラウザ・サーバ共通の純変換。DOM 非依存） */
export function base64ToUint8Array(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
