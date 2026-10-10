import { Response } from 'express'
import { getPool, sql } from '../config/database'
import type { AuthRequest } from '../middleware/auth'

export async function getReports(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { type, from, to, dept, generatedBy, page = 1, limit = 20 } = req.query
    const offset = (Number(page) - 1) * Number(limit)
    const pool = await getPool()

    let query = `SELECT r.ReportID, r.ReportName, r.ReportType, r.Category, r.DateFrom, r.DateTo, 
                        r.Format, r.GeneratedAt, r.Status, r.DownloadCount, s.FullName as GeneratedBy
                 FROM Reports r JOIN Staff s ON r.GeneratedByID = s.StaffID WHERE 1=1`
    const req2 = pool.request()
    if (type) { query += ' AND r.ReportType = @Type'; req2.input('Type', sql.NVarChar, type as string) }
    if (from) { query += ' AND r.GeneratedAt >= @From'; req2.input('From', sql.DateTime2, `${from} 00:00:00`) }
    if (to) { query += ' AND r.GeneratedAt <= @To'; req2.input('To', sql.DateTime2, `${to} 23:59:59`) }
    if (generatedBy) { query += ' AND s.FullName = @GeneratedBy'; req2.input('GeneratedBy', sql.NVarChar, generatedBy as string) }
    if (dept) {
      query += ' AND EXISTS (SELECT 1 FROM Staff st LEFT JOIN Departments d ON st.DeptID = d.DeptID WHERE st.StaffID = r.GeneratedByID AND d.DeptName = @Dept)'
      req2.input('Dept', sql.NVarChar, dept as string)
    }

    query += ` ORDER BY r.GeneratedAt DESC OFFSET ${offset} ROWS FETCH NEXT ${Number(limit)} ROWS ONLY`
    const result = await req2.query(query)
    res.json({ success: true, data: result.recordset })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
}

export async function generateTrialBalanceReport(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { from, to, format = 'PDF' } = req.body
    const pool = await getPool()

    // Get data
    const result = await pool.request()
      .input('From', sql.Date, from || new Date(new Date().getFullYear(), 0, 1))
      .input('To', sql.Date, to || new Date())
      .query(`SELECT c.AccountCode, c.AccountName, at.TypeName,
                     ISNULL(SUM(t.DebitAmount), 0) AS TotalDebit,
                     ISNULL(SUM(t.CreditAmount), 0) AS TotalCredit
              FROM ChartOfAccounts c
              JOIN AccountTypes at ON c.TypeID = at.TypeID
              LEFT JOIN Transactions t ON c.AccountID = t.AccountID AND t.TxnDate BETWEEN @From AND @To AND t.Status = 'posted'
              WHERE c.IsActive = 1 GROUP BY c.AccountCode, c.AccountName, at.TypeName ORDER BY c.AccountCode`)

    // Record the report generation
    await pool.request()
      .input('ReportName', sql.NVarChar, 'Trial Balance Report')
      .input('ReportType', sql.NVarChar, 'Accounting')
      .input('Category', sql.NVarChar, 'Financial')
      .input('DateFrom', sql.Date, from || new Date(new Date().getFullYear(), 0, 1))
      .input('DateTo', sql.Date, to || new Date())
      .input('Format', sql.NVarChar, format)
      .input('GeneratedByID', sql.Int, req.user!.staffId)
      .query(`INSERT INTO Reports (ReportName, ReportType, Category, DateFrom, DateTo, Format, GeneratedByID) 
              VALUES (@ReportName, @ReportType, @Category, @DateFrom, @DateTo, @Format, @GeneratedByID)`)

    // In production: actually generate PDF using jsPDF or ExcelJS
    // For now return data
    res.json({ success: true, message: 'Report data prepared', data: result.recordset })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
}

export async function generateIncomeExpenseReport(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { from, to, format = 'PDF' } = req.body
    const pool = await getPool()
    const result = await pool.request()
      .input('From', sql.Date, from)
      .input('To', sql.Date, to)
      .query(`SELECT TxnType, TxnDate, Description, DebitAmount, CreditAmount, PaymentMethod
              FROM Transactions WHERE TxnDate BETWEEN @From AND @To AND Status = 'posted' ORDER BY TxnDate`)

    await pool.request()
      .input('ReportName', sql.NVarChar, 'Income & Expense Report')
      .input('ReportType', sql.NVarChar, 'Financial')
      .input('Category', sql.NVarChar, 'Financial')
      .input('DateFrom', sql.Date, from)
      .input('DateTo', sql.Date, to)
      .input('Format', sql.NVarChar, format)
      .input('GeneratedByID', sql.Int, req.user!.staffId)
      .query(`INSERT INTO Reports (ReportName, ReportType, Category, DateFrom, DateTo, Format, GeneratedByID)
              VALUES (@ReportName, @ReportType, @Category, @DateFrom, @DateTo, @Format, @GeneratedByID)`)

    res.json({ success: true, data: result.recordset })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
}
