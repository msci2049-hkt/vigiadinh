import type { ComponentProps, ComponentType, ReactNode } from "react";

type SvgIconProps = Omit<ComponentProps<"svg">, "children" | "height" | "width"> & {
  label?: string | undefined;
  size?: number | undefined;
};

function IconFrame({
  children,
  label,
  size = 24,
  ...props
}: SvgIconProps & { children: ReactNode }) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
    >
      {label ? <title>{label}</title> : null}
      {children}
    </svg>
  );
}

export function FingerprintIcon(props: SvgIconProps) {
  return (
    <IconFrame {...props}>
      <path d="M5.7 9.8a6.5 6.5 0 0 1 12.6 2.2c0 3.9-.8 7-2.3 9" />
      <path d="M8.1 12a3.9 3.9 0 0 1 7.8 0c0 3.5-.6 6.1-1.8 8" />
      <path d="M10.5 12a1.5 1.5 0 0 1 3 0c0 3.5-.4 6-1.3 7.7" />
      <path d="M4 13.2c0 3.1-.5 5.4-1.4 7" />
      <path d="M7.2 16.4c-.2 1.8-.7 3.4-1.4 4.6" />
    </IconFrame>
  );
}

export function ShieldCheckIcon(props: SvgIconProps) {
  return (
    <IconFrame {...props}>
      <path d="M12 3 20 6v5.4c0 4.7-3.2 8.1-8 9.6-4.8-1.5-8-4.9-8-9.6V6l8-3Z" />
      <path d="m8.6 12 2.1 2.1 4.8-5" />
    </IconFrame>
  );
}

