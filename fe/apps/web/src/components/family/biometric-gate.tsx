import { Button } from "@repo/ui";
import type { ComponentProps, ReactNode } from "react";
import { Icon } from "./icon";
import { Sheet } from "./sheet";

export function BiometricGate({
  label,
  loadingLabel,
  sheetTitle,
  sheetBody,
  showSheet = false,
  children,
  ...buttonProps
}: Omit<ComponentProps<typeof Button>, "children"> & {
  label: string;
  loadingLabel?: string | undefined;
  sheetTitle?: string | undefined;
  sheetBody?: ReactNode;
  showSheet?: boolean;
  children?: never;
}) {
  return (
    <>
      <Button
        {...buttonProps}
        loadingLabel={loadingLabel}
        className="w-full"
        variant={buttonProps.variant ?? "primary"}
      >
        <Icon name="fingerprint" size={32} />
        {label}
      </Button>
      {sheetTitle ? (
        <Sheet title={sheetTitle} visible={showSheet}>
          {sheetBody}
        </Sheet>
      ) : null}
    </>
  );
}
