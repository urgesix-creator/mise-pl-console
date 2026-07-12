'use client';

import { useCallback } from 'react';

/**
 * グリッド状の入力欄に「Excel風のフォーカス移動」を足す共通フック。
 *
 * 方式（調査で推奨された方式）：
 *   - 表/フォームを囲む要素に、本フックが返す onKeyDown を付ける（イベント委譲）。
 *   - フォーカス中の <input> を起点に、実DOM上の data-nav-row / data-nav-col 属性から
 *     隣のセルを特定して focus() する。
 *   - React の ref には依存しない（AmountInput が ref 非対応のため）。AmountInput 本体は改造不要。
 *
 * 各入力セルの実DOM側に、行・列を示す属性を付与しておくこと：
 *   - data-nav-row="<行index>"  data-nav-col="<列index>"
 *   （input そのものでも、input を内包する親要素でも可。closest() で拾う）
 *
 * 挙動：
 *   - Enter：下のセル（同 col・row+1）が存在する時だけ preventDefault して focus。無ければ何もしない。
 *   - Tab  ：右のセル（同 row・col+1）が存在する時だけ preventDefault して focus。無ければ標準のTab。
 *   - ↑    ：上のセル（同 col・row-1）へ常に移動（金額欄は1行）。無ければ何もしない。
 *   - ↓    ：下のセル（同 col・row+1）へ常に移動。無ければ何もしない。
 *   - ←    ：カーソルが入力欄の左端（選択なし）の時だけ左のセル（同 row・col-1）へ。途中なら標準（欄内移動）。
 *   - →    ：カーソルが入力欄の右端（選択なし）の時だけ右のセル（同 row・col+1）へ。途中なら標準（欄内移動）。
 *   - Shift+Tab・Escape・その他キー：一切触らない（標準動作）。
 *   - 矢印キーに修飾（Shift/Ctrl/Meta/Alt）が付く時は標準動作（範囲選択・単語移動を奪わない）。
 *   - IME：変換確定の Enter・変換中の矢印（isComposing=true）は移動と誤認しない。
 *
 * 値の流れ（onChange）や保存（onBlur）には一切関与しない。フォーカス移動だけを足す。
 */
export function useGridNavigation() {
  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLElement>) => {
    const key = e.key;
    const isArrow =
      key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight';

    // 対象キー（Enter / Tab / 矢印）以外は標準動作。
    if (key !== 'Enter' && key !== 'Tab' && !isArrow) return;
    // Shift+Tab は標準のまま。
    if (key === 'Tab' && e.shiftKey) return;
    // 矢印に修飾キーが付く時は標準（範囲選択・単語/行移動を奪わない）。
    if (isArrow && (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey)) return;

    // フォーカスが入力欄に無ければ何もしない
    const target = e.target as HTMLElement;
    if (!(target instanceof HTMLInputElement)) return;

    // 起点セルの行・列を実DOMから取得（input か、その親の data-nav-* を拾う）
    const cell = target.closest<HTMLElement>('[data-nav-row][data-nav-col]');
    if (!cell) return;
    const row = Number(cell.getAttribute('data-nav-row'));
    const col = Number(cell.getAttribute('data-nav-col'));
    if (!Number.isInteger(row) || !Number.isInteger(col)) return;

    const container = e.currentTarget;

    const focusCell = (nextRow: number, nextCol: number): boolean => {
      const next = container.querySelector<HTMLInputElement>(
        `[data-nav-row="${nextRow}"][data-nav-col="${nextCol}"] input, ` +
          `input[data-nav-row="${nextRow}"][data-nav-col="${nextCol}"]`,
      );
      if (!next || next.disabled) return false;
      next.focus();
      return true;
    };

    // IME 変換確定の Enter・変換中の矢印は移動扱いにしない（Tab は従来通り対象外）
    if ((key === 'Enter' || isArrow) && e.nativeEvent.isComposing) return;

    switch (key) {
      case 'Enter':
      case 'ArrowDown': {
        // 下（同じ列の次の行）へ。無ければ何もしない（preventDefault もしない）。
        if (focusCell(row + 1, col)) e.preventDefault();
        return;
      }
      case 'ArrowUp': {
        // 上（同じ列の前の行）へ。無ければ何もしない。
        if (focusCell(row - 1, col)) e.preventDefault();
        return;
      }
      case 'Tab':
      case 'ArrowRight': {
        // 右（同じ行の次の列）へ。
        // 矢印はカーソルが右端（選択なし）の時だけ移動。途中なら標準（欄内でカーソル移動）。
        if (key === 'ArrowRight') {
          const len = target.value.length;
          if (!(target.selectionStart === len && target.selectionEnd === len)) return;
        }
        if (focusCell(row, col + 1)) e.preventDefault();
        return;
      }
      case 'ArrowLeft': {
        // 左（同じ行の前の列）へ。カーソルが左端（選択なし）の時だけ移動。途中なら標準。
        if (!(target.selectionStart === 0 && target.selectionEnd === 0)) return;
        if (focusCell(row, col - 1)) e.preventDefault();
        return;
      }
    }
  }, []);

  return { onKeyDown };
}
