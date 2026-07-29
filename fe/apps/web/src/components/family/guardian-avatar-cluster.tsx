import {
  GuardianPortrait,
  type GuardianPortraitVariant,
  guardianPortraitForIndex,
} from "./guardian-portrait";
import { Icon } from "./icons";
import { cn } from "./utils";

export type GuardianFace = {
  name: string;
  variant?: GuardianPortraitVariant | undefined;
  status?: "active" | "slow" | "offline" | "pending" | undefined;
};

export const DEMO_GUARDIANS: GuardianFace[] = [
  { name: "Mom", variant: 0, status: "active" },
  { name: "Brother", variant: 1, status: "active" },
  { name: "Aunt", variant: 3, status: "active" },
];

export function GuardianAvatarCluster({
  people,
  size = "md",
  emptyLabel,
}: {
  people?: GuardianFace[] | undefined;
  size?: "md" | "lg";
  emptyLabel?: string | undefined;
}) {
  const faces = people?.slice(0, 3) ?? [];
  const dimensions = size === "lg" ? "size-[4.5rem]" : "size-[3.25rem]";
  const overlap = size === "lg" ? "-ml-5" : "-ml-3.5";

  if (faces.length === 0) {
    return (
      <div>
        <div className="flex items-center">
          {[0, 1, 2].map((slot) => (
            <span
              key={slot}
              className={cn(
                dimensions,
                slot > 0 && overlap,
                "rounded-full border-2 border-border border-dashed bg-muted",
              )}
            />
          ))}
        </div>
        {emptyLabel ? <p className="mt-3 text-muted-foreground text-sm">{emptyLabel}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex items-center">
      {faces.map((person, index) => (
        <span
          key={`${person.name}-${person.variant ?? index}`}
          className={cn("relative rounded-full border-[3px] border-card", index > 0 && overlap)}
          title={person.name}
        >
          <GuardianPortrait
            variant={person.variant ?? guardianPortraitForIndex(index)}
            label={person.name}
            muted={person.status === "offline"}
            className={cn(dimensions, "rounded-full")}
          />
          {index === faces.length - 1 ? (
            <span className="-right-1 -bottom-1 absolute flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
              <Icon name="shieldCheck" size={20} />
            </span>
          ) : null}
        </span>
      ))}
    </div>
  );
}
