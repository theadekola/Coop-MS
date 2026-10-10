import { getPool, sql } from '../config/database'
import { HttpError, id, text } from './validation'

export class EventLimiter {
  private entries = new Map<number, { count: number; until: number }>()
  constructor(private max = 60, private windowMs = 60000, private now = Date.now) {}
  take(staffId: number): void {
    const now = this.now()
    for (const [key,value] of this.entries) if (value.until <= now) this.entries.delete(key)
    const entry = this.entries.get(staffId) || { count: 0, until: now + this.windowMs }
    if (++entry.count > this.max) throw new HttpError(429,'Too many chat events')
    this.entries.set(staffId,entry)
  }
}
export const chatLimiter = new EventLimiter()
export const memberGuard = `IF NOT EXISTS (SELECT 1 FROM ChatRoomMembers m WITH (UPDLOCK,HOLDLOCK)
  JOIN Staff s ON s.StaffID=m.StaffID WHERE m.RoomID=@RoomID AND m.StaffID=@StaffID AND s.Status='active')
  THROW 51003,'Room access denied',1;`
export async function members(roomId: number): Promise<number[]> {
  const result = await (await getPool()).request().input('RoomID',sql.Int,id(roomId))
    .query("SELECT m.StaffID FROM ChatRoomMembers m JOIN Staff s ON s.StaffID=m.StaffID WHERE m.RoomID=@RoomID AND s.Status='active'")
  return result.recordset.map(r => r.StaffID)
}
export async function requireMember(roomId: number, staffId: number): Promise<void> {
  if (!(await members(id(roomId))).includes(staffId)) throw new HttpError(403,'Room access denied')
}
export async function createMessage(roomId: number, staffId: number, data: any): Promise<any> {
  const content = text(data?.content,4000,'Message'), documentId = data?.documentId ? id(data.documentId) : null
  if (data?.type && !['text','file'].includes(data.type)) throw new HttpError(400,'Invalid message type')
  if (data?.type==='file' && !documentId) throw new HttpError(400,'Upload the document before sharing it')
  const result = await (await getPool()).request().input('RoomID',sql.Int,id(roomId)).input('StaffID',sql.Int,staffId)
    .input('Content',sql.NVarChar(4000),content).input('DocumentID',sql.Int,documentId)
    .query(`SET XACT_ABORT ON;
      BEGIN TRY
        BEGIN TRANSACTION;
        ${memberGuard}
        DECLARE @Name NVARCHAR(200),@Size INT;
        IF @DocumentID IS NOT NULL
        BEGIN
          SELECT @Name=OriginalName,@Size=Size FROM PrivateDocuments WITH (UPDLOCK,HOLDLOCK)
          WHERE DocumentID=@DocumentID AND OwnerStaffID=@StaffID AND RoomID=@RoomID AND ExpiresAt>SYSUTCDATETIME();
          IF @Name IS NULL THROW 51003,'Document access denied',1;
        END;
        DECLARE @Message TABLE (MessageID INT);
        INSERT INTO ChatMessages (RoomID,SenderID,Content,MessageType,DocumentID,FileName,FileSize)
        OUTPUT INSERTED.MessageID INTO @Message
        VALUES (@RoomID,@StaffID,@Content,CASE WHEN @DocumentID IS NULL THEN 'text' ELSE 'file' END,@DocumentID,@Name,@Size);
        SELECT m.*,s.FullName AS SenderName FROM ChatMessages m JOIN @Message n ON n.MessageID=m.MessageID JOIN Staff s ON s.StaffID=m.SenderID;
        COMMIT;
      END TRY
      BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH`)
  return result.recordset[0]
}
export async function readMessage(messageId:number,staffId:number):Promise<number> {
  const result=await (await getPool()).request().input('MessageID',sql.Int,id(messageId)).input('StaffID',sql.Int,staffId)
    .query(`SET XACT_ABORT ON;
      BEGIN TRY BEGIN TRANSACTION;
        DECLARE @RoomID INT=(SELECT RoomID FROM ChatMessages WHERE MessageID=@MessageID AND IsDeleted=0);
        ${memberGuard}
        IF NOT EXISTS(SELECT 1 FROM MessageReadReceipts WITH (UPDLOCK,HOLDLOCK) WHERE MessageID=@MessageID AND StaffID=@StaffID)
          INSERT INTO MessageReadReceipts (MessageID,StaffID) VALUES (@MessageID,@StaffID);
        SELECT @RoomID AS RoomID; COMMIT;
      END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH`)
  return result.recordset[0].RoomID
}
export function chatError(error: any): HttpError {
  return error instanceof HttpError ? error : new HttpError(error?.number===51003?403:500,error?.number===51003?'Room or document access denied':'Chat event failed')
}
