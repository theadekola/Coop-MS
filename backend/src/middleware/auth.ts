import { Request, Response, NextFunction } from 'express'
import { authenticateToken, SessionUser } from '../security/session'
export interface AuthRequest extends Request { user?: SessionUser }
export async function authenticate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    req.user = await authenticateToken(req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined)
    next()
  } catch { res.status(401).json({ success: false, message: 'Invalid or expired session' }) }
}
export function authorize(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) { res.status(401).json({ success: false, message: 'Authentication required' }); return }
    if (!roles.includes(req.user.role)) { res.status(403).json({ success: false, message: 'Insufficient permissions' }); return }
    next()
  }
}
