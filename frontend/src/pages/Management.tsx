import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Bell, Briefcase, Building2, CalendarDays, Check, CheckCircle, ClipboardCheck, ClipboardList, FileCheck2, FileText, Folder, Hourglass, Plane, ShieldAlert, Users, X } from 'lucide-react'
import { format } from 'date-fns'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import Badge from '../components/ui/Badge'
import { auditApi, managementApi, staffApi } from '../services/api'
import type { AuditLog } from '../types'

type ApprovalRow = Record<string, unknown>
type AnnouncementRow = Record<string, unknown>

function numberValue(value: unknown) {
  return Number(value || 0)
}

function EmptyState({ text }: { text: string }) {
  return <div className="py-8 text-center text-sm text-slate-400">{text}</div>
}

function TopMetric({ icon, label, value, sub, tone, onClick }: { icon: ReactNode; label: string; value: string | number; sub: string; tone: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4 min-h-[104px] text-left hover:border-navy/30 hover:shadow-md transition-all">
      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white ${tone}`}>{icon}</div>
      <div>
        <div className="text-xs font-semibold text-slate-600">{label}</div>
        <div className="text-2xl font-bold text-slate-950 mt-1">{value}</div>
        <div className="text-xs text-slate-500 mt-1">{sub}</div>
      </div>
    </button>
  )
}

function SummaryTile({ icon, label, value, tone, onClick }: { icon: ReactNode; label: string; value: string | number; tone: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="border border-slate-200 rounded-xl p-4 flex items-center gap-4 bg-white text-left hover:border-navy/30 hover:shadow-sm transition-all">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tone}`}>{icon}</div>
      <div>
        <div className="text-xs text-slate-600 font-medium">{label}</div>
        <div className="text-xl font-bold text-slate-950 mt-1">{value}</div>
      </div>
    </button>
  )
}

function approvalBadge(type: string) {
  const normalized = type.toLowerCase()
  if (normalized.includes('loan')) return <Badge label={type || 'Loan'} variant="green" />
  if (normalized.includes('expense')) return <Badge label={type || 'Expense'} variant="blue" />
  if (normalized.includes('payment')) return <Badge label={type || 'Payment'} variant="orange" />
  if (normalized.includes('leave')) return <Badge label={type || 'Leave'} variant="purple" />
  if (normalized.includes('contract')) return <Badge label={type || 'Contract'} variant="teal" />
  return <Badge label={type || 'Item'} variant="gray" />
}

