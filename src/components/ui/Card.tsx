import { cn } from "@/lib/cn";

export default function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-3xl bg-white/70 shadow-soft border border-white/60",
        className
      )}
    >
      {children}
    </div>
  );
}
