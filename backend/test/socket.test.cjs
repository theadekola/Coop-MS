const {test}=require('node:test'),assert=require('node:assert/strict')
const {Server}=require('socket.io'),{io:client}=require('socket.io-client')
const {createServer}=require('node:http')
const {configureChat}=require('../dist/security/sockets')
const {EventLimiter}=require('../dist/security/chat')
const {HttpError,text,id}=require('../dist/security/validation')
test('Socket authentication, membership, recipient isolation, revocation and multiple sessions',{timeout:12000},async()=>{
 const http=createServer(),io=new Server(http),members=new Set([1,2]),revoked=new Set(),clients=[]
 let persisted=0,reads=0
 const deps={
  authenticateToken:async token=>{if(!['one','two','other'].includes(token)||revoked.has(token))throw new HttpError(401,'Invalid');return {staffId:token==='one'?1:token==='two'?2:3,exp:Math.floor(Date.now()/1000)+300}},
  members:async()=>[...members],requireMember:async(room,user)=>{if(room!==1||!members.has(user))throw new HttpError(403,'Room access denied')},
  createMessage:async(room,user,data)=>{await deps.requireMember(id(room),user);text(data.content,4000);persisted++;return {MessageID:10,RoomID:room,Content:data.content}},
  readMessage:async(message,user)=>{assert.equal(id(message),10);await deps.requireMember(1,user);reads++;return 1},limiter:new EventLimiter(60)
 }
 configureChat(io,deps);await new Promise(resolve=>http.listen(0,'127.0.0.1',resolve))
 const base=`http://127.0.0.1:${http.address().port}`
 const connect=async token=>{const socket=client(base,{auth:{token},transports:['websocket'],reconnection:false});clients.push(socket);await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject)});return socket}
 const emit=(socket,event,data)=>socket.timeout(2000).emitWithAck(event,data)
 try {
  await assert.rejects(connect('invalid'),/Authentication/)
  const one=await connect('one'),secondSession=await connect('one'),two=await connect('two'),outsider=await connect('other')
  let leaked=0,delivered=0,offline=0
  outsider.on('chat:message',()=>leaked++);outsider.on('chat:typing',()=>leaked++);outsider.on('chat:read',()=>leaked++)
  two.on('chat:message',()=>delivered++);two.on('user:offline',()=>offline++)
  assert.equal((await emit(outsider,'chat:join',1)).status,403)
  assert.equal((await emit(outsider,'chat:message',{roomId:1,content:'intrusion'})).status,403);assert.equal(persisted,0)
  assert.equal((await emit(outsider,'chat:read',{messageId:10})).status,403);assert.equal(reads,0)
  assert.equal((await emit(one,'chat:join','bad')).status,400)
  await emit(one,'chat:join',1);await emit(secondSession,'chat:join',1);await emit(two,'chat:join',1)
  assert.equal((await emit(one,'chat:message',{roomId:1,content:''})).status,400)
  await emit(one,'chat:message',{roomId:1,content:'private'});await emit(one,'chat:typing',{roomId:1,isTyping:true});await emit(two,'chat:read',{messageId:10})
  await new Promise(resolve=>setTimeout(resolve,50));assert.equal(leaked,0);assert.equal(delivered,1)
  one.disconnect();await new Promise(resolve=>setTimeout(resolve,50));assert.equal(offline,0)
  members.delete(2);await emit(secondSession,'chat:message',{roomId:1,content:'membership removed'})
  await new Promise(resolve=>setTimeout(resolve,50));assert.equal(delivered,1)
  assert.equal((await emit(two,'chat:typing',{roomId:1,isTyping:true})).status,403)
  revoked.add('one');assert.equal((await emit(secondSession,'chat:message',{roomId:1,content:'revoked'})).status,401)
 }finally{clients.forEach(socket=>socket.disconnect());await new Promise(resolve=>io.close(resolve))}
})
