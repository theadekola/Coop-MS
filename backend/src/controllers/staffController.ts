import { Response } from 'express'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import { getPool, sql } from '../config/database'
import type { AuthRequest } from '../middleware/auth'

async function resolveDeptId(pool: any, deptId?: number, department?: string): Promise<number | null> {
  if (deptId) return deptId
  if (!department) return null
  const result = await pool.request()
    .input('DeptName', sql.NVarChar, department)
    .query('SELECT TOP 1 DeptID FROM Departments WHERE DeptName = @DeptName')
  return result.recordset[0]?.DeptID ?? null
}

async function ensurePasswordResetKeyColumn(pool: any): Promise<void> {
  await pool.request().query(`
    IF COL_LENGTH('Staff', 'PasswordResetKeyHash') IS NULL
      ALTER TABLE Staff ADD PasswordResetKeyHash NVARCHAR(500) NULL;
  `)
}

export async function getAllStaff(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { search, dept, role, status, page = 1, limit = 20 } = req.query
    const offset = (Number(page) - 1) * Number(limit)

    const pool = await getPool()
    let query = `SELECT s.StaffID, s.EmployeeID, s.FullName, s.Email, s.Phone, s.Role, s.Status,
                        s.JoinedDate, s.LastLogin, s.TwoFactorEnabled, s.PhotoPath,
                        d.DeptName as Department
                 FROM Staff s LEFT JOIN Departments d ON s.DeptID = d.DeptID WHERE 1=1`
    const req2 = pool.request()

    if (search) { query += ` AND (s.FullName LIKE @Search OR s.Email LIKE @Search OR s.Phone LIKE @Search)`; req2.input('Search', sql.NVarChar, `%${search}%`) }
    if (dept) { query += ` AND d.DeptName = @Dept`; req2.input('Dept', sql.NVarChar, dept as string) }
    if (role) { query += ` AND s.Role = @Role`; req2.input('Role', sql.NVarChar, role as string) }
    if (status) { query += ` AND s.Status = @Status`; req2.input('Status', sql.NVarChar, status as string) }

    query += ` ORDER BY s.FullName OFFSET ${offset} ROWS FETCH NEXT ${Number(limit)} ROWS ONLY`
    const result = await req2.query(query)

    const countResult = await pool.request().query(`SELECT COUNT(*) as total FROM Staff`)
    res.json({ success: true, data: result.recordset, total: countResult.recordset[0].total, page: Number(page), limit: Number(limit) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Server error' })
  }
}

export async function getStaffById(req: AuthRequest, res: Response): Promise<void> {
  try {
    const pool = await getPool()
    const result = await pool.request().input('StaffID', sql.Int, req.params.id)
      .query(`SELECT s.*, d.DeptName as Department FROM Staff s LEFT JOIN Departments d ON s.DeptID = d.DeptID WHERE s.StaffID = @StaffID`)
    if (!result.recordset[0]) { res.status(404).json({ success: false, message: 'Staff not found' }); return }
    const { PasswordHash, PasswordResetKeyHash, RefreshToken, TwoFactorSecret, ...staff } = result.recordset[0]
    res.json({ success: true, data: staff })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
}

export async function createStaff(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { fullName, email, phone, role, deptId, department, password, passwordResetKey } = req.body
    if (!fullName || !email || !phone || !role || !password) { res.status(400).json({ success: false, message: 'Required fields missing' }); return }
    if (String(password).length < 8) { res.status(400).json({ success: false, message: 'Password must be at least 8 characters' }); return }
    if (passwordResetKey && String(passwordResetKey).trim().length < 4) { res.status(400).json({ success: false, message: 'Password Reset Key must be at least 4 characters' }); return }
    if (role === 'super_admin' && req.user!.role !== 'super_admin') {
      res.status(403).json({ success: false, message: 'Only Super Admin can create another Super Admin account' })
      return
    }

    const pool = await getPool()
    await ensurePasswordResetKeyColumn(pool)
    const existsResult = await pool.request().input('Email', sql.NVarChar, email.toLowerCase())
      .query('SELECT StaffID FROM Staff WHERE Email = @Email')
    if (existsResult.recordset.length > 0) { res.status(409).json({ success: false, message: 'Email already exists' }); return }
    const resolvedDeptId = await resolveDeptId(pool, deptId, department)

    // Generate employee ID
    const lastResult = await pool.request().query("SELECT TOP 1 EmployeeID FROM Staff ORDER BY StaffID DESC")
    const lastNum = lastResult.recordset[0] ? parseInt(lastResult.recordset[0].EmployeeID.replace('EXC', '')) : 0
    const employeeId = `EXC${String(lastNum + 1).padStart(3, '0')}`

    const passwordHash = await bcrypt.hash(password, 12)
    const passwordResetKeyHash = passwordResetKey ? await bcrypt.hash(String(passwordResetKey).trim(), 12) : null
    const result = await pool.request()
      .input('EmployeeID', sql.NVarChar, employeeId)
      .input('FullName', sql.NVarChar, fullName)
      .input('Email', sql.NVarChar, email.toLowerCase())
      .input('Phone', sql.NVarChar, phone)
      .input('Role', sql.NVarChar, role)
      .input('DeptID', sql.Int, resolvedDeptId)
      .input('PasswordHash', sql.NVarChar, passwordHash)
      .input('PasswordResetKeyHash', sql.NVarChar, passwordResetKeyHash)
      .query(`INSERT INTO Staff (EmployeeID, FullName, Email, Phone, Role, DeptID, PasswordHash, PasswordResetKeyHash)
              OUTPUT INSERTED.StaffID VALUES (@EmployeeID, @FullName, @Email, @Phone, @Role, @DeptID, @PasswordHash, @PasswordResetKeyHash)`)

    // Audit log
    await pool.request()
      .input('StaffID', sql.Int, req.user!.staffId)
      .input('Module', sql.NVarChar, 'Staff Management')
      .input('Description', sql.NVarChar, `Created new staff: ${fullName}`)
      .input('NewValue', sql.NVarChar, `EmployeeID: ${employeeId}`)
      .input('IPAddress', sql.NVarChar, req.ip || '')
      .query(`INSERT INTO AuditLogs (StaffID, ActionType, Module, Description, NewValue, IPAddress) VALUES (@StaffID, 'CREATE', @Module, @Description, @NewValue, @IPAddress)`)

    res.status(201).json({ success: true, message: 'Staff created successfully', data: { staffId: result.recordset[0].StaffID, employeeId } })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Server error' })
  }
}

export async function updateStaff(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { fullName, email, phone, role, deptId, department, status, passwordResetKey } = req.body
    const pool = await getPool()
    await ensurePasswordResetKeyColumn(pool)
    const targetResult = await pool.request()
      .input('StaffID', sql.Int, req.params.id)
      .query('SELECT StaffID, Role FROM Staff WHERE StaffID = @StaffID')
    const target = targetResult.recordset[0]
    if (!target) { res.status(404).json({ success: false, message: 'Staff not found' }); return }
    if (target.Role === 'super_admin' && req.user!.role !== 'super_admin') {
      res.status(403).json({ success: false, message: 'Only Super Admin can update a Super Admin account' })
      return
    }
    if (role === 'super_admin' && req.user!.role !== 'super_admin') {
      res.status(403).json({ success: false, message: 'Only Super Admin can assign the Super Admin role' })
      return
    }
    const resolvedDeptId = await resolveDeptId(pool, deptId, department)
    const passwordResetKeyHash = passwordResetKey ? await bcrypt.hash(String(passwordResetKey).trim(), 12) : null
    await pool.request()
      .input('StaffID', sql.Int, req.params.id)
      .input('FullName', sql.NVarChar, fullName)
      .input('Email', sql.NVarChar, email ? String(email).toLowerCase() : null)
      .input('Phone', sql.NVarChar, phone)
      .input('Role', sql.NVarChar, role)
      .input('DeptID', sql.Int, resolvedDeptId)
      .input('Status', sql.NVarChar, status || null)
      .input('PasswordResetKeyHash', sql.NVarChar, passwordResetKeyHash)
      .query(`UPDATE Staff
              SET FullName = COALESCE(@FullName, FullName),
                  Email = COALESCE(@Email, Email),
                  Phone = COALESCE(@Phone, Phone),
                  Role = COALESCE(@Role, Role),
                  DeptID = COALESCE(@DeptID, DeptID),
                  Status = COALESCE(@Status, Status),
                  PasswordResetKeyHash = COALESCE(@PasswordResetKeyHash, PasswordResetKeyHash),
                  UpdatedAt = GETDATE()
              WHERE StaffID = @StaffID`)

    await pool.request()
      .input('StaffID', sql.Int, req.user!.staffId)
      .input('Description', sql.NVarChar, `Updated staff ID: ${req.params.id}`)
      .input('IPAddress', sql.NVarChar, req.ip || '')
      .query(`INSERT INTO AuditLogs (StaffID, ActionType, Module, Description, IPAddress) VALUES (@StaffID, 'UPDATE', 'Staff Management', @Description, @IPAddress)`)

    res.json({ success: true, message: 'Staff updated successfully' })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
}

export async function resetStaffPassword(req: AuthRequest, res: Response): Promise<void> {
  try {
    const pool = await getPool()
    const staffResult = await pool.request()
      .input('StaffID', sql.Int, req.params.id)
      .query('SELECT StaffID, FullName, Email, Role FROM Staff WHERE StaffID = @StaffID')

    const staff = staffResult.recordset[0]
    if (!staff) { res.status(404).json({ success: false, message: 'Staff not found' }); return }
    if (staff.Role === 'super_admin' && req.user!.role !== 'super_admin') {
      res.status(403).json({ success: false, message: 'Only Super Admin can reset a Super Admin password' })
      return
    }

    const temporaryPassword = `Temp@${randomBytes(4).toString('hex')}`
    const passwordHash = await bcrypt.hash(temporaryPassword, 12)

    await pool.request()
      .input('StaffID', sql.Int, req.params.id)
      .input('PasswordHash', sql.NVarChar, passwordHash)
      .query('UPDATE Staff SET PasswordHash = @PasswordHash, UpdatedAt = GETDATE() WHERE StaffID = @StaffID')

    await pool.request()
      .input('StaffID', sql.Int, req.user!.staffId)
      .input('Description', sql.NVarChar, `Reset password for ${staff.FullName}`)
      .input('NewValue', sql.NVarChar, `StaffID: ${staff.StaffID}`)
      .input('IPAddress', sql.NVarChar, req.ip || '')
      .query(`INSERT INTO AuditLogs (StaffID, ActionType, Module, Description, NewValue, IPAddress) VALUES (@StaffID, 'UPDATE', 'User Management', @Description, @NewValue, @IPAddress)`)

    res.json({ success: true, message: 'Password reset successfully', data: { temporaryPassword } })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Server error' })
  }
}

export async function getDashboardStats(req: AuthRequest, res: Response): Promise<void> {
  try {
    const pool = await getPool()
    const result = await pool.request().query(`
      SELECT
        (SELECT COUNT(*) FROM Staff) AS TotalStaff,
        (SELECT COUNT(*) FROM Staff WHERE Status = 'active') AS ActiveStaff,
        (SELECT COUNT(*) FROM Staff WHERE Status = 'on_leave') AS OnLeave,
        (SELECT COUNT(*) FROM Staff WHERE Status = 'suspended') AS Suspended,
        (SELECT COUNT(*) FROM Departments) AS TotalDepts
    `)
    res.json({ success: true, data: result.recordset[0] })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
}
