import { create as createQrCode } from "qrcode";
import { useMemo } from "react";
import { cn } from "./utils";

export function WalletQrCode({
  value,
  label,
  className,
}: {
  value: string;
  label: string;
  className?: string | undefined;
}) {
  const { path, viewBoxSize } = useMemo(() => {
    const modules = createQrCode(value, { errorCorrectionLevel: "M" }).modules;
    const margin = 4;
    const commands: string[] = [];

    for (let row = 0; row < modules.size; row += 1) {
      for (let column = 0; column < modules.size; column += 1) {
        if (modules.get(row, column)) {
          commands.push(`M${column + margin} ${row + margin}h1v1h-1z`);
        }
      }
    }

    return {
      path: commands.join(""),
      viewBoxSize: modules.size + margin * 2,
    };
  }, [value]);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
      className={cn("size-44 max-w-full text-foreground", className)}
    >
      <title>{label}</title>
      <rect width={viewBoxSize} height={viewBoxSize} fill="white" />
      <path d={path} fill="currentColor" />
    </svg>
  );
}
