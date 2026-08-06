import sql from 'mssql'
import dotenv from 'dotenv'
dotenv.config()

const config: sql.config = {
  server: process.env.DB_SERVER || 'localhost',
  port: parseInt(process.env.DB_PORT || '1433'),
  user: process.env.DB_USER || 'coop_app',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'OshodiCoopDB',
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
    enableArithAbort: true,
    requestTimeout: 30000,
    connectTimeout: 30000,
  },
  pool: {
    max: 20,
    min: 2,
    idleTimeoutMillis: 30000,
  },
}

let pool: sql.ConnectionPool | null = null

export async function getPool(): Promise<sql.ConnectionPool> {
  if (pool && pool.connected) return pool
  pool = await sql.connect(config)
  console.log('✅ MSSQL Connected to', config.server, '-', config.database)
  return pool
}

export async function closePool(): Promise<void> {
  if (pool) { await pool.close(); pool = null; console.log('MSSQL pool closed') }
}

export { sql }
