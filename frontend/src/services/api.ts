import axios from 'axios'
import type { Account, AccountType, AuditLog, Report, Staff, StaffStatus, Transaction, TransactionType, User, UserRole } from '../types'

type ApiResponse<T> = {
  success: boolean
  message?: string
  data: T
  token?: string
  user?: Partial<User> & Record<string, unknown>
  requires2FA?: boolean
  tempUserId?: number
  total?: number
  page?: number
  limit?: number
  stats?: Record<string, number>
  totalDebit?: number
  totalCredit?: number
  isBalanced?: boolean
  downloadUrl?: string
}

export type Paginated<T> = {
  data: T[]
  total: number
  page?: number
  limit?: number
}

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
})

export function isAuthError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'isAuthError' in error)
}

api.interceptors.request.use(config => {
  const raw = localStorage.getItem('auth-storage')
  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      const token = parsed?.state?.token
      if (token) config.headers.Authorization = `Bearer ${token}`
    } catch {
      localStorage.removeItem('auth-storage')
    }
  }
  return config
})

api.interceptors.response.use(
  response => response,
  error => {
    if (error?.response?.status === 401) {
      const message = error.response.data?.message || 'Request failed'
      const requestUrl = String(error.config?.url || '')
      const isAuthRequest = requestUrl.startsWith('/auth/')
      const isLoginPage = window.location.pathname === '/login'

      if (isAuthRequest || isLoginPage) {
        return Promise.reject(new Error(message))
      }

      localStorage.removeItem('auth-storage')
      sessionStorage.setItem('auth-session-expired', '1')
      const authError = Object.assign(new Error('Your session has expired. Please sign in again.'), { isAuthError: true })
      window.location.replace('/login')
      return Promise.reject(authError)
    }
    return Promise.reject(error)
  }
)

function read<T>(response: { data: ApiResponse<T> }): T {
  if (!response.data.success) throw new Error(response.data.message || 'Request failed')
  return response.data.data
}

function normalizeRole(role?: string): UserRole {
  const value = (role || 'staff').toLowerCase().replace(/\s+/g, '_')
  const valid: UserRole[] = ['super_admin', 'admin', 'accountant', 'auditor', 'cashier', 'loan_officer', 'manager', 'staff']
  return valid.includes(value as UserRole) ? value as UserRole : 'staff'
}

function normalizeStatus(status?: string): StaffStatus {
  const value = (status || 'active').toLowerCase().replace(/\s+/g, '_')
  const valid: StaffStatus[] = ['active', 'inactive', 'on_leave', 'suspended']
  return valid.includes(value as StaffStatus) ? value as StaffStatus : 'active'
}

export function normalizeUser(raw: Partial<User> & Record<string, unknown>): User {
  return {
    id: Number(raw.id ?? raw.StaffID ?? raw.staffId ?? 0),
    fullName: String(raw.fullName ?? raw.FullName ?? 'User'),
    email: String(raw.email ?? raw.Email ?? ''),
    role: normalizeRole(String(raw.role ?? raw.Role ?? 'staff')),
    department: String(raw.department ?? raw.Department ?? raw.DeptName ?? 'General'),
    employeeId: String(raw.employeeId ?? raw.EmployeeID ?? ''),
    avatar: raw.avatar as string | undefined,
    status: normalizeStatus(String(raw.status ?? raw.Status ?? 'active')),
    lastLogin: raw.lastLogin || raw.LastLogin ? String(raw.lastLogin ?? raw.LastLogin) : undefined,
    twoFactorEnabled: Boolean(raw.twoFactorEnabled ?? raw.TwoFactorEnabled ?? false),
    phone: String(raw.phone ?? raw.Phone ?? ''),
    joinedDate: String(raw.joinedDate ?? raw.JoinedDate ?? ''),
  }
}

function normalizeStaff(raw: Record<string, unknown>): Staff {
  return { ...normalizeUser(raw), photo: raw.photo as string | undefined }
}

