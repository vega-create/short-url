import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { selectTargetByWeight } from '@/lib/utils'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params
  const host = request.headers.get('host') || ''
  const [firstSegment] = slug.map(s => decodeURIComponent(s))

  if (firstSegment === 'vega888admin' || firstSegment === 'admin' || firstSegment === 'api') {
    return NextResponse.next()
  }

  // Bio 頁面：@ 開頭
  if (firstSegment.startsWith('@')) {
    return handleBioPage(host, firstSegment.slice(1))
  }

  // 短網址重定向
  const shortCode = firstSegment
  const trackingParams = slug.slice(1).map(s => decodeURIComponent(s)).join('/')

  const { data: link } = await supabaseAdmin
    .from('short_links')
    .select(`*, domains!inner(domain), link_targets(*), param_utm_rules(*)`)
    .eq('domains.domain', host)
    .eq('slug', shortCode)
    .eq('is_active', true)
    .single()

  if (!link) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  let targetUrl = link.target_url

  if (link.use_ab_test && link.link_targets && link.link_targets.length > 0) {
    const target = selectTargetByWeight(link.link_targets)
    if (target) targetUrl = target.target_url
  }

  // === UTM 決定邏輯 ===
  // 1. 先查渠道 UTM 對照表（最長路徑優先匹配）
  // 2. 沒匹配到就用預設 UTM
  let utmSource = link.utm_source || null
  let utmMedium = link.utm_medium || null
  let utmCampaign = link.utm_campaign || null
  let utmTerm = link.utm_term || null
  let utmContent = link.utm_content || null

  if (trackingParams && link.param_utm_rules && link.param_utm_rules.length > 0) {
    // 按 param_pattern 長度排序（最長優先匹配）
    const sortedRules = [...link.param_utm_rules].sort(
      (a, b) => b.param_pattern.length - a.param_pattern.length
    )
    for (const rule of sortedRules) {
      // 完全匹配或前綴匹配（trackingParams 以 rule.param_pattern 開頭）
      if (
        trackingParams === rule.param_pattern ||
        trackingParams.startsWith(rule.param_pattern + '/')
      ) {
        if (rule.utm_source) utmSource = rule.utm_source
        if (rule.utm_medium) utmMedium = rule.utm_medium
        if (rule.utm_campaign) utmCampaign = rule.utm_campaign
        if (rule.utm_term) utmTerm = rule.utm_term
        if (rule.utm_content) utmContent = rule.utm_content
        break
      }
    }
  }

  // 附加 UTM 到目標網址（只有 append_utm=true 時）
  if (link.append_utm) {
    const utmEntries: [string, string][] = []
    if (utmSource) utmEntries.push(['utm_source', utmSource])
    if (utmMedium) utmEntries.push(['utm_medium', utmMedium])
    if (utmCampaign) utmEntries.push(['utm_campaign', utmCampaign])
    if (utmTerm) utmEntries.push(['utm_term', utmTerm])
    if (utmContent) utmEntries.push(['utm_content', utmContent])

    if (utmEntries.length > 0) {
      try {
        const urlObj = new URL(targetUrl)
        for (const [key, val] of utmEntries) {
          if (!urlObj.searchParams.has(key)) {
            urlObj.searchParams.set(key, val)
          }
        }
        targetUrl = urlObj.toString()
      } catch {
        // URL 格式有問題就不加
      }
    }
  }

  // 記錄點擊
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const userAgent = request.headers.get('user-agent') || ''
  const referer = request.headers.get('referer') || ''
  const isMobile = /mobile|android|iphone/i.test(userAgent)
  const isTablet = /tablet|ipad/i.test(userAgent)
  const device = isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop'

  await supabaseAdmin.from('click_logs').insert({
    short_link_id: link.id,
    param: trackingParams || null,
    ip,
    user_agent: userAgent,
    referer: referer,
    device,
    utm_source: utmSource,
    utm_medium: utmMedium,
    utm_campaign: utmCampaign,
  })

  // 有追蹤碼時，用 HTML 頁面載入追蹤碼再跳轉
  const hasTracking = link.pixel_id || link.gtm_id || link.ga_id
  if (hasTracking) {
    return renderTrackingRedirect(targetUrl, link, {
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      short_link: link.slug,
      param: trackingParams,
    })
  }

  return NextResponse.redirect(targetUrl, 302)
}

