import * as security from '../controllers/securityController'
import rateLimit from 'express-rate-limit'
import * as documents from '../controllers/documentsController'
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
router.use((_req,res,next)=>{res.set('Cache-Control','private, no-store');next()})
const managementRoles=['super_admin','admin','manager']
const financeRoles=[...managementRoles,'accountant','auditor','cashier']
const authLimit=rateLimit({windowMs:15*60000,limit:20,standardHeaders:true,legacyHeaders:false,message:{success:false,message:'Too many authentication attempts'}})
router.use('/auth',authLimit)
router.post('/auth/refresh',auth.refresh)
router.get('/auth/sessions',authenticate,security.sessions)
router.delete('/auth/sessions/others',authenticate,security.revokeSessions)
router.get('/security/policy',authenticate,security.policy)
router.post('/auth/2fa/setup',authenticate,auth.setupTwoFactor)
router.post('/documents',authenticate,documents.receiveUpload,documents.uploadDocument)
router.get('/documents/:id',authenticate,documents.downloadDocument)
router.post('/documents/:id/grants',authenticate,documents.grantDocument)


router.get('/dashboard', authenticate, authorize(...financeRoles), dashboard.getDashboard)

// Application middleware
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

// Application middleware
router.get('/staff/directory',authenticate,staff.getDirectory)
router.get('/staff', authenticate, authorize(...managementRoles), staff.getAllStaff)
router.get('/staff/dashboard-stats', authenticate, authorize(...managementRoles), staff.getDashboardStats)
router.get('/staff/:id', authenticate, authorize(...managementRoles), staff.getStaffById)
router.post('/staff', authenticate, authorize('super_admin', 'admin'), staff.createStaff)
router.post('/staff/:id/reset-password', authenticate, authorize('super_admin', 'admin'), staff.resetStaffPassword)
router.put('/staff/:id', authenticate, authorize('super_admin', 'admin'), staff.updateStaff)

// Application middleware
router.get('/accounts/transactions', authenticate, authorize(...financeRoles), accounts.getTransactions)
router.post('/accounts/transactions', authenticate, authorize('super_admin', 'admin', 'accountant', 'cashier'), accounts.createTransaction)
router.post('/accounts/transactions/:id/reverse',authenticate,authorize('super_admin','admin','accountant'),accounts.reverseTransaction)
router.get('/accounts/summary', authenticate, authorize(...financeRoles), accounts.getAccountSummary)
router.get('/accounts/trial-balance', authenticate, authorize(...financeRoles), accounts.getTrialBalance)
router.get('/accounts/trading-account', authenticate, authorize(...financeRoles), accounts.getTradingAccount)

// Application middleware
router.get('/audit/logs', authenticate, authorize('super_admin', 'admin', 'auditor'), audit.getAuditLogs)
router.get('/audit/export', authenticate, authorize('super_admin', 'admin', 'auditor'), audit.exportAuditLogs)
router.delete('/audit/logs/old', authenticate, authorize('super_admin', 'admin'), (_req,res)=>{res.status(405).json({success:false,message:'Audit logs are append-only; use the operator archive procedure'})})

// Application middleware
router.get('/reports', authenticate, authorize(...financeRoles), reports.getReports)
router.post('/reports/trial-balance', authenticate, authorize(...financeRoles), reports.generateTrialBalanceReport)
router.post('/reports/income-expense', authenticate, authorize(...financeRoles), reports.generateIncomeExpenseReport)

// Management
router.get('/management/approvals', authenticate, authorize(...financeRoles), management.getApprovals)
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
