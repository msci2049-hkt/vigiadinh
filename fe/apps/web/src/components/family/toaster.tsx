import { Toaster as Sonner, type ToasterProps } from "sonner";
import { AlertTriangleIcon, CheckCircleIcon, InfoIcon, LoaderIcon, XCircleIcon } from "./icons";
import { useThemeStore } from "./theme-store";

const Toaster = ({ ...props }: ToasterProps) => {
  // Theme comes from our zustand store (we don't use next-themes).
  const theme = useThemeStore((s) => s.theme);

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      icons={{
        success: <CheckCircleIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <AlertTriangleIcon className="size-4" />,
        error: <XCircleIcon className="size-4" />,
        loading: <LoaderIcon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
