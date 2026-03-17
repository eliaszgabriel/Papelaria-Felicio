import Link from "next/link";

type Item = { label: string; href: string };

export default function ProductBreadcrumb({ items }: { items: Item[] }) {
  return (
    <nav className="text-sm text-felicio-ink/70">
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((item, idx) => (
          <li key={item.href} className="flex items-center gap-2">
            <Link
              className="transition hover:text-felicio-pink"
              href={item.href}
            >
              {item.label}
            </Link>
            {idx < items.length - 1 && (
              <span className="text-felicio-ink/40">/</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
