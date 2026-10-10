import { Response, NextFunction } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs/promises'
import { randomUUID } from 'crypto'
import { getPool,sql } from '../config/database'
import type { AuthRequest } from '../middleware/auth'
import { requireMember } from '../security/chat'
import { HttpError,id,errorResponse } from '../security/validation'

export const maxFileSize=10*1024*1024
export function validateFile(file:{buffer:Buffer;mimetype:string;originalname:string}):string {
  const signatures = [
    {type:'application/pdf',ext:'.pdf',matches:file.buffer.subarray(0,5).toString()==='%PDF-'},
    {type:'image/png',ext:'.png',matches:file.buffer.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'))},
    {type:'image/jpeg',ext:'.jpg',matches:file.buffer.subarray(0,3).equals(Buffer.from('ffd8ff','hex'))},
  ]
  const match=signatures.find(s=>s.matches && s.type===file.mimetype)
  const extension=path.extname(file.originalname).toLowerCase()
  if(!file.buffer.length || file.buffer.length>maxFileSize || !match || !(extension===match.ext || match.ext==='.jpg' && extension==='.jpeg')) throw new HttpError(400,'Only PDF, PNG and JPEG documents up to 10 MB are allowed')
  return match.ext
}
export function documentPath(storageName:string):string {
  const root=process.env.PRIVATE_UPLOAD_DIR
  if(!root || !path.isAbsolute(root)) throw new Error('Private storage is not configured')
  if(!/^[a-f0-9-]{36}\.(pdf|png|jpg)$/.test(storageName)) throw new HttpError(400,'Invalid document storage name')
  return path.join(root,storageName)
}
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:maxFileSize,files:1,fields:2,parts:3}}).single('file')
export function receiveUpload(req:AuthRequest,res:Response,next:NextFunction):void {
  upload(req,res,error=> {
    if(error) {errorResponse(res,new HttpError(error instanceof multer.MulterError && error.code==='LIMIT_FILE_SIZE'?413:400,'Invalid upload or file exceeds 10 MB'));return}
    next()
  })
}
export async function uploadDocument(req:AuthRequest,res:Response):Promise<void> {
  let savedPath:string|undefined
  try {
    if(!req.file) throw new HttpError(400,'A document is required')
    const ext=validateFile(req.file),roomId=req.body.roomId?id(req.body.roomId):null
    if(roomId)await requireMember(roomId,req.user!.staffId)
    const retention=Number(process.env.DOCUMENT_RETENTION_DAYS||90)
    if(!Number.isInteger(retention)||retention<1||retention>3650) throw new Error('Invalid retention configuration')
    const storageName=randomUUID()+ext,filename=path.basename(req.file.originalname.replace(/\\/g,'/')).replace(/[\r\n\x00-\x1f]/g,'').slice(0,200)
    savedPath=documentPath(storageName)
    await fs.mkdir(path.dirname(savedPath),{recursive:true,mode:0o700})
    await fs.writeFile(savedPath,req.file.buffer,{flag:'wx',mode:0o600})
    const result=await (await getPool()).request().input('Owner',sql.Int,req.user!.staffId).input('RoomID',sql.Int,roomId).input('StorageName',sql.NVarChar(100),storageName)
      .input('Name',sql.NVarChar(200),filename).input('Type',sql.NVarChar(100),req.file.mimetype).input('Size',sql.Int,req.file.size).input('Days',sql.Int,retention)
      .query(`INSERT INTO PrivateDocuments(OwnerStaffID,RoomID,StorageName,OriginalName,ContentType,Size,ExpiresAt)
        OUTPUT INSERTED.DocumentID,INSERTED.OriginalName,INSERTED.Size,INSERTED.ExpiresAt
        VALUES(@Owner,@RoomID,@StorageName,@Name,@Type,@Size,DATEADD(day,@Days,SYSUTCDATETIME()))`)
    savedPath=undefined;res.status(201).json({success:true,data:result.recordset[0]})
  } catch(err){if(savedPath)await fs.unlink(savedPath).catch(()=>{});errorResponse(res,err)}
}
export async function downloadDocument(req:AuthRequest,res:Response):Promise<void> {
  try {
    const result=await (await getPool()).request().input('ID',sql.Int,id(req.params.id)).input('StaffID',sql.Int,req.user!.staffId)
      .query(`SELECT d.StorageName,d.OriginalName,d.ContentType FROM PrivateDocuments d WHERE d.DocumentID=@ID AND d.ExpiresAt>SYSUTCDATETIME()
        AND (d.OwnerStaffID=@StaffID OR EXISTS(SELECT 1 FROM DocumentGrants g WHERE g.DocumentID=d.DocumentID AND g.StaffID=@StaffID)
          OR EXISTS(SELECT 1 FROM ChatRoomMembers m WHERE m.RoomID=d.RoomID AND m.StaffID=@StaffID))`)
    const doc=result.recordset[0]
    if(!doc) throw new HttpError(404,'Document not found or access denied')
    const file=documentPath(doc.StorageName);await fs.access(file)
    await (await getPool()).request().input('StaffID',sql.Int,req.user!.staffId).input('Description',sql.NVarChar(1000),`Downloaded document ${id(req.params.id)}`)
      .query("INSERT INTO AuditLogs(StaffID,ActionType,Module,Description) VALUES(@StaffID,'EXPORT','Documents',@Description)")
    res.set({'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Type':doc.ContentType})
    res.download(file,doc.OriginalName,error=>{if(error && !res.headersSent)res.status(404).end()})
  } catch(err){errorResponse(res,err)}
}
export async function grantDocument(req:AuthRequest,res:Response):Promise<void> {
  try {
    const result=await (await getPool()).request().input('ID',sql.Int,id(req.params.id)).input('Actor',sql.Int,req.user!.staffId).input('Recipient',sql.Int,id(req.body.staffId))
      .query(`SET XACT_ABORT ON; BEGIN TRY BEGIN TRANSACTION;
        IF NOT EXISTS(SELECT 1 FROM PrivateDocuments WITH(UPDLOCK,HOLDLOCK) WHERE DocumentID=@ID AND OwnerStaffID=@Actor AND ExpiresAt>SYSUTCDATETIME())
          OR NOT EXISTS(SELECT 1 FROM Staff WHERE StaffID=@Recipient AND Status='active') THROW 51003,'Access denied',1;
        IF NOT EXISTS(SELECT 1 FROM DocumentGrants WITH(UPDLOCK,HOLDLOCK) WHERE DocumentID=@ID AND StaffID=@Recipient)
          INSERT INTO DocumentGrants(DocumentID,StaffID,GrantedByID) VALUES(@ID,@Recipient,@Actor);
        INSERT INTO AuditLogs(StaffID,ActionType,Module,Description) VALUES(@Actor,'CREATE','Documents',CONCAT('Granted document ',@ID,' to ',@Recipient));
        COMMIT; END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH`)
    res.json({success:true,data:true})
  } catch(err){errorResponse(res,(err as any)?.number===51003?new HttpError(403,'Document owner permission required'):err)}
}
