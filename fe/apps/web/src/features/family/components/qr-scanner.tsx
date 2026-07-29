// Quét QR bằng camera (LÔ 4) — getUserMedia + jsQR decode HOÀN TOÀN trên máy
// (thuần JS, không gọi dịch vụ online — địa chỉ người nhận không rời trình
// duyệt). jsQR nạp LƯỜI lúc mở scanner: người không bao giờ quét không phải
// tải decoder.
//
// Máy không có camera → cha đã ẨN nút (canScanQr). Ở đây chỉ còn hai đường
// chết thật: người dùng TỪ CHỐI quyền hoặc camera bận — báo câu người thường
// rồi đóng, không treo màn đen.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Card, CardContent } from "@/components/family/ui";

/** Có đường quét không — thiếu getUserMedia thì đừng vẽ nút ("nút chết"). */
export function canScanQr(): boolean {
  return typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
}

const SCAN_INTERVAL_MS = 250;

export function QrScanner({
  onResult,
  onClose,
}: {
  /** Chuỗi QR đầu tiên decode được — cha tự validate (địa chỉ hay không). */
  onResult: (text: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("fw");
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: number | null = null;
    let cancelled = false;
    const canvas = document.createElement("canvas");

    async function start() {
      try {
        const [{ default: jsQR }, media] = await Promise.all([
          import("jsqr"),
          navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
            audio: false,
          }),
        ]);
        if (cancelled) {
          for (const track of media.getTracks()) track.stop();
          return;
        }
        stream = media;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = media;
        await video.play();

        timer = window.setInterval(() => {
          if (video.readyState < video.HAVE_ENOUGH_DATA) return;
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (!ctx || canvas.width === 0) return;
          ctx.drawImage(video, 0, 0);
          const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(image.data, image.width, image.height);
          if (code && code.data.trim() !== "") {
            onResult(code.data.trim());
          }
        }, SCAN_INTERVAL_MS);
      } catch {
        // NotAllowedError (từ chối quyền) / NotFoundError / NotReadableError —
        // với người dùng đều là "không mở được camera", còn đường dán tay.
        if (!cancelled) setFailed(true);
      }
    }
    void start();

    return () => {
      cancelled = true;
      if (timer !== null) window.clearInterval(timer);
      if (stream) for (const track of stream.getTracks()) track.stop();
    };
  }, [onResult]);

  return (
    <Card className="bg-paper-2">
      <CardContent className="flex flex-col items-center gap-3 pt-4">
        {failed ? (
          <p className="text-destructive text-sm" role="alert">
            {t("wallet.send.scan.failed")}
          </p>
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full max-w-sm rounded-card bg-black"
              aria-label={t("wallet.send.scan.viewfinder")}
            />
            <p className="text-muted-foreground text-xs">{t("wallet.send.scan.hint")}</p>
          </>
        )}
        <Button variant="ghost" size="sm" onClick={onClose}>
          {t("wallet.send.scan.closeCta")}
        </Button>
      </CardContent>
    </Card>
  );
}
