import { Icon } from "./icons";
import { ProductImage } from "./product-image";
import { cn } from "./utils";

export type GuardianFace = {
  name: string;
  src?: string | undefined;
  status?: "active" | "slow" | "offline" | "pending" | undefined;
};

export const DEMO_GUARDIANS: GuardianFace[] = [
  { name: "Mom", src: "/assets/avatars/mom-160.webp", status: "active" },
  { name: "Brother", src: "/assets/avatars/brother-160.webp", status: "active" },
  { name: "Aunt", src: "/assets/avatars/aunt-160.webp", status: "active" },
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
          key={`${person.name}-${person.src ?? index}`}
          className={cn("relative rounded-full border-[3px] border-card", index > 0 && overlap)}
          title={person.name}
        >
          {person.src ? (
            <ProductImage
              src={person.src}
              avifSrc={person.src.replace(/\.webp$/, ".avif")}
              alt={person.name}
              width={160}
              height={160}
              className={cn(
                dimensions,
                "rounded-full object-cover",
                person.status === "offline" && "grayscale",
              )}
            />
          ) : (
            <span
              className={cn(
                dimensions,
                "flex items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground",
              )}
            >
              {person.name.slice(0, 1).toUpperCase()}
            </span>
          )}
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
