import {it,expect,vi,afterEach} from 'vitest'
const request=vi.hoisted(()=>vi.fn())
vi.mock('../src/lib/social-site',()=>({siteRequest:request}))
import {authorizePresentation} from '../src/lib/site-versions'
afterEach(()=>vi.resetAllMocks())
it('saves the original draft before applying an authorized change',async()=>{
 let resolve:(value:unknown)=>void=()=>{}
 request.mockImplementation(()=>new Promise(r=>{resolve=r}))
 const apply=vi.fn(),config={name:'Original',blocks:[]}
 const pending=authorizePresentation(config,'Before layout',apply)
 expect(request).toHaveBeenCalledWith('openpage-version',expect.objectContaining({config,label:'Before layout'}))
 expect(apply).not.toHaveBeenCalled()
 resolve({ok:true});await pending
 expect(apply).toHaveBeenCalledOnce()
})
it('does not overwrite the draft when its backup cannot be saved',async()=>{
 request.mockRejectedValue(new Error('Storage unavailable'))
 const apply=vi.fn()
 await expect(authorizePresentation({name:'Original',blocks:[]},'Before change',apply)).rejects.toThrow('Storage unavailable')
 expect(apply).not.toHaveBeenCalled()
})
