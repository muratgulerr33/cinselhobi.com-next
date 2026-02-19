"use client";

import { Input } from "@/components/ui/input";
import { formatCentsForInput, parseMoneyToCents } from "@/lib/admin/product-money";

interface MoneyInputTRProps {
  value: string;
  onChange: (value: string) => void;
  onCentsChange?: (cents: number | null) => void;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  name?: string;
}

function sanitizeMoneyInput(value: string): string {
  return value.replace(/[^\d.,\s]/g, "");
}

export function MoneyInputTR({
  value,
  onChange,
  onCentsChange,
  disabled,
  placeholder,
  id,
  name,
}: MoneyInputTRProps) {
  return (
    <Input
      id={id}
      name={name}
      value={value}
      onChange={(event) => {
        const nextValue = sanitizeMoneyInput(event.target.value);
        onChange(nextValue);

        const cents = parseMoneyToCents(nextValue, false);
        onCentsChange?.(typeof cents === "number" && Number.isFinite(cents) ? cents : null);
      }}
      onBlur={() => {
        const cents = parseMoneyToCents(value, false);
        if (cents === null) {
          if (!value.trim() && value !== "") {
            onChange("");
          }
          onCentsChange?.(null);
          return;
        }

        if (!Number.isFinite(cents)) {
          onCentsChange?.(null);
          return;
        }

        const canonical = formatCentsForInput(cents);
        if (canonical !== value) {
          onChange(canonical);
        }
        onCentsChange?.(cents);
      }}
      inputMode="decimal"
      autoComplete="off"
      disabled={disabled}
      placeholder={placeholder}
    />
  );
}
