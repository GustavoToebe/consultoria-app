/**
 * Formato dos textos da Ajuda (`conteudo.ts`): o texto continua uma string, com uma marcação mínima que a tela e o
 * `scripts/guias/gerar.mjs` leem do mesmo jeito. Sem imports, como o `conteudo.ts`: o gerador o importa direto pelo Node.
 *
 * - parágrafos separados por linha em branco (`\n\n`);
 * - linhas `1. `, `2. ` seguidas viram passos numerados (o número da tela é a ordem, não o digitado);
 * - linhas `- ` seguidas viram marcadores;
 * - linha `! ` vira nota (aviso de permissão, internet, limite), com ícone na tela;
 * - `**Editar**` marca o nome de botão ou de tela em negrito.
 *
 * Texto sem marcação nenhuma (o formato antigo) é um parágrafo só; se passar de ~400 caracteres, a tela o divide em
 * parágrafos de 2 ou 3 frases (`paragrafosPorFrase`), sem mudar uma letra.
 */

export interface Trecho {
  texto: string;
  negrito?: true;
}

export type Bloco =
  | { tipo: 'p'; trechos: Trecho[] }
  | { tipo: 'passos'; itens: Trecho[][] }
  | { tipo: 'lista'; itens: Trecho[][] }
  | { tipo: 'nota'; trechos: Trecho[] };

/** Acima disto um parágrafo corrido é dividido por frases. */
export const LIMITE_DO_PARAGRAFO = 400;

/**
 * Par de `**` do negrito. Os asteriscos não podem ter outro `*` colado: a máscara do CPF (`***.456.789-**`) é texto, não
 * negrito. Usado também na busca e no gerador dos guias.
 */
const NEGRITO = /(?<!\*)\*\*(?!\*)(.+?)(?<!\*)\*\*(?!\*)/g;

/** `**negrito**` em trechos; `**` sem par fica como texto. */
export function trechosDoTexto(texto: string): Trecho[] {
  const trechos: Trecho[] = [];
  const marca = new RegExp(NEGRITO);
  let desde = 0;
  for (let m = marca.exec(texto); m; m = marca.exec(texto)) {
    if (m.index > desde) trechos.push({ texto: texto.slice(desde, m.index) });
    trechos.push({ texto: m[1], negrito: true });
    desde = m.index + m[0].length;
  }
  if (desde < texto.length) trechos.push({ texto: texto.slice(desde) });
  return trechos;
}

const PASSO = /^\d+\.\s+/;
const MARCADOR = /^-\s+/;
const NOTA = /^!\s+/;

/** O texto como se lê, sem a marcação (busca, trecho do resultado): tira `**`, os prefixos das linhas e as quebras. */
export function semMarcacao(texto: string): string {
  return texto
    .split('\n')
    .map((l) => l.trim().replace(PASSO, '').replace(MARCADOR, '').replace(NOTA, ''))
    .filter(Boolean)
    .join(' ')
    .replace(NEGRITO, '$1');
}

/** Palavras que terminam em ponto sem fechar a frase ("ex.", "pág."), comparadas sem caixa. */
const ABREVIACOES = new Set(['ex', 'p', 'pág', 'pg', 'nº', 'n', 'obs', 'aprox', 'sr', 'sra', 'dr', 'dra', 'min', 'máx', 'mín', 'séc', 'vs', 'etc']);
const ABRE = new Set(['(', '[']);
const FECHA = new Set([')', ']']);
const ASPAS = new Set(['"', '“', '”']);

/**
 * Frases do texto, cada uma com o espaço que a separa da próxima já tirado: `frases.join(' ')` devolve o original quando
 * a separação é um espaço só. Fim de frase = `.`, `!` ou `?` (ou `…`), seguido de espaço e de letra maiúscula, aspas ou
 * número; nunca dentro de parênteses ou aspas, depois de abreviação ou de uma letra maiúscula sozinha (sigla, inicial).
 */
