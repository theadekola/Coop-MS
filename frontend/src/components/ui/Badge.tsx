type BadgeVariant = 'green' | 'red' | 'orange' | 'blue' | 'purple' | 'gray' | 'teal' | 'yellow'

const variants: Record<BadgeVariant, string> = {
  green: 'bg-coop-green-light text-coop-green',
  red: 'bg-coop-red-light text-coop-red',
  orange: 'bg-coop-orange-light text-coop-orange',
  blue: 'bg-coop-blue-light text-coop-blue',
  purple: 'bg-coop-purple-light text-coop-purple',
  teal: 'bg-coop-teal-light text-coop-teal',
  gray: 'bg-gray-100 text-gray-600',
  yellow: 'bg-yellow-100 text-yellow-700',
}

interface BadgeProps { label: string; variant: BadgeVariant; dot?: boolean }

export default function Badge({ label, variant, dot }: BadgeProps) {
  return (
    <span className={`badge ${variants[variant]}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full mr-1 ${
        variant === 'green' ? 'bg-coop-green' : variant === 'red' ? 'bg-coop-red' :
        variant === 'orange' ? 'bg-coop-orange' : 'bg-current'}`} />}
      {label}
    </span>
  )
}

export function statusBadge(status: string) {
  const map: Record<string, { label: string; variant: BadgeVariant }> = {
    active: { label: 'Active', variant: 'green' },
    inactive: { label: 'Inactive', variant: 'red' },
    on_leave: { label: 'On Leave', variant: 'yellow' },
    suspended: { label: 'Suspended', variant: 'red' },
    pending: { label: 'Pending', variant: 'orange' },
    approved: { label: 'Approved', variant: 'green' },
    rejected: { label: 'Rejected', variant: 'red' },
  }
  const { label, variant } = map[status] || { label: status, variant: 'gray' as BadgeVariant }
  return <Badge label={label} variant={variant} dot />
}

export function roleBadge(role: string) {
  const map: Record<string, BadgeVariant> = {
    accountant: 'blue', auditor: 'purple', cashier: 'green',
    loan_officer: 'orange', manager: 'red', staff: 'gray',
    admin: 'teal', super_admin: 'purple',
  }
  return <Badge label={role.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())} variant={map[role] || 'gray'} />
}

export function actionBadge(action: string) {
  const map: Record<string, BadgeVariant> = { CREATE: 'green', UPDATE: 'orange', DELETE: 'red' }
  return <Badge label={action} variant={map[action] || 'gray'} />
}
