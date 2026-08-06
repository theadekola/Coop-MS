import { getJwtSecret } from '../config/secrets'
import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { getPool, sql } from '../config/database'
import type { AuthRequest } from '../middleware/auth'

const JWT_SECRET = getJwtSecret()
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '8h'

function generateToken(staffId: number, role: string, email: string): string {
  return jwt.sign({ staffId, role, email }, JWT_SECRET, { expiresIn: JWT_EXPIRES } as any)
}

async function ensurePasswordResetKeyColumn(): Promise<void> {
  const pool = await getPool()
  await pool.request().query(`
    IF COL_LENGTH('Staff', 'PasswordResetKeyHash') IS NULL
      ALTER TABLE Staff ADD PasswordResetKeyHash NVARCHAR(500) NULL;
  `)
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body
    if (!email || !password) { res.status(400).json({ success: false, message: 'Email and password required' }); return }

    const pool = await getPool()
    const result = await pool.request()
      .input('Email', sql.NVarChar, email.toLowerCase())
      .query('SELECT StaffID, FullName, Email, Role, PasswordHash, Status, TwoFactorEnabled, DeptID FROM Staff WHERE Email = @Email')

    if (result.recordset.length === 0) { res.status(401).json({ success: false, message: 'Invalid credentials' }); return }
    const staff = result.recordset[0]
    if (staff.Status !== 'active') { res.status(403).json({ success: false, message: 'Account is not active' }); return }

    const validPass = await bcrypt.compare(password, staff.PasswordHash)
    if (!validPass) { res.status(401).json({ success: false, message: 'Invalid credentials' }); return }

    await pool.request().input('StaffID', sql.Int, staff.StaffID).query('UPDATE Staff SET LastLogin = GETDATE() WHERE StaffID = @StaffID')
    const token = generateToken(staff.StaffID, staff.Role, staff.Email)
    res.json({ success: true, token, user: { id: staff.StaffID, fullName: staff.FullName, email: staff.Email, role: staff.Role } })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ success: false, message: 'Server error' })
  }
}

export async function registerAdmin(req: Request, res: Response): Promise<void> {
  try {
    const { fullName, email, phone, password, role = 'admin' } = req.body
    if (!fullName || !email || !phone || !password) {
      res.status(400).json({ success: false, message: 'Full name, email, phone and password are required' })
      return
    }
    if (String(password).length < 8) {
      res.status(400).json({ success: false, message: 'Password must be at least 8 characters' })
      return
    }

    const adminRole = role === 'super_admin' ? 'super_admin' : 'admin'
    const pool = await getPool()
    const adminCount = await pool.request()
      .query("SELECT COUNT(*) AS TotalAdmins FROM Staff WHERE Role IN ('super_admin','admin')")

    const registrationOpen = process.env.ENABLE_ADMIN_REGISTRATION === 'true'
    if (adminCount.recordset[0].TotalAdmins > 0 && !registrationOpen) {
      res.status(403).json({ success: false, message: 'Admin registration is closed. Ask an existing admin to create this user.' })
      return
    }

    const existsResult = await pool.request()
      .input('Email', sql.NVarChar, String(email).toLowerCase())
      .query('SELECT StaffID FROM Staff WHERE Email = @Email')
    if (existsResult.recordset.length > 0) {
      res.status(409).json({ success: false, message: 'Email already exists' })
      return
    }

    const lastResult = await pool.request().query("SELECT TOP 1 EmployeeID FROM Staff ORDER BY StaffID DESC")
    const lastNum = lastResult.recordset[0] ? parseInt(String(lastResult.recordset[0].EmployeeID).replace('EXC', ''), 10) || 0 : 0
    const employeeId = `EXC${String(lastNum + 1).padStart(3, '0')}`
    const passwordHash = await bcrypt.hash(password, 12)

    const result = await pool.request()
      .input('EmployeeID', sql.NVarChar, employeeId)
      .input('FullName', sql.NVarChar, fullName)
      .input('Email', sql.NVarChar, String(email).toLowerCase())
      .input('Phone', sql.NVarChar, phone)
      .input('Role', sql.NVarChar, adminRole)
      .input('PasswordHash', sql.NVarChar, passwordHash)
      .query(`
        INSERT INTO Staff (EmployeeID, FullName, Email, Phone, Role, PasswordHash, TwoFactorEnabled)
        OUTPUT INSERTED.StaffID, INSERTED.EmployeeID, INSERTED.FullName, INSERTED.Email, INSERTED.Role
        VALUES (@EmployeeID, @FullName, @Email, @Phone, @Role, @PasswordHash, 0)
      `)

    res.status(201).json({ success: true, data: result.recordset[0], message: 'Admin account created' })
  } catch (err) {
    console.error('Admin registration error:', err)
    res.status(500).json({ success: false, message: 'Could not create admin account' })
  }
}

