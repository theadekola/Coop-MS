import toast from 'react-hot-toast'

export function openSupportEmail(subject: string, body?: string): boolean {
  const email = import.meta.env.VITE_SUPPORT_EMAIL?.trim()
  if (!email || !/^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(email)) {
    toast.error('Support contact is not configured. Contact your administrator.')
    return false
  }
  const params = new URLSearchParams({ subject })
  if (body) params.set('body', body)
  window.location.href = `mailto:${encodeURIComponent(email)}?${params.toString()}`
  return true
}
