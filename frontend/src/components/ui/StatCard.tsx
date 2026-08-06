import type { ReactNode } from 'react'

interface StatCardProps {
  icon: ReactNode
  iconBg: string
  label: string
  value: string | number
  sub?: string
  trend?: { value: string; up: boolean }
}

export default function StatCard({ icon, iconBg, label, value, sub, trend }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${iconBg}`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-500 font-medium truncate">{label}</div>
        <div className="text-xl font-bold text-gray-900 mt-0.5 truncate">{value}</div>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
        {trend && (
          <div className={`text-xs font-medium mt-0.5 ${trend.up ? 'text-coop-green' : 'text-coop-red'}`}>
            {trend.up ? '↑' : '↓'} {trend.value}
          </div>
        )}
      </div>
    </div>
  )
}
