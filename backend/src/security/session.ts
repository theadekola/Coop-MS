import jwt from 'jsonwebtoken'
import { randomBytes, randomUUID, createHash } from 'crypto'
import { getJwtSecret } from '../config/secrets'
import { getPool, sql } from '../config/database'
import { HttpError } from './validation'
export interface SessionUser { staffId: number; role: string; email: string; sessionId: string; exp: number }
const options = { issuer: 'coop-ms', audience: 'coop-ms-web', algorithm: 'HS256' as const }
export const digest = (token: string) => createHash('sha256').update(token).digest('hex')
export function accessToken(staff: any, sessionId: string): string {
  return jwt.sign({ staffId: staff.StaffID, sessionId, version: staff.TokenVersion, type: 'access' }, getJwtSecret(), { ...options, expiresIn: '15m' })
}
export async function authenticateToken(token: unknown): Promise<SessionUser> {
  if (typeof token !== 'string' || token.length > 4096) throw new HttpError(401, 'Invalid session')
  let claims: any
  try { claims = jwt.verify(token, getJwtSecret(), { issuer: options.issuer, audience: options.audience, algorithms: ['HS256'] }) } catch { throw new HttpError(401, 'Invalid or expired session') }
  if (claims.type !== 'access' || !Number.isInteger(claims.staffId) || !claims.exp || typeof claims.sessionId !== 'string') throw new HttpError(401, 'Invalid session')
  const result = await (await getPool()).request().input('StaffID', sql.Int, claims.staffId).input('SessionID', sql.UniqueIdentifier, claims.sessionId).input('Version', sql.Int, claims.version)
    .query(`SELECT s.StaffID, s.Role, s.Email FROM Staff s JOIN AuthSessions a ON a.StaffID=s.StaffID
      WHERE s.StaffID=@StaffID AND s.Status='active' AND s.TokenVersion=@Version AND a.SessionID=@SessionID AND a.RevokedAt IS NULL AND a.ExpiresAt>SYSUTCDATETIME()`)
  const staff = result.recordset[0]
  if (!staff) throw new HttpError(401, 'Session revoked')
  return { staffId: staff.StaffID, role: staff.Role, email: staff.Email, sessionId: claims.sessionId, exp: claims.exp }
}
export async function newSession(staff: any): Promise<{ token: string; refresh: string }> {
  const sessionId = randomUUID(), refresh = randomBytes(32).toString('hex')
  await (await getPool()).request().input('SessionID', sql.UniqueIdentifier, sessionId).input('StaffID', sql.Int, staff.StaffID).input('Hash', sql.Char(64), digest(refresh)).input('Version',sql.Int,staff.TokenVersion)
    .query(`SET XACT_ABORT ON;
      BEGIN TRY BEGIN TRANSACTION;
      IF NOT EXISTS(SELECT 1 FROM Staff WITH(UPDLOCK,HOLDLOCK) WHERE StaffID=@StaffID AND Status='active' AND TokenVersion=@Version) THROW 51003,'Account changed during login',1;
      INSERT INTO AuthSessions (SessionID,StaffID,RefreshHash,TokenVersion,ExpiresAt) VALUES (@SessionID,@StaffID,@Hash,@Version,DATEADD(day,7,SYSUTCDATETIME()));
      UPDATE Staff SET LastLogin=SYSUTCDATETIME() WHERE StaffID=@StaffID;
      INSERT INTO AuditLogs(StaffID,ActionType,Module,Description) VALUES(@StaffID,'LOGIN','Authentication','New authenticated session');
      COMMIT; END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH`)
  return { token: accessToken(staff, sessionId), refresh }
}
export function refreshCookie(res: any, value: string): void {
  res.cookie('coop_refresh', value, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/api/auth', maxAge: value ? 7 * 86400000 : 0 })
}
