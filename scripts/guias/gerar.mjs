// Gera os guias do usuário em PDF (treinador e aluno) a partir de app/src/ajuda/conteudo.ts, o mesmo texto da tela
// de Ajuda. Saída: app/public/guias/*.pdf (a web serve em /guias/...). Usa o chrome-headless-shell do Playwright
// se achar (NAVEGADOR_PDF manda sobre tudo), senão o Edge ou o Chrome instalado.
//   node scripts/guias/gerar.mjs
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const raiz = resolve(import.meta.dirname, '..', '..');
const saida = join(raiz, 'app', 'public', 'guias');
const { GUIAS, textoDoItem, secoesDoGuia } = await import(pathToFileURL(join(raiz, 'app', 'src', 'ajuda', 'conteudo.ts')).href);
// O formato dos textos (parágrafos, passos, marcadores, nota e negrito) é o mesmo da tela: `app/src/ajuda/blocos.ts`, sem imports.
const { blocosDoTexto } = await import(pathToFileURL(join(raiz, 'app', 'src', 'ajuda', 'blocos.ts')).href);
// `--html <pasta>`: só grava o HTML dos guias na pasta, sem navegador nem PDF (para conferir o texto).
const soHtml = process.argv.includes('--html') ? resolve(process.argv[process.argv.indexOf('--html') + 1] ?? '.') : null;

// chrome-headless-shell do Playwright (revisão mais alta): o Edge e o chrome.exe completo travam ou não gravam o PDF no Windows.
function headlessShellDoPlaywright() {
  const pasta =
    process.env.PLAYWRIGHT_BROWSERS_PATH ||
    (process.platform === 'win32' ? join(process.env.LOCALAPPDATA ?? '', 'ms-playwright')
      : process.platform === 'darwin' ? join(homedir(), 'Library', 'Caches', 'ms-playwright')
      : join(homedir(), '.cache', 'ms-playwright'));
  if (!existsSync(pasta)) return undefined;
  const exe = process.platform === 'win32' ? 'chrome-headless-shell.exe' : 'chrome-headless-shell';
  return readdirSync(pasta)
    .map((nome) => ({ nome, revisao: Number(/^chromium_headless_shell-(\d+)$/.exec(nome)?.[1]) }))
    .filter((r) => r.revisao)
    .sort((a, b) => b.revisao - a.revisao)
    .flatMap((r) => readdirSync(join(pasta, r.nome)).filter((d) => d.startsWith('chrome-headless-shell-')).map((d) => join(pasta, r.nome, d, exe)))
    .find((c) => existsSync(c));
}

const NAVEGADORES = [
  process.env.NAVEGADOR_PDF,
  ...(process.env.NAVEGADOR_PDF ? [] : [headlessShellDoPlaywright()]),
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);
const navegador = NAVEGADORES.find((c) => existsSync(c));
if (!navegador && !soHtml) throw new Error('Edge ou Chrome não encontrado. Defina NAVEGADOR_PDF com o caminho do executável.');

// O ciclo está desligado em produção: o PDF não cita a frase dele (a tela de Ajuda faz o mesmo com cicloHabilitado).
const semCiclo = (t) => textoDoItem(String(t), false);
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const trechos = (lista) => lista.map((t) => (t.negrito ? `<b>${esc(t.texto)}</b>` : esc(t.texto))).join('');
/** Texto de um tópico em HTML, bloco a bloco como na tela (texto antigo, sem marcação, sai em parágrafos por frase). */
const blocos = (texto) => blocosDoTexto(semCiclo(texto)).map((b) => {
  if (b.tipo === 'p') return `<p>${trechos(b.trechos)}</p>`;
  if (b.tipo === 'nota') return `<p class="nota">${trechos(b.trechos)}</p>`;
  const tag = b.tipo === 'passos' ? 'ol' : 'ul';
  return `<${tag} class="itens">${b.itens.map((i) => `<li>${trechos(i)}</li>`).join('')}</${tag}>`;
}).join('');

