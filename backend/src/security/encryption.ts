import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
function key(): Buffer {
  const value = process.env.DATA_ENCRYPTION_KEY || ''
  if (!/^[a-fA-F0-9]{64}$/.test(value)) throw new Error('DATA_ENCRYPTION_KEY must be 32 random bytes encoded as hex')
  return Buffer.from(value, 'hex')
}
export function encrypt(value: string): string {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join(':')
}
export function decrypt(value: string): string {
  const [version, iv, tag, data] = value.split(':')
  if (version !== 'v1') throw new Error('Unencrypted secret: migrate before use')
  const cipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'))
  cipher.setAuthTag(Buffer.from(tag, 'base64'))
  return Buffer.concat([cipher.update(Buffer.from(data, 'base64')), cipher.final()]).toString('utf8')
}
