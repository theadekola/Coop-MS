export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message) }
}
export function id(value: unknown): number {
  if (!/^[1-9]\d{0,9}$/.test(String(value)) || Number(value) > 2147483647) throw new HttpError(400, 'Invalid identifier')
  return Number(value)
}
export function text(value: unknown, max: number, label = 'Text'): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new HttpError(400, `${label} is invalid`)
  return value.trim()
}
export function password(value: unknown): string {
  if (typeof value !== 'string' || value.length < 12 || Buffer.byteLength(value) > 72) throw new HttpError(400, 'Password must contain at least 12 characters and at most 72 bytes')
  return value
}
export function email(value: unknown): string {
  const result = text(value, 200, 'Email').toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) throw new HttpError(400, 'Invalid email')
  return result
}
export function amount(value: unknown): string {
  if (!['string', 'number'].includes(typeof value) || !/^\d{1,12}(\.\d{1,2})?$/.test(String(value)) || Number(value) <= 0) throw new HttpError(400, 'Amount must be positive with at most two decimal places')
  return Number(value).toFixed(2)
}
export function errorResponse(res: any, error: unknown): void {
  res.status(error instanceof HttpError ? error.status : 500).json({ success: false, message: error instanceof HttpError ? error.message : 'Request could not be completed' })
}