function normalizeTransaction(raw: Record<string, unknown>): Transaction {
  return {
    id: Number(raw.id ?? raw.TxnID),
    date: String(raw.date ?? raw.TxnDate ?? ''),
    description: String(raw.description ?? raw.Description ?? ''),
    account: String(raw.account ?? raw.AccountName ?? ''),
    reference: String(raw.reference ?? raw.Reference ?? ''),
    type: String(raw.type ?? raw.TxnType ?? 'income') as TransactionType,
    debit: Number(raw.debit ?? raw.DebitAmount ?? 0),
    credit: Number(raw.credit ?? raw.CreditAmount ?? 0),
    balance: Number(raw.balance ?? raw.Balance ?? 0),
    paymentMethod: String(raw.paymentMethod ?? raw.PaymentMethod ?? ''),
    chequeNumber: raw.chequeNumber || raw.ChequeNumber ? String(raw.chequeNumber ?? raw.ChequeNumber) : undefined,
    postedBy: String(raw.postedBy ?? raw.PostedBy ?? ''),
  }
}

function normalizeAccount(raw: Record<string, unknown>): Account {
  const debit = Number(raw.debit ?? raw.TotalDebit ?? 0)
  const credit = Number(raw.credit ?? raw.TotalCredit ?? 0)
  return {
    id: Number(raw.id ?? raw.AccountID ?? 0),
    code: String(raw.code ?? raw.AccountCode ?? ''),
    name: String(raw.name ?? raw.AccountName ?? ''),
    type: String(raw.type ?? raw.AccountType ?? 'asset').toLowerCase() as AccountType,
    debit,
    credit,
    balance: Number(raw.balance ?? raw.Balance ?? debit - credit),
  }
}

function normalizeAuditLog(raw: Record<string, unknown>): AuditLog {
  return {
    id: Number(raw.id ?? raw.LogID),
    dateTime: String(raw.dateTime ?? raw.CreatedAt ?? ''),
    staffName: String(raw.staffName ?? raw.StaffName ?? ''),
    action: String(raw.action ?? raw.ActionType ?? 'CREATE') as AuditLog['action'],
    module: String(raw.module ?? raw.Module ?? ''),
    description: String(raw.description ?? raw.Description ?? ''),
    oldValue: raw.oldValue || raw.OldValue ? String(raw.oldValue ?? raw.OldValue) : undefined,
    newValue: raw.newValue || raw.NewValue ? String(raw.newValue ?? raw.NewValue) : undefined,
    ipAddress: String(raw.ipAddress ?? raw.IPAddress ?? ''),
  }
}

function normalizeReport(raw: Record<string, unknown>): Report {
  const from = raw.DateFrom ? new Date(String(raw.DateFrom)).toLocaleDateString() : ''
  const to = raw.DateTo ? new Date(String(raw.DateTo)).toLocaleDateString() : ''
  return {
    id: Number(raw.id ?? raw.ReportID),
    name: String(raw.name ?? raw.ReportName ?? ''),
    type: String(raw.type ?? raw.ReportType ?? raw.Category ?? ''),
    period: String(raw.period ?? (from && to ? `${from} - ${to}` : '')),
    generatedBy: String(raw.generatedBy ?? raw.GeneratedBy ?? ''),
    generatedOn: String(raw.generatedOn ?? raw.GeneratedAt ?? ''),
    format: String(raw.format ?? raw.Format ?? 'PDF') as Report['format'],
  }
}

export const authApi = {
  async login(email: string, password: string) {
    const response = await api.post<ApiResponse<never> & { token?: string; user?: Record<string, unknown> }>('/auth/login', { email, password })
    if (!response.data.success) throw new Error(response.data.message || 'Login failed')
    return {
      requires2FA: Boolean(response.data.requires2FA),
      tempUserId: response.data.tempUserId,
      token: response.data.token,
      user: response.data.user ? normalizeUser(response.data.user) : undefined,
      message: response.data.message,
    }
  },
  async registerAdmin(payload: { fullName: string; email: string; phone: string; password: string; role?: 'admin' | 'super_admin' }) {
    return read<Record<string, unknown>>(await api.post('/auth/register-admin', payload))
  },
  async verify2FA(staffId: number, otp: string) {
    const response = await api.post<ApiResponse<never> & { token: string; user: Record<string, unknown> }>('/auth/verify-2fa', { staffId, otp })
    if (!response.data.success || !response.data.token || !response.data.user) throw new Error(response.data.message || 'OTP verification failed')
    return { token: response.data.token, user: normalizeUser(response.data.user) }
  },
  async me() {
    return normalizeUser(read<Record<string, unknown>>(await api.get('/auth/me')))
  },
  async updateMe(payload: { fullName: string; email: string; phone: string; employeeId?: string; role?: UserRole; department?: string }) {
    return normalizeUser(read<Record<string, unknown>>(await api.put('/auth/me', payload)))
  },
  async changePassword(payload: { currentPassword: string; newPassword: string }) {
    return read<boolean>(await api.post('/auth/change-password', payload))
  },
  async verifyPasswordResetKey(payload: { email: string; passwordResetKey: string }) {
    return read<boolean>(await api.post('/auth/password-reset/verify', payload))
  },
  async completePasswordReset(payload: { email: string; passwordResetKey: string; newPassword: string }) {
    return read<{ changedAt: string }>(await api.post('/auth/password-reset/complete', payload))
  },
  async setTwoFactor(enabled: boolean) {
    return read<{ twoFactorEnabled: boolean }>(await api.put('/auth/2fa', { enabled }))
  },
  logout: () => api.post('/auth/logout'),
}

