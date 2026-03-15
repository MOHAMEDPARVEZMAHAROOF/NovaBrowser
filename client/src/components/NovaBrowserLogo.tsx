export function NovaBrowserLogo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-label="NovaBrowser logo"
    >
      {/* Outer ring - browser globe */}
      <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      {/* Inner star / nova burst */}
      <path
        d="M16 4L18.5 12.5L27 14L18.5 17L16 28L13.5 17L5 14L13.5 12.5L16 4Z"
        fill="currentColor"
        opacity="0.9"
      />
      {/* Center dot */}
      <circle cx="16" cy="15.5" r="2.5" fill="currentColor" opacity="0.6" />
    </svg>
  );
}
