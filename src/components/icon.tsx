export function Icon({
  name,
  size = 22,
}: {
  name: "bag" | "search" | "heart" | "close" | "diamond" | "home" | "user";
  size?: number;
}) {
  const paths = {
    user: (
      <>
        <circle cx="12" cy="7" r="4" />
        <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
      </>
    ),
    bag: (
      <>
        <path d="M5 7h14l1 14H4L5 7Z" />
        <path d="M8 8V6a4 4 0 0 1 8 0v2" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    heart: (
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0l-1 1-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    diamond: (
      <>
        <path d="m3 8 4-5h10l4 5-9 13L3 8Z" />
        <path d="M3 8h18M8 8l4 13 4-13" />
      </>
    ),
    home: (
      <>
        <path d="m3 10 9-8 9 8v11H3V10Z" />
        <path d="M9 21v-8h6v8" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