// ===== 追蹤碼跳轉頁面 =====
function renderTrackingRedirect(
  targetUrl: string,
  link: Record<string, unknown>,
  utmData: Record<string, string | null>
) {
  let trackingScripts = ''

  // FB Pixel
  if (link.pixel_id) {
    trackingScripts += `
    <script>
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
      n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
      document,'script','https://connect.facebook.net/en_US/fbevents.js');
      fbq('init','${link.pixel_id}');
      fbq('track','PageView');
      fbq('trackCustom','ShortLinkClick',${JSON.stringify({
        utm_source: utmData.utm_source || '',
        utm_medium: utmData.utm_medium || '',
        utm_campaign: utmData.utm_campaign || '',
        short_link: utmData.short_link || '',
        param: utmData.param || '',
      })});
    </script>`
  }

  // GTM
  if (link.gtm_id) {
    trackingScripts += `
    <script>
      window.dataLayer=window.dataLayer||[];
      window.dataLayer.push(${JSON.stringify({
        event: 'short_link_click',
        utm_source: utmData.utm_source || '',
        utm_medium: utmData.utm_medium || '',
        utm_campaign: utmData.utm_campaign || '',
        short_link: utmData.short_link || '',
        param: utmData.param || '',
      })});
    </script>
    <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
    new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
    j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
    'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
    })(window,document,'script','dataLayer','${link.gtm_id}');</script>`
  }

  // GA4
  if (link.ga_id) {
    trackingScripts += `
    <script async src="https://www.googletagmanager.com/gtag/js?id=${link.ga_id}"></script>
    <script>
      window.dataLayer=window.dataLayer||[];
      function gtag(){dataLayer.push(arguments);}
      gtag('js',new Date());
      gtag('config','${link.ga_id}');
      gtag('event','short_link_click',${JSON.stringify({
        utm_source: utmData.utm_source || '',
        utm_medium: utmData.utm_medium || '',
        utm_campaign: utmData.utm_campaign || '',
        short_link: utmData.short_link || '',
        param: utmData.param || '',
      })});
    </script>`
  }

  const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta name="robots" content="noindex, nofollow">
${trackingScripts}
<script>setTimeout(function(){window.location.href="${targetUrl}"},800);</script>
</head><body></body></html>`

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

// ===== Bio 頁面渲染 =====
async function handleBioPage(host: string, bioSlug: string) {
  const { data: page } = await supabaseAdmin
    .from('bio_pages')
    .select(`*, domains!inner(domain), bio_links(*)`)
    .eq('domains.domain', host)
    .eq('slug', bioSlug)
    .single()

  if (!page) {
    return new NextResponse('Page not found', { status: 404 })
  }

  const t = {
    bgColor: '#ffffff',
    textColor: '#000000',
    buttonColor: '#000000',
    buttonTextColor: '#ffffff',
    buttonStyle: 'rounded',
    bgGradient: '',
    bgImage: '',
    bgOverlay: 'rgba(0,0,0,0.3)',
    ...page.theme,
  }

  const activeLinks = (page.bio_links || [])
    .filter((l: { is_active: boolean }) => l.is_active)
    .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)

  const borderRadius = t.buttonStyle === 'pill' ? '9999px' : t.buttonStyle === 'square' ? '4px' : '12px'
  const isOutline = t.buttonStyle === 'outline'
  const isGlass = t.buttonStyle === 'glass'

  const linksHtml = activeLinks.map((link: { url: string; icon?: string; title: string }, i: number) => `
    <a href="${esc(link.url)}" target="_blank" rel="noopener noreferrer" class="bio-btn" style="animation-delay: ${0.15 + i * 0.08}s">
      ${link.icon ? `<span class="bio-icon">${esc(link.icon)}</span>` : ''}
      ${esc(link.title)}
    </a>
  `).join('')

  // 背景 CSS
  let bodyBg = `background: ${t.bgColor};`
  if (t.bgGradient) bodyBg = `background: ${t.bgGradient};`
  if (t.bgImage) bodyBg = `background: url('${esc(t.bgImage)}') center/cover fixed no-repeat;`

  const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(page.title || 'Links')}</title>
  <meta name="robots" content="noindex, nofollow">
  <meta name="description" content="${esc(page.bio || '')}">
  <meta property="og:title" content="${esc(page.title || 'Links')}">
  <meta property="og:description" content="${esc(page.bio || '')}">
  ${page.logo_url ? `<meta property="og:image" content="${esc(page.logo_url)}">` : ''}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Noto Sans TC', -apple-system, sans-serif;
      ${bodyBg}
      color: ${t.textColor};
      min-height: 100vh;
    }

    /* 背景遮罩 */
    ${t.bgImage ? `
    body::before {
      content: '';
      position: fixed;
      inset: 0;
      background: ${t.bgOverlay || 'transparent'};
      z-index: 0;
    }` : ''}

    .container {
      position: relative;
      z-index: 1;
      width: 100%;
      max-width: 420px;
      margin: 0 auto;
      padding: 48px 20px 40px;
      text-align: center;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    /* Logo 動畫 */
    .logo {
      width: 96px;
      height: 96px;
      border-radius: 50%;
      object-fit: cover;
      margin-bottom: 16px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.15);
      border: 3px solid rgba(255,255,255,0.3);
      animation: fadeDown 0.6s ease both;
    }

    .title {
      font-size: 1.5rem;
      font-weight: 700;
      margin-bottom: 6px;
      animation: fadeDown 0.6s ease 0.05s both;
    }

    .bio-text {
      font-size: 0.95rem;
      opacity: 0.7;
      margin-bottom: 36px;
      line-height: 1.6;
      animation: fadeDown 0.6s ease 0.1s both;
    }

    .links {
      display: flex;
      flex-direction: column;
      gap: 14px;
      width: 100%;
    }

    .bio-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 15px 20px;
      border-radius: ${borderRadius};
      background: ${isGlass ? 'rgba(255,255,255,0.12)' : isOutline ? 'transparent' : t.buttonColor};
      color: ${isGlass ? '#ffffff' : isOutline ? t.buttonColor : t.buttonTextColor};
      border: ${isOutline ? `2px solid ${t.buttonColor}` : 'none'};
      ${isGlass ? `
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      box-shadow: 0 4px 20px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.2);
      ` : `
      box-shadow: 0 2px 12px rgba(0,0,0,0.06);
      `}
      text-decoration: none;
      font-size: 0.95rem;
      font-weight: 500;
      transition: all 0.25s ease;
      animation: fadeUp 0.5s ease both;
    }

    .bio-btn:hover {
      transform: translateY(-3px) scale(1.01);
      box-shadow: 0 8px 28px rgba(0,0,0,0.12);
    }

    .bio-btn:active {
      transform: translateY(-1px) scale(0.99);
    }

    .bio-icon { font-size: 1.2rem; }

    .footer {
      margin-top: auto;
      padding-top: 40px;
      font-size: 0.72rem;
      opacity: 0.35;
      animation: fadeUp 0.5s ease 0.8s both;
    }

    /* 動畫 */
    @keyframes fadeDown {
      from { opacity: 0; transform: translateY(-16px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
  </style>
</head>
<body>
  <div class="container">
    ${page.logo_url ? `<img src="${esc(page.logo_url)}" alt="Logo" class="logo">` : ''}
    ${page.title ? `<h1 class="title">${esc(page.title)}</h1>` : ''}
    ${page.bio ? `<p class="bio-text">${esc(page.bio)}</p>` : ''}
    <div class="links">${linksHtml}</div>
    <div class="footer">Powered by SmartMommy</div>
  </div>
</body>
</html>`

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=60' },
  })
}

function esc(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
