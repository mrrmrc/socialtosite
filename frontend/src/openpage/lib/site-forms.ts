export function safeFormUrl(value: unknown): string {
  const url = typeof value === 'string' ? value.trim() : ''
  if (/[\s\\]/.test(url)) return ''
  return /^(https?:\/\/[^/]+|\/(?!\/)|#[a-zA-Z])/i.test(url) ? url : ''
}

export function formDestination(props: Record<string, unknown>, kind: 'contact' | 'newsletter') {
  const privacyUrl = safeFormUrl(props.privacyUrl)
  const endpoint = safeFormUrl(props.submitUrl)
  const email = typeof props.recipientEmail === 'string' ? props.recipientEmail.trim() : ''
  const recipient = /^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(email) ? email : ''
  return { privacyUrl, endpoint: endpoint.startsWith('#') ? '' : endpoint, recipient,
    ready: Boolean(privacyUrl && (endpoint && !endpoint.startsWith('#') || kind === 'contact' && recipient)) }
}

export function safeSiteUrl(value: unknown): string {
  const url=typeof value==='string'?value.trim():'';
  if (/[\s\\]/.test(url)) return '';
  return safeFormUrl(url) || (/^(mailto:[^?]+|tel:[+0-9()-]+)$/i.test(url)?url:'');
}
