// Original mark for Zim Fantasy Football — not affiliated with, and not
// derived from, any real club crest or league branding.
export function Logo({ size = 44, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Zim Fantasy Football"
    >
      <circle cx="50" cy="50" r="47" fill="#15803D" />
      <circle cx="50" cy="50" r="47" fill="none" stroke="#CA8A04" strokeWidth="3" />
      <circle cx="50" cy="36" r="17" fill="#FFFFFF" />
      <polygon points="50,26 58,32 55,41 45,41 42,32" fill="#0F172A" />
      <path d="M33 36 L42 32 M67 36 L58 32 M45 41 L41 51 M55 41 L59 51 M50 26 L50 19"
        stroke="#0F172A" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <text x="50" y="76" textAnchor="middle" fontFamily="'Bebas Neue', Impact, sans-serif"
        fontSize="22" letterSpacing="2" fill="#FFFFFF">ZFF</text>
    </svg>
  );
}
