export type UserRole = 'super_admin' | 'admin' | 'accountant' | 'auditor' | 'cashier' | 'loan_officer' | 'manager' | 'staff';
export type StaffStatus = 'active' | 'inactive' | 'on_leave' | 'suspended';
export type TransactionType = 'income' | 'expense' | 'transfer';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

export interface User {
  id: number;
  fullName: string;
  email: string;
  role: UserRole;
  department: string;
  employeeId: string;
  avatar?: string;
  status: StaffStatus;
  lastLogin?: string;
  twoFactorEnabled: boolean;
  phone: string;
  joinedDate: string;
}

export interface Staff extends User {
  photo?: string;
}

export interface Transaction {
  id: number;
  date: string;
  description: string;
  account: string;
  reference: string;
  type: TransactionType;
  debit?: number;
  credit?: number;
  balance: number;
  paymentMethod: string;
  chequeNumber?: string;
  postedBy: string;
}

export interface Account {
  id: number;
  code: string;
  name: string;
  type: AccountType;
  debit: number;
  credit: number;
  balance: number;
}

export interface PendingApproval {
  id: number;
  item: string;
  type: string;
  submittedBy: string;
  date: string;
  status: ApprovalStatus;
}

export interface Announcement {
  id: number;
  title: string;
  content: string;
  by: string;
  date: string;
  time: string;
  category: string;
}

export interface AuditLog {
  id: number;
  dateTime: string;
  staffName: string;
  staffAvatar?: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'EXPORT';
  module: string;
  description: string;
  oldValue?: string;
  newValue?: string;
  ipAddress: string;
}

export interface ChatMessage {
  id: number;
  senderId: number;
  senderName: string;
  senderAvatar?: string;
  content: string;
  timestamp: string;
  type: 'text' | 'file';
  documentId?: number;
  fileName?: string;
  fileSize?: string;
  isRead: boolean;
}

export interface ChatConversation {
  id: number;
  name: string;
  avatar?: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  isOnline: boolean;
  type: 'direct' | 'group' | 'channel';
  role?: string;
}

export interface Report {
  id: number;
  name: string;
  type: string;
  period: string;
  generatedBy: string;
  generatedOn: string;
  format: 'PDF' | 'Excel';
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  requires2FA: boolean;
  tempUserId?: number;
}
