import { getJwtSecret } from './config/secrets'
import express from 'express'
import http from 'http'
import { Server as SocketServer } from 'socket.io'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'
import jwt from 'jsonwebtoken'
import path from 'path'
import routes from './routes/index'
import { getPool, sql } from './config/database'

dotenv.config()
getJwtSecret()
const app = express()
const httpServer = http.createServer(app)
const PORT = process.env.PORT || 5000

// ── Socket.IO ────────────────────────────────────────────────
const io = new SocketServer(httpServer, {
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true },
  transports: ['websocket', 'polling'],
})

// Track online users: staffId → socketId
const onlineUsers = new Map<number, string>()

io.use((socket, next) => {
  const token = socket.handshake.auth.token
  if (!token) return next(new Error('Unauthorized'))
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as any
    ;(socket as any).user = decoded
    next()
  } catch { next(new Error('Unauthorized')) }
})

io.on('connection', (socket) => {
  const user = (socket as any).user
  console.log('Socket connected')
  onlineUsers.set(user.staffId, socket.id)
  io.emit('user:online', { staffId: user.staffId })

  // Join chat room
  socket.on('chat:join', (roomId: number) => socket.join(`room:${roomId}`))
  socket.on('chat:leave', (roomId: number) => socket.leave(`room:${roomId}`))

  // New message
  socket.on('chat:message', async (data: { roomId: number; content: string; type?: string }) => {
    try {
      const pool = await getPool()
      const result = await pool.request()
        .input('RoomID', sql.Int, data.roomId)
        .input('SenderID', sql.Int, user.staffId)
        .input('Content', sql.NVarChar, data.content)
        .input('Type', sql.NVarChar, data.type || 'text')
        .query(`INSERT INTO ChatMessages (RoomID, SenderID, Content, MessageType)
                OUTPUT INSERTED.MessageID, INSERTED.SentAt
                VALUES (@RoomID, @SenderID, @Content, @Type)`)

      const staffResult = await pool.request().input('StaffID', sql.Int, user.staffId)
        .query('SELECT FullName FROM Staff WHERE StaffID = @StaffID')

      const msg = {
        id: result.recordset[0].MessageID,
        roomId: data.roomId, senderId: user.staffId,
        senderName: staffResult.recordset[0].FullName,
        content: data.content, type: data.type || 'text',
        timestamp: result.recordset[0].SentAt,
      }
      io.to(`room:${data.roomId}`).emit('chat:message', msg)
    } catch (err) { console.error('Chat msg error:', err) }
  })

  // Typing indicator
  socket.on('chat:typing', (data: { roomId: number; isTyping: boolean }) => {
    socket.to(`room:${data.roomId}`).emit('chat:typing', { staffId: user.staffId, isTyping: data.isTyping })
  })

  // Read receipts
  socket.on('chat:read', async (data: { messageId: number }) => {
    try {
      const pool = await getPool()
      await pool.request()
        .input('MessageID', sql.Int, data.messageId)
        .input('StaffID', sql.Int, user.staffId)
        .query(`IF NOT EXISTS (SELECT 1 FROM MessageReadReceipts WHERE MessageID=@MessageID AND StaffID=@StaffID)
                INSERT INTO MessageReadReceipts (MessageID, StaffID) VALUES (@MessageID, @StaffID)`)
      socket.broadcast.emit('chat:read', { messageId: data.messageId, staffId: user.staffId })
    } catch (err) { console.error('Read receipt error:', err) }
  })

  socket.on('disconnect', () => {
    onlineUsers.delete(user.staffId)
    io.emit('user:offline', { staffId: user.staffId })
    console.log('Socket disconnected')
  })
})

// ── Middleware ───────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }))
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }))
app.use(compression() as any)
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max: parseInt(process.env.RATE_LIMIT_MAX || '200'),
  message: { success: false, message: 'Too many requests, please try again later.' }
}))

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

// ── API Routes ───────────────────────────────────────────────
app.use('/api', routes)

// Health check
app.get('/health', (_, res) => res.json({ status: 'OK', timestamp: new Date().toISOString(), env: process.env.NODE_ENV }))

// 404
app.use('*', (_, res) => res.status(404).json({ success: false, message: 'Route not found' }))

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ success: false, message: 'Internal server error' })
})

// ── Start ────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`\n🚀 Oshodi Coop API running on port ${PORT}`)
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`   Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}\n`)
})

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down...')
  const { closePool } = await import('./config/database')
  await closePool()
  process.exit(0)
})