function html(guia) {
  const passos = (lista) => lista.map((p, i) => `<li><b>${esc(p.titulo)}</b><br>${esc(semCiclo(p.texto))}</li>`).join('');
  // O retorno imediato e a vitrine também estão desligados em produção: as seções deles ficam só na tela, com a chave ligada.
  const secoes = secoesDoGuia(guia, false, false)
    .map((s) => `<h2>${esc(s.titulo)}</h2>${s.itens.map((i) => `<h3>${esc(i.titulo)}</h3>${blocos(i.texto)}`).join('')}`)
    .join('');
  const perguntas = guia.perguntas.map((p) => `<h3>${esc(p.pergunta)}</h3>${blocos(p.resposta)}`).join('');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(guia.titulo)}</title><style>
@page { size: A4; margin: 18mm 16mm; }
body { font-family: "Segoe UI", Arial, sans-serif; color: #1a1a1a; font-size: 11pt; line-height: 1.45; }
h1 { font-size: 24pt; margin: 0 0 4pt; }
h2 { font-size: 15pt; margin: 20pt 0 6pt; border-bottom: 1px solid #ccc; padding-bottom: 3pt; break-after: avoid; }
p { margin: 0 0 7pt; break-inside: avoid; }
h3 { font-size: 12pt; margin: 12pt 0 4pt; break-after: avoid; }
ol { padding-left: 18pt; } li { margin-bottom: 8pt; break-inside: avoid; }
.itens { margin: 0 0 7pt; } .itens li { margin-bottom: 3pt; }
.nota { border-left: 3px solid #999; background: #f3f3f3; padding: 4pt 8pt; }
.intro { color: #444; margin-bottom: 8pt; }
</style></head><body>
<h1>${esc(guia.titulo)}</h1>
<p class="intro">${esc(guia.introducao)}</p>
<h2>Primeiros passos</h2><ol>${passos(guia.primeirosPassos)}</ol>
<h2>Tutorial: passeio pelas telas</h2><ol>${passos(guia.tutorial)}</ol>
${secoes}
<h2>Perguntas frequentes</h2>${perguntas}
</body></html>`;
}

mkdirSync(saida, { recursive: true });
const temp = mkdtempSync(join(tmpdir(), 'guias-'));
try {
  for (const guia of Object.values(GUIAS)) {
    if (soHtml) {
      mkdirSync(soHtml, { recursive: true });
      writeFileSync(join(soHtml, `${guia.arquivoPdf}.html`), html(guia), 'utf8');
      console.log(`html ${join(soHtml, `${guia.arquivoPdf}.html`)}`);
      continue;
    }
    const origem = join(temp, `${guia.arquivoPdf}.html`);
    const destino = join(saida, guia.arquivoPdf);
    const novo = join(temp, guia.arquivoPdf); // a pasta temporária é nova: um PDF aqui é deste navegador, nunca o velho
    writeFileSync(origem, html(guia), 'utf8');
    execFileSync(
      navegador,
      ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--user-data-dir=${join(temp, 'perfil')}`, `--print-to-pdf=${novo}`, pathToFileURL(origem).href],
      { stdio: 'ignore', timeout: 180_000 },
    );
    if (!existsSync(novo) || statSync(novo).size === 0) throw new Error(`PDF não gerado: ${guia.arquivoPdf}`);
    copyFileSync(novo, `${destino}.novo`);
    renameSync(`${destino}.novo`, destino); // só troca o PDF do repositório depois de o novo estar completo
    console.log(`ok  ${destino}`);
  }
} finally {
  // No Windows o perfil do navegador pode ficar preso um instante; sobra só lixo em %TEMP%, não vale falhar com os PDFs já gravados.
  try { rmSync(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }); } catch { /* shortcut: lixo em %TEMP% tolerado, limpar à mão se pesar */ }
}
