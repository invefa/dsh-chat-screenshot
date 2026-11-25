// A throwaway static server for `checks/dom.html`. The page imports the source modules over http
// because a browser refuses a module graph loaded from `file://`, so this serves the repository root
// and nothing else. Node only, no dependencies: `node checks/serve.mjs [port]`.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { dirname, extname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const port = Number(process.argv[2] ?? 8712)
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost')
  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^[\\/]+/, '')
  const file = join(root, rel)
  if (!file.startsWith(root + sep)) {
    res.writeHead(403).end('outside')
    return
  }
  try {
    const body = await readFile(file)
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404).end('missing')
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`checks: http://127.0.0.1:${port}/checks/dom.html`)
})
