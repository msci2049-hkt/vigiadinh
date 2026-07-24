// Ô nhập TIỀN (PHA 7.1) — luật vàng i18n §2: chuỗi RAW người gõ nằm trong state,
// bản format chỉ là PREVIEW hiển thị cạnh bên — KHÔNG BAO GIỜ ghi ngược bản
// format vào ô nhập (hai chuỗi tách biệt tuyệt đối). Giá trị đi tiếp trong app
// là ScaledAmount (BigInt string 7 số lẻ) — không float, không chuỗi đã format.
import {
  formatAmount,
  localeSeparators,
  type ParseAmountResult,
  parseAmountInput,
} from "@repo/core";
import { Input } from "@repo/ui";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

type AmountInputProps = {
  /** RAW đúng như người gõ — state thuộc form cha (RHF field.value). */
  value: string;
  onChange: (raw: string) => void;
  /** Mã tài sản hiển thị ở preview (theo TÀI SẢN, không theo locale UI). */
  assetCode?: string | undefined;
  id?: string | undefined;
  "aria-label"?: string | undefined;
  disabled?: boolean | undefined;
};

/** Parse RAW hiện tại theo locale UI — form cha gọi lại khi submit (nguồn duy nhất). */
export function useParsedAmount(raw: string): ParseAmountResult {
  const { i18n } = useTranslation();
  return useMemo(() => parseAmountInput(raw, { locale: i18n.language }), [raw, i18n.language]);
}

export function AmountInput({ value, onChange, assetCode, disabled, ...rest }: AmountInputProps) {
  const { i18n } = useTranslation();
  const locale = i18n.language;
  const parsed = useParsedAmount(value);
  // Preview format ở LÁ — chỉ khi parse được và khác biểu diễn thô (đỡ lặp vô nghĩa).
  const preview = parsed.ok
    ? formatAmount(parsed.scaled, {
        locale,
        ...(assetCode ? { code: assetCode } : {}),
      })
    : null;
  const { decimal } = localeSeparators(locale);

  return (
    <div className="flex flex-col gap-1">
      <Input
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        placeholder={`0${decimal}00`}
        aria-invalid={value.length > 0 && !parsed.ok}
      />
      {preview !== null && value.length > 0 ? (
        <p
          aria-live="polite"
          className="text-muted-foreground text-sm"
          data-testid="amount-preview"
        >
          {preview}
        </p>
      ) : null}
    </div>
  );
}
