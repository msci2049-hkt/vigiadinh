import {
  ArrowLeft,
  ArrowRight,
  Ban,
  CircleCheck,
  CircleX,
  Clock,
  Copy,
  Eye,
  EyeOff,
  FingerprintPattern,
  Heart,
  History,
  Info,
  LoaderCircle,
  Lock,
  type LucideIcon,
  Moon,
  QrCode,
  RefreshCw,
  Scroll,
  Send,
  ShieldCheck,
  TriangleAlert,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";

const ICONS = {
  fingerprint: FingerprintPattern,
  shieldCheck: ShieldCheck,
  users: Users,
  lock: Lock,
  send: Send,
  qrCode: QrCode,
  history: History,
  clock: Clock,
  alertTriangle: TriangleAlert,
  checkCircle: CircleCheck,
  xCircle: CircleX,
  arrowRight: ArrowRight,
  arrowLeft: ArrowLeft,
  copy: Copy,
  userPlus: UserPlus,
  userMinus: UserMinus,
  eye: Eye,
  eyeOff: EyeOff,
  heart: Heart,
  moon: Moon,
  scroll: Scroll,
  ban: Ban,
  refresh: RefreshCw,
  loader: LoaderCircle,
  info: Info,
} satisfies Record<string, LucideIcon>;

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
  return (
    <Component
      size={size}
      strokeWidth={1.5}
      className={className}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
    />
  );
}