export function UsersIcon(props: SvgIconProps) {
  return (
    <IconFrame {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20v-1.7A4.3 4.3 0 0 1 7.8 14h2.4a4.3 4.3 0 0 1 4.3 4.3V20" />
      <path d="M15.5 5.4a3 3 0 0 1 0 5.2M16.5 14.3a4.3 4.3 0 0 1 4 4.3V20" />
    </IconFrame>
  );
}

export function LockIcon(props: SvgIconProps) {
  return (
    <IconFrame {...props}>
      <rect x="4.5" y="10" width="15" height="10.5" rx="2.5" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v2.5" />
    </IconFrame>
  );
}

export function SendIcon(props: SvgIconProps) {
  return (
    <IconFrame {...props}>
      <path d="m21 3-8 18-2.4-7.6L3 11l18-8Z" />
      <path d="m10.6 13.4 4.8-4.8" />
    </IconFrame>
  );
}

export function QrCodeIcon(props: SvgIconProps) {
  return (
    <IconFrame {...props}>
      <rect x="3" y="3" width="6" height="6" rx="1" />
      <rect x="15" y="3" width="6" height="6" rx="1" />
      <rect x="3" y="15" width="6" height="6" rx="1" />
      <path d="M13 13h3v3h-3zM18 13h3M18 16h3v5M13 18v3h3" />
    </IconFrame>
  );
}

export function HistoryIcon(props: SvgIconProps) {
  return (
    <IconFrame {...props}>
      <path d="M4.4 8A8.5 8.5 0 1 1 3.5 14" />
      <path d="M3 4v5h5M12 7.5V12l3 2" />
    </IconFrame>
  );
}

export function ClockIcon(props: SvgIconProps) {
  return (
    <IconFrame {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </IconFrame>
  );
}

export function AlertTriangleIcon(props: SvgIconProps) {
  return (
    <IconFrame {...props}>
      <path d="M10.3 4.2 2.7 18a2 2 0 0 0 1.8 3h15a2 2 0 0 0 1.8-3L13.7 4.2a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </IconFrame>
  );
}

export function CheckCircleIcon(props: SvgIconProps) {
  return (
    <IconFrame {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.2 2.5 2.5 5.7-6" />
    </IconFrame>
  );
}

export function XCircleIcon(props: SvgIconProps) {
  return (
    <IconFrame {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 9 6 6M15 9l-6 6" />
    </IconFrame>
  );
}

export function ArrowRightIcon(props: SvgIconProps) {
  return (
    <IconFrame {...props}>
      <path d="M5 12h14M14 7l5 5-5 5" />
    </IconFrame>
  );
}

export function ArrowLeftIcon(props: SvgIconProps) {
  return (
    <IconFrame {...props}>
      <path d="M19 12H5M10 7l-5 5 5 5" />
    </IconFrame>
  );
}

export function CopyIcon(props: SvgIconProps) {
  return (
    <IconFrame {...props}>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </IconFrame>
  );
}

export function UserPlusIcon(props: SvgIconProps) {
  return (
    <IconFrame {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20v-1.7A4.3 4.3 0 0 1 7.8 14h2.4a4.3 4.3 0 0 1 4.3 4.3V20M17 8v6M14 11h6" />
    </IconFrame>
  );
}

export function UserMinusIcon(props: SvgIconProps) {
  return (
    <IconFrame {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20v-1.7A4.3 4.3 0 0 1 7.8 14h2.4a4.3 4.3 0 0 1 4.3 4.3V20M14 11h6" />
    </IconFrame>
  );
}

export function EyeIcon(props: SvgIconProps) {
  return (
    <IconFrame {...props}>
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </IconFrame>
  );
}

export function EyeOffIcon(props: SvgIconProps) {
  return (
    <IconFrame {...props}>
      <path d="M3 3 21 21M10.6 6.1A10.3 10.3 0 0 1 12 6c6 0 9.5 6 9.5 6a16.8 16.8 0 0 1-2.3 3M6.2 6.2A16.3 16.3 0 0 0 2.5 12s3.5 6 9.5 6a9.8 9.8 0 0 0 3-.5" />
      <path d="M10.2 10.2a2.5 2.5 0 0 0 3.6 3.6" />
    </IconFrame>
  );
}

export function HeartIcon(props: SvgIconProps) {
  return (
    <IconFrame {...props}>
      <path d="M20.8 5.8a5 5 0 0 0-7.1 0L12 7.5l-1.7-1.7a5 5 0 0 0-7.1 7.1L12 21l8.8-8.1a5 5 0 0 0 0-7.1Z" />
    </IconFrame>
  );
}

export function MoonIcon(props: SvgIconProps) {
  return (
    <IconFrame {...props}>
      <path d="M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 9 9 0 1 0 20.5 15.5Z" />
    </IconFrame>
  );
}

export function ScrollIcon(props: SvgIconProps) {
  return (
    <IconFrame {...props}>
      <path d="M6 4h11a3 3 0 0 1 3 3v13H8a4 4 0 0 1-4-4V6a2 2 0 0 1 2-2Z" />
      <path d="M8 20c2 0 3-1.3 3-3H4M9 8h7M9 12h7" />
    </IconFrame>
  );
}

export function BanIcon(props: SvgIconProps) {
  return (
    <IconFrame {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m5.6 5.6 12.8 12.8" />
    </IconFrame>
  );
}

export function RefreshIcon(props: SvgIconProps) {
  return (
    <IconFrame {...props}>
      <path d="M20 7v5h-5M4 17v-5h5" />
      <path d="M18.3 9A7 7 0 0 0 6 6.7L4 9M5.7 15A7 7 0 0 0 18 17.3l2-2.3" />
    </IconFrame>
  );
}

export function LoaderIcon(props: SvgIconProps) {
  return (
    <IconFrame {...props}>
      <path d="M21 12a9 9 0 1 1-6.2-8.6" />
    </IconFrame>
  );
}

export function InfoIcon(props: SvgIconProps) {
  return (
    <IconFrame {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </IconFrame>
  );
}

export function CloseIcon(props: SvgIconProps) {
  return (
    <IconFrame {...props}>
      <path d="m7 7 10 10M17 7 7 17" />
    </IconFrame>
  );
}

export function CheckIcon(props: SvgIconProps) {
  return (
    <IconFrame {...props}>
      <path d="m5 12 4 4L19 6" />
    </IconFrame>
  );
}

export function ChevronDownIcon(props: SvgIconProps) {
  return (
    <IconFrame {...props}>
      <path d="m7 9 5 5 5-5" />
    </IconFrame>
  );
}

export function ChevronUpIcon(props: SvgIconProps) {
  return (
    <IconFrame {...props}>
      <path d="m7 15 5-5 5 5" />
    </IconFrame>
  );
}

export function ChevronRightIcon(props: SvgIconProps) {
  return (
    <IconFrame {...props}>
      <path d="m9 7 5 5-5 5" />
    </IconFrame>
  );
}

export function DotIcon(props: SvgIconProps) {
  return (
    <IconFrame {...props}>
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
    </IconFrame>
  );
}

export function MoreHorizontalIcon(props: SvgIconProps) {
  return (
    <IconFrame {...props}>
      <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
    </IconFrame>
  );
}

export function WalletIcon(props: SvgIconProps) {
  return (
    <IconFrame {...props}>
      <path d="M4 6.5h13.5A2.5 2.5 0 0 1 20 9v9.5H6A3 3 0 0 1 3 15.5v-9A2.5 2.5 0 0 1 5.5 4H17" />
      <path d="M15 11h6v4h-6a2 2 0 0 1 0-4Z" />
    </IconFrame>
  );
}

export function SettingsIcon(props: SvgIconProps) {
  return (
    <IconFrame {...props}>
      <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h7M15 18h5" />
      <circle cx="15" cy="6" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="13" cy="18" r="2" />
    </IconFrame>
  );
}

export function UserIcon(props: SvgIconProps) {
  return (
    <IconFrame {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </IconFrame>
  );
}

export function LogOutIcon(props: SvgIconProps) {
  return (
    <IconFrame {...props}>
      <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M14 8l4 4-4 4M8 12h10" />
    </IconFrame>
  );
}

export function PlusIcon(props: SvgIconProps) {
  return (
    <IconFrame {...props}>
      <path d="M12 5v14M5 12h14" />
    </IconFrame>
  );
}

export function ArrowUpIcon(props: SvgIconProps) {
  return (
    <IconFrame {...props}>
      <path d="M12 19V5M7 10l5-5 5 5" />
    </IconFrame>
  );
}

export function ArrowDownIcon(props: SvgIconProps) {
  return (
    <IconFrame {...props}>
      <path d="M12 5v14M7 14l5 5 5-5" />
    </IconFrame>
  );
}

export function SunIcon(props: SvgIconProps) {
  return (
    <IconFrame {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </IconFrame>
  );
}

const ICONS = {
  fingerprint: FingerprintIcon,
  shieldCheck: ShieldCheckIcon,
  users: UsersIcon,
  lock: LockIcon,
  send: SendIcon,
  qrCode: QrCodeIcon,
  history: HistoryIcon,
  clock: ClockIcon,
  alertTriangle: AlertTriangleIcon,
  checkCircle: CheckCircleIcon,
  xCircle: XCircleIcon,
  arrowRight: ArrowRightIcon,
  arrowLeft: ArrowLeftIcon,
  copy: CopyIcon,
  userPlus: UserPlusIcon,
  userMinus: UserMinusIcon,
  eye: EyeIcon,
  eyeOff: EyeOffIcon,
  heart: HeartIcon,
  moon: MoonIcon,
  scroll: ScrollIcon,
  ban: BanIcon,
  refresh: RefreshIcon,
  loader: LoaderIcon,
  info: InfoIcon,
  wallet: WalletIcon,
  settings: SettingsIcon,
  user: UserIcon,
  logOut: LogOutIcon,
} satisfies Record<string, ComponentType<SvgIconProps>>;

export type FamilyIconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 24,
  className,
  label,
}: {
  name: FamilyIconName;
  size?: 20 | 24 | 32;
  className?: string | undefined;
  label?: string | undefined;
}) {
  const Component = ICONS[name];
  return <Component size={size} className={className} label={label} />;
}