export const staffApi = {
  async list(params: Record<string, string | number | undefined> = {}): Promise<Paginated<Staff>> {
    const response = await api.get<ApiResponse<Record<string, unknown>[]>>('/staff', { params })
    return {
      data: (response.data.data || []).map(normalizeStaff),
      total: response.data.total || 0,
      page: response.data.page,
      limit: response.data.limit,
    }
  },
  async create(payload: { fullName: string; email: string; phone: string; role: UserRole; deptId?: number; department?: string; password?: string; passwordResetKey?: string }) {
    return read(await api.post('/staff', payload))
  },
  async update(id: number, payload: Partial<Staff> & { deptId?: number; passwordResetKey?: string }) {
    return read(await api.put(`/staff/${id}`, payload))
  },
  async resetPassword(id: number) {
    return read<{ temporaryPassword: string }>(await api.post(`/staff/${id}/reset-password`))
  },
  async stats() {
    return read<Record<string, number>>(await api.get('/staff/dashboard-stats'))
  },
}

export const accountsApi = {
  async transactions(params: Record<string, string | number | undefined> = {}): Promise<Paginated<Transaction>> {
    const response = await api.get<ApiResponse<Record<string, unknown>[]>>('/accounts/transactions', { params })
    return { data: (response.data.data || []).map(normalizeTransaction), total: response.data.total || 0 }
  },
  async summary() {
    return read<Record<string, number>>(await api.get('/accounts/summary'))
  },
  async trialBalance(params: Record<string, string | undefined> = {}) {
    const response = await api.get<ApiResponse<Record<string, unknown>[]>>('/accounts/trial-balance', { params })
    return {
      accounts: (response.data.data || []).map(normalizeAccount),
      totalDebit: response.data.totalDebit || 0,
      totalCredit: response.data.totalCredit || 0,
      isBalanced: Boolean(response.data.isBalanced),
    }
  },
  async createTransaction(payload: { description: string; accountId: number; txnType: TransactionType; amount: number; paymentMethod: string; chequeNumber?: string; notes?: string }) {
    return read(await api.post('/accounts/transactions', payload))
  },
  async tradingAccount(year: number) {
    return read<{
      year: number
      summary: { TotalSales: number; TotalPurchases: number; GrossProfit: number }
      monthly: { MonthNo: number; Profit: number }[]
      byAccount: { AccountName: string; Amount: number; TxnType: TransactionType }[]
    }>(await api.get('/accounts/trading-account', { params: { year } }))
  },
}

export const auditApi = {
  async logs(params: Record<string, string | number | undefined> = {}) {
    const response = await api.get<ApiResponse<Record<string, unknown>[]>>('/audit/logs', { params })
    return {
      data: (response.data.data || []).map(normalizeAuditLog),
      stats: response.data.stats || {},
    }
  },
  async export() {
    return api.get<ApiResponse<never> & { downloadUrl?: string }>('/audit/export').then(r => r.data)
  },
  async clearOld(days: number) {
    return read<{ deleted: number }>(await api.delete('/audit/logs/old', { params: { days } }))
  },
}

export const reportsApi = {
  async list(params: Record<string, string | number | undefined> = {}) {
    const response = await api.get<ApiResponse<Record<string, unknown>[]>>('/reports', { params })
    return (response.data.data || []).map(normalizeReport)
  },
  async generateTrialBalance(payload: { from?: string; to?: string; format?: 'PDF' | 'Excel' }) {
    return api.post<ApiResponse<Record<string, unknown>[]>>('/reports/trial-balance', payload).then(r => r.data)
  },
  async generateIncomeExpense(payload: { from: string; to: string; format?: 'PDF' | 'Excel' }) {
    return api.post<ApiResponse<Record<string, unknown>[]>>('/reports/income-expense', payload).then(r => r.data)
  },
}

