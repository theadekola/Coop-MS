export default function CoopLogo({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="32" cy="32" r="30" fill="#162350" stroke="#F5A623" strokeWidth="2" />
      {/* Crown/laurel wreath */}
      <path d="M16 28 C16 20 24 16 32 16 C40 16 48 20 48 28" stroke="#F5A623" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M14 30 C14 18 22 12 32 12 C42 12 50 18 50 30" stroke="#F5A623" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeDasharray="2 2" />
      {/* Star */}
      <polygon points="32,18 33.5,22.5 38,22.5 34.5,25 36,30 32,27 28,30 29.5,25 26,22.5 30.5,22.5" fill="#F5A623" />
      {/* Cross/Plus symbol */}
      <rect x="29" y="33" width="6" height="14" rx="1" fill="#F5A623" />
      <rect x="24" y="38" width="16" height="4" rx="1" fill="#F5A623" />
      {/* Bottom banner */}
      <path d="M18 48 Q32 52 46 48" stroke="#F5A623" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  )
}
