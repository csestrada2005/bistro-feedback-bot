import logoAsset from "@/assets/main-catering-logo.jpg.asset.json";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  alt?: string;
};

export function BrandLogo({ className, alt = "Main Catering" }: Props) {
  return (
    <img
      src={logoAsset.url}
      alt={alt}
      className={cn("object-contain", className)}
      loading="eager"
      decoding="async"
    />
  );
}