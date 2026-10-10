import { Server, Socket } from 'socket.io'
import { authenticateToken } from './session'
import { chatLimiter, chatError, createMessage, members, readMessage, requireMember } from './chat'
import { id, HttpError } from './validation'

// Delivery rechecks membership and sessions. Joining a Socket.IO room never grants access.
export function configureChat(io:Server, dependencies = { authenticateToken, createMessage, members, readMessage, requireMember, limiter:chatLimiter }) {
  const online = new Map<number,Set<string>>()
  const userRooms=new Map<number,Set<number>>()
  const emitRoom = async(roomId:number,event:string,data:any,except?:string) => {
    const allowed = new Set(await dependencies.members(roomId))
    for(const socket of io.sockets.sockets.values()) {
      if(socket.id===except || !allowed.has(socket.data.user?.staffId)) continue
      try { await dependencies.authenticateToken(socket.handshake.auth.token); socket.emit(event,data) }
      catch { socket.disconnect(true) }
    }
  }
  io.use(async(socket,next) => {
    try { socket.data.user=await dependencies.authenticateToken(socket.handshake.auth.token); next() }
    catch {next(new Error('Authentication required'))}
  })
  io.on('connection',socket => {
    const user=socket.data.user
    const sessions=online.get(user.staffId)||new Set<string>(); sessions.add(socket.id); online.set(user.staffId,sessions)
    const expiry=setTimeout(()=>socket.disconnect(true),Math.max(0,user.exp*1000-Date.now()))
    const event=(name:string,action:(data:any)=>Promise<any>) => socket.on(name,async(data,ack) => {
      try {
        dependencies.limiter.take(user.staffId)
        socket.data.user=await dependencies.authenticateToken(socket.handshake.auth.token)
        const result=await action(data)
        if(typeof ack==='function') ack({success:true,data:result})
      } catch(error) {
        const err=chatError(error), response={success:false,status:err.status,message:err.message}
        if(typeof ack==='function') ack(response); else socket.emit('chat:error',response)
        if(err.status===401) socket.disconnect(true)
      }
    })
    event('chat:join',async value => {
      const room=id(value); await dependencies.requireMember(room,user.staffId); await socket.join(`room:${room}`)
      const rooms=userRooms.get(user.staffId)||new Set<number>();rooms.add(room);userRooms.set(user.staffId,rooms)
      await emitRoom(room,'user:online',{staffId:user.staffId},socket.id)
      return {roomId:room}
    })
    event('chat:leave',async value=> { await socket.leave(`room:${id(value)}`) })
    event('chat:message',async data=> {
      const room=id(data?.roomId), message=await dependencies.createMessage(room,user.staffId,data)
      await emitRoom(room,'chat:message',message).catch(()=>{}); return message
    })
    event('chat:typing',async data=> {
      const room=id(data?.roomId)
      if(typeof data?.isTyping!=='boolean') throw new HttpError(400,'Invalid typing indicator')
      await dependencies.requireMember(room,user.staffId)
      await emitRoom(room,'chat:typing',{roomId:room,staffId:user.staffId,isTyping:data.isTyping},socket.id)
    })
    event('chat:read',async data=> {
      const message=id(data?.messageId),room=await dependencies.readMessage(message,user.staffId)
      await emitRoom(room,'chat:read',{roomId:room,messageId:message,staffId:user.staffId},socket.id)
    })
    socket.on('disconnect',()=> {
      clearTimeout(expiry); sessions.delete(socket.id)
      if(sessions.size) return
      online.delete(user.staffId)
      // Only previously joined, currently authorised rooms receive presence updates.
      for(const room of userRooms.get(user.staffId)||[]) void emitRoom(room,'user:offline',{staffId:user.staffId}).catch(()=>{})
      userRooms.delete(user.staffId)
    })

  })
  return emitRoom
}
