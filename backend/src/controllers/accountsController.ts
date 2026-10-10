import {pagination} from '../security/validation'
import { Response } from 'express'
import { getPool, sql } from '../config/database'
import type { AuthRequest } from '../middleware/auth'
import { HttpError, id, text, amount, errorResponse } from '../security/validation'

export async function getTransactions(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { account, type, from, to, page = 1, limit = 20, search } = req.query
    const {offset,limit:boundedLimit} = pagination(page,limit)
    const pool = await getPool()

    let query = `SELECT t.TxnID, t.Reference, t.TxnDate, t.Description, t.TxnType, 
                        t.DebitAmount, t.CreditAmount, t.Balance, t.PaymentMethod, t.ChequeNumber, t.Status,
                        c.AccountName, c.AccountCode, s.FullName as PostedBy
                 FROM Transactions t
                 JOIN ChartOfAccounts c ON t.AccountID = c.AccountID
                 JOIN Staff s ON t.PostedByID = s.StaffID
                 WHERE t.Status != 'voided'`
    const req2 = pool.request()

    if (search) { query += ` AND (t.Description LIKE @Search OR t.Reference LIKE @Search)`; req2.input('Search', sql.NVarChar, `%${search}%`) }
    if (account) { query += ` AND t.AccountID = @AccountID`; req2.input('AccountID', sql.Int, account as string) }
    if (type) { query += ` AND t.TxnType = @Type`; req2.input('Type', sql.NVarChar, type as string) }
    if (from) { query += ` AND t.TxnDate >= @From`; req2.input('From', sql.Date, from as string) }
    if (to) { query += ` AND t.TxnDate <= @To`; req2.input('To', sql.Date, to as string) }

    query += ` ORDER BY t.TxnDate DESC, t.TxnID DESC OFFSET ${offset} ROWS FETCH NEXT ${boundedLimit} ROWS ONLY`
    const result = await req2.query(query)
    const countResult = await pool.request().query('SELECT COUNT(*) as total FROM Transactions WHERE Status != \'voided\'')
    res.json({ success: true, data: result.recordset, total: countResult.recordset[0].total })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Server error' })
  }
}

export async function createTransaction(req:AuthRequest,res:Response):Promise<void> {
  try {
    const {txnType,paymentMethod='Cash'}=req.body
    if(!['income','expense'].includes(txnType)) throw new HttpError(400,'Use income or expense; unbalanced transfers are not supported')
    if(!['Cash','Bank Transfer','Cheque','POS','Card'].includes(paymentMethod)) throw new HttpError(400,'Invalid payment method')
    const result=await (await getPool()).request().input('ActorID',sql.Int,req.user!.staffId)
      .input('Description',sql.NVarChar(500),text(req.body.description,500,'Description')).input('AccountID',sql.Int,id(req.body.accountId))
      .input('TxnType',sql.NVarChar(20),txnType).input('Amount',sql.Decimal(18,2),amount(req.body.amount))
      .input('PaymentMethod',sql.NVarChar(50),paymentMethod).input('ChequeNumber',sql.NVarChar(100),paymentMethod==='Cheque'?text(req.body.chequeNumber,100,'Cheque number'):null)
      .input('Notes',sql.NVarChar(1000),req.body.notes?text(req.body.notes,1000,'Notes'):null).execute('dbo.SubmitTransaction')
    res.status(201).json({success:true,data:result.recordset[0],message:txnType==='expense'?'Expense submitted for independent approval':'Income posted'})
  } catch(err){financeError(res,err)}
}
export async function reverseTransaction(req:AuthRequest,res:Response):Promise<void> {
  try {
    const result=await (await getPool()).request().input('ActorID',sql.Int,req.user!.staffId).input('TxnID',sql.Int,id(req.params.id))
      .input('Reason',sql.NVarChar(500),text(req.body.reason,500,'Reversal reason')).execute('dbo.RequestReversal')
    res.status(201).json({success:true,data:result.recordset[0],message:'Reversal submitted for independent approval'})
  } catch(err){financeError(res,err)}
}
export function financeError(res:Response,err:any):void {
  errorResponse(res,err?.number===51003?new HttpError(403,'Financial operation is not authorised'):err?.number===51001?new HttpError(409,'The item has already changed or cannot be processed'):err)
}

