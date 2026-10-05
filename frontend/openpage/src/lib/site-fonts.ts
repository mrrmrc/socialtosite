export function googleFontUrl(fonts: string[]): string {
  const families = [...new Set(fonts.filter(Boolean))].sort().map(font =>
    `family=${encodeURIComponent(font).replace(/%20/g, '+')}:wght@300;400;500;600;700`)
  return `https://fonts.googleapis.com/css2?${families.join('&')}&display=swap`
}
