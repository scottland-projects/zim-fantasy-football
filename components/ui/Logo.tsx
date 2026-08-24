import Image from "next/image";

export function Logo({ size = 44, className = "" }: { size?: number; className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt="Africa Fantasy"
      width={size}
      height={size}
      className={`object-contain ${className}`}
      style={{ height: "auto" }}
      priority
    />
  );
}
