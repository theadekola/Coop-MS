import fs from 'fs'
import path from 'path'
import sql from 'mssql'
import dotenv from 'dotenv'

dotenv.config()

const masterConfig: sql.config = {
  server: process.env.DB_SERVER || 'localhost',
  port: parseInt(process.env.DB_PORT || '1433', 10),
  user: process.env.DB_USER || 'coop_app',
  password: process.env.DB_PASSWORD || '',
  database: 'master',
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_CERT !== 'false',
    enableArithAbort: true,
    requestTimeout: 30000,
    connectTimeout: 30000,
  },
  pool: {
    max: 5,
    min: 0,
    idleTimeoutMillis: 30000,
  },
}

function getBatches(script: string) {
  return script
    .split(/^\s*GO\s*;?\s*$/gim)
    .map(batch => batch.trim())
    .filter(Boolean)
}

async function migrate() {
  const schemaPath = path.join(__dirname, 'schema.sql')
  const script = fs.readFileSync(schemaPath, 'utf8')
  const batches = getBatches(script)
  const pool = await sql.connect(masterConfig)

  try {
    console.log(`Running database migration with ${batches.length} SQL batches...`)
    for (const batch of batches) {
      await pool.request().batch(batch)
    }
    console.log('Database migration complete.')
  } finally {
    await pool.close()
  }
}

migrate().catch(error => {
  console.error('Database migration failed:', error)
  process.exit(1)
})