export async function verify2FA(req: Request, res: Response): Promise<void> {
  try {
    const { staffId, otp } = req.body
    if (!staffId || !otp) { res.status(400).json({ success: false, message: 'staffId and OTP required' }); return }

    const pool = await getPool()
    const result = await pool.request()
      .input('StaffID', sql.Int, staffId)
      .input('OTPCode', sql.NVarChar, otp)
      .query(`SELECT TokenID FROM OTPTokens 
              WHERE StaffID = @StaffID AND OTPCode = @OTPCode AND IsUsed = 0 AND ExpiresAt > GETDATE()`)

    if (result.recordset.length === 0) { res.status(401).json({ success: false, message: 'Invalid or expired OTP' }); return }

    await pool.request().input('TokenID', sql.Int, result.recordset[0].TokenID)
      .query('UPDATE OTPTokens SET IsUsed = 1 WHERE TokenID = @TokenID')

    const staffResult = await pool.request().input('StaffID', sql.Int, staffId)
      .query(`UPDATE Staff SET LastLogin = GETDATE() WHERE StaffID = @StaffID;
              SELECT StaffID, FullName, Email, Role, Phone, EmployeeID FROM Staff WHERE StaffID = @StaffID`)
    const staff = staffResult.recordset[0]
    const token = generateToken(staff.StaffID, staff.Role, staff.Email)
    res.json({ success: true, token, user: { id: staff.StaffID, fullName: staff.FullName, email: staff.Email, role: staff.Role } })
  } catch (err) {
    console.error('2FA error:', err)
    res.status(500).json({ success: false, message: 'Server error' })
  }
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
    const { fullName, email, phone, employeeId, role, department } = req.body
    const validRoles = ['super_admin', 'admin', 'accountant', 'auditor', 'cashier', 'loan_officer', 'manager', 'staff']
    if (!fullName || !email) {
      res.status(400).json({ success: false, message: 'Full name and email are required' })
      return
    }

    const pool = await getPool()
    const currentResult = await pool.request()
      .input('StaffID', sql.Int, req.user!.staffId)
      .query(`SELECT s.EmployeeID, s.Role, s.DeptID, d.DeptName AS Department
              FROM Staff s LEFT JOIN Departments d ON s.DeptID = d.DeptID
              WHERE s.StaffID = @StaffID`)
    if (!currentResult.recordset[0]) {
      res.status(404).json({ success: false, message: 'User not found' })
      return
    }

    const current = currentResult.recordset[0]
    const nextRole = role ? String(role) : String(current.Role || 'staff')
    if (!validRoles.includes(nextRole)) {
      res.status(400).json({ success: false, message: 'Invalid role selected' })
      return
    }

    const nextDepartment = String(department || current.Department || 'General').trim()
    const nextEmployeeId = String(employeeId || current.EmployeeID || `EXC${String(req.user!.staffId).padStart(3, '0')}`).trim()
    const deptResult = await pool.request()
      .input('DeptName', sql.NVarChar, nextDepartment)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM Departments WHERE DeptName = @DeptName)
          INSERT INTO Departments (DeptName) VALUES (@DeptName);
        SELECT DeptID FROM Departments WHERE DeptName = @DeptName;
      `)
    const deptId = deptResult.recordset[0].DeptID

    const result = await pool.request()
      .input('StaffID', sql.Int, req.user!.staffId)
      .input('FullName', sql.NVarChar, fullName)
      .input('Email', sql.NVarChar, String(email).toLowerCase())
      .input('Phone', sql.NVarChar, phone || '')
      .input('EmployeeID', sql.NVarChar, nextEmployeeId)
      .input('Role', sql.NVarChar, nextRole)
      .input('DeptID', sql.Int, deptId)
      .query(`
        UPDATE Staff
        SET FullName = @FullName,
            Email = @Email,
            Phone = @Phone,
            EmployeeID = @EmployeeID,
            Role = @Role,
            DeptID = @DeptID,
            UpdatedAt = GETDATE()
        WHERE StaffID = @StaffID;

        SELECT s.StaffID, s.FullName, s.Email, s.Phone, s.Role, s.EmployeeID, s.Status,
               s.TwoFactorEnabled, s.JoinedDate, s.LastLogin, s.PhotoPath, d.DeptName as Department
        FROM Staff s LEFT JOIN Departments d ON s.DeptID = d.DeptID
        WHERE s.StaffID = @StaffID
      `)

    res.json({ success: true, data: result.recordset[0], message: 'Profile updated' })
  } catch (err) {
    console.error('Update profile error:', err)
    if (err && typeof err === 'object' && 'number' in err && (err as { number?: number }).number === 2627) {
      res.status(409).json({ success: false, message: 'Email address or employee ID already exists' })
      return
    }
    res.status(500).json({ success: false, message: 'Could not update profile' })
  }
}

export async function changePassword(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword || String(newPassword).length < 8) {
      res.status(400).json({ success: false, message: 'Current password and a new password of at least 8 characters are required' })
      return
    }

    const pool = await getPool()
    const staffResult = await pool.request()
      .input('StaffID', sql.Int, req.user!.staffId)
      .query('SELECT PasswordHash FROM Staff WHERE StaffID = @StaffID')
    const staff = staffResult.recordset[0]
    if (!staff || !(await bcrypt.compare(currentPassword, staff.PasswordHash))) {
      res.status(401).json({ success: false, message: 'Current password is incorrect' })
      return
    }

    const hash = await bcrypt.hash(newPassword, 10)
    await pool.request()
      .input('StaffID', sql.Int, req.user!.staffId)
      .input('PasswordHash', sql.NVarChar, hash)
      .query('UPDATE Staff SET PasswordHash = @PasswordHash, UpdatedAt = GETDATE() WHERE StaffID = @StaffID')

    res.json({ success: true, data: true, message: 'Password updated' })
  } catch (err) {
    console.error('Change password error:', err)
    res.status(500).json({ success: false, message: 'Could not update password' })
  }
}

export async function verifyPasswordResetKey(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { email, passwordResetKey } = req.body
    if (!email || !passwordResetKey) {
      res.status(400).json({ success: false, message: 'Registered email and Password Reset Key are required' })
      return
    }

    await ensurePasswordResetKeyColumn()
    const pool = await getPool()
    const staffResult = await pool.request()
      .input('Email', sql.NVarChar, String(email).trim().toLowerCase())
      .query('SELECT StaffID, Email, Status, PasswordResetKeyHash FROM Staff WHERE Email = @Email')
    const staff = staffResult.recordset[0]

    if (!staff || staff.Status !== 'active') {
      res.status(403).json({ success: false, message: 'Account is not active' })
      return
    }
    if (String(staff.Email).toLowerCase() !== String(email).trim().toLowerCase()) {
      res.status(400).json({ success: false, message: 'Enter the registered email address on your account' })
      return
    }
    if (!staff.PasswordResetKeyHash) {
      res.status(400).json({ success: false, message: 'Password Reset Key has not been set for this account' })
      return
    }

    const validKey = await bcrypt.compare(String(passwordResetKey).trim(), staff.PasswordResetKeyHash)
    if (!validKey) {
      res.status(401).json({ success: false, message: 'Invalid Password Reset Key' })
      return
    }

    res.json({ success: true, data: true, message: 'Password Reset Key confirmed' })
  } catch (err) {
    console.error('Verify password reset key error:', err)
    res.status(500).json({ success: false, message: 'Could not verify Password Reset Key' })
  }
}

export async function completePasswordReset(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { email, passwordResetKey, newPassword } = req.body
    if (!email || !passwordResetKey || !newPassword || String(newPassword).length < 8) {
      res.status(400).json({ success: false, message: 'Registered email, Password Reset Key and a new password of at least 8 characters are required' })
      return
    }

    await ensurePasswordResetKeyColumn()
    const pool = await getPool()
    const staffResult = await pool.request()
      .input('Email', sql.NVarChar, String(email).trim().toLowerCase())
      .query('SELECT StaffID, Email, Status, PasswordResetKeyHash FROM Staff WHERE Email = @Email')

    const staff = staffResult.recordset[0]
    if (!staff || staff.Status !== 'active') {
      res.status(403).json({ success: false, message: 'Account is not active' })
      return
    }
    if (String(staff.Email).toLowerCase() !== String(email).trim().toLowerCase()) {
      res.status(400).json({ success: false, message: 'Enter the registered email address on your account' })
      return
    }
    if (!staff.PasswordResetKeyHash || !(await bcrypt.compare(String(passwordResetKey).trim(), staff.PasswordResetKeyHash))) {
      res.status(401).json({ success: false, message: 'Invalid Password Reset Key' })
      return
    }

    const hash = await bcrypt.hash(newPassword, 10)
    await pool.request()
      .input('StaffID', sql.Int, staff.StaffID)
      .input('PasswordHash', sql.NVarChar, hash)
      .query('UPDATE Staff SET PasswordHash = @PasswordHash, UpdatedAt = GETDATE() WHERE StaffID = @StaffID')

    res.json({ success: true, data: { changedAt: new Date().toISOString() }, message: 'Password updated' })
  } catch (err) {
    console.error('Complete password reset error:', err)
    res.status(500).json({ success: false, message: 'Could not update password' })
  }
}

export async function setTwoFactor(req: AuthRequest, res: Response): Promise<void> {
  try {
    const pool = await getPool()
    await pool.request()
      .input('StaffID', sql.Int, req.user!.staffId)
      .query('UPDATE Staff SET TwoFactorEnabled = 0, UpdatedAt = GETDATE() WHERE StaffID = @StaffID')

    res.json({ success: true, data: { twoFactorEnabled: false }, message: '2FA is disabled for now' })
  } catch (err) {
    console.error('2FA update error:', err)
    res.status(500).json({ success: false, message: 'Could not update 2FA' })
  }
}

export async function logout(req: AuthRequest, res: Response): Promise<void> {
  // In production: invalidate refresh token in DB
  res.json({ success: true, message: 'Logged out successfully' })
}
