import {createServer} from 'node:http'
import {readFile} from 'node:fs/promises'
import path from 'node:path'
const root=path.resolve('dist')
const html=await readFile(path.join(root,'index.html'),'utf8')
const policy=html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1]+"; frame-ancestors 'none'"
createServer(async(req,res)=>{
 try{
  const pathname=new URL(req.url,'http://localhost').pathname
  let file=path.resolve(root,'.'+decodeURIComponent(pathname))
  if(!file.startsWith(root+path.sep))file=path.join(root,'index.html')
  if(!path.extname(file))file=path.join(root,'index.html')
  const ext=path.extname(file),type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'}[ext]||'application/octet-stream'
  res.setHeader('Content-Security-Policy',policy);res.setHeader('Content-Type',type);res.end(await readFile(file))
 }catch{res.statusCode=404;res.end()}
}).listen(4173,'127.0.0.1')
