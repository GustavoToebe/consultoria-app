// Gera os guias do usuário em PDF (treinador e aluno) a partir de app/src/ajuda/conteudo.ts, o mesmo texto da tela
// de Ajuda. Saída: app/public/guias/*.pdf (a web serve em /guias/...). Precisa do Edge ou do Chrome instalado.
//   node scripts/guias/gerar.mjs
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const raiz = resolve(import.meta.dirname, '..', '..');
const saida = join(raiz, 'app', 'public', 'guias');
const { GUIAS, textoDoItem, secoesDoGuia } = await import(pathToFileURL(join(raiz, 'app', 'src', 'ajuda', 'conteudo.ts')).href);

const NAVEGADORES = [
  process.env.NAVEGADOR_PDF,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);
const navegador = NAVEGADORES.find((c) => existsSync(c));
if (!navegador) throw new Error('Edge ou Chrome não encontrado. Defina NAVEGADOR_PDF com o caminho do executável.');

// O ciclo está desligado em produção: o PDF não cita a frase dele (a tela de Ajuda faz o mesmo com cicloHabilitado).
const semCiclo = (t) => textoDoItem(String(t), false);
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function html(guia) {
  const passos = (lista) => lista.map((p, i) => `<li><b>${esc(p.titulo)}</b><br>${esc(semCiclo(p.texto))}</li>`).join('');
  // O retorno imediato também está desligado em produção: as seções dele ficam só na tela, com a chave ligada.
  const secoes = secoesDoGuia(guia, false)
    .map((s) => `<h2>${esc(s.titulo)}</h2>${s.itens.map((i) => `<p><b>${esc(i.titulo)}.</b> ${esc(semCiclo(i.texto))}</p>`).join('')}`)
    .join('');
  const perguntas = guia.perguntas.map((p) => `<p><b>${esc(p.pergunta)}</b><br>${esc(semCiclo(p.resposta))}</p>`).join('');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(guia.titulo)}</title><style>
@page { size: A4; margin: 18mm 16mm; }
body { font-family: "Segoe UI", Arial, sans-serif; color: #1a1a1a; font-size: 11pt; line-height: 1.45; }
h1 { font-size: 24pt; margin: 0 0 4pt; }
h2 { font-size: 15pt; margin: 20pt 0 6pt; border-bottom: 1px solid #ccc; padding-bottom: 3pt; break-after: avoid; }
p { margin: 0 0 7pt; break-inside: avoid; }
ol { padding-left: 18pt; } li { margin-bottom: 8pt; break-inside: avoid; }
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
    const origem = join(temp, `${guia.arquivoPdf}.html`);
    const destino = join(saida, guia.arquivoPdf);
    writeFileSync(origem, html(guia), 'utf8');
    rmSync(destino, { force: true }); // sem isto, um navegador que não escreve nada passaria com o PDF velho
    execFileSync(
      navegador,
      ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--user-data-dir=${join(temp, 'perfil')}`, `--print-to-pdf=${destino}`, pathToFileURL(origem).href],
      { stdio: 'ignore', timeout: 60_000 },
    );
    if (!existsSync(destino)) throw new Error(`PDF não gerado: ${destino}`);
    console.log(`ok  ${destino}`);
  }
} finally {
  rmSync(temp, { recursive: true, force: true });
}
