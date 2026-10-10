// Runs only against an explicitly named, disposable database. Never a production database.
const {test}=require('node:test'),assert=require('node:assert/strict')
const sql=require('mssql'),fs=require('node:fs'),path=require('node:path'),{randomUUID,randomBytes}=require('node:crypto')
const name=process.env.TEST_DB_NAME
test('SQL transactions, independent expense approval, reversals, chat ACLs and least privilege',{skip:!name,timeout:120000},async()=>{
 assert.match(name,/^[A-Za-z][A-Za-z0-9_]*_Test$/)
 assert.notEqual(name,process.env.DB_NAME)
 const config={server:process.env.TEST_DB_SERVER||'localhost',port:Number(process.env.TEST_DB_PORT||1433),user:process.env.TEST_DB_USER,password:process.env.TEST_DB_PASSWORD,database:'master',options:{encrypt:true,trustServerCertificate:true}}
 const master=await new sql.ConnectionPool(config).connect()
 let pool,appPool
 const batches=script=>script.split(/^\s*GO\s*;?\s*$/gim).map(s=>s.trim()).filter(Boolean)
 try {
  // An existing database is never overwritten or cleared by this test.
  const exists=await master.request().input('Name',sql.NVarChar,name).query('SELECT name FROM sys.databases WHERE name=@Name')
  assert.equal(exists.recordset.length,0,'Use a fresh disposable test database name')
  await master.request().batch(`CREATE DATABASE [${name}]`)
  pool=await new sql.ConnectionPool({...config,database:name}).connect()
  const schema=fs.readFileSync(path.join(__dirname,'../src/config/schema.sql'),'utf8').split('-- STAFF & AUTH')[1]
  // Discard only the database-selection preamble; all application tables are tested.
  for(const batch of batches(schema.substring(schema.indexOf('CREATE TABLE Departments'))))await pool.request().batch(batch)
  for(let run=0;run<2;run++)for(const batch of batches(fs.readFileSync(path.join(__dirname,'../src/config/security-v2.sql'),'utf8')))await pool.request().batch(batch)
  await pool.request().batch(fs.readFileSync(path.join(__dirname,'../src/config/runtime-permissions.sql'),'utf8'))
  const login=`test_${randomBytes(6).toString('hex')}`,pass=randomBytes(32).toString('hex')+'Aa!'
  // The generated identity is disposable and cannot control the schema or ledger directly.
  await master.request().batch(`CREATE LOGIN [${login}] WITH PASSWORD='${pass}'`)
  await pool.request().batch(`CREATE USER [${login}] FOR LOGIN [${login}]; ALTER ROLE coop_runtime ADD MEMBER [${login}]`)
  appPool=await new sql.ConnectionPool({...config,database:name,user:login,password:pass}).connect()
  await pool.request().batch(`INSERT INTO Staff(EmployeeID,FullName,Email,Phone,PasswordHash,Role) VALUES
   ('test1','Submitter','submitter@example.test','test','not-a-login-hash','accountant'),
   ('test2','Reviewer','reviewer@example.test','test','not-a-login-hash','manager'),
   ('test3','Outsider','outsider@example.test','test','not-a-login-hash','staff');
   INSERT INTO AccountTypes(TypeName,NormalBal) VALUES('Asset','debit');
   INSERT INTO ChartOfAccounts(AccountCode,AccountName,TypeID) VALUES('1000','Test cash',1);
   INSERT INTO ChatRooms(RoomName,RoomType,CreatedByID) VALUES('Private','group',1);
   INSERT INTO ChatRoomMembers(RoomID,StaffID) VALUES(1,1),(1,2);`)
  const submit=async(actor,type,value)=>appPool.request().input('ActorID',sql.Int,actor).input('AccountID',sql.Int,1).input('Description',sql.NVarChar,'Test entry').input('TxnType',sql.NVarChar,type).input('Amount',sql.Decimal(18,2),value).input('PaymentMethod',sql.NVarChar,'Cash').execute('dbo.SubmitTransaction')
  const review=async(actor,approval,decision)=>appPool.request().input('ActorID',sql.Int,actor).input('ApprovalID',sql.Int,approval).input('Decision',sql.NVarChar,decision).execute('dbo.ReviewApproval')
  await assert.rejects(submit(3,'income',100),e=>e.number===51003)
  await submit(1,'income',1000)
  const expense=(await submit(1,'expense',125.50)).recordset[0]
  assert.equal(expense.Status,'pending');assert.equal(expense.Balance,1000)
  // Make the submitter eligible to review in general; independence must still reject them.
  await pool.request().query("UPDATE Staff SET Role='admin' WHERE StaffID=1")
  await assert.rejects(review(1,1,'approved'),e=>e.number===51003)
  const concurrent=await Promise.allSettled([review(2,1,'approved'),review(2,1,'approved')])
  assert.equal(concurrent.filter(r=>r.status==='fulfilled').length,1)
  const posted=(await pool.request().query('SELECT * FROM Transactions WHERE TxnID=2')).recordset[0]
  assert.equal(posted.Status,'posted');assert.equal(posted.Balance,874.50)
  await assert.rejects(appPool.request().query('DELETE FROM Transactions WHERE TxnID=2'))
  await assert.rejects(pool.request().query('UPDATE Transactions SET CreditAmount=1 WHERE TxnID=2'),e=>e.number===51001)
  await assert.rejects(appPool.request().query('DELETE FROM AuditLogs'))
  await assert.rejects(appPool.request().query('ALTER TABLE Staff ADD Unauthorized INT'))
  const reversal=await appPool.request().input('ActorID',sql.Int,1).input('TxnID',sql.Int,2).input('Reason',sql.NVarChar,'Correct duplicated expense').execute('dbo.RequestReversal')
  assert.equal(reversal.recordset[0].Status,'pending')
  await assert.rejects(appPool.request().input('ActorID',sql.Int,1).input('TxnID',sql.Int,2).input('Reason',sql.NVarChar,'Duplicate reversal').execute('dbo.RequestReversal'))
  await review(2,2,'approved')
  assert.equal((await pool.request().query("SELECT SUM(DebitAmount-CreditAmount) Balance FROM Transactions WHERE Status='posted'")).recordset[0].Balance,1000)
  const audit=(await pool.request().query("SELECT COUNT(*) AS Total FROM AuditLogs WHERE Module IN ('Accounts','Management')")).recordset[0].Total
  assert.equal(audit,5)
  const database=require('../dist/config/database');database.getPool=async()=>appPool
  const chat=require('../dist/security/chat')
  await assert.rejects(chat.createMessage(1,3,{content:'unauthorised'}),e=>e.number===51003)
  const message=await chat.createMessage(1,1,{content:'private'})
  await assert.rejects(chat.readMessage(message.MessageID,3),e=>e.number===51003)
  await chat.readMessage(message.MessageID,2)
  process.env.JWT_SECRET=randomBytes(48).toString('hex')
  const session=require('../dist/security/session')
  const staff=(await pool.request().query('SELECT StaffID,Role,Email,TokenVersion FROM Staff WHERE StaffID=1')).recordset[0]
  const issued=await session.newSession(staff);assert.equal((await session.authenticateToken(issued.token)).role,'admin')
  await pool.request().query('UPDATE Staff SET TokenVersion=TokenVersion+1 WHERE StaffID=1')
  await assert.rejects(session.authenticateToken(issued.token),/revoked/)
  // Exercise the real HTTP handlers against the restricted SQL connection.
  process.env.DATA_ENCRYPTION_KEY=randomBytes(32).toString('hex')
  const {encrypt}=require('../dist/security/encryption'),{authenticator}=require('otplib'),bcrypt=require('bcryptjs')
  const loginPassword=randomBytes(20).toString('hex'),secret=authenticator.generateSecret()
  await pool.request().input('Hash',sql.NVarChar,await bcrypt.hash(loginPassword,12)).input('Secret',sql.NVarChar,encrypt(secret))
   .query('UPDATE Staff SET PasswordHash=@Hash,TwoFactorSecret=@Secret,TwoFactorEnabled=1 WHERE StaffID=1')
  const {createApp}=require('../dist/app'),{httpServer,io}=createApp()
  const fsPromises=require('node:fs/promises'),os=require('node:os')
  const storage=await fsPromises.mkdtemp(path.join(os.tmpdir(),'coop-security-'))
  process.env.PRIVATE_UPLOAD_DIR=storage
  await new Promise(resolve=>httpServer.listen(0,'127.0.0.1',resolve))
  const base=`http://127.0.0.1:${httpServer.address().port}`;process.env.FRONTEND_URL=base
  const request=(url,data,token,extra={})=>fetch(base+'/api'+url,{method:data===undefined?'GET':'POST',headers:{...(data===undefined?{}:{'Content-Type':'application/json'}),...(token?{Authorization:`Bearer ${token}`} : {}),...extra},...(data===undefined?{}:{body:JSON.stringify(data)})})
  try{
   const login=async()=>{const response=await request('/auth/login',{email:'submitter@example.test',password:loginPassword});assert.equal(response.status,200);const data=await response.json();assert.equal(data.requires2FA,true);assert.equal(data.token,undefined);return data.challengeId}
   const expired=await login()
   await pool.request().input('ID',sql.UniqueIdentifier,expired).query('UPDATE AuthChallenges SET ExpiresAt=DATEADD(minute,-1,SYSUTCDATETIME()) WHERE ChallengeID=@ID')
   assert.equal((await request('/auth/verify-2fa',{challengeId:expired,otp:authenticator.generate(secret)})).status,401)
   assert.equal((await request('/auth/verify-2fa',{staffId:1,otp:authenticator.generate(secret)})).status,400)
   const challenge=await login(),code=authenticator.generate(secret)
   const verified=await request('/auth/verify-2fa',{challengeId:challenge,otp:code});assert.equal(verified.status,200)
   const signedIn=await verified.json(),cookie=verified.headers.get('set-cookie').split(';')[0]
   assert.match(verified.headers.get('set-cookie'),/HttpOnly/i);assert.match(verified.headers.get('set-cookie'),/SameSite=Strict/i)
   assert.equal((await request('/auth/verify-2fa',{challengeId:challenge,otp:code})).status,401)
   const secondChallenge=await login()
   assert.equal((await request('/auth/verify-2fa',{challengeId:secondChallenge,otp:code})).status,401)
   const outsider=(await pool.request().query('SELECT StaffID,Role,Email,TokenVersion FROM Staff WHERE StaffID=3')).recordset[0]
   const outsiderSession=await session.newSession(outsider)
   assert.equal((await request('/staff',undefined,outsiderSession.token)).status,403)
   assert.equal((await request('/settings/my-profile-1',undefined,outsiderSession.token)).status,403)
   const form=new FormData();form.append('roomId','1');form.append('file',new Blob(['%PDF-1.7\nprotected'],{type:'application/pdf'}),'private.pdf')
   const uploaded=await fetch(base+'/api/documents',{method:'POST',headers:{Authorization:`Bearer ${signedIn.token}`},body:form});assert.equal(uploaded.status,201)
   const document=(await uploaded.json()).data
   assert.equal((await request(`/documents/${document.DocumentID}`,undefined,outsiderSession.token)).status,404)
   const downloaded=await request(`/documents/${document.DocumentID}`,undefined,signedIn.token)
   assert.equal(downloaded.status,200);assert.match(downloaded.headers.get('cache-control'),/no-store/);assert.equal(await downloaded.text(),'%PDF-1.7\nprotected')
   const refreshed=await request('/auth/refresh',{},undefined,{Origin:base,Cookie:cookie});assert.equal(refreshed.status,200)
   const rotated=refreshed.headers.get('set-cookie').split(';')[0]
   assert.equal((await request('/auth/refresh',{},undefined,{Origin:base,Cookie:cookie})).status,401)
   assert.equal((await request('/auth/logout',{},signedIn.token)).status,200)
   assert.equal((await request('/auth/me',undefined,signedIn.token)).status,401)
   assert.equal((await request('/auth/refresh',{},undefined,{Origin:base,Cookie:rotated})).status,401)
  }finally{
   await new Promise(resolve=>io.close(resolve))
   assert.ok(storage.startsWith(path.resolve(os.tmpdir())+path.sep))
   await fsPromises.rm(storage,{recursive:true,force:true})
  }
  await appPool.close();appPool=undefined
  await pool.request().batch(`DROP USER [${login}]`);await master.request().batch(`DROP LOGIN [${login}]`)
 }finally{
  if(appPool)await appPool.close();if(pool)await pool.close();await master.close()
  // Keep the disposable database for investigation; the CI service is destroyed by the runner.
 }
})
