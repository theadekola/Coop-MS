import { Response } from 'express'
import { getPool, sql } from '../config/database'
import type { AuthRequest } from '../middleware/auth'

export async function getApprovals(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { status } = req.query
    const pool = await getPool()
    const request = pool.request()
    let query = `
      SELECT a.ApprovalID, a.ItemType, a.ItemID, a.ItemDescription, a.Status,
             a.Comments, a.SubmittedAt, a.ReviewedAt,
             submitter.FullName as SubmittedBy,
             reviewer.FullName as ReviewedBy
      FROM Approvals a
      JOIN Staff submitter ON a.SubmittedByID = submitter.StaffID
      LEFT JOIN Staff reviewer ON a.ReviewedByID = reviewer.StaffID
      WHERE 1=1
    `
    if (status) {
      query += ' AND a.Status = @Status'
      request.input('Status', sql.NVarChar, status as string)
    }
    query += ' ORDER BY a.SubmittedAt DESC'
    const result = await request.query(query)
    res.json({ success: true, data: result.recordset })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Server error' })
  }
}

export async function reviewApproval(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { status, comments } = req.body
    if (!['approved', 'rejected'].includes(status)) {
      res.status(400).json({ success: false, message: 'Status must be approved or rejected' })
      return
    }
    const pool = await getPool()
    await pool.request()
      .input('ApprovalID', sql.Int, req.params.id)
      .input('Status', sql.NVarChar, status)
      .input('Comments', sql.NVarChar, comments || null)
      .input('ReviewedByID', sql.Int, req.user!.staffId)
      .query(`UPDATE Approvals SET Status=@Status, Comments=@Comments, ReviewedByID=@ReviewedByID, ReviewedAt=GETDATE() WHERE ApprovalID=@ApprovalID`)

    await pool.request()
      .input('StaffID', sql.Int, req.user!.staffId)
      .input('Description', sql.NVarChar, `Approval ${req.params.id} ${status}`)
      .input('IPAddress', sql.NVarChar, req.ip || '')
      .query(`INSERT INTO AuditLogs (StaffID, ActionType, Module, Description, IPAddress) VALUES (@StaffID, 'UPDATE', 'Management', @Description, @IPAddress)`)

    res.json({ success: true, message: `Approval ${status}` })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Server error' })
  }
}

export async function getAnnouncements(req: AuthRequest, res: Response): Promise<void> {
  try {
    const pool = await getPool()
    const result = await pool.request().query(`
      SELECT a.AnnouncementID, a.Title, a.Content, a.Category, a.PublishedAt, a.ExpiresAt,
             s.FullName as PublishedBy
      FROM Announcements a
      JOIN Staff s ON a.PublishedByID = s.StaffID
      WHERE a.IsActive = 1 AND (a.ExpiresAt IS NULL OR a.ExpiresAt > GETDATE())
      ORDER BY a.PublishedAt DESC
    `)
    res.json({ success: true, data: result.recordset })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
}

export async function createAnnouncement(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { title, content, category = 'General', expiresAt } = req.body
    if (!title || !content) {
      res.status(400).json({ success: false, message: 'Title and content are required' })
      return
    }
    const pool = await getPool()
    const result = await pool.request()
      .input('Title', sql.NVarChar, title)
      .input('Content', sql.NVarChar, content)
      .input('Category', sql.NVarChar, category)
      .input('ExpiresAt', sql.DateTime2, expiresAt || null)
      .input('PublishedByID', sql.Int, req.user!.staffId)
      .query(`INSERT INTO Announcements (Title, Content, Category, ExpiresAt, PublishedByID)
              OUTPUT INSERTED.AnnouncementID
              VALUES (@Title, @Content, @Category, @ExpiresAt, @PublishedByID)`)

    res.status(201).json({ success: true, message: 'Announcement created', data: { id: result.recordset[0].AnnouncementID } })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Server error' })
  }
}
