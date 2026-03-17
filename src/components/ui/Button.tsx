import { cn } from "@/lib/cn";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "soft";
};

export default function Button({
  className,
  variant = "primary",
  ...props
}: Props) {
  const base =
    "inline-flex cursor-pointer items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60";

  const variants: Record<string, string> = {
    primary:
      "bg-felicio-pink text-white shadow-soft hover:brightness-[0.98] focus:outline-none focus:ring-2 focus:ring-felicio-pink/40",
    soft: "bg-white/70 text-felicio-ink shadow-soft hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-felicio-pink/30",
  };

  return (
    <button className={cn(base, variants[variant], className)} {...props} />
  );
}
