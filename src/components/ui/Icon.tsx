type IconName =
  | "search"
  | "heart"
  | "user"
  | "cart"
  | "truck"
  | "lock"
  | "gift"
  | "chat";

export default function Icon({
  name,
  className,
}: {
  name: IconName;
  className?: string;
}) {
  const common = `stroke-current ${className ?? ""}`;

  switch (name) {
    case "search":
      return (
        <svg
          className={common}
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
        >
          <path d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" strokeWidth="2" />
          <path d="M21 21l-4.3-4.3" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "heart":
      return (
        <svg
          className={common}
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
        >
          <path
            d="M12 20.5s-7.5-4.8-9.2-9C1.5 8.3 3.6 5.5 6.9 5.5c2.1 0 3.7 1.1 5.1 3 1.4-1.9 3-3 5.1-3 3.3 0 5.4 2.8 4.1 6-1.7 4.2-9.2 9-9.2 9Z"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "user":
      return (
        <svg
          className={common}
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
        >
          <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" strokeWidth="2" />
          <path
            d="M20 21a8 8 0 0 0-16 0"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case "cart":
      return (
        <svg
          className={common}
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
        >
          <path
            d="M6 7h15l-1.5 8H8L6 3H3"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" strokeWidth="2" />
          <path d="M18 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" strokeWidth="2" />
        </svg>
      );
    case "truck":
      return (
        <svg
          className={common}
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
        >
          <path d="M3 7h11v10H3V7Z" strokeWidth="2" />
          <path d="M14 10h4l3 3v4h-7v-7Z" strokeWidth="2" />
          <path d="M7 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" strokeWidth="2" />
          <path d="M18 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" strokeWidth="2" />
        </svg>
      );
    case "lock":
      return (
        <svg
          className={common}
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
        >
          <path
            d="M7 11V8a5 5 0 0 1 10 0v3"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path d="M6 11h12v10H6V11Z" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      );
    case "gift":
      return (
        <svg
          className={common}
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
        >
          <path d="M20 12v9H4v-9" strokeWidth="2" />
          <path d="M2 7h20v5H2V7Z" strokeWidth="2" />
          <path d="M12 7v14" strokeWidth="2" />
          <path
            d="M12 7H7.5C6.1 7 5 5.9 5 4.5S6.1 2 7.5 2C10 2 12 4.5 12 7Z"
            strokeWidth="2"
          />
          <path
            d="M12 7h4.5C17.9 7 19 5.9 19 4.5S17.9 2 16.5 2C14 2 12 4.5 12 7Z"
            strokeWidth="2"
          />
        </svg>
      );
    case "chat":
      return (
        <svg
          className={common}
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
        >
          <path
            d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z"
            strokeWidth="2"
          />
        </svg>
      );
  }
}
