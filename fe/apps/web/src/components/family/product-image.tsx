import type { ComponentProps } from "react";

type ProductImageProps = Omit<
  ComponentProps<"img">,
  "decoding" | "fetchPriority" | "height" | "loading" | "src" | "width"
> & {
  avifSrc?: string | undefined;
  height: number;
  priority?: boolean | undefined;
  src: string;
  webpSrc?: string | undefined;
  width: number;
};

export function ProductImage({
  alt,
  avifSrc,
  height,
  priority = false,
  src,
  webpSrc,
  width,
  ...props
}: ProductImageProps) {
  const image = (
    <img
      {...props}
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
    />
  );

  if (!avifSrc && !webpSrc) return image;

  return (
    <picture className="contents">
      {avifSrc ? <source srcSet={avifSrc} type="image/avif" /> : null}
      {webpSrc ? <source srcSet={webpSrc} type="image/webp" /> : null}
      {image}
    </picture>
  );
}
