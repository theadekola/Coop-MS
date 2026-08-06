import { Response } from 'express'
import { getPool, sql } from '../config/database'
import type { AuthRequest } from '../middleware/auth'

async function ensureSettingsTable(): Promise<void> {
  const pool = await getPool()
  await pool.request().query(`
    IF OBJECT_ID('SystemSettings', 'U') IS NULL
    BEGIN
      CREATE TABLE SystemSettings (
        SettingID INT IDENTITY(1,1) PRIMARY KEY,
        Scope NVARCHAR(100) NOT NULL UNIQUE,
        SettingsJson NVARCHAR(MAX) NOT NULL,
        UpdatedByID INT NULL,
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETDATE()
      )
    END
  `)
}

export async function getSettings(req: AuthRequest, res: Response): Promise<void> {
  try {
    const scope = String(req.params.scope || 'system').toLowerCase()
    await ensureSettingsTable()
    const pool = await getPool()
    const result = await pool.request()
      .input('Scope', sql.NVarChar, scope)
      .query('SELECT SettingsJson FROM SystemSettings WHERE Scope = @Scope')

    const raw = result.recordset[0]?.SettingsJson
    res.json({ success: true, data: raw ? JSON.parse(raw) : {} })
  } catch (err) {
    console.error('Get settings error:', err)
    res.status(500).json({ success: false, message: 'Could not load settings' })
  }
}

export async function saveSettings(req: AuthRequest, res: Response): Promise<void> {
  try {
    const scope = String(req.params.scope || 'system').toLowerCase()
    if (scope === 'system' && !['super_admin', 'admin', 'manager'].includes(req.user!.role)) {
      res.status(403).json({ success: false, message: 'Only management users can update system settings' })
      return
    }
    const settings = req.body?.settings ?? req.body ?? {}
    await ensureSettingsTable()
    const pool = await getPool()
    await pool.request()
      .input('Scope', sql.NVarChar, scope)
      .input('SettingsJson', sql.NVarChar(sql.MAX), JSON.stringify(settings))
      .input('UpdatedByID', sql.Int, req.user!.staffId)
      .query(`
        MERGE SystemSettings AS target
        USING (SELECT @Scope AS Scope) AS source
        ON target.Scope = source.Scope
        WHEN MATCHED THEN
          UPDATE SET SettingsJson = @SettingsJson, UpdatedByID = @UpdatedByID, UpdatedAt = GETDATE()
        WHEN NOT MATCHED THEN
          INSERT (Scope, SettingsJson, UpdatedByID) VALUES (@Scope, @SettingsJson, @UpdatedByID);
      `)

    res.json({ success: true, data: settings, message: 'Settings saved' })
  } catch (err) {
    console.error('Save settings error:', err)
    res.status(500).json({ success: false, message: 'Could not save settings' })
  }
}
