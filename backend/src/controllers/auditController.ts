import { Response } from 'express'
import { getPool, sql } from '../config/database'
import type { AuthRequest } from '../middleware/auth'

export async function getAuditLogs(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { from, to, staffId, module, action, ip, search, page = 1, limit = 20 } = req.query
    const offset = (Number(page) - 1) * Number(limit)
    const pool = await getPool()

    let query = `SELECT a.LogID, a.ActionType, a.Module, a.Description, a.OldValue, a.NewValue, 
                        a.IPAddress, a.CreatedAt, s.FullName as StaffName, s.PhotoPath
                 FROM AuditLogs a JOIN Staff s ON a.StaffID = s.StaffID WHERE 1=1`
    const req2 = pool.request()

    if (from) { query += ' AND a.CreatedAt >= @From'; req2.input('From', sql.DateTime2, from as string) }
    if (to) { query += ' AND a.CreatedAt <= @To'; req2.input('To', sql.DateTime2, `${to} 23:59:59`) }
    if (staffId) { query += ' AND a.StaffID = @StaffID'; req2.input('StaffID', sql.Int, staffId as string) }
    if (module) { query += ' AND a.Module = @Module'; req2.input('Module', sql.NVarChar, module as string) }
    if (action) { query += ' AND a.ActionType = @Action'; req2.input('Action', sql.NVarChar, (action as string).toUpperCase()) }
    if (ip) { query += ' AND a.IPAddress = @IP'; req2.input('IP', sql.NVarChar, ip as string) }
    if (search) { query += ' AND (a.Description LIKE @Search OR a.OldValue LIKE @Search OR a.NewValue LIKE @Search)'; req2.input('Search', sql.NVarChar, `%${search}%`) }

    query += ` ORDER BY a.CreatedAt DESC OFFSET ${offset} ROWS FETCH NEXT ${Number(limit)} ROWS ONLY`
    const result = await req2.query(query)

    const statsResult = await pool.request().query(`
      SELECT COUNT(*) AS TotalActivities,
             COUNT(DISTINCT StaffID) AS ActiveUsers,
             SUM(CASE WHEN ActionType = 'CREATE' THEN 1 ELSE 0 END) AS CreateActions,
             SUM(CASE WHEN ActionType = 'UPDATE' THEN 1 ELSE 0 END) AS UpdateActions,
             SUM(CASE WHEN ActionType = 'DELETE' THEN 1 ELSE 0 END) AS DeleteActions
      FROM AuditLogs WHERE MONTH(CreatedAt) = MONTH(GETDATE())
    `)

    res.json({ success: true, data: result.recordset, stats: statsResult.recordset[0] })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Server error' })
  }
}

export async function exportAuditLogs(req: AuthRequest, res: Response): Promise<void> {
  try {
    const pool = await getPool()
    const result = await pool.request().query(`
      SELECT a.CreatedAt, a.ActionType, a.Module, a.Description, a.OldValue, a.NewValue,
             a.IPAddress, COALESCE(s.FullName, 'System') AS StaffName
      FROM AuditLogs a
      LEFT JOIN Staff s ON a.StaffID = s.StaffID
      ORDER BY a.CreatedAt DESC
    `)
    const headers = ['Date & Time', 'Staff Name', 'Action', 'Module', 'Description', 'Old Value', 'New Value', 'IP Address']
    const csvEscape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`
    const rows = result.recordset.map(row => [
      row.CreatedAt,
      row.StaffName,
      row.ActionType,
      row.Module,
      row.Description,
      row.OldValue,
      row.NewValue,
      row.IPAddress,
    ])
    const csv = [headers, ...rows].map(row => row.map(csvEscape).join(',')).join('\n')
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.csv"')
    res.send(csv)
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Could not export audit logs' })
  }
}

export async function clearOldAuditLogs(req: AuthRequest, res: Response): Promise<void> {
  try {
    const days = Math.max(1, Number(req.query.days || req.body?.days || 90))
    const pool = await getPool()
    const result = await pool.request()
      .input('Days', sql.Int, days)
      .query('DELETE FROM AuditLogs WHERE CreatedAt < DATEADD(day, -1 * @Days, GETDATE())')

    await pool.request()
      .input('StaffID', sql.Int, req.user!.staffId)
      .input('Description', sql.NVarChar, `Cleared audit logs older than ${days} days`)
      .input('NewValue', sql.NVarChar, `Rows deleted: ${result.rowsAffected[0] || 0}`)
      .input('IPAddress', sql.NVarChar, req.ip || '')
      .query(`INSERT INTO AuditLogs (StaffID, ActionType, Module, Description, NewValue, IPAddress) VALUES (@StaffID, 'DELETE', 'System Logs', @Description, @NewValue, @IPAddress)`)

    res.json({ success: true, data: { deleted: result.rowsAffected[0] || 0 }, message: 'Old logs cleared' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Could not clear old logs' })
  }
}
