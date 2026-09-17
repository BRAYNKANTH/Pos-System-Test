"use client";

import { useState, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "min" | "max" | "step"> & {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number | string;
  integer?: boolean;
  emptyValue?: number;
};

/** Preserve intermediate text while editing; clearing a field never deletes a line. */
export function NumberInput({ value, onValueChange, min = 0, max = Number.MAX_SAFE_INTEGER, integer, emptyValue, onBlur, onFocus, onKeyDown, step: _step, ...props }: Props) {
  const [text, setText] = useState(String(value));
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) { setLastValue(value); setText(String(value)); }
  function valid(n: number) { return Number.isFinite(n) && n >= min && n <= max && (!integer || Number.isInteger(n)); }
  function commit() {
    const n = Number(text);
    if (text.trim() && valid(n)) { onValueChange(n); setText(String(n)); }
    else setText(String(value));
  }
  return <input {...props} type="text" inputMode={integer ? "numeric" : "decimal"} value={text}
    onFocus={(e) => { e.currentTarget.select(); onFocus?.(e); }}
    onChange={(e) => {
      const raw = e.target.value;
      if (!(integer ? /^\d*$/ : /^\d*(\.\d*)?$/).test(raw)) return;
      setText(raw);
      const n = Number(raw);
      if (raw && valid(n)) { setLastValue(n); onValueChange(n); }
      else if (!raw && emptyValue !== undefined) { setLastValue(emptyValue); onValueChange(emptyValue); }
    }}
    onBlur={(e) => { commit(); onBlur?.(e); }}
    onKeyDown={(e) => {
      if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); commit(); e.currentTarget.blur(); }
      onKeyDown?.(e);
    }} />;
}
