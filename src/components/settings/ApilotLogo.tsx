import { cn } from "@/lib/utils"

interface ApilotLogoProps {
  size?: number
  className?: string
}

export function ApilotLogo({ size = 64, className }: ApilotLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
    >
      <rect x="6" y="6" width="52" height="52" rx="12" stroke="currentColor" strokeWidth="2.5" fill="none" />
      <path d="M22 15A13 13 0 0 1 42 15" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <circle cx="32" cy="12.5" r="1.8" fill="#60a5fa" />
      <path d="M32 18L19 50H26L28.5 43H35.5L38 50H45L32 18Z" fill="currentColor" />
      <path d="M26 37L32 31L38 37" stroke="var(--color-background, #0f0f10)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}
