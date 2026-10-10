import path from 'path'
import { getJwtSecret } from './secrets'
export function validateEnvironment():void {
  getJwtSecret()
  if (!/^[a-f0-9]{64}$/i.test(process.env.DATA_ENCRYPTION_KEY||'')) throw new Error('DATA_ENCRYPTION_KEY must be 32 random bytes encoded as hex')
  for(const key of ['DB_SERVER','DB_NAME','DB_USER','DB_PASSWORD','FRONTEND_URL','PRIVATE_UPLOAD_DIR']) if(!process.env[key]?.trim()) throw new Error(`${key} is required`)
  const origin=new URL(process.env.FRONTEND_URL!)
  if(origin.origin!==process.env.FRONTEND_URL || !['http:','https:'].includes(origin.protocol)) throw new Error('FRONTEND_URL must be an exact HTTP(S) origin')
  if(process.env.PRIVATE_UPLOAD_DIR && /(^|[\\/])(public|dist|uploads)([\\/]|$)/i.test(process.env.PRIVATE_UPLOAD_DIR)) throw new Error('Private document storage must be outside public, dist and legacy uploads directories')
  if(!path.isAbsolute(process.env.PRIVATE_UPLOAD_DIR!)) throw new Error('PRIVATE_UPLOAD_DIR must be absolute')
  if(process.env.NODE_ENV==='production' && (origin.protocol!=='https:' || process.env.DB_ENCRYPT!=='true' || process.env.DB_TRUST_CERT==='true' || process.env.DB_USER?.toLowerCase()==='sa')) throw new Error('Production requires HTTPS, verified SQL TLS and a dedicated database user')
  for(const name of ['PORT','DB_PORT','RATE_LIMIT_MAX','RATE_LIMIT_WINDOW_MS']) if(process.env[name] && (!/^\d+$/.test(process.env[name]!) || Number(process.env[name])<1)) throw new Error(`${name} must be positive`)
}
