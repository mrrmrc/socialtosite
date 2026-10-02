
import { LayoutGrid } from 'lucide-react'

export function ArticlesBlock() {
  return (
    <section className="py-24 bg-bg-1 border-t border-b border-border-default">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-text-0">
            Latest Articles
          </h2>
          <p className="mt-4 text-text-2 text-lg max-w-2xl mx-auto">
            Our latest insights and updates, directly from our automated feed.
          </p>
        </div>
        
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-border-default rounded-2xl bg-bg-0 opacity-70">
          <LayoutGrid size={48} className="text-text-3 mb-4" />
          <h3 className="text-text-1 font-semibold text-lg">Dynamic Articles Grid</h3>
          <p className="text-text-2 text-sm max-w-md text-center mt-2">
            In the live site, this area will be automatically replaced with the grid of your latest published articles.
          </p>
        </div>
        
        <div id="sts-dynamic-articles" className="hidden"></div>
      </div>
    </section>
  )
}
