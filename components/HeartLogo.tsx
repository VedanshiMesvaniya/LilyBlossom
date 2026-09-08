// Brand mark used in the header, favicon export and loading state.
// A single filled heart in the primary blossom pink, kept simple so it
// stays legible at favicon size.
export function HeartLogo({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="GL Tracker heart mark"
    >
      <path
        d="M16 27.5C16 27.5 3.5 20.4 3.5 11.9C3.5 7.9 6.7 4.7 10.6 4.7C13 4.7 15 5.9 16 7.7C17 5.9 19 4.7 21.4 4.7C25.3 4.7 28.5 7.9 28.5 11.9C28.5 20.4 16 27.5 16 27.5Z"
        fill="currentColor"
      />
    </svg>
  );
}
