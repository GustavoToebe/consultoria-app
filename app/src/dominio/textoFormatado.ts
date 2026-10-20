/**
 * Formato simples do texto que o treinador escreve (descrição da seção, INFORMATIVO, ACEITE): `**negrito**`,
 * `__sublinhado__` (os dois podem se combinar, `**__assim__**`) e quebras de linha. Linha em branco separa parágrafos.
 * Nada além disso: sem link, lista ou HTML. Marcador sem par, ou par sem nada dentro (como a linha `______` de
 * "preencha aqui"), fica como texto. Um marcador não atravessa a quebra de linha.
 */
export interface Trecho { texto: string; negrito: boolean; sublinhado: boolean }
/** Uma linha do texto: trechos com o mesmo formato já juntados. */
export type LinhaFormatada = Trecho[];
/** Linhas seguidas, sem linha em branco entre elas. */
export type Paragrafo = LinhaFormatada[];

type Marca = { tipo: 'marca'; marca: '**' | '__'; par: boolean; podeAbrir: boolean; podeFechar: boolean };
type Token = { tipo: 'texto'; texto: string } | Marca;
const espacoOuNada = (c: string | undefined) => c === undefined || /\s/.test(c);

function tokens(linha: string): Token[] {
  const lista: Token[] = [];
  let texto = '';
  for (let i = 0; i < linha.length;) {
    const dois = linha.slice(i, i + 2);
    if (dois === '**' || dois === '__') {
      if (texto) lista.push({ tipo: 'texto', texto });
      texto = '';
      // Como no Markdown: abre colado no texto que vem depois e fecha colado no texto de antes ("2 ** 3" fica como está).
      lista.push({ tipo: 'marca', marca: dois, par: false, podeAbrir: !espacoOuNada(linha[i + 2]), podeFechar: !espacoOuNada(linha[i - 1]) });
      i += 2;
    } else {
      texto += linha[i];
      i += 1;
    }
  }
  if (texto) lista.push({ tipo: 'texto', texto });
  return lista;
}

/** Junta cada marcador que abre com o seguinte do mesmo tipo que fecha, desde que haja texto (não só espaço) entre eles. */
function parear(lista: Token[], marca: '**' | '__') {
  let aberto: Marca | null = null;
  let inicio = 0;
  lista.forEach((t, i) => {
    if (t.tipo !== 'marca' || t.marca !== marca) return;
    const temTexto = aberto !== null && lista.slice(inicio + 1, i).some((x) => x.tipo === 'texto' && x.texto.trim() !== '');
    if (aberto && t.podeFechar && temTexto) {
      aberto.par = true;
      t.par = true;
      aberto = null;
    } else if (t.podeAbrir) {
      // Par vazio ("____") ou abridor anterior sem fechamento: o anterior fica como texto e este tenta abrir.
      aberto = t;
      inicio = i;
    }
  });
}

export function linhaFormatada(linha: string): LinhaFormatada {
  const lista = tokens(linha);
  parear(lista, '**');
  parear(lista, '__');
  const trechos: Trecho[] = [];
  let negrito = false;
  let sublinhado = false;
  const somar = (texto: string) => {
    const ultimo = trechos[trechos.length - 1];
    if (ultimo && ultimo.negrito === negrito && ultimo.sublinhado === sublinhado) ultimo.texto += texto;
    else trechos.push({ texto, negrito, sublinhado });
  };
  for (const t of lista) {
    if (t.tipo === 'texto') somar(t.texto);
    else if (!t.par) somar(t.marca);
    else if (t.marca === '**') negrito = !negrito;
    else sublinhado = !sublinhado;
  }
  return trechos;
}

/** Texto em parágrafos de linhas formatadas. Linhas em branco (uma ou várias) só separam parágrafos; vazio = nenhum. */
export function textoFormatado(texto: string | null | undefined): Paragrafo[] {
  const paragrafos: Paragrafo[] = [];
  let atual: Paragrafo = [];
  for (const linha of (texto ?? '').replace(/\r\n?/g, '\n').split('\n')) {
    if (linha.trim() === '') {
      if (atual.length) paragrafos.push(atual);
      atual = [];
    } else atual.push(linhaFormatada(linha));
  }
  if (atual.length) paragrafos.push(atual);
  return paragrafos;
}

/** O texto sem as marcas (para leitor de tela e buscas). */
export const textoSemMarcas = (texto: string | null | undefined) =>
  textoFormatado(texto).map((p) => p.map((l) => l.map((t) => t.texto).join('')).join('\n')).join('\n\n');
