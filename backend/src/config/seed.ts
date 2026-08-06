import bcrypt from 'bcryptjs'
import { getPool, sql, closePool } from './database'

async function seed() {
  console.log('Seeding database...')
  const pool = await getPool()

  for (const [name, bal] of [['Asset', 'debit'], ['Liability', 'credit'], ['Equity', 'credit'], ['Income', 'credit'], ['Expense', 'debit']]) {
    await pool.request().input('n', sql.NVarChar, name).input('b', sql.NVarChar, bal)
      .query('IF NOT EXISTS (SELECT 1 FROM AccountTypes WHERE TypeName=@n) INSERT INTO AccountTypes (TypeName, NormalBal) VALUES (@n, @b)')
  }

  for (const dept of ['Administration', 'Accounts', 'Audit', 'Cash Desk', 'Loans', 'Management', 'General']) {
    await pool.request().input('n', sql.NVarChar, dept)
      .query('IF NOT EXISTS (SELECT 1 FROM Departments WHERE DeptName=@n) INSERT INTO Departments (DeptName) VALUES (@n)')
  }

  const coaEntries = [
    ['1000', 'Cash Account', 'Asset'], ['1100', 'Bank Account', 'Asset'],
    ['1200', 'Accounts Receivable', 'Asset'], ['1300', 'Inventory', 'Asset'],
    ['2000', 'Accounts Payable', 'Liability'], ['2100', 'Members Savings', 'Liability'],
    ['2200', 'Loan Payable', 'Liability'], ['3000', 'Share Capital', 'Equity'],
    ['3100', 'Retained Earnings', 'Equity'], ['4000', 'Sales Income', 'Income'],
    ['4100', 'Loan Interest Income', 'Income'], ['5000', 'Other Income', 'Income'],
    ['6000', 'Purchase of Goods', 'Expense'], ['6100', 'Operating Expenses', 'Expense'],
    ['6200', 'Salaries & Wages', 'Expense'], ['6300', 'Utilities', 'Expense'],
  ]

  for (const [code, name, type] of coaEntries) {
    await pool.request().input('c', sql.NVarChar, code).input('n', sql.NVarChar, name).input('t', sql.NVarChar, type)
      .query(`IF NOT EXISTS (SELECT 1 FROM ChartOfAccounts WHERE AccountCode=@c)
              INSERT INTO ChartOfAccounts (AccountCode, AccountName, TypeID)
              VALUES (@c, @n, (SELECT TypeID FROM AccountTypes WHERE TypeName=@t))`)
  }

  const adminEmail = process.env.INITIAL_ADMIN_EMAIL
  const adminName = process.env.INITIAL_ADMIN_NAME
  const adminPhone = process.env.INITIAL_ADMIN_PHONE
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD

  if (adminEmail && adminName && adminPhone && adminPassword) {
    const adminHash = await bcrypt.hash(adminPassword, 12)
    await pool.request()
      .input('EID', sql.NVarChar, 'EXC000')
      .input('FN', sql.NVarChar, adminName)
      .input('EM', sql.NVarChar, adminEmail.toLowerCase())
      .input('PH', sql.NVarChar, adminPhone)
      .input('PW', sql.NVarChar, adminHash)
      .input('RL', sql.NVarChar, 'super_admin')
      .query(`IF NOT EXISTS (SELECT 1 FROM Staff WHERE Email=@EM)
              INSERT INTO Staff (EmployeeID, FullName, Email, Phone, PasswordHash, Role, TwoFactorEnabled, DeptID)
              VALUES (@EID, @FN, @EM, @PH, @PW, @RL, 0, (SELECT DeptID FROM Departments WHERE DeptName='Administration'))`)
  } else {
    console.log('Initial admin not seeded. Set INITIAL_ADMIN_EMAIL, INITIAL_ADMIN_NAME, INITIAL_ADMIN_PHONE and INITIAL_ADMIN_PASSWORD or use /admin/register before first login.')
  }

  console.log('Seed complete!')
  await closePool()
}

seed().catch(console.error)
