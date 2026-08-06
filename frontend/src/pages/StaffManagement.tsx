import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Briefcase,
  ChevronRight,
  Download,
  Edit,
  Eye,
  Filter,
  MoreVertical,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Upload,
  UserCheck,
  UserCog,
  Users,
} from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import { statusBadge, roleBadge } from '../components/ui/Badge'
import { staffApi } from '../services/api'
import { useAuthStore } from '../store/authStore'
import type { Staff, StaffStatus, UserRole } from '../types'

const departments = ['Accounts', 'Audit', 'Management', 'Trading', 'HR', 'Operations', 'IT', 'General']
const positions = ['Super Admin', 'Admin', 'Accountant', 'Head of Accounts', 'Internal Auditor', 'Admin Manager', 'Trading Officer', 'HR Officer', 'Operations Manager', 'IT Support', 'Cashier']
const colors = ['#4f46e5', '#f59e0b', '#22c55e', '#0ea5e9', '#ec4899', '#60a5fa', '#a78bfa', '#94a3b8']
const accessRoles: UserRole[] = ['super_admin', 'admin', 'accountant', 'auditor', 'cashier', 'loan_officer', 'manager']
const protectedRoles: UserRole[] = ['super_admin', 'admin']
const roleOrder: Record<UserRole, number> = {
  super_admin: 0,
  admin: 1,
  accountant: 2,
  manager: 3,
  loan_officer: 4,
  cashier: 5,
  auditor: 6,
  staff: 7,
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'ST'
}

