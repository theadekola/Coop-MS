import { Response } from 'express'
import { getPool, sql } from '../config/database'
import { chatLimiter, createMessage, chatError } from '../security/chat'
import { id, text, HttpError, errorResponse } from '../security/validation'
import type { AuthRequest } from '../middleware/auth'

export async function getRooms(req: AuthRequest, res: Response): Promise<void> {
  try {
    const staffId = req.user!.staffId

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

export async function createRoom(req:AuthRequest,res:Response):Promise<void> {
  let tx:sql.Transaction|undefined
  try {
    chatLimiter.take(req.user!.staffId)
    const name=text(req.body.name,200,'Room name'),type=req.body.type||'group'
    if (!['group','direct','channel'].includes(type) || !Array.isArray(req.body.memberIds||[]) || (req.body.memberIds||[]).length>100) throw new HttpError(400,'Invalid room or members')
    const memberIds=[...new Set<number>([req.user!.staffId,...(req.body.memberIds||[]).map(id)])]
    if(type==='direct' && memberIds.length!==2) throw new HttpError(400,'Direct chats require two members')
    tx=new sql.Transaction(await getPool()); await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE)
    for(const staffId of memberIds) {
      const staff=await new sql.Request(tx).input('ID',sql.Int,staffId).query("SELECT StaffID FROM Staff WHERE StaffID=@ID AND Status='active'")
      if(!staff.recordset.length) throw new HttpError(400,'All members must be active staff')
    }
    const room=(await new sql.Request(tx).input('Name',sql.NVarChar(200),name).input('Type',sql.NVarChar(20),type).input('StaffID',sql.Int,req.user!.staffId)
      .query('INSERT INTO ChatRooms (RoomName,RoomType,CreatedByID) OUTPUT INSERTED.* VALUES (@Name,@Type,@StaffID)')).recordset[0]
    for(const staffId of memberIds) await new sql.Request(tx).input('RoomID',sql.Int,room.RoomID).input('StaffID',sql.Int,staffId)
      .query('INSERT INTO ChatRoomMembers (RoomID,StaffID) VALUES (@RoomID,@StaffID)')
    await tx.commit(); tx=undefined; res.status(201).json({success:true,data:room})
  } catch(err) {if(tx)await tx.rollback().catch(()=>{});errorResponse(res,err)}
}

export async function getMessages(req: AuthRequest, res: Response): Promise<void> {
  try {
    const roomId = id(req.params.roomId)
    const pool = await getPool()
    const result = await pool.request()
      .input('RoomID', sql.Int, roomId)
      .input('StaffID', sql.Int, req.user!.staffId)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM ChatRoomMembers WHERE RoomID = @RoomID AND StaffID = @StaffID)
          THROW 51000, 'You are not a member of this chat room', 1;

        SELECT TOP (200) m.DocumentID, m.MessageID, m.RoomID, m.SenderID, s.FullName AS SenderName, m.Content,
               m.MessageType, m.FileName, m.FileSize, m.SentAt
        FROM ChatMessages m
        INNER JOIN Staff s ON m.SenderID = s.StaffID
        INNER JOIN ChatRoomMembers authorised ON authorised.RoomID=m.RoomID AND authorised.StaffID=@StaffID
        WHERE m.RoomID = @RoomID AND m.IsDeleted = 0
        ORDER BY m.MessageID DESC
      `)

    res.json({ success: true, data: result.recordset })
  } catch (err) {
    console.error('Get chat messages error:', err)
    errorResponse(res, (err as any)?.number===51000 ? new HttpError(403,'Room access denied') : err)
  }
}

export async function sendMessage(req:AuthRequest,res:Response):Promise<void> {
  try {
    chatLimiter.take(req.user!.staffId)
    const roomId=id(req.params.roomId),message=await createMessage(roomId,req.user!.staffId,req.body)
    if(req.app.locals.emitRoom) await req.app.locals.emitRoom(roomId,'chat:message',message).catch(()=>{})
    res.status(201).json({success:true,data:message})
  } catch(err) { errorResponse(res,chatError(err)) }
}
