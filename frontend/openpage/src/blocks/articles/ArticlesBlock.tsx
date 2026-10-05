import type { BlockConfig } from '../types'
import { safeSiteUrl } from '../../lib/social-site'
import { filterArticles } from '../../lib/article-rules'
export function ArticlesBlock({ block, dynamic = false }: { block: BlockConfig; dynamic?: boolean }) {
  const items = filterArticles((block.props.items || []) as { id: number; title: string; excerpt: string; href: string; image?: string; publishedAt?: string; featured?: number }[], block.props)
  return <section data-articles-layout={block.variant} id={dynamic ? undefined : "sts-dynamic-articles"} className="py-16 px-6 bg-bg-1"><div className="max-w-7xl mx-auto">
    <h2 className="text-3xl font-semibold mb-8">{String(block.props.title || 'Articoli')}</h2>
    {dynamic ? <div id="sts-dynamic-articles"></div> : items.length ? <div className="grid @md:grid-cols-2 @2xl:grid-cols-3 gap-6">{items.map(item => <article key={item.id} className="bg-bg-2 border border-border-default rounded-xl overflow-hidden">
      {item.image && <img src={safeSiteUrl(item.image)} alt="" className="w-full h-48 object-cover" />}
      <div className="p-5"><h3 className="text-xl font-semibold">{item.title}</h3><p className="mt-3 text-text-2">{item.excerpt}</p><a href={safeSiteUrl(item.href)} target="_blank" rel="noopener noreferrer" className="inline-block mt-4 text-green">Leggi l’articolo →</a></div>
    </article>)}</div> : <p>Non ci sono articoli nel periodo selezionato.</p>}
  </div></section>
}
