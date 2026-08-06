import { Response } from 'express'
import { getPool } from '../config/database'
import type { AuthRequest } from '../middleware/auth'

export async function getDashboard(req: AuthRequest, res: Response): Promise<void> {
  try {
    const pool = await getPool()
    const [summary, transactions, approvals, announcements, dailyTrend, staffActivity] = await Promise.all([
      pool.request().query(`
        SELECT
          (SELECT COUNT(*) FROM Staff) AS TotalStaff,
          (SELECT COUNT(*) FROM Staff WHERE Status='active') AS ActiveStaff,
          (SELECT ISNULL(SUM(DebitAmount - CreditAmount), 0) FROM Transactions t JOIN ChartOfAccounts c ON t.AccountID = c.AccountID WHERE c.AccountCode='1000' AND t.Status='posted') AS CashBalance,
          (SELECT ISNULL(SUM(DebitAmount - CreditAmount), 0) FROM Transactions t JOIN ChartOfAccounts c ON t.AccountID = c.AccountID WHERE c.AccountCode='1100' AND t.Status='posted') AS BankBalance,
          (SELECT ISNULL(SUM(DebitAmount), 0) FROM Transactions WHERE TxnType='income' AND Status='posted' AND MONTH(TxnDate)=MONTH(GETDATE()) AND YEAR(TxnDate)=YEAR(GETDATE())) AS TotalIncome,
          (SELECT ISNULL(SUM(CreditAmount), 0) FROM Transactions WHERE TxnType='expense' AND Status='posted' AND MONTH(TxnDate)=MONTH(GETDATE()) AND YEAR(TxnDate)=YEAR(GETDATE())) AS TotalExpenses,
          (SELECT ISNULL(SUM(DebitAmount), 0) FROM Transactions WHERE TxnType='income' AND Status='posted' AND CAST(TxnDate AS DATE)=CAST(GETDATE() AS DATE)) AS TodayIncome,
          (SELECT ISNULL(SUM(CreditAmount), 0) FROM Transactions WHERE TxnType='expense' AND Status='posted' AND CAST(TxnDate AS DATE)=CAST(GETDATE() AS DATE)) AS TodayExpenses,
          (SELECT COUNT(*) FROM Approvals WHERE Status='pending') AS PendingApprovals,
          (SELECT COUNT(*) FROM Reports) AS TotalReports,
          (SELECT COUNT(*) FROM AuditLogs WHERE ActionType='DELETE' AND CreatedAt >= DATEADD(DAY, -7, GETDATE())) AS AuditAlerts,
          (SELECT ISNULL(SUM(DebitAmount), 0) FROM Transactions WHERE Status='posted') AS TrialDebit,
          (SELECT ISNULL(SUM(CreditAmount), 0) FROM Transactions WHERE Status='posted') AS TrialCredit
      `),
      pool.request().query(`
        SELECT TOP 8 t.TxnID, t.Reference, t.TxnDate, t.Description, t.TxnType,
               t.DebitAmount, t.CreditAmount, t.Balance, t.PaymentMethod,
               c.AccountName, s.FullName as PostedBy
        FROM Transactions t
        JOIN ChartOfAccounts c ON t.AccountID = c.AccountID
        JOIN Staff s ON t.PostedByID = s.StaffID
        WHERE t.Status != 'voided'
        ORDER BY t.TxnDate DESC, t.TxnID DESC
      `),
      pool.request().query(`
        SELECT TOP 8 a.ApprovalID, a.ItemType, a.ItemDescription, a.Status, a.SubmittedAt,
               s.FullName as SubmittedBy
        FROM Approvals a
        JOIN Staff s ON a.SubmittedByID = s.StaffID
        ORDER BY a.SubmittedAt DESC
      `),
      pool.request().query(`
        SELECT TOP 8 a.AnnouncementID, a.Title, a.Content, a.Category, a.PublishedAt,
               s.FullName as PublishedBy
        FROM Announcements a
        JOIN Staff s ON a.PublishedByID = s.StaffID
        WHERE a.IsActive = 1 AND (a.ExpiresAt IS NULL OR a.ExpiresAt > GETDATE())
        ORDER BY a.PublishedAt DESC
      `),
      pool.request().query(`
        SELECT CAST(TxnDate AS DATE) AS TxnDate,
               ISNULL(SUM(CASE WHEN TxnType='income' THEN DebitAmount ELSE 0 END), 0) AS Income,
               ISNULL(SUM(CASE WHEN TxnType='expense' THEN CreditAmount ELSE 0 END), 0) AS Expenses
        FROM Transactions
        WHERE Status='posted' AND TxnDate >= DATEADD(DAY, -6, CAST(GETDATE() AS DATE))
        GROUP BY CAST(TxnDate AS DATE)
        ORDER BY CAST(TxnDate AS DATE)
      `),
      pool.request().query(`
        SELECT TOP 8 a.LogID, a.CreatedAt, a.ActionType, a.Module, a.Description,
               s.FullName, s.Role
        FROM AuditLogs a
        JOIN Staff s ON a.StaffID = s.StaffID
        ORDER BY a.CreatedAt DESC
      `),
    ])

    res.json({
      success: true,
      data: {
        summary: summary.recordset[0],
        transactions: transactions.recordset,
        approvals: approvals.recordset,
        announcements: announcements.recordset,
        dailyTrend: dailyTrend.recordset,
        staffActivity: staffActivity.recordset,
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Server error' })
  }
}
