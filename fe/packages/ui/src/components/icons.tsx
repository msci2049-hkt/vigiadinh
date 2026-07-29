import type { ComponentProps, ReactNode } from "react";

type IconProps = Omit<ComponentProps<"svg">, "children">;

function IconFrame({ children, ...props }: IconProps & { children: ReactNode }) {
  const label = props["aria-label"];
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-hidden={label ? undefined : true}
    >
      <title>{label ?? "Decorative icon"}</title>
      {children}
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="m5 12 4 4L19 6" />
    </IconFrame>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="m7 9 5 5 5-5" />
    </IconFrame>
  );
}

export function ChevronUpIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="m7 15 5-5 5 5" />
    </IconFrame>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="m9 7 5 5-5 5" />
    </IconFrame>
  );
}

export function CircleIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
    </IconFrame>
  );
}

export function XIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="m7 7 10 10M17 7 7 17" />
    </IconFrame>
  );
}

export function LoaderCircleIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M21 12a9 9 0 1 1-6.2-8.6" />
    </IconFrame>
  );
}

export function CircleCheckIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.2 2.5 2.5 5.7-6" />
    </IconFrame>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </IconFrame>
  );
}

export function TriangleAlertIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M10.3 4.2 2.7 18a2 2 0 0 0 1.8 3h15a2 2 0 0 0 1.8-3L13.7 4.2a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </IconFrame>
  );
}

export function OctagonXIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="m8 3 8 0 5 5v8l-5 5H8l-5-5V8l5-5Z" />
      <path d="m9 9 6 6M15 9l-6 6" />
    </IconFrame>
  );
}