function csvValue(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

function downloadCsv(filename: string, headers: string[], rows: unknown[][]) {
  const csv = [headers, ...rows].map(row => row.map(csvValue).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function parseCsv(text: string) {
  return text.split(/\r?\n/).filter(Boolean).map(line => {
    const values: string[] = []
    let current = ''
    let quoted = false
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i]
      if (char === '"' && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else if (char === '"') {
        quoted = !quoted
      } else if (char === ',' && !quoted) {
        values.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    values.push(current.trim())
    return values
  })
}

function statusLabel(status: StaffStatus) {
  if (status === 'on_leave') return 'On Leave'
  if (status === 'inactive') return 'Resigned'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function sortByRolePriority(rows: Staff[]) {
  return [...rows].sort((a, b) => {
    const roleRank = (roleOrder[a.role] ?? 99) - (roleOrder[b.role] ?? 99)
    if (roleRank !== 0) return roleRank
    return a.fullName.localeCompare(b.fullName)
  })
}

export default function StaffManagement() {
  const navigate = useNavigate()
  const { user: currentUser } = useAuthStore()
  const importRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('All Departments')
  const [positionFilter, setPositionFilter] = useState('All Positions')
  const [statusFilter, setStatusFilter] = useState('All Status')
  const [showMoreFilters, setShowMoreFilters] = useState(false)
  const [staffRows, setStaffRows] = useState<Staff[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null)
  const canViewSuperAdmin = currentUser?.role === 'super_admin'
  const hasProtectedEditAccess = currentUser?.role === 'super_admin' || currentUser?.role === 'admin'
  const canEditStaff = (target: Staff) => hasProtectedEditAccess || !protectedRoles.includes(target.role)

  const loadStaff = async () => {
    setLoading(true)
    try {
      const [list, statResult] = await Promise.all([
        staffApi.list({
          search: search || undefined,
          dept: deptFilter === 'All Departments' ? undefined : deptFilter,
          status: statusFilter === 'All Status' ? undefined : statusFilter.toLowerCase().replace(/\s+/g, '_'),
          limit: 100,
        }),
        staffApi.stats(),
      ])
      setStaffRows(sortByRolePriority(list.data))
      setTotal(list.total)
      setStats(statResult)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to load staff')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadStaff() }, [search, deptFilter, statusFilter])

  const visibleStaffRows = useMemo(() => {
    const rows = canViewSuperAdmin ? staffRows : staffRows.filter(staff => staff.role !== 'super_admin')
    return sortByRolePriority(rows)
  }, [canViewSuperAdmin, staffRows])

  const filteredRows = useMemo(() => {
    const term = search.toLowerCase()
    return visibleStaffRows.filter(staff => {
      const position = staff.role.replace(/_/g, ' ')
      const matchesSearch = !term || [staff.fullName, staff.email, staff.phone, staff.employeeId, staff.department, position].some(value => value?.toLowerCase().includes(term))
      const matchesDept = deptFilter === 'All Departments' || staff.department === deptFilter
      const matchesPosition = positionFilter === 'All Positions' || position.toLowerCase() === positionFilter.toLowerCase()
      const matchesStatus = statusFilter === 'All Status' || statusLabel(staff.status) === statusFilter
      return matchesSearch && matchesDept && matchesPosition && matchesStatus
    })
  }, [visibleStaffRows, search, deptFilter, positionFilter, statusFilter])

  const directoryStats = useMemo(() => {
    const active = visibleStaffRows.filter(staff => staff.status === 'active').length
    const leave = visibleStaffRows.filter(staff => staff.status === 'on_leave').length
    const resigned = visibleStaffRows.filter(staff => staff.status === 'inactive' || staff.status === 'suspended').length
    const access = visibleStaffRows.filter(staff => accessRoles.includes(staff.role)).length
    return {
      total: visibleStaffRows.length,
      active,
      leave,
      resigned,
      access,
    }
  }, [visibleStaffRows])

  const departmentData = useMemo(() => departments.map((dept, index) => {
    const count = visibleStaffRows.filter(staff => staff.department === dept).length
    return { name: dept, value: count, color: colors[index % colors.length] }
  }).filter(item => item.value > 0), [visibleStaffRows])

  const resetFilters = () => {
    setSearch('')
    setDeptFilter('All Departments')
    setPositionFilter('All Positions')
    setStatusFilter('All Status')
    setShowMoreFilters(false)
  }

  const exportStaff = () => {
    downloadCsv(
      'staff-directory.csv',
      ['Staff ID', 'Full Name', 'Department', 'Position', 'Phone', 'Email', 'Status', 'System Access'],
      filteredRows.map(staff => [
        staff.employeeId,
        staff.fullName,
        staff.department,
        staff.role.replace(/_/g, ' '),
        staff.phone,
        staff.email,
        statusLabel(staff.status),
        accessRoles.includes(staff.role) ? 'Yes' : 'No',
      ]),
    )
    toast.success('Staff list exported')
  }

  const importStaff = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const rows = parseCsv(await file.text())
      const [headers, ...records] = rows
      const keys = headers.map(header => header.toLowerCase().trim())
      let imported = 0
      for (const record of records) {
        const row = Object.fromEntries(keys.map((key, index) => [key, record[index] || '']))
        const fullName = row['full name'] || row.name
        const email = row.email
        const phone = row.phone || row['phone number']
        if (!fullName || !email || !phone) continue
        await staffApi.create({
          fullName,
          email,
          phone,
          role: 'staff',
          department: row.department || 'General',
          password: row.password || 'Staff@12345',
        })
        imported += 1
      }
      toast.success(`${imported} staff record${imported === 1 ? '' : 's'} imported`)
      loadStaff()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to import staff file')
    } finally {
      event.target.value = ''
    }
  }

  return (
    <div className="p-4 lg:p-5 space-y-4">
      <div>
        <h2 className="page-header">Staff Management</h2>
        <nav className="text-xs text-slate-500 mt-1">Dashboard <span className="mx-1">›</span> Staff Management</nav>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        <Metric icon={<Users size={18} />} label="Total Staff" value={directoryStats.total} sub="Active staff members" tone="purple" />
        <Metric icon={<UserCheck size={18} />} label="Active Staff" value={directoryStats.active} sub="Currently employed" tone="green" />
        <Metric icon={<UserCog size={18} />} label="On Leave" value={directoryStats.leave} sub="Staff on leave" tone="amber" />
        <Metric icon={<Briefcase size={18} />} label="Resigned" value={directoryStats.resigned} sub="Separated staff" tone="blue" />
        <button onClick={() => navigate('/admin/users')} className="card p-4 text-left border-indigo-200 hover:border-indigo-400 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="h-12 w-12 shrink-0 rounded-xl grid place-items-center bg-indigo-100 text-indigo-600"><UserCog size={18} /></span>
              <div>
                <p className="text-xs font-semibold text-navy">Users with Access</p>
                <p className="text-2xl font-bold text-navy">{directoryStats.access}</p>
                <p className="text-xs text-slate-500">Have system access</p>
              </div>
            </div>
            <ChevronRight className="text-indigo-600" size={18} />
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-4">
        <section className="card p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="section-title">Staff Directory</h3>
              <p className="text-xs text-slate-500">View, search and manage all staff records.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input ref={importRef} type="file" accept=".csv" onChange={importStaff} className="hidden" />
              <button onClick={() => importRef.current?.click()} className="btn-secondary"><Upload size={14} /> Import Staff</button>
              <button onClick={exportStaff} className="btn-secondary"><Download size={14} /> Export</button>
              <button onClick={() => navigate('/staff/add')} className="btn-primary"><Plus size={14} /> Add New Staff</button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 py-3">
            <div className="relative flex-1 min-w-[230px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={event => setSearch(event.target.value)} className="input-field pl-9" placeholder="Search staff by name, ID, email or phone..." />
            </div>
            <FilterSelect value={deptFilter} onChange={setDeptFilter} options={['All Departments', ...departments]} />
            <FilterSelect value={positionFilter} onChange={setPositionFilter} options={['All Positions', ...positions]} />
            <FilterSelect value={statusFilter} onChange={setStatusFilter} options={['All Status', 'Active', 'On Leave', 'Resigned', 'Suspended']} />
            <button onClick={() => setShowMoreFilters(prev => !prev)} className="btn-secondary"><Filter size={14} /> More Filters</button>
            <button onClick={resetFilters} className="btn-secondary"><RotateCcw size={14} /> Reset</button>
          </div>

          {showMoreFilters && (
            <div className="mb-3 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-900">
              More filters are active. Use department, position, status and search together to narrow the directory.
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {['', 'Staff ID', 'Full Name', 'Department', 'Position', 'Phone', 'Email', 'Status', 'System Access', 'Actions'].map(header => (
                    <th key={header} className="table-th">{header || <input type="checkbox" aria-label="Select all staff" />}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map(staff => (
                  <tr key={staff.id} className="hover:bg-slate-50">
                    <td className="table-td"><input type="checkbox" aria-label={`Select ${staff.fullName}`} /></td>
                    <td className="table-td text-indigo-700 font-semibold">{staff.employeeId || `EMP-${String(staff.id).padStart(4, '0')}`}</td>
                    <td className="table-td">
                      <div className="flex items-center gap-2">
                        <span className="h-8 w-8 rounded-full bg-navy text-white grid place-items-center text-xs font-bold">{initials(staff.fullName)}</span>
                        <div>
                          <div className="font-semibold text-navy">{staff.fullName}</div>
                          <div className="text-[11px] text-slate-500">Joined {staff.joinedDate || '-'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="table-td">{staff.department}</td>
                    <td className="table-td capitalize">{staff.role.replace(/_/g, ' ')}</td>
                    <td className="table-td">{staff.phone || '-'}</td>
                    <td className="table-td">{staff.email}</td>
                    <td className="table-td">{statusBadge(staff.status)}</td>
                    <td className="table-td"><span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${accessRoles.includes(staff.role) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{accessRoles.includes(staff.role) ? 'Yes' : 'No'}</span></td>
                    <td className="table-td">
                      <div className="flex gap-1">
                        <button onClick={() => setSelectedStaff(staff)} className="h-7 w-7 rounded-lg border border-slate-200 grid place-items-center text-slate-600 hover:bg-slate-50" title="View staff"><Eye size={13} /></button>
                        <button
                          onClick={() => canEditStaff(staff) ? navigate('/staff/add', { state: { staff } }) : toast.error('You can view this account, but you cannot edit Admin or Super Admin roles')}
                          className={`h-7 w-7 rounded-lg border border-slate-200 grid place-items-center ${canEditStaff(staff) ? 'text-indigo-600 hover:bg-indigo-50' : 'text-slate-300 cursor-not-allowed'}`}
                          title={canEditStaff(staff) ? 'Edit staff' : 'View only for this role'}
                        >
                          <Edit size={13} />
                        </button>
                        <button onClick={() => toast.success(`${staff.fullName} selected for more actions`)} className="h-7 w-7 rounded-lg border border-slate-200 grid place-items-center text-slate-600 hover:bg-slate-50" title="More actions"><MoreVertical size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && filteredRows.length === 0 && (
                  <tr><td colSpan={10} className="table-td text-center text-slate-400">No staff records found.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-4 border-t border-slate-100">
            <span className="text-xs text-slate-500">Showing {filteredRows.length ? 1 : 0} to {filteredRows.length} of {visibleStaffRows.length} staff</span>
            <div className="flex items-center gap-2">
              <button className="page-dot bg-indigo-600 text-white">1</button>
              <button className="page-dot">2</button>
              <button className="page-dot">3</button>
              <button className="page-dot">13</button>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <Panel title="Quick Actions">
            <QuickAction icon={<Plus size={15} />} title="Add New Staff" sub="Create a new staff record" onClick={() => navigate('/staff/add')} />
            <QuickAction icon={<Upload size={15} />} title="Bulk Import" sub="Import staff from Excel/CSV" onClick={() => importRef.current?.click()} />
            <QuickAction icon={<Download size={15} />} title="Export Staff" sub="Export staff list to Excel" onClick={exportStaff} />
            <QuickAction icon={<Printer size={15} />} title="Print Staff List" sub="Generate printable list" onClick={() => window.print()} />
          </Panel>

          <Panel title="Staff by Department">
            <div className="h-44 flex items-center">
              <ResponsiveContainer width="45%" height="100%">
                <PieChart>
                  <Pie data={departmentData.length ? departmentData : [{ name: 'No data', value: 1, color: '#e5e7eb' }]} dataKey="value" innerRadius={38} outerRadius={58} paddingAngle={2}>
                    {(departmentData.length ? departmentData : [{ color: '#e5e7eb' }]).map((entry, index) => <Cell key={index} fill={entry.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1 text-xs">
                {(departmentData.length ? departmentData : [{ name: 'No staff', value: 0, color: '#94a3b8' }]).map(item => (
                  <div key={item.name} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: item.color }} />{item.name}</span>
                    <span className="font-semibold">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          <Panel title="Staff Status">
            <StatusBar label="Active" value={directoryStats.active} total={directoryStats.total} color="bg-green-500" />
            <StatusBar label="On Leave" value={directoryStats.leave} total={directoryStats.total} color="bg-amber-500" />
            <StatusBar label="Resigned" value={directoryStats.resigned} total={directoryStats.total} color="bg-rose-500" />
            <div className="flex justify-between border-t border-slate-100 pt-2 text-xs font-bold"><span>Total</span><span>{directoryStats.total} (100%)</span></div>
          </Panel>
        </aside>
      </div>

      {selectedStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="h-12 w-12 rounded-full bg-navy text-white grid place-items-center font-bold">{initials(selectedStaff.fullName)}</span>
                <div>
                  <h3 className="text-lg font-bold text-navy">{selectedStaff.fullName}</h3>
                  <p className="text-xs text-slate-500">{selectedStaff.employeeId || `EMP-${String(selectedStaff.id).padStart(4, '0')}`}</p>
                </div>
              </div>
              {statusBadge(selectedStaff.status)}
            </div>
            <div className="grid grid-cols-2 gap-3 mt-5 text-sm">
              <Info label="Department" value={selectedStaff.department} />
              <Info label="Position" value={selectedStaff.role.replace(/_/g, ' ')} />
              <Info label="Phone" value={selectedStaff.phone || '-'} />
              <Info label="Email" value={selectedStaff.email} />
              <Info label="System Access" value={accessRoles.includes(selectedStaff.role) ? 'Yes' : 'No'} />
              <Info label="Last Login" value={selectedStaff.lastLogin || '-'} />
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button className="btn-secondary" onClick={() => setSelectedStaff(null)}>Close</button>
              <button
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!canEditStaff(selectedStaff)}
                onClick={() => canEditStaff(selectedStaff) && navigate('/staff/add', { state: { staff: selectedStaff } })}
              >
                Edit Staff
              </button>
            </div>
            {!canEditStaff(selectedStaff) && <p className="mt-3 text-center text-xs text-slate-500">You can view this account, but only Admin or Super Admin can edit Admin and Super Admin roles.</p>}
          </div>
        </div>
      )}
    </div>
  )
}

function Metric({ icon, label, value, sub, tone }: { icon: ReactNode; label: string; value: number; sub: string; tone: 'purple' | 'green' | 'amber' | 'blue' }) {
  const tones = {
    purple: 'bg-indigo-100 text-indigo-600',
    green: 'bg-green-100 text-green-600',
    amber: 'bg-amber-100 text-amber-600',
    blue: 'bg-blue-100 text-blue-600',
  }
  return (
    <div className="card p-4 flex items-center gap-3">
      <span className={`h-12 w-12 shrink-0 rounded-xl grid place-items-center ${tones[tone]}`}>{icon}</span>
      <div>
        <p className="text-xs font-semibold text-navy">{label}</p>
        <p className="text-2xl font-bold text-navy">{value}</p>
        <p className="text-xs text-slate-500">{sub}</p>
      </div>
    </div>
  )
}

function FilterSelect({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: string[] }) {
  return <select value={value} onChange={event => onChange(event.target.value)} className="input-field w-auto min-w-[150px]">{options.map(option => <option key={option}>{option}</option>)}</select>
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <section className="card p-4"><h3 className="section-title mb-3">{title}</h3>{children}</section>
}

function QuickAction({ icon, title, sub, onClick }: { icon: ReactNode; title: string; sub: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 text-left hover:border-indigo-300 hover:bg-indigo-50 transition-colors">
      <span className="flex items-center gap-3">
        <span className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 grid place-items-center">{icon}</span>
        <span><span className="block text-sm font-bold text-navy">{title}</span><span className="block text-xs text-slate-500">{sub}</span></span>
      </span>
      <ChevronRight size={15} className="text-slate-400" />
    </button>
  )
}

function StatusBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const percent = total ? Math.round((value / total) * 100) : 0
  return (
    <div className="space-y-1 mb-3">
      <div className="flex justify-between text-xs"><span>{label}</span><span className="font-semibold">{value} ({percent}%)</span></div>
      <div className="h-2 rounded-full bg-slate-100"><div className={`h-2 rounded-full ${color}`} style={{ width: `${percent}%` }} /></div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-slate-500">{label}</p><p className="font-semibold text-navy capitalize break-words">{value}</p></div>
}
