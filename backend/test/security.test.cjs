const {test}=require('node:test')
const assert=require('node:assert/strict')
const {randomBytes}=require('node:crypto')
process.env.JWT_SECRET=randomBytes(48).toString('hex')
process.env.DATA_ENCRYPTION_KEY=randomBytes(32).toString('hex')
process.env.PRIVATE_UPLOAD_DIR=require('node:path').resolve(__dirname,'test-private-storage')
const {id,text,password,amount}=require('../dist/security/validation')
const {encrypt,decrypt}=require('../dist/security/encryption')
const {EventLimiter,createMessage}=require('../dist/security/chat')
const {validateFile,documentPath}=require('../dist/controllers/documentsController')
test('Identifiers, message text, bcrypt byte limits and monetary precision are validated',async()=>{
 for(const value of [0,-1,NaN,1.5,'1;DROP TABLE Staff',{},2147483648])assert.throws(()=>id(value))
 assert.equal(id('12'),12)
 for(const value of ['',{},'x'.repeat(4001),'a\x00b'])assert.throws(()=>text(value,4000))
 assert.throws(()=>password('x'.repeat(11)));assert.throws(()=>password('é'.repeat(40)))
 for(const value of [-1,0,1.001,'1e3',Infinity,'NaN'])assert.throws(()=>amount(value))
 assert.equal(amount('12.10'),'12.10')
 await assert.rejects(createMessage(1,1,{content:''}),/Message/)
 await assert.rejects(createMessage(1,1,{content:'file',type:'file'}),/Upload/)
})
test('Chat event limits span sessions and recover only after the time window',()=>{
 let clock=1000;const limiter=new EventLimiter(2,100,()=>clock)
 limiter.take(1);limiter.take(1);assert.throws(()=>limiter.take(1),/Too many/)
 limiter.take(2);clock+=101;assert.doesNotThrow(()=>limiter.take(1))
})
test('Sensitive settings and authenticator secrets use authenticated encryption',()=>{
 const encrypted=encrypt('private-data');assert.equal(decrypt(encrypted),'private-data');assert.notEqual(encrypted,encrypt('private-data'))
 const parts=encrypted.split(':');parts[2]=Buffer.alloc(16).toString('base64');assert.throws(()=>decrypt(parts.join(':')))
 assert.throws(()=>decrypt('plain-secret'))
})
test('Private files reject disguised types, oversized payloads and path traversal',()=>{
 assert.equal(validateFile({buffer:Buffer.from('%PDF-1.7\n'),mimetype:'application/pdf',originalname:'report.pdf'}),'.pdf')
 assert.throws(()=>validateFile({buffer:Buffer.from('<script>'),mimetype:'application/pdf',originalname:'report.pdf'}))
 assert.throws(()=>validateFile({buffer:Buffer.from('%PDF-1.7'),mimetype:'text/html',originalname:'report.html'}))
 assert.throws(()=>validateFile({buffer:Buffer.alloc(10485761),mimetype:'image/png',originalname:'report.png'}))
 assert.throws(()=>documentPath('../../.env'))
})
test('HTTP denies public registration, legacy uploads and unauthenticated API access; CSP is enabled',async()=>{
 const {createApp}=require('../dist/app');const {app,httpServer,io}=createApp()
 await new Promise(resolve=>httpServer.listen(0,'127.0.0.1',resolve))
 const base=`http://127.0.0.1:${httpServer.address().port}`
 try {
  for(const [url,method,status] of [['/api/auth/register-admin','POST',410],['/uploads/private.pdf','GET',404],['/api/staff','GET',401],['/api/accounts/transactions','POST',401],['/api/documents/1','GET',401]]){
   const response=await fetch(base+url,{method});assert.equal(response.status,status,url)
   assert.match(response.headers.get('content-security-policy'),/default-src 'none'/)
   assert.match(response.headers.get('content-security-policy'),/frame-ancestors 'none'/)
  }
 }finally{await new Promise(resolve=>io.close(resolve))}
})

test('Frontend CSP restricts scripts, and service worker never caches private APIs',()=>{
 const fs=require('node:fs'),path=require('node:path')
 const html=fs.readFileSync(path.join(__dirname,'../../frontend/index.html'),'utf8')
 assert.match(html,/script-src 'self';/);assert.doesNotMatch(html,/script-src[^;]*(unsafe-inline|unsafe-eval)/)
 const config=fs.readFileSync(path.join(__dirname,'../../frontend/vite.config.ts'),'utf8')
 assert.match(config,/handler: 'NetworkOnly'/);assert.doesNotMatch(config,/NetworkFirst/)
})
