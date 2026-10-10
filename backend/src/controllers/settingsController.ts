import { encrypt,decrypt } from '../security/encryption'
import { HttpError,errorResponse } from '../security/validation'
import { Response } from 'express'
import { getPool, sql } from '../config/database'
import type { AuthRequest } from '../middleware/auth'

function checkScope(req:AuthRequest):string {
  const scope=String(req.params.scope||'').toLowerCase()
  if(scope.startsWith('my-profile-')) {
    if(scope!==`my-profile-${req.user!.staffId}`) throw new HttpError(403,'Profile access denied')
  } else {
    if(!['system','company-profile','general-settings','financial-settings','tax-settings','notifications','log-retention'].includes(scope)) throw new HttpError(409,'This feature requires an operational backend; use Security to view enforced controls')
    if(!['super_admin','admin','manager'].includes(req.user!.role)) throw new HttpError(403,'Management permission required')
  }
  return scope
}

export async function getSettings(req: AuthRequest, res: Response): Promise<void> {
  try {
    const scope = checkScope(req)
    const pool = await getPool()
    const result = await pool.request()
      .input('Scope', sql.NVarChar, scope)
      .query('SELECT SettingsJson FROM SystemSettings WHERE Scope = @Scope')

    const raw = result.recordset[0]?.SettingsJson
    res.json({ success: true, data: raw ? JSON.parse(raw.startsWith('v1:') ? decrypt(raw) : raw) : {} })
  } catch (err) {
    console.error('Get settings error:', err)
    errorResponse(res,err)
  }
}

export async function saveSettings(req: AuthRequest, res: Response): Promise<void> {
  try {
    const scope = checkScope(req)
    if (scope === 'system' && !['super_admin', 'admin', 'manager'].includes(req.user!.role)) {
      res.status(403).json({ success: false, message: 'Only management users can update system settings' })
      return
    }
    const settings = req.body?.settings ?? req.body ?? {}
    if(!settings || typeof settings!=='object' || Array.isArray(settings) || JSON.stringify(settings).length>1000000) throw new HttpError(400,'Invalid settings')
    if(/"[^" ]*(password|secret|token|apiKey)[^" ]*"\s*:/i.test(JSON.stringify(settings))) throw new HttpError(400,'Configure credentials through the deployment secret store')
    const pool = await getPool()
    await pool.request()
      .input('Scope', sql.NVarChar, scope)
      .input('SettingsJson', sql.NVarChar(sql.MAX), encrypt(JSON.stringify(settings)))
      .input('UpdatedByID', sql.Int, req.user!.staffId)
      .query(`
        MERGE SystemSettings WITH (HOLDLOCK) AS target
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
    errorResponse(res,err)
  }
}
