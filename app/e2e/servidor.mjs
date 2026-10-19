// Servidor estático dos testes de tela: serve a web exportada (`expo export --platform web`) e, como o Caddy da
// produção, devolve o `index.html` para qualquer caminho que não é arquivo (as rotas do Expo Router são do navegador).
// A API (`/api/**`) nunca chega aqui: cada teste a simula com `page.route` (e2e/api-falsa.ts).
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const [pasta = 'dist-e2e', porta = '8099'] = process.argv.slice(2);
const raiz = resolve(pasta);
const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
};

createServer((req, res) => {
  const caminho = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
  const arquivo = normalize(join(raiz, caminho));
  const dentro = arquivo.startsWith(raiz) && existsSync(arquivo) && statSync(arquivo).isFile();
  const servido = dentro ? arquivo : join(raiz, 'index.html');
  res.writeHead(200, { 'Content-Type': TIPOS[extname(servido)] ?? 'application/octet-stream' });
  createReadStream(servido).pipe(res);
}).listen(Number(porta), '127.0.0.1', () => console.log(`web dos testes em http://localhost:${porta} (${raiz})`));
