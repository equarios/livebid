import { useId } from 'react'

function batteryFill(pct: number) {
  if (pct >= 90) return '#16a34a'
  if (pct >= 80) return '#22c55e'
  if (pct >= 70) return '#ca8a04'
  return '#dc2626'
}

export function BatteryMark({
  value,
  size = 18,
}: {
  value: number
  size?: number
}) {
  const shineId = useId().replace(/:/g, '')
  const pct = Math.max(0, Math.min(100, Math.round(value)))
  const fill = batteryFill(pct)
  const inner = 18
  const w = Math.max(pct > 0 ? 1.6 : 0, (inner * pct) / 100)

  return (
    <span className="batt-mark" title={`Battery ${pct}%`}>
      <svg
        viewBox="0 0 26 20"
        width={size}
        height={Math.round((size * 20) / 26)}
        aria-hidden
      >
        <defs>
          <linearGradient id={shineId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.45" />
            <stop offset="55%" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect
          x="1.2"
          y="3.6"
          width="21.2"
          height="12.8"
          rx="3.2"
          fill="#f8fafc"
          stroke="#334155"
          strokeWidth="1.4"
        />
        <rect x="22.8" y="7.2" width="2.4" height="5.6" rx="1" fill="#334155" />
        <rect x="3" y="5.4" width={w} height="9.2" rx="1.8" fill={fill} />
        <rect x="3" y="5.4" width={w} height="9.2" rx="1.8" fill={`url(#${shineId})`} />
      </svg>
      <span className="batt-mark-pct">{pct}%</span>
    </span>
  )
}
