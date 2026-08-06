import { Router } from 'express'
import { authenticate, authorize } from '../middleware/auth'
import * as auth from '../controllers/authController'
import * as staff from '../controllers/staffController'
import * as accounts from '../controllers/accountsController'
import * as audit from '../controllers/auditController'
import * as reports from '../controllers/reportsController'
import * as dashboard from '../controllers/dashboardController'
import * as management from '../controllers/managementController'
import * as chat from '../controllers/chatController'
import * as settings from '../controllers/settingsController'

const router = Router()

router.get('/dashboard', authenticate, dashboard.getDashboard)

// ── Auth ──────────────────────────────────────────────────────
router.post('/auth/login', auth.login)
router.post('/auth/register-admin', auth.registerAdmin)
router.post('/auth/verify-2fa', auth.verify2FA)
router.get('/auth/me', authenticate, auth.getMe)
router.put('/auth/me', authenticate, auth.updateMe)
router.post('/auth/change-password', authenticate, auth.changePassword)
router.post('/auth/password-reset/verify', auth.verifyPasswordResetKey)
router.post('/auth/password-reset/complete', auth.completePasswordReset)
router.put('/auth/2fa', authenticate, auth.setTwoFactor)
router.post('/auth/logout', authenticate, auth.logout)

// ── Staff ─────────────────────────────────────────────────────
router.get('/staff', authenticate, staff.getAllStaff)
router.get('/staff/dashboard-stats', authenticate, staff.getDashboardStats)
router.get('/staff/:id', authenticate, staff.getStaffById)
router.post('/staff', authenticate, authorize('super_admin', 'admin'), staff.createStaff)
router.post('/staff/:id/reset-password', authenticate, authorize('super_admin', 'admin'), staff.resetStaffPassword)
router.put('/staff/:id', authenticate, authorize('super_admin', 'admin', 'manager'), staff.updateStaff)

// ── Accounts ──────────────────────────────────────────────────
router.get('/accounts/transactions', authenticate, accounts.getTransactions)
router.post('/accounts/transactions', authenticate, authorize('super_admin', 'admin', 'accountant', 'cashier'), accounts.createTransaction)
router.get('/accounts/summary', authenticate, accounts.getAccountSummary)
router.get('/accounts/trial-balance', authenticate, accounts.getTrialBalance)
router.get('/accounts/trading-account', authenticate, accounts.getTradingAccount)

// ── Audit ─────────────────────────────────────────────────────
router.get('/audit/logs', authenticate, authorize('super_admin', 'admin', 'auditor'), audit.getAuditLogs)
router.get('/audit/export', authenticate, authorize('super_admin', 'admin', 'auditor'), audit.exportAuditLogs)
router.delete('/audit/logs/old', authenticate, authorize('super_admin', 'admin'), audit.clearOldAuditLogs)

// ── Reports ───────────────────────────────────────────────────
router.get('/reports', authenticate, reports.getReports)
router.post('/reports/trial-balance', authenticate, reports.generateTrialBalanceReport)
router.post('/reports/income-expense', authenticate, reports.generateIncomeExpenseReport)

// Management
router.get('/management/approvals', authenticate, management.getApprovals)
router.put('/management/approvals/:id', authenticate, authorize('super_admin', 'admin', 'manager'), management.reviewApproval)
router.get('/management/announcements', authenticate, management.getAnnouncements)
router.post('/management/announcements', authenticate, authorize('super_admin', 'admin', 'manager'), management.createAnnouncement)

// Chat
router.get('/chat/rooms', authenticate, chat.getRooms)
router.post('/chat/rooms', authenticate, chat.createRoom)
router.get('/chat/rooms/:roomId/messages', authenticate, chat.getMessages)
router.post('/chat/rooms/:roomId/messages', authenticate, chat.sendMessage)

// Settings
router.get('/settings/:scope', authenticate, settings.getSettings)
router.put('/settings/:scope', authenticate, settings.saveSettings)

export default router
