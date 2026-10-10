import dotenv from 'dotenv'
import {createApp} from './app'
import {validateEnvironment} from './config/environment'
import {getPool,closePool} from './config/database'
dotenv.config()
async function start(){
 validateEnvironment()
 const pool=await getPool()
 await pool.request().query("IF OBJECT_ID('dbo.AuthSessions') IS NULL OR OBJECT_ID('dbo.SubmitTransaction') IS NULL THROW 51001,'Apply security migration before starting',1;")
 await pool.request().query("IF IS_SRVROLEMEMBER('sysadmin')=1 OR IS_MEMBER('db_owner')=1 OR HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','ALTER')=1 OR HAS_PERMS_BY_NAME('dbo.Transactions','OBJECT','UPDATE')=1 OR HAS_PERMS_BY_NAME('dbo.AuditLogs','OBJECT','DELETE')=1 THROW 51003,'Runtime database identity has excessive privileges',1;")
 const {httpServer,io}=createApp()
 httpServer.listen(process.env.PORT||5000,()=>console.log('Coop-MS API started'))
 const shutdown=()=>{io.close();httpServer.close(()=>{void closePool().finally(()=>process.exit(0))})}
 process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown)
}
start().catch(error=>{console.error('Startup failed',error.message);process.exitCode=1})
