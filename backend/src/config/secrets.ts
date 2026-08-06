import dotenv from 'dotenv'
dotenv.config()

// HTTP and Socket.IO must use the same configured key; never a built-in key.
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32 || /^(your-|change[_-]|replace[_-]|default[_-])/i.test(secret)) {
    throw new Error('JWT_SECRET must be configured with a random secret of at least 32 characters')
  }
  return secret
}
