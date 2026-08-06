import { Response } from 'express'
import { getPool, sql } from '../config/database'
import type { AuthRequest } from '../middleware/auth'

async function ensureDefaultRoom(staffId: number): Promise<void> {
  const pool = await getPool()
  const existing = await pool.request()
    .input('StaffID', sql.Int, staffId)
    .query(`
      SELECT TOP 1 r.RoomID
      FROM ChatRooms r
      INNER JOIN ChatRoomMembers m ON r.RoomID = m.RoomID
      WHERE m.StaffID = @StaffID
      ORDER BY r.CreatedAt
    `)

  if (existing.recordset.length > 0) return

  const created = await pool.request()
    .input('CreatedByID', sql.Int, staffId)
    .query(`
      INSERT INTO ChatRooms (RoomName, RoomType, CreatedByID)
      OUTPUT INSERTED.RoomID
      VALUES ('General', 'channel', @CreatedByID)
    `)

  await pool.request()
    .input('RoomID', sql.Int, created.recordset[0].RoomID)
    .input('StaffID', sql.Int, staffId)
    .query('INSERT INTO ChatRoomMembers (RoomID, StaffID) VALUES (@RoomID, @StaffID)')
}

export async function getRooms(req: AuthRequest, res: Response): Promise<void> {
  try {
    const staffId = req.user!.staffId
    await ensureDefaultRoom(staffId)
    const pool = await getPool()
    const result = await pool.request()
      .input('StaffID', sql.Int, staffId)
      .query(`
        SELECT r.RoomID, r.RoomName, r.RoomType, r.CreatedAt,
               latest.Content AS LastMessage, latest.SentAt AS LastMessageAt,
               COUNT(DISTINCT members.StaffID) AS MemberCount
        FROM ChatRooms r
        INNER JOIN ChatRoomMembers mine ON r.RoomID = mine.RoomID AND mine.StaffID = @StaffID
        LEFT JOIN ChatRoomMembers members ON r.RoomID = members.RoomID
        OUTER APPLY (
          SELECT TOP 1 Content, SentAt
          FROM ChatMessages
          WHERE RoomID = r.RoomID AND IsDeleted = 0
          ORDER BY SentAt DESC
        ) latest
        GROUP BY r.RoomID, r.RoomName, r.RoomType, r.CreatedAt, latest.Content, latest.SentAt
        ORDER BY COALESCE(latest.SentAt, r.CreatedAt) DESC
      `)

    res.json({ success: true, data: result.recordset })
  } catch (err) {
    console.error('Get chat rooms error:', err)
    res.status(500).json({ success: false, message: 'Could not load chat rooms' })
  }
}

export async function createRoom(req: AuthRequest, res: Response): Promise<void> {
  try {
    const staffId = req.user!.staffId
    const { name, type = 'group', memberIds = [] } = req.body
    if (!name) { res.status(400).json({ success: false, message: 'Room name is required' }); return }

    const pool = await getPool()
    const created = await pool.request()
      .input('RoomName', sql.NVarChar, name)
      .input('RoomType', sql.NVarChar, type)
      .input('CreatedByID', sql.Int, staffId)
      .query(`
        INSERT INTO ChatRooms (RoomName, RoomType, CreatedByID)
        OUTPUT INSERTED.RoomID, INSERTED.RoomName, INSERTED.RoomType, INSERTED.CreatedAt
        VALUES (@RoomName, @RoomType, @CreatedByID)
      `)

    const roomId = created.recordset[0].RoomID
    const uniqueMembers = Array.from(new Set([staffId, ...memberIds.map((id: unknown) => Number(id)).filter(Boolean)]))
    for (const memberId of uniqueMembers) {
      await pool.request()
        .input('RoomID', sql.Int, roomId)
        .input('StaffID', sql.Int, memberId)
        .query('INSERT INTO ChatRoomMembers (RoomID, StaffID) VALUES (@RoomID, @StaffID)')
    }

    res.status(201).json({ success: true, data: created.recordset[0], message: 'Chat room created' })
  } catch (err) {
    console.error('Create chat room error:', err)
    res.status(500).json({ success: false, message: 'Could not create chat room' })
  }
}

export async function getMessages(req: AuthRequest, res: Response): Promise<void> {
  try {
    const roomId = Number(req.params.roomId)
    const pool = await getPool()
    const result = await pool.request()
      .input('RoomID', sql.Int, roomId)
      .input('StaffID', sql.Int, req.user!.staffId)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM ChatRoomMembers WHERE RoomID = @RoomID AND StaffID = @StaffID)
          THROW 51000, 'You are not a member of this chat room', 1;

        SELECT m.MessageID, m.RoomID, m.SenderID, s.FullName AS SenderName, m.Content,
               m.MessageType, m.FileName, m.FileSize, m.SentAt
        FROM ChatMessages m
        INNER JOIN Staff s ON m.SenderID = s.StaffID
        WHERE m.RoomID = @RoomID AND m.IsDeleted = 0
        ORDER BY m.SentAt ASC
      `)

    res.json({ success: true, data: result.recordset })
  } catch (err) {
    console.error('Get chat messages error:', err)
    res.status(500).json({ success: false, message: 'Could not load messages' })
  }
}

export async function sendMessage(req: AuthRequest, res: Response): Promise<void> {
  try {
    const roomId = Number(req.params.roomId)
    const staffId = req.user!.staffId
    const messageType = req.body.type === 'file' ? 'file' : 'text'
    const fileName = req.body.fileName ? String(req.body.fileName).trim() : null
    const fileSize = Number(req.body.fileSize || 0) || null
    const content = String(req.body.content || fileName || '').trim()
    if (!content && !fileName) { res.status(400).json({ success: false, message: 'Message cannot be empty' }); return }

    const pool = await getPool()
    const result = await pool.request()
      .input('RoomID', sql.Int, roomId)
      .input('StaffID', sql.Int, staffId)
      .input('Content', sql.NVarChar(sql.MAX), content)
      .input('MessageType', sql.NVarChar, messageType)
      .input('FileName', sql.NVarChar, fileName)
      .input('FileSize', sql.Int, fileSize)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM ChatRoomMembers WHERE RoomID = @RoomID AND StaffID = @StaffID)
          THROW 51000, 'You are not a member of this chat room', 1;

        INSERT INTO ChatMessages (RoomID, SenderID, Content, MessageType, FileName, FileSize)
        OUTPUT INSERTED.MessageID, INSERTED.RoomID, INSERTED.SenderID, INSERTED.Content, INSERTED.MessageType, INSERTED.FileName, INSERTED.FileSize, INSERTED.SentAt
        VALUES (@RoomID, @StaffID, @Content, @MessageType, @FileName, @FileSize)
      `)

    const staff = await pool.request()
      .input('StaffID', sql.Int, staffId)
      .query('SELECT FullName FROM Staff WHERE StaffID = @StaffID')

    res.status(201).json({
      success: true,
      data: { ...result.recordset[0], SenderName: staff.recordset[0]?.FullName || 'User' },
      message: 'Message sent',
    })
  } catch (err) {
    console.error('Send message error:', err)
    res.status(500).json({ success: false, message: 'Could not send message' })
  }
}
