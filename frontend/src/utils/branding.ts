export type CompanyBrand = {
  companyName?: string
  logoDataUrl?: string
  faviconDataUrl?: string
}

export const COMPANY_BRAND_CACHE_KEY = 'oshodi-company-brand'

export function readCachedCompanyBrand(): CompanyBrand {
  try {
    const raw = localStorage.getItem(COMPANY_BRAND_CACHE_KEY)
    return raw ? JSON.parse(raw) as CompanyBrand : {}
  } catch {
    return {}
  }
}

export function cacheCompanyBrand(brand: CompanyBrand) {
  try {
    const next = { ...readCachedCompanyBrand(), ...brand }
    localStorage.setItem(COMPANY_BRAND_CACHE_KEY, JSON.stringify(next))
  } catch {
    // Branding cache is optional; the app can still use server settings.
  }
}

function ensureLink(rel: string) {
  const existing = Array.from(document.querySelectorAll<HTMLLinkElement>(`link[rel="${rel}"]`))
  let link = existing[0]
  if (!link) {
    link = document.createElement('link')
    link.rel = rel
    document.head.appendChild(link)
  }
  existing.slice(1).forEach(item => item.remove())
  return link
}

export function applyBrowserBrandIcon(brand: CompanyBrand) {
  const iconUrl = brand.faviconDataUrl || brand.logoDataUrl
  if (!iconUrl || typeof document === 'undefined') return

  document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]').forEach(item => item.remove())

  const icon = ensureLink('icon')
  icon.type = iconUrl.startsWith('data:image/svg') ? 'image/svg+xml' : 'image/png'
  icon.href = iconUrl

  const shortcut = ensureLink('shortcut icon')
  shortcut.type = icon.type
  shortcut.href = iconUrl

  const apple = ensureLink('apple-touch-icon')
  apple.href = iconUrl
}
