import dotenv from 'dotenv'
import sql from 'mssql'
import {encrypt} from '../security/encryption'
dotenv.config()
async function migrate():Promise<void>{
 if(!process.env.MIGRATION_DB_USER||!process.env.MIGRATION_DB_PASSWORD)throw new Error('Separate migration identity required')
 const pool=await new sql.ConnectionPool({server:process.env.DB_SERVER!,port:Number(process.env.DB_PORT||1433),database:process.env.DB_NAME!,user:process.env.MIGRATION_DB_USER,password:process.env.MIGRATION_DB_PASSWORD,options:{encrypt:process.env.DB_ENCRYPT==='true',trustServerCertificate:process.env.DB_TRUST_CERT==='true'}}).connect()
 const tx=new sql.Transaction(pool)
 try{
  await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE)
  const settings=await new sql.Request(tx).query('SELECT SettingID,SettingsJson FROM SystemSettings WITH(UPDLOCK,HOLDLOCK)')
  for(const row of settings.recordset)if(!row.SettingsJson.startsWith('v1:'))await new sql.Request(tx).input('ID',sql.Int,row.SettingID).input('Data',sql.NVarChar(sql.MAX),encrypt(row.SettingsJson)).query('UPDATE SystemSettings SET SettingsJson=@Data WHERE SettingID=@ID')
  const staff=await new sql.Request(tx).query('SELECT StaffID,TwoFactorSecret FROM Staff WITH(UPDLOCK,HOLDLOCK) WHERE TwoFactorSecret IS NOT NULL')
  for(const row of staff.recordset)if(!row.TwoFactorSecret.startsWith('v1:'))await new sql.Request(tx).input('ID',sql.Int,row.StaffID).input('Data',sql.NVarChar(200),encrypt(row.TwoFactorSecret)).query('UPDATE Staff SET TwoFactorSecret=@Data WHERE StaffID=@ID')
  await new sql.Request(tx).query('UPDATE Staff SET PasswordResetKeyHash=NULL,RefreshToken=NULL; DELETE FROM OTPTokens; DELETE FROM PasswordResets;')
  await tx.commit();console.log('Existing protected data migrated; retired tokens removed.')
 }catch(error){await tx.rollback().catch(()=>{});throw error}finally{await pool.close()}
}
migrate().catch(()=>{console.error('Protected-data migration failed; transaction rolled back. Check operator configuration.');process.exitCode=1})
