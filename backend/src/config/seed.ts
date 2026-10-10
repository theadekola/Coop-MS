import bcrypt from 'bcryptjs'
import { getPool, sql, closePool } from './database'

async function seed() {
  console.log('Seeding database...')
  if(!process.env.MIGRATION_DB_USER || !process.env.MIGRATION_DB_PASSWORD) throw new Error('Bootstrap requires a separate migration identity')
  const pool = await new sql.ConnectionPool({server:process.env.DB_SERVER!,port:Number(process.env.DB_PORT||1433),database:process.env.DB_NAME||'OshodiCoopDB',user:process.env.MIGRATION_DB_USER,password:process.env.MIGRATION_DB_PASSWORD,options:{encrypt:process.env.DB_ENCRYPT==='true',trustServerCertificate:process.env.DB_TRUST_CERT==='true'}}).connect()

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
    if(adminPassword.length<12 || Buffer.byteLength(adminPassword)>72) throw new Error('Initial administrator password must be 12 characters or more and at most 72 bytes')
    const adminHash = await bcrypt.hash(adminPassword, 12)
    await pool.request()
      .input('EID', sql.NVarChar, 'EXC000')
      .input('FN', sql.NVarChar, adminName)
      .input('EM', sql.NVarChar, adminEmail.toLowerCase())
      .input('PH', sql.NVarChar, adminPhone)
      .input('PW', sql.NVarChar, adminHash)
      .input('RL', sql.NVarChar, 'super_admin')
      .query(`SET XACT_ABORT ON; BEGIN TRY BEGIN TRANSACTION;
              IF EXISTS(SELECT 1 FROM BootstrapState WITH(UPDLOCK,HOLDLOCK) WHERE ID=1 AND ConsumedAt IS NULL)
              AND NOT EXISTS(SELECT 1 FROM Staff WITH(UPDLOCK,HOLDLOCK) WHERE Role IN ('super_admin','admin'))
              BEGIN
              INSERT INTO Staff (EmployeeID, FullName, Email, Phone, PasswordHash, Role, TwoFactorEnabled, DeptID)
              VALUES (@EID, @FN, @EM, @PH, @PW, @RL, 0, (SELECT DeptID FROM Departments WHERE DeptName='Administration'));
              UPDATE BootstrapState SET ConsumedAt=SYSUTCDATETIME() WHERE ID=1;
              END; COMMIT; END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH`)
  } else {
    console.log('Initial admin not seeded. Set INITIAL_ADMIN_EMAIL, INITIAL_ADMIN_NAME, INITIAL_ADMIN_PHONE and INITIAL_ADMIN_PASSWORD through the operator bootstrap.')
  }

  console.log('Seed complete!')
  await pool.close()
}

seed().catch(error=>{console.error('Seed failed',error);process.exitCode=1})
