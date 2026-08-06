import { getJwtSecret } from '../config/secrets'
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthRequest extends Request {
  user?: { staffId: number; role: string; email: string }
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Authentication required' })
    return
  }
  const token = authHeader.split(' ')[1]
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as { staffId: number; role: string; email: string }
    req.user = decoded
    next()
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token' })
  }
}

export function authorize(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) { res.status(401).json({ success: false, message: 'Unauthorized' }); return }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' }); return
    }
    next()
  }
}
