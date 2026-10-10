import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { randomBytes, randomUUID } from 'crypto'
import { authenticator } from 'otplib'
import { getPool, sql } from '../config/database'
import type { AuthRequest } from '../middleware/auth'
import { HttpError, email, password, text, errorResponse } from '../security/validation'
import { accessToken, newSession, refreshCookie, digest } from '../security/session'
import { encrypt, decrypt } from '../security/encryption'

const publicUser = (s: any) => ({ id: s.StaffID, fullName: s.FullName, email: s.Email, role: s.Role })
async function signedIn(res: Response, staff: any): Promise<void> {
  const session = await newSession(staff)
  refreshCookie(res, session.refresh)
  res.json({ success: true, token: session.token, user: publicUser(staff) })
}
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const address = email(req.body.email)
    if (typeof req.body.password !== 'string' || Buffer.byteLength(req.body.password) > 72) throw new HttpError(400, 'Invalid password')
    const pool = await getPool()
    const result = await pool.request().input('Email', sql.NVarChar(200), address)
      .query('SELECT StaffID,FullName,Email,Role,PasswordHash,Status,TwoFactorEnabled,TokenVersion FROM Staff WHERE Email=@Email')
    const staff = result.recordset[0]
    // A constant dummy hash keeps unknown addresses on the password hashing path.
    const hash = staff?.PasswordHash || '$2a$12$C6UzMDM.H6dfI/f/IKcEe.3AkHrxBMYQVhS1FbTjZL0mMPU6HTnWq'
    if (!await bcrypt.compare(req.body.password, hash) || !staff || staff.Status !== 'active') throw new HttpError(401, 'Invalid credentials')
    if (staff.TwoFactorEnabled) {
      const challenge = randomUUID()
      await pool.request().input('ID', sql.UniqueIdentifier, challenge).input('StaffID', sql.Int, staff.StaffID).input('Version', sql.Int, staff.TokenVersion)
        .query('INSERT INTO AuthChallenges (ChallengeID,StaffID,TokenVersion,ExpiresAt) VALUES (@ID,@StaffID,@Version,DATEADD(minute,5,SYSUTCDATETIME()))')
      res.json({ success: true, requires2FA: true, challengeId: challenge }); return
    }
    await signedIn(res, staff)
  } catch (err) { errorResponse(res, err) }
}
export async function registerAdmin(_req: Request, res: Response): Promise<void> {
  res.status(410).json({ success: false, message: 'Public administrator registration is closed. An operator must run the one-time database bootstrap; later accounts require an authorised administrator.' })
}
export async function verify2FA(req: Request, res: Response): Promise<void> {
  let tx: sql.Transaction | undefined
  try {
    const challenge = text(req.body.challengeId, 36, 'Challenge')
    if (!/^[a-f0-9-]{36}$/i.test(challenge) || !/^\d{6}$/.test(req.body.otp)) throw new HttpError(400, 'Invalid challenge or code')
    tx = new sql.Transaction(await getPool()); await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE)
    const result = await new sql.Request(tx).input('ID', sql.UniqueIdentifier, challenge).query(`
      SELECT c.ChallengeID,c.Attempts,s.StaffID,s.FullName,s.Email,s.Role,s.TokenVersion,s.TwoFactorSecret
      FROM AuthChallenges c WITH (UPDLOCK,HOLDLOCK) JOIN Staff s WITH (UPDLOCK,HOLDLOCK) ON c.StaffID=s.StaffID
      WHERE c.ChallengeID=@ID AND c.ConsumedAt IS NULL AND c.ExpiresAt>SYSUTCDATETIME() AND c.Attempts<5
      AND s.Status='active' AND s.TwoFactorEnabled=1 AND c.TokenVersion=s.TokenVersion`)
    const staff = result.recordset[0]
    if (!staff) throw new HttpError(401, 'Invalid or expired challenge')
    await new sql.Request(tx).input('ID', sql.UniqueIdentifier, challenge).query('UPDATE AuthChallenges SET Attempts=Attempts+1 WHERE ChallengeID=@ID')
    const codeHash = digest(req.body.otp)
    const used = await new sql.Request(tx).input('StaffID', sql.Int, staff.StaffID).input('Hash', sql.Char(64), codeHash)
      .query('SELECT 1 AS Used FROM AuthUsedOtps WHERE StaffID=@StaffID AND CodeHash=@Hash AND ExpiresAt>SYSUTCDATETIME()')
    if (!authenticator.check(req.body.otp, decrypt(staff.TwoFactorSecret)) || used.recordset.length) {
      await tx.commit(); tx = undefined; throw new HttpError(401, 'Invalid or already used code')
    }
    await new sql.Request(tx).input('ID', sql.UniqueIdentifier, challenge).input('StaffID', sql.Int, staff.StaffID).input('Hash', sql.Char(64), codeHash)
      .query(`UPDATE AuthChallenges SET ConsumedAt=SYSUTCDATETIME() WHERE ChallengeID=@ID;
        INSERT INTO AuthUsedOtps (StaffID,CodeHash,ExpiresAt) VALUES (@StaffID,@Hash,DATEADD(minute,5,SYSUTCDATETIME()))`)
    await tx.commit(); tx = undefined
    await signedIn(res, staff)
  } catch (err) { if (tx) await tx.rollback().catch(() => {}); errorResponse(res, err) }
}
export async function refresh(req: Request, res: Response): Promise<void> {
  try {
    if (req.headers.origin !== (process.env.FRONTEND_URL || 'http://localhost:3000')) throw new HttpError(403, 'Refresh requires the application origin')
    const token = req.headers.cookie?.split(';').map(v => v.trim()).find(v => v.startsWith('coop_refresh='))?.slice(13)
    if (!token || !/^[a-f0-9]{64}$/.test(token)) throw new HttpError(401, 'Refresh session required')
    const replacement = randomBytes(32).toString('hex')
    const result = await (await getPool()).request().input('Hash', sql.Char(64), digest(token)).input('NextHash', sql.Char(64), digest(replacement))
      .query(`UPDATE a SET RefreshHash=@NextHash OUTPUT INSERTED.SessionID,INSERTED.StaffID,s.FullName,s.Email,s.Role,s.TokenVersion
        FROM AuthSessions a JOIN Staff s ON s.StaffID=a.StaffID WHERE a.RefreshHash=@Hash AND a.RevokedAt IS NULL
        AND a.ExpiresAt>SYSUTCDATETIME() AND s.Status='active' AND a.TokenVersion=s.TokenVersion`)
    const staff = result.recordset[0]
    if (!staff) throw new HttpError(401, 'Refresh session revoked or expired')
    refreshCookie(res, replacement)
    res.json({ success: true, token: accessToken(staff, staff.SessionID), user: publicUser(staff) })
  } catch (err) { refreshCookie(res, ''); errorResponse(res, err) }
}
export async function getMe(req: AuthRequest, res: Response): Promise<void> {
  try {
    const pool = await getPool()
    const result = await pool.request()
      .input('StaffID', sql.Int, req.user!.staffId)
      .query(`SELECT s.StaffID, s.FullName, s.Email, s.Phone, s.Role, s.EmployeeID, s.Status, 
                     s.TwoFactorEnabled, s.JoinedDate, s.LastLogin, s.PhotoPath, d.DeptName as Department
              FROM Staff s LEFT JOIN Departments d ON s.DeptID = d.DeptID WHERE s.StaffID = @StaffID`)
    if (!result.recordset[0]) { res.status(404).json({ success: false, message: 'User not found' }); return }
    res.json({ success: true, data: result.recordset[0] })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
}


export async function updateMe(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (['role','employeeId','department','status','deptId'].some(k => req.body[k] !== undefined)) throw new HttpError(403, 'Employment details require an authorised administrator')
    await (await getPool()).request().input('StaffID', sql.Int, req.user!.staffId)
      .input('Name', sql.NVarChar(200), text(req.body.fullName,200,'Name')).input('Email', sql.NVarChar(200), email(req.body.email))
      .input('Phone', sql.NVarChar(20), req.body.phone ? text(req.body.phone,20,'Phone') : '')
      .query('UPDATE Staff SET FullName=@Name,Email=@Email,Phone=@Phone,UpdatedAt=SYSUTCDATETIME() WHERE StaffID=@StaffID')
    await getMe(req,res)
  } catch (err) { errorResponse(res,err) }
}
export async function changePassword(req: AuthRequest, res: Response): Promise<void> {
  try {
    const next = password(req.body.newPassword)
    if (typeof req.body.currentPassword !== 'string' || Buffer.byteLength(req.body.currentPassword)>72) throw new HttpError(400,'Invalid current password')
    const pool = await getPool()
    const staff = (await pool.request().input('ID',sql.Int,req.user!.staffId).query('SELECT PasswordHash FROM Staff WHERE StaffID=@ID')).recordset[0]
    if (!await bcrypt.compare(req.body.currentPassword,staff.PasswordHash)) throw new HttpError(401,'Current password is incorrect')
    await pool.request().input('ID',sql.Int,req.user!.staffId).input('Hash',sql.NVarChar(500),await bcrypt.hash(next,12)).input('OldHash',sql.NVarChar(500),staff.PasswordHash)
      .query(`UPDATE Staff SET PasswordHash=@Hash,TokenVersion=TokenVersion+1,UpdatedAt=SYSUTCDATETIME() WHERE StaffID=@ID AND PasswordHash=@OldHash;
        IF @@ROWCOUNT<>1 THROW 51001,'Password changed concurrently',1;`)
    refreshCookie(res,''); res.json({success:true,data:true,message:'Password changed. Sign in again.'})
  } catch(err) { errorResponse(res,err) }
}
// Reusable reset keys had no expiry and allowed cross-account resets. Retired entirely.
export async function verifyPasswordResetKey(_req: Request,res:Response):Promise<void> {
  res.status(410).json({success:false,message:'Reusable reset keys are retired. Contact an authorised administrator for account recovery.'})
}
export const completePasswordReset = verifyPasswordResetKey
export async function setupTwoFactor(req:AuthRequest,res:Response):Promise<void> {
  try {
    const pool=await getPool()
    const staff=(await pool.request().input('ID',sql.Int,req.user!.staffId).query('SELECT PasswordHash,TwoFactorEnabled FROM Staff WHERE StaffID=@ID')).recordset[0]
    if (typeof req.body.currentPassword!=='string' || !await bcrypt.compare(req.body.currentPassword,staff.PasswordHash)) throw new HttpError(401,'Current password is required')
    if (staff.TwoFactorEnabled) throw new HttpError(409,'Two-factor authentication is already enabled')
    const secret=authenticator.generateSecret()
    await pool.request().input('ID',sql.Int,req.user!.staffId).input('Secret',sql.NVarChar(200),encrypt(secret))
      .query('UPDATE Staff SET PendingTwoFactorSecret=@Secret,PendingTwoFactorExpires=DATEADD(minute,10,SYSUTCDATETIME()) WHERE StaffID=@ID')
    res.json({success:true,data:{secret,uri:authenticator.keyuri(req.user!.email,'Coop-MS',secret)}})
  } catch(err) { errorResponse(res,err) }
}
export async function setTwoFactor(req:AuthRequest,res:Response):Promise<void> {
  try {
    if (typeof req.body.enabled!=='boolean' || typeof req.body.currentPassword!=='string' || !/^\d{6}$/.test(req.body.otp)) throw new HttpError(400,'Password and six-digit authenticator code are required')
    const pool=await getPool()
    const staff=(await pool.request().input('ID',sql.Int,req.user!.staffId).query('SELECT PasswordHash,TwoFactorEnabled,TwoFactorSecret,PendingTwoFactorSecret,PendingTwoFactorExpires FROM Staff WHERE StaffID=@ID')).recordset[0]
    if (!await bcrypt.compare(req.body.currentPassword,staff.PasswordHash)) throw new HttpError(401,'Invalid current password')
    const secret=req.body.enabled ? staff.PendingTwoFactorSecret : staff.TwoFactorSecret
    if (!secret || (req.body.enabled && (!staff.PendingTwoFactorExpires || new Date(staff.PendingTwoFactorExpires)<=new Date()))) throw new HttpError(400,'Authenticator setup has expired')
    if (!authenticator.check(req.body.otp,decrypt(secret))) throw new HttpError(401,'Invalid authenticator code')
    await pool.request().input('ID',sql.Int,req.user!.staffId).input('Enabled',sql.Bit,req.body.enabled).input('Secret',sql.NVarChar(200),req.body.enabled?secret:null)
      .input('ExpectedSecret',sql.NVarChar(200),secret)
      .query(`UPDATE Staff SET TwoFactorEnabled=@Enabled,TwoFactorSecret=@Secret,PendingTwoFactorSecret=NULL,PendingTwoFactorExpires=NULL,TokenVersion=TokenVersion+1
        WHERE StaffID=@ID AND ((@Enabled=1 AND PendingTwoFactorSecret=@ExpectedSecret AND PendingTwoFactorExpires>SYSUTCDATETIME() AND TwoFactorEnabled=0)
          OR (@Enabled=0 AND TwoFactorSecret=@ExpectedSecret AND TwoFactorEnabled=1));
        IF @@ROWCOUNT<>1 THROW 51001,'Authenticator setup changed',1;`)
    refreshCookie(res,''); res.json({success:true,data:{twoFactorEnabled:req.body.enabled},message:'Sign in again to continue.'})
  } catch(err) {errorResponse(res,err)}
}
export async function logout(req:AuthRequest,res:Response):Promise<void> {
  try {
    await (await getPool()).request().input('ID',sql.UniqueIdentifier,req.user!.sessionId).query('UPDATE AuthSessions SET RevokedAt=SYSUTCDATETIME() WHERE SessionID=@ID')
    refreshCookie(res,''); res.json({success:true,message:'Signed out'})
  } catch(err){errorResponse(res,err)}
}
