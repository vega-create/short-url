export interface Domain {
  id: string
  domain: string
  name: string | null
  is_verified: boolean
  created_at: string
  updated_at: string
}

export interface ShortLink {
  id: string
  domain_id: string
  slug: string
  name: string | null
  target_url: string
  is_active: boolean
  use_ab_test: boolean
  pixel_id: string | null
  gtm_id: string | null
  ga_id: string | null
  created_at: string
  updated_at: string
  // Joined
  domains?: Domain
  link_targets?: LinkTarget[]
  qr_settings?: QrSetting | null
}

export interface LinkTarget {
  id: string
  short_link_id: string
  target_url: string
  weight: number
  name: string | null
  is_active: boolean
  created_at: string
}

export interface ClickLog {
  id: string
  short_link_id: string | null
  target_id: string | null
  param: string | null
  ip: string | null
  user_agent: string | null
  referer: string | null
  country: string | null
  device: string | null
  clicked_at: string
}

export interface BioPage {
  id: string
  domain_id: string
  slug: string
  title: string | null
  bio: string | null
  logo_url: string | null
  theme: BioTheme
  created_at: string
  updated_at: string
  // Joined
  domains?: Domain
  bio_links?: BioLink[]
}

export interface BioTheme {
  bgColor: string
  textColor: string
  buttonColor: string
  buttonTextColor: string
  buttonStyle: 'rounded' | 'pill' | 'square' | 'outline'
  bgGradient?: string
}

export interface BioLink {
  id: string
  bio_page_id: string
  title: string
  url: string
  icon: string | null
  sort_order: number
  is_active: boolean
  created_at: string
}

export interface QrSetting {
  id: string
  short_link_id: string
  logo_url: string | null
  fg_color: string
  bg_color: string
  style: 'square' | 'dots' | 'rounded'
  size: number
  created_at: string
}