export function frasesDoTexto(texto: string): string[] {
  const frases: string[] = [];
  let inicio = 0;
  let parenteses = 0;
  let dentroDeAspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (ABRE.has(c)) parenteses++;
    else if (FECHA.has(c)) parenteses = Math.max(0, parenteses - 1);
    else if (c === '"') dentroDeAspas = !dentroDeAspas;
    else if (c === '“') dentroDeAspas = true;
    else if (c === '”') dentroDeAspas = false;
    if (!'.!?…'.includes(c) || parenteses > 0 || dentroDeAspas) continue;
    // Fecha com aspas ou parêntese logo depois do ponto ("… pronto.")? A frase inclui o fechamento.
    let fim = i + 1;
    while (fim < texto.length && (ASPAS.has(texto[fim]) || FECHA.has(texto[fim]))) fim++;
    if (texto[fim] !== ' ') continue;
    let proximo = fim;
    while (texto[proximo] === ' ') proximo++;
    const seguinte = texto[proximo] ?? '';
    if (!/[A-ZÀ-ÖØ-Ý0-9"“(]/.test(seguinte)) continue;
    if (c === '.') {
      // "1. Destino": o número de um passo escrito no meio do texto não é frase.
      if (/^\d+$/.test(texto.slice(inicio, i))) continue;
      const palavra = /([\p{L}º]+)$/u.exec(texto.slice(inicio, i))?.[1] ?? '';
      if (ABREVIACOES.has(palavra.toLowerCase()) || /^\p{Lu}$/u.test(palavra)) continue;
    }
    frases.push(texto.slice(inicio, fim));
    inicio = proximo;
    i = proximo - 1;
  }
  if (inicio < texto.length) frases.push(texto.slice(inicio));
  return frases;
}

/**
 * Parágrafo longo em parágrafos menores, por frase: 2 ou 3 frases cada (uma frase só quando ela sozinha já é longa), sem
 * deixar uma frase curta sobrando no fim. Até `limite` caracteres o parágrafo fica inteiro. `join(' ')` devolve o texto.
 */
export function paragrafosPorFrase(texto: string, limite = LIMITE_DO_PARAGRAFO): string[] {
  if (texto.length <= limite) return [texto];
  const frases = frasesDoTexto(texto);
  const grupos: string[][] = [];
  let atual: string[] = [];
  let tamanho = 0;
  for (const frase of frases) {
    // Já tem 2 frases e passaria do meio do limite, ou já tem 3: começa outro parágrafo.
    if (atual.length >= 3 || (atual.length >= 2 && tamanho + frase.length > limite * 0.6) || (atual.length >= 1 && tamanho > limite * 0.75)) {
      grupos.push(atual);
      atual = [];
      tamanho = 0;
    }
    atual.push(frase);
    tamanho += frase.length + 1;
  }
  if (atual.length) {
    const anterior = grupos[grupos.length - 1];
    // Uma frase curta sozinha no fim volta para o parágrafo de cima, se ele ainda não tem 3.
    if (atual.length === 1 && anterior && anterior.length < 3 && atual[0].length < limite / 3) anterior.push(atual[0]);
    else grupos.push(atual);
  }
  return grupos.map((g) => g.join(' '));
}

/** Blocos do texto de um tópico (formato no topo do arquivo). Texto antigo, sem marcação, vira parágrafos por frase. */
export function blocosDoTexto(texto: string): Bloco[] {
  const blocos: Bloco[] = [];
  for (const pedaco of texto.split(/\n\s*\n/)) {
    // Passos e marcadores só se juntam dentro do mesmo pedaço: uma linha em branco começa outra lista.
    const inicioDoPedaco = blocos.length;
    let corrido: string[] = [];
    const fecharParagrafo = () => {
      if (corrido.length) for (const p of paragrafosPorFrase(corrido.join(' '))) blocos.push({ tipo: 'p', trechos: trechosDoTexto(p) });
      corrido = [];
    };
    for (const bruta of pedaco.split('\n')) {
      const linha = bruta.trim();
      if (!linha) continue;
      const tipo = PASSO.test(linha) ? 'passos' : MARCADOR.test(linha) ? 'lista' : NOTA.test(linha) ? 'nota' : 'p';
      if (tipo === 'p') {
        corrido.push(linha);
        continue;
      }
      fecharParagrafo();
      if (tipo === 'nota') {
        blocos.push({ tipo: 'nota', trechos: trechosDoTexto(linha.replace(NOTA, '')) });
        continue;
      }
      const item = trechosDoTexto(linha.replace(tipo === 'passos' ? PASSO : MARCADOR, ''));
      const ultimo = blocos[blocos.length - 1];
      if (ultimo && blocos.length - 1 >= inicioDoPedaco && ultimo.tipo === tipo) ultimo.itens.push(item);
      else blocos.push({ tipo, itens: [item] });
    }
    fecharParagrafo();
  }
  return blocos;
}

/** Âncora do tópico a partir do título ("Todos ou Meus" → `todos-ou-meus`): `?topico=` e o "Nesta página". */
export function idDoTopico(titulo: string): string {
  return titulo.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
