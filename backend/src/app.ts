import express from 'express'
import http from 'http'
import { Server as SocketServer } from 'socket.io'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'
import { configureChat } from './security/sockets'
import routes from './routes/index'

dotenv.config()
export function createApp(){
const app = express()
const httpServer = http.createServer(app)

// Application middleware
const io = new SocketServer(httpServer, {
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true },
  transports: ['websocket', 'polling'],
})

const handshakeLimit=rateLimit({windowMs:15*60000,limit:30,standardHeaders:true,legacyHeaders:false})
io.engine.use((req:any,res:any,next:any)=>req._query.sid?next():handshakeLimit(req,res,next))
app.locals.emitRoom = configureChat(io)

app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'none'"], formAction: ["'none'"] } } }))
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }))
app.use(compression() as any)
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max: parseInt(process.env.RATE_LIMIT_MAX || '200'),
  message: { success: false, message: 'Too many requests, please try again later.' }
}))

// Static uploads
app.use('/uploads', (_req,res) => { res.status(404).json({success:false,message:'Use authenticated document downloads'}) })

// API routes
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

// Application middleware

return {app,httpServer,io}
}