export const dashboardApi = {
  async get() {
    return read<{
      summary: Record<string, number>
      transactions: Record<string, unknown>[]
      approvals: Record<string, unknown>[]
      announcements: Record<string, unknown>[]
      dailyTrend: Record<string, unknown>[]
      staffActivity: Record<string, unknown>[]
    }>(await api.get('/dashboard'))
  },
}

export const managementApi = {
  async approvals(status?: string) {
    return read<Record<string, unknown>[]>(await api.get('/management/approvals', { params: { status } }))
  },
  async reviewApproval(id: number, status: 'approved' | 'rejected', comments?: string) {
    return read(await api.put(`/management/approvals/${id}`, { status, comments }))
  },
  async announcements() {
    return read<Record<string, unknown>[]>(await api.get('/management/announcements'))
  },
  async createAnnouncement(payload: { title: string; content: string; category?: string; expiresAt?: string }) {
    return read(await api.post('/management/announcements', payload))
  },
}

export const chatApi = {
  async rooms() {
    const rows = read<Record<string, unknown>[]>(await api.get('/chat/rooms'))
    return rows.map(row => ({
      id: Number(row.RoomID ?? row.id),
      name: String(row.RoomName ?? row.name ?? ''),
      lastMessage: String(row.LastMessage ?? row.lastMessage ?? 'No messages yet'),
      timestamp: row.LastMessageAt ? new Date(String(row.LastMessageAt)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
      unreadCount: 0,
      isOnline: false,
      type: String(row.RoomType ?? row.type ?? 'group') as 'direct' | 'group' | 'channel',
      role: `${Number(row.MemberCount ?? 1)} member(s)`,
    }))
  },
  async createRoom(payload: { name: string; type: 'direct' | 'group' | 'channel'; memberIds?: number[] }) {
    return read<Record<string, unknown>>(await api.post('/chat/rooms', payload))
  },
  async messages(roomId: number) {
    const rows = read<Record<string, unknown>[]>(await api.get(`/chat/rooms/${roomId}/messages`))
    return rows.map(row => ({
      id: Number(row.MessageID ?? row.id),
      senderId: Number(row.SenderID ?? row.senderId),
      senderName: String(row.SenderName ?? row.senderName ?? 'User'),
      content: String(row.Content ?? row.content ?? ''),
      timestamp: row.SentAt ? new Date(String(row.SentAt)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
      type: String(row.MessageType ?? 'text') === 'file' ? 'file' as const : 'text' as const,
      fileName: row.FileName ? String(row.FileName) : undefined,
      fileSize: row.FileSize ? `${Math.round(Number(row.FileSize) / 1024)} KB` : undefined,
      isRead: true,
    }))
  },
  async sendMessage(roomId: number, content: string, options?: { type?: 'text' | 'file'; fileName?: string; fileSize?: number }) {
    const row = read<Record<string, unknown>>(await api.post(`/chat/rooms/${roomId}/messages`, { content, ...options }))
    return {
      id: Number(row.MessageID ?? row.id),
      senderId: Number(row.SenderID ?? row.senderId),
      senderName: String(row.SenderName ?? row.senderName ?? 'User'),
      content: String(row.Content ?? row.content ?? ''),
      timestamp: row.SentAt ? new Date(String(row.SentAt)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
      type: String(row.MessageType ?? row.type ?? options?.type ?? 'text') === 'file' ? 'file' as const : 'text' as const,
      fileName: row.FileName ? String(row.FileName) : options?.fileName,
      fileSize: row.FileSize || options?.fileSize ? `${Math.round(Number(row.FileSize ?? options?.fileSize) / 1024)} KB` : undefined,
      isRead: true,
    }
  },
}

export const settingsApi = {
  async get<T extends object>(scope: string): Promise<Partial<T>> {
    return read<Partial<T>>(await api.get(`/settings/${scope}`))
  },
  async save<T extends object>(scope: string, settings: T): Promise<T> {
    return read<T>(await api.put(`/settings/${scope}`, { settings }))
  },
}

export default api
