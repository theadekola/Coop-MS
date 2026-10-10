import { Response } from 'express'
import type { AuthRequest } from '../middleware/auth'
import { getPool,sql } from '../config/database'
import { errorResponse,HttpError } from '../security/validation'
export async function sessions(req:AuthRequest,res:Response):Promise<void> {
  try {
    const result=await (await getPool()).request().input('ID',sql.Int,req.user!.staffId)
      .query(`SELECT a.SessionID,a.CreatedAt,a.ExpiresAt FROM AuthSessions a JOIN Staff s ON a.StaffID=s.StaffID
        WHERE a.StaffID=@ID AND a.RevokedAt IS NULL AND a.ExpiresAt>SYSUTCDATETIME() AND a.TokenVersion=s.TokenVersion`)
    res.json({success:true,data:result.recordset.map(s=>({...s,current:s.SessionID.toLowerCase()===req.user!.sessionId.toLowerCase()}))})
  }catch(err){errorResponse(res,err)}
}
export async function revokeSessions(req:AuthRequest,res:Response):Promise<void> {
  try {
    await (await getPool()).request().input('StaffID',sql.Int,req.user!.staffId).input('Current',sql.UniqueIdentifier,req.user!.sessionId)
      .query('UPDATE AuthSessions SET RevokedAt=SYSUTCDATETIME() WHERE StaffID=@StaffID AND SessionID<>@Current AND RevokedAt IS NULL')
    res.json({success:true,data:true})
  }catch(err){errorResponse(res,err)}
}
export async function policy(_req:AuthRequest,res:Response):Promise<void> {
  res.json({success:true,data:{accessMinutes:15,refreshDays:7,otpChallengeMinutes:5,otpAttempts:5,passwordMin:12,
    expenseApproval:'Every expense requires a different authorised reviewer',audit:'Append-only',
    documents:'Owner, explicitly granted staff, or active room members; authenticated downloads only',
    roles:{super_admin:'Manage users and administrators; financial posting and independent approvals',admin:'Manage ordinary users; financial posting and independent approvals',manager:'Staff directory, financial reads and independent approvals',accountant:'Financial reads, income posting, expense and reversal requests',cashier:'Financial reads, income posting and expense requests',auditor:'Financial and audit reads',loan_officer:'Own profile and authorised chat rooms',staff:'Own profile and authorised chat rooms'},
    backups:'Operator-managed SQL and private-storage backups. No web restore endpoint is enabled.',
    integrations:'External payment, webhook and mail workflows are not implemented; no connection is claimed.'}})
}