export async function getAccountSummary(req: AuthRequest, res: Response): Promise<void> {
  try {
    const pool = await getPool()
    const result = await pool.request().query(`
      SELECT
        (SELECT ISNULL(SUM(DebitAmount - CreditAmount), 0) FROM Transactions t JOIN ChartOfAccounts c ON t.AccountID = c.AccountID WHERE c.AccountCode = '1000' AND t.Status = 'posted') AS CashBalance,
        (SELECT ISNULL(SUM(DebitAmount - CreditAmount), 0) FROM Transactions t JOIN ChartOfAccounts c ON t.AccountID = c.AccountID WHERE c.AccountCode = '1100' AND t.Status = 'posted') AS BankBalance,
        (SELECT ISNULL(SUM(DebitAmount), 0) FROM Transactions WHERE TxnType = 'income' AND MONTH(TxnDate) = MONTH(GETDATE()) AND Status = 'posted') AS TotalIncomeMTD,
        (SELECT ISNULL(SUM(CreditAmount), 0) FROM Transactions WHERE TxnType = 'expense' AND MONTH(TxnDate) = MONTH(GETDATE()) AND Status = 'posted') AS TotalExpensesMTD
    `)
    res.json({ success: true, data: result.recordset[0] })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
}

export async function getTrialBalance(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { from, to } = req.query
    const pool = await getPool()
    const req2 = pool.request()
    if (from) req2.input('From', sql.Date, from as string)
    if (to) req2.input('To', sql.Date, to as string)

    const result = await req2.query(`
      SELECT c.AccountCode, c.AccountName, at.TypeName as AccountType,
             ISNULL(SUM(t.DebitAmount), 0) AS TotalDebit,
             ISNULL(SUM(t.CreditAmount), 0) AS TotalCredit,
             ISNULL(SUM(t.DebitAmount - t.CreditAmount), 0) AS Balance
      FROM ChartOfAccounts c
      JOIN AccountTypes at ON c.TypeID = at.TypeID
      LEFT JOIN Transactions t ON c.AccountID = t.AccountID 
        AND t.Status = 'posted'
        ${from ? 'AND t.TxnDate >= @From' : ''}
        ${to ? 'AND t.TxnDate <= @To' : ''}
      WHERE c.IsActive = 1
      GROUP BY c.AccountCode, c.AccountName, at.TypeName
      ORDER BY c.AccountCode
    `)

    const totalDebit = result.recordset.reduce((s: number, r: any) => s + r.TotalDebit, 0)
    const totalCredit = result.recordset.reduce((s: number, r: any) => s + r.TotalCredit, 0)

    res.json({ success: true, data: result.recordset, totalDebit, totalCredit, isBalanced: Math.abs(totalDebit - totalCredit) < 0.01 })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
}

export async function getTradingAccount(req: AuthRequest, res: Response): Promise<void> {
  try {
    const year = Number(req.query.year || new Date().getFullYear())
    const pool = await getPool()
    const result = await pool.request()
      .input('Year', sql.Int, year)
      .query(`
        SELECT
          ISNULL(SUM(CASE WHEN t.TxnType = 'income' THEN t.DebitAmount ELSE 0 END), 0) AS TotalSales,
          ISNULL(SUM(CASE WHEN t.TxnType = 'expense' THEN t.CreditAmount ELSE 0 END), 0) AS TotalPurchases,
          ISNULL(SUM(CASE WHEN t.TxnType = 'income' THEN t.DebitAmount ELSE 0 END), 0) -
          ISNULL(SUM(CASE WHEN t.TxnType = 'expense' THEN t.CreditAmount ELSE 0 END), 0) AS GrossProfit
        FROM Transactions t
        WHERE t.Status = 'posted' AND YEAR(t.TxnDate) = @Year
      `)

    const monthly = await pool.request()
      .input('Year', sql.Int, year)
      .query(`
        SELECT MONTH(TxnDate) AS MonthNo,
               ISNULL(SUM(CASE WHEN TxnType = 'income' THEN DebitAmount ELSE 0 END), 0) -
               ISNULL(SUM(CASE WHEN TxnType = 'expense' THEN CreditAmount ELSE 0 END), 0) AS Profit
        FROM Transactions
        WHERE Status = 'posted' AND YEAR(TxnDate) = @Year
        GROUP BY MONTH(TxnDate)
        ORDER BY MONTH(TxnDate)
      `)

    const byAccount = await pool.request()
      .input('Year', sql.Int, year)
      .query(`
        SELECT TOP 10 c.AccountName,
               SUM(CASE WHEN t.TxnType = 'income' THEN t.DebitAmount ELSE t.CreditAmount END) AS Amount,
               t.TxnType
        FROM Transactions t
        INNER JOIN ChartOfAccounts c ON t.AccountID = c.AccountID
        WHERE t.Status = 'posted' AND YEAR(t.TxnDate) = @Year
        GROUP BY c.AccountName, t.TxnType
        ORDER BY Amount DESC
      `)

    res.json({
      success: true,
      data: {
        year,
        summary: result.recordset[0],
        monthly: monthly.recordset,
        byAccount: byAccount.recordset,
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Server error' })
  }
}
