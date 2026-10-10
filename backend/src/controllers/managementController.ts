import { HttpError,id,text } from '../security/validation'
import { financeError } from './accountsController'
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

export async function reviewApproval(req:AuthRequest,res:Response):Promise<void> {
  try {
    if(!['approved','rejected'].includes(req.body.status)) throw new HttpError(400,'Status must be approved or rejected')
    await (await getPool()).request().input('ActorID',sql.Int,req.user!.staffId).input('ApprovalID',sql.Int,id(req.params.id))
      .input('Decision',sql.NVarChar(20),req.body.status).input('Comments',sql.NVarChar(1000),req.body.comments?text(req.body.comments,1000,'Comments'):null).execute('dbo.ReviewApproval')
    res.json({success:true,message:`Approval ${req.body.status}`})
  } catch(err){financeError(res,err)}
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