export default function Management() {
  const navigate = useNavigate()
  const [approvals, setApprovals] = useState<ApprovalRow[]>([])
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([])
  const [activities, setActivities] = useState<AuditLog[]>([])
  const [stats, setStats] = useState<Record<string, number>>({})
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '' })
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false)
  const [announcementView, setAnnouncementView] = useState<'all' | 'meetings' | 'documents' | null>(null)
  const [showAllApprovals, setShowAllApprovals] = useState(false)
  const [showTaskDetails, setShowTaskDetails] = useState(false)
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRow | null>(null)

  const loadManagement = async () => {
    try {
      const [approvalRows, announcementRows, staffStats, auditResult] = await Promise.all([
        managementApi.approvals(),
        managementApi.announcements(),
        staffApi.stats(),
        auditApi.logs({ module: 'Management', limit: 8 }),
      ])
      setApprovals(approvalRows)
      setAnnouncements(announcementRows)
      setStats(staffStats)
      setActivities(auditResult.data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to load management data')
    }
  }

  useEffect(() => { loadManagement() }, [])

  const review = async (id: number, status: 'approved' | 'rejected') => {
    try {
      await managementApi.reviewApproval(id, status)
      toast.success(`Approval ${status}`)
      setSelectedApproval(null)
      loadManagement()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to update approval')
    }
  }

  const createAnnouncement = async () => {
    try {
      if (!newAnnouncement.title.trim() || !newAnnouncement.content.trim()) throw new Error('Enter title and content')
      await managementApi.createAnnouncement({ ...newAnnouncement, category: 'Management' })
      toast.success('Announcement posted')
      setNewAnnouncement({ title: '', content: '' })
      setShowAnnouncementModal(false)
      loadManagement()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to post announcement')
    }
  }

  const pendingApprovals = approvals.filter(a => String(a.Status) === 'pending')
  const approved = approvals.filter(a => String(a.Status) === 'approved').length
  const rejected = approvals.filter(a => String(a.Status) === 'rejected').length
  const pending = pendingApprovals.length
  const totalTasks = approvals.length

  const taskData = useMemo(() => [
    { name: 'Completed', value: approved, color: '#16A34A' },
    { name: 'In Progress', value: rejected, color: '#F97316' },
    { name: 'Pending', value: pending, color: '#2563EB' },
  ], [approved, rejected, pending])
  const hasTaskData = taskData.some(item => item.value > 0)

  const meetings = announcements.filter(item => String(item.Category ?? '').toLowerCase().includes('meeting'))
  const documents = announcements.filter(item => {
    const category = String(item.Category ?? '').toLowerCase()
    return category.includes('policy') || category.includes('document')
  })
  const visibleAnnouncements = announcementView === 'meetings' ? meetings
    : announcementView === 'documents' ? documents
    : announcements

  return (
    <div className="p-5 space-y-5 bg-slate-50 min-h-full">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-950">Management Overview</h2>
          <p className="text-sm text-slate-500 mt-1">Overview of cooperative management activities and performance.</p>
        </div>
        <div className="hidden md:flex items-center gap-2 text-sm text-slate-600">
          <CalendarDays size={16} />
          <span>{format(new Date(), 'EEEE, do MMMM yyyy')}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
        <TopMetric onClick={() => navigate('/staff')} icon={<Users size={22} />} tone="bg-indigo-600" label="Total Staff" value={stats.TotalStaff ?? 0} sub="All staff" />
        <TopMetric onClick={() => setShowTaskDetails(true)} icon={<ClipboardCheck size={22} />} tone="bg-green-600" label="Tasks Assigned" value={totalTasks} sub="This month" />
        <TopMetric onClick={() => setShowAllApprovals(true)} icon={<Hourglass size={22} />} tone="bg-amber-500" label="Pending Tasks" value={pending} sub="Awaiting completion" />
        <TopMetric onClick={() => setShowAllApprovals(true)} icon={<FileCheck2 size={22} />} tone="bg-blue-600" label="Approvals Pending" value={pending} sub="Requires action" />
        <TopMetric onClick={() => setAnnouncementView('meetings')} icon={<Users size={22} />} tone="bg-purple-600" label="Meetings This Month" value={meetings.length} sub={`Completed: ${0}`} />
        <TopMetric onClick={() => setAnnouncementView('documents')} icon={<Check size={24} />} tone="bg-teal-600" label="Policies & Documents" value={documents.length} sub="Active documents" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <section className="xl:col-span-4 bg-white border border-slate-200 rounded-xl shadow-sm p-5">
          <h3 className="font-bold text-slate-900 mb-4">Management Summary</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <SummaryTile onClick={() => setShowTaskDetails(true)} icon={<Folder size={20} className="text-blue-600" />} tone="bg-blue-50" label="Active Projects" value={totalTasks} />
            <SummaryTile onClick={() => navigate('/staff')} icon={<Building2 size={20} className="text-purple-600" />} tone="bg-purple-50" label="Total Departments" value={stats.TotalDepts ?? 0} />
            <SummaryTile onClick={() => setShowTaskDetails(true)} icon={<CheckCircle size={20} className="text-green-600" />} tone="bg-green-50" label="Completed Projects" value={approved} />
            <SummaryTile onClick={() => navigate('/staff')} icon={<Users size={20} className="text-amber-600" />} tone="bg-amber-50" label="Department Heads" value={0} />
            <SummaryTile onClick={() => setShowAllApprovals(true)} icon={<ShieldAlert size={20} className="text-red-600" />} tone="bg-red-50" label="Overdue Tasks" value={0} />
            <SummaryTile onClick={() => navigate('/staff')} icon={<Plane size={20} className="text-teal-600" />} tone="bg-teal-50" label="Staff on Leave" value={stats.OnLeave ?? 0} />
          </div>
        </section>

        <section className="xl:col-span-4 bg-white border border-slate-200 rounded-xl shadow-sm p-5">
          <h3 className="font-bold text-slate-900 mb-4">Tasks by Status</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <div className="h-52">
              {hasTaskData ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={taskData} dataKey="value" innerRadius={54} outerRadius={82}>
                      {taskData.map(item => <Cell key={item.name} fill={item.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : <EmptyState text="No tasks available." />}
            </div>
            <div className="space-y-4">
              {taskData.map(item => {
                const pct = totalTasks ? Math.round((item.value / totalTasks) * 100) : 0
                return (
                  <div key={item.name} className="flex items-start gap-3">
                    <span className="w-2.5 h-2.5 rounded-full mt-1.5" style={{ background: item.color }} />
                    <div>
                      <div className="text-sm text-slate-700">{item.name}</div>
                      <div className="text-sm font-bold text-slate-950">{item.value} ({pct}%)</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <section className="xl:col-span-4 bg-white border border-slate-200 rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900">Upcoming Meetings</h3>
            <button onClick={() => setAnnouncementView('meetings')} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-navy hover:bg-slate-50">View All</button>
          </div>
          <div className="space-y-3">
            {meetings.map((meeting, index) => (
              <div key={String(meeting.AnnouncementID ?? index)} className="border border-slate-100 rounded-xl p-3 flex gap-3">
                <div className="w-12 h-12 rounded-lg bg-red-50 border border-red-100 flex flex-col items-center justify-center text-red-600">
                  <span className="text-[10px] font-bold">{meeting.PublishedAt ? format(new Date(String(meeting.PublishedAt)), 'MMM').toUpperCase() : 'DATE'}</span>
                  <span className="text-lg font-bold">{meeting.PublishedAt ? format(new Date(String(meeting.PublishedAt)), 'dd') : '--'}</span>
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900 truncate">{String(meeting.Title ?? '')}</div>
                  <div className="text-xs text-slate-500 mt-1">{String(meeting.Content ?? '')}</div>
                  <div className="text-xs text-slate-400 mt-1">By {String(meeting.PublishedBy ?? '')}</div>
                </div>
              </div>
            ))}
            {meetings.length === 0 && <EmptyState text="No upcoming meetings." />}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900">Recent Management Activities</h3>
            <button onClick={() => navigate('/audit')} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-navy hover:bg-slate-50">View All</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr>
                {['Activity', 'By', 'Department', 'Date & Time'].map(header => (
                  <th key={header} className="text-left text-xs font-semibold text-slate-600 px-4 py-3 bg-slate-50">{header}</th>
                ))}
              </tr></thead>
              <tbody>
                {activities.map((activity, index) => (
                  <tr key={String(activity.id ?? index)} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-sm text-slate-800">{String(activity.description ?? '')}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{String(activity.staffName ?? '')}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{String(activity.module ?? 'Management')}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{activity.dateTime ? new Date(String(activity.dateTime)).toLocaleString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {activities.length === 0 && <EmptyState text="No management activities yet." />}
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900">Pending Approvals</h3>
            <button onClick={() => setShowAllApprovals(true)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-navy hover:bg-slate-50">View All</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr>
                {['Item', 'Type', 'Submitted By', 'Date', 'Action'].map(header => (
                  <th key={header} className="text-left text-xs font-semibold text-slate-600 px-4 py-3 bg-slate-50">{header}</th>
                ))}
              </tr></thead>
              <tbody>
                {pendingApprovals.map(approval => (
                  <tr key={String(approval.ApprovalID)} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-sm text-slate-800">{String(approval.ItemDescription ?? '')}</td>
                    <td className="px-4 py-3">{approvalBadge(String(approval.ItemType ?? 'Item'))}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{String(approval.SubmittedBy ?? '')}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{approval.SubmittedAt ? new Date(String(approval.SubmittedAt)).toLocaleDateString() : '-'}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => setSelectedApproval(approval)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-navy hover:bg-slate-50">Review</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pendingApprovals.length === 0 && <EmptyState text="No pending approvals." />}
          </div>
        </section>
      </div>

      <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Bell size={22} className="text-blue-600" />
            <h3 className="font-bold text-slate-900">Management Announcements</h3>
          </div>
          <button onClick={() => setShowAnnouncementModal(true)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-navy hover:bg-slate-50">New Announcement</button>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {visibleAnnouncements.map((announcement, index) => (
            <div key={String(announcement.AnnouncementID ?? index)} className="rounded-xl border border-blue-100 bg-blue-50 p-4 flex gap-3">
              <Bell size={22} className="text-blue-600 mt-1" />
              <div>
                <div className="font-bold text-slate-900 text-sm">{String(announcement.Title ?? '')}</div>
                <div className="text-sm text-slate-600 mt-2">{String(announcement.Content ?? '')}</div>
                <div className="text-xs text-slate-500 mt-3">By {String(announcement.PublishedBy ?? '')} • {announcement.PublishedAt ? new Date(String(announcement.PublishedAt)).toLocaleString() : ''}</div>
              </div>
            </div>
          ))}
          {visibleAnnouncements.length === 0 && <EmptyState text={announcementView === 'meetings' ? 'No upcoming meetings.' : announcementView === 'documents' ? 'No active documents.' : 'No active announcements.'} />}
        </div>
      </section>

      {announcementView && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-3xl p-5 shadow-xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">
                {announcementView === 'meetings' ? 'All Meetings' : announcementView === 'documents' ? 'Policies & Documents' : 'All Announcements'}
              </h3>
              <button onClick={() => setAnnouncementView(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              {visibleAnnouncements.map((item, index) => (
                <div key={String(item.AnnouncementID ?? index)} className="border border-slate-100 rounded-xl p-4">
                  <div className="font-bold text-slate-900">{String(item.Title ?? '')}</div>
                  <div className="text-sm text-slate-600 mt-2">{String(item.Content ?? '')}</div>
                  <div className="text-xs text-slate-400 mt-3">By {String(item.PublishedBy ?? '')} • {item.PublishedAt ? new Date(String(item.PublishedAt)).toLocaleString() : ''}</div>
                </div>
              ))}
              {visibleAnnouncements.length === 0 && <EmptyState text="No records found." />}
            </div>
          </div>
        </div>
      )}

      {showAllApprovals && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-5xl p-5 shadow-xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">All Approvals</h3>
              <button onClick={() => setShowAllApprovals(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><X size={16} /></button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr>
                  {['Item', 'Type', 'Submitted By', 'Date', 'Status', 'Action'].map(header => (
                    <th key={header} className="text-left text-xs font-semibold text-slate-600 px-4 py-3 bg-slate-50">{header}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {approvals.map(approval => (
                    <tr key={String(approval.ApprovalID)} className="border-t border-slate-100">
                      <td className="px-4 py-3 text-sm text-slate-800">{String(approval.ItemDescription ?? '')}</td>
                      <td className="px-4 py-3">{approvalBadge(String(approval.ItemType ?? 'Item'))}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{String(approval.SubmittedBy ?? '')}</td>
                      <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{approval.SubmittedAt ? new Date(String(approval.SubmittedAt)).toLocaleDateString() : '-'}</td>
                      <td className="px-4 py-3 text-xs text-slate-600 capitalize">{String(approval.Status ?? '')}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => { setShowAllApprovals(false); setSelectedApproval(approval) }} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-navy hover:bg-slate-50">Review</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {approvals.length === 0 && <EmptyState text="No approvals found." />}
            </div>
          </div>
        </div>
      )}

      {showTaskDetails && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Task Status Details</h3>
              <button onClick={() => setShowTaskDetails(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              {taskData.map(item => (
                <div key={item.name} className="flex items-center justify-between border border-slate-100 rounded-xl p-3">
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full" style={{ background: item.color }} />
                    <span className="font-semibold text-slate-800">{item.name}</span>
                  </div>
                  <span className="font-bold text-slate-950">{item.value}</span>
                </div>
              ))}
              <button onClick={() => { setShowTaskDetails(false); setShowAllApprovals(true) }} className="w-full btn-primary bg-navy justify-center">Open Approval Records</button>
            </div>
          </div>
        </div>
      )}

      {selectedApproval && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Review Approval</h3>
                <p className="text-sm text-slate-500 mt-1">{String(selectedApproval.ItemDescription ?? '')}</p>
              </div>
              <button onClick={() => setSelectedApproval(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><X size={16} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm mt-4">
              <div><div className="text-xs text-slate-400">Type</div><div className="font-medium">{String(selectedApproval.ItemType ?? '-')}</div></div>
              <div><div className="text-xs text-slate-400">Submitted By</div><div className="font-medium">{String(selectedApproval.SubmittedBy ?? '-')}</div></div>
              <div className="col-span-2"><div className="text-xs text-slate-400">Submitted On</div><div className="font-medium">{selectedApproval.SubmittedAt ? new Date(String(selectedApproval.SubmittedAt)).toLocaleString() : '-'}</div></div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => review(numberValue(selectedApproval.ApprovalID), 'rejected')} className="flex-1 btn-secondary justify-center text-red-600">Reject</button>
              <button onClick={() => review(numberValue(selectedApproval.ApprovalID), 'approved')} className="flex-1 btn-primary bg-navy justify-center">Approve</button>
            </div>
          </div>
        </div>
      )}

      {showAnnouncementModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">New Announcement</h3>
              <button onClick={() => setShowAnnouncementModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <input value={newAnnouncement.title} onChange={event => setNewAnnouncement(prev => ({ ...prev, title: event.target.value }))} className="input-field" placeholder="Announcement title" />
              <textarea value={newAnnouncement.content} onChange={event => setNewAnnouncement(prev => ({ ...prev, content: event.target.value }))} className="input-field min-h-28 resize-none" placeholder="Announcement content" />
              <button onClick={createAnnouncement} className="w-full btn-primary bg-navy justify-center">Post Announcement</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
