// Ô "Gửi tới" cho NGƯỜI THẬT (LÔ 4): gõ/dán/quét QR/chọn người thân — không
// bắt ai chép tay 56 ký tự. Validate bằng StrKey (checksum) qua lib/address:
//   C…/G… hợp lệ → hiện rút gọn + nhãn nếu là người quen ("Mẹ").
//   M… (muxed — sàn) → nhận diện đúng + nói thật: pipeline chưa hỗ trợ,
//     hướng dẫn đường thay thế. CẤM im lặng nuốt (docs/SEND-ADDRESSES.md).
//   Sai/thiếu ký tự → câu lỗi ngay khi gõ.
// Máy không có camera → nút quét KHÔNG render; clipboard không đọc được →
// nút dán KHÔNG render (đừng vẽ nút chết).
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/family/icons";
import { Button, Card, CardContent, Input } from "@/components/family/ui";
import { classifyAddress, shortAddress } from "../lib/address";
import { canScanQr, QrScanner } from "./qr-scanner";

export type RecipientContact = { label: string; address: string };

function canReadClipboard(): boolean {
  return typeof navigator !== "undefined" && Boolean(navigator.clipboard?.readText);
}

export function RecipientField({
  value,
  onChange,
  contacts,
}: {
  value: string;
  onChange: (next: string) => void;
  /** Người thân đã biết (guardian có địa chỉ) — bấm là điền. */
  contacts: RecipientContact[];
}) {
  const { t } = useTranslation("fw");
  const [panel, setPanel] = useState<"none" | "scan" | "contacts">("none");

  const kind = classifyAddress(value);
  const known = contacts.find((c) => c.address === value.trim()) ?? null;

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim() !== "") {
        onChange(text.trim());
        setPanel("none");
      }
    } catch {
      // Người dùng chối quyền đọc clipboard — không có gì để điền, giữ nguyên ô.
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="send-recipient" className="flex flex-col gap-1">
        <span className="text-foreground text-sm">{t("wallet.send.recipientLabel")}</span>
        <Input
          id="send-recipient"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="C… / G…"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={value.length > 0 && kind === "invalid"}
        />
      </label>

      <div className="flex flex-wrap gap-2">
        {canScanQr() ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setPanel(panel === "scan" ? "none" : "scan")}
            data-testid="recipient-scan"
          >
            <Icon name="qrCode" />
            {t("wallet.send.scan.cta")}
          </Button>
        ) : null}
        {contacts.length > 0 ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setPanel(panel === "contacts" ? "none" : "contacts")}
            data-testid="recipient-contacts"
          >
            <Icon name="users" />
            {t("wallet.send.contacts.cta")}
          </Button>
        ) : null}
        {canReadClipboard() ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void pasteFromClipboard()}
            data-testid="recipient-paste"
          >
            <Icon name="copy" />
            {t("wallet.send.pasteCta")}
          </Button>
        ) : null}
      </div>

      {panel === "scan" ? (
        <QrScanner
          onResult={(text) => {
            onChange(text);
            setPanel("none");
          }}
          onClose={() => setPanel("none")}
        />
      ) : null}

      {panel === "contacts" ? (
        <Card className="bg-paper-2">
          <CardContent className="flex flex-col gap-1 pt-3">
            {contacts.map((c) => (
              <button
                key={c.address}
                type="button"
                className="flex items-center justify-between gap-3 rounded-card px-2 py-2 text-left hover:bg-accent"
                onClick={() => {
                  onChange(c.address);
                  setPanel("none");
                }}
                data-testid={`recipient-contact-${c.address.slice(0, 6)}`}
              >
                <span className="truncate font-semibold text-sm">{c.label}</span>
                <span className="font-mono text-muted-foreground text-xs">
                  {shortAddress(c.address)}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {/* Trạng thái địa chỉ — đúng MỘT câu, đổi ngay khi gõ. */}
      {value.length > 0 && kind === "invalid" ? (
        <span className="text-destructive text-xs">{t("wallet.send.errors.badRecipient")}</span>
      ) : null}
      {kind === "muxed" ? (
        <span className="text-destructive text-xs" data-testid="recipient-muxed">
          {t("wallet.send.muxedNote")} {t("wallet.send.muxedUnsupported")}
        </span>
      ) : null}
      {(kind === "contract" || kind === "classic") && value.length > 0 ? (
        <span className="text-muted-foreground text-xs" data-testid="recipient-ok">
          {known ? t("wallet.send.knownRecipient", { name: known.label }) : shortAddress(value)}
        </span>
      ) : null}
    </div>
  );
}
