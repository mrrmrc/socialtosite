export interface ArticleRules { recentDays?: unknown; dateFrom?: unknown; dateTo?: unknown; maxArticles?: unknown; articleOrder?: unknown }
function day(value: unknown): number {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN
  const time=Date.parse(value+'T00:00:00Z')
  if (!Number.isFinite(time)) return NaN
  return new Date(time).toISOString().slice(0,10)===value ? time : NaN
}
export function filterArticles<T extends object>(items:T[], rules:ArticleRules, now=Date.now()):T[] {
  const days=Math.max(0,Math.min(36500,Math.floor(Number(rules.recentDays)||0)))
  const start=day(rules.dateFrom), end=day(rules.dateTo)
  const today=Math.floor(now/86400000)*86400000
  const stamp=(item:T)=> {const p=item as Record<string,unknown>;const value=String(p.publishedAt||'');return Date.parse(/^\d{4}-\d{2}-\d{2} \d{2}:/.test(value)?value.replace(' ','T')+'Z':value)}
  let result=items.filter(item=>{
    const date=stamp(item)
    if ((days || Number.isFinite(start) || Number.isFinite(end)) && !Number.isFinite(date)) return false
    return (!days || (date>=today-(days-1)*86400000 && date<today+86400000)) && (!Number.isFinite(start)||date>=start) && (!Number.isFinite(end)||date<end+86400000)
  })
  result.sort((a,b)=> {
    if (!rules.articleOrder || rules.articleOrder==='featured') {const diff=Number((b as Record<string,unknown>).featured||0)-Number((a as Record<string,unknown>).featured||0);if(diff)return diff}
    return ((stamp(a)||0)-(stamp(b)||0))*(rules.articleOrder==='oldest'?1:-1)
  })
  const max=Math.max(0,Math.min(1000,Math.floor(Number(rules.maxArticles)||0)))
  if(max)result=result.slice(0,max)
  return result
}
