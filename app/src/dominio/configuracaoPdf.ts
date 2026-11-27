import { colunasPorCelula } from './colunasPorCelula';
import { marcaParaTexto, textoSobre } from '../tema/tokens';

/**
 * Modelos e opções dos PDFs (plano `docs/planos/documentos-pdf-motor.md`, "Nova direção", D14 a D25). Um modelo é só um
 * conjunto COMPLETO de valores das opções, sem código próprio; a consultoria grava o modelo e as sobrescritas (só o que
 * ela mudou). A configuração é dado: nunca HTML nem CSS, e valor desconhecido cai no do modelo. A forma é a mesma que o
 * backend valida do outro lado.
 *
 * Para o CSS (`cssDasOpcoes`): o cabeçalho de tabela preenchido do `CLASSICO` e o leve do `MINIMALISTA` e do `MARCANTE`
 * seguem o `cabecalho.estilo` (FAIXA = preenchido com o destaque; LINHA e CARTAO = leve), porque `tabelas.estilo` só
 * escolhe linhas, listras ou cartões.
 *
 * Acrescentar `rodape` e `secoes` (N2): um grupo novo em `ESQUEMA`, o valor dele em cada modelo de `MODELOS` e o rótulo
 * em `ROTULOS`; `normalizar`, `resolver` e a contagem leem o `ESQUEMA`. Campo de texto livre (rodapé) pede um tipo novo de
 * regra em `ESQUEMA` (hoje só lista fechada e booleano).
 */

const BOOLEANO = 'booleano' as const;

/** Fonte única das opções: grupo → opção → valores aceitos (lista fechada) ou `BOOLEANO`. */
const ESQUEMA = {
  cores: { destaque: ['MARCA', 'GRAFITE', 'AZUL', 'INDIGO', 'VERDE', 'TURQUESA', 'MAGENTA', 'BRONZE'] },
  texto: { fonte: ['SEM_SERIFA', 'SERIFADA', 'CONDENSADA'], tamanho: ['P', 'M', 'G'] },
  cabecalho: {
    estilo: ['FAIXA', 'LINHA', 'CARTAO'],
    logo: ['ESQUERDA', 'CENTRO'],
    tamanhoLogo: ['P', 'M', 'G'],
    mostrarNome: BOOLEANO,
  },
  tabelas: { estilo: ['LINHAS', 'LISTRADA', 'CARTOES'], densidade: ['COMPACTA', 'NORMAL', 'ESPACOSA'] },
} as const;

type Esquema = typeof ESQUEMA;
type ValorDe<E> = E extends readonly (infer V)[] ? V : boolean;

/** Valores completos de todas as opções (o que o gerador de CSS lê). */
export type ValoresPdf = { -readonly [G in keyof Esquema]: { -readonly [K in keyof Esquema[G]]: ValorDe<Esquema[G][K]> } };
/** Sobrescritas: só o que a consultoria mudou em relação ao modelo (já normalizadas por `normalizar`). */
export type OpcoesPdf = { [G in keyof ValoresPdf]?: Partial<ValoresPdf[G]> };

export type DestaquePdf = ValoresPdf['cores']['destaque'];

export const MODELOS_PDF = [
  { id: 'CLASSICO', nome: 'Clássico', descricao: 'Faixa da marca no alto e cabeçalhos de tabela preenchidos com a cor de destaque.' },
  { id: 'MINIMALISTA', nome: 'Minimalista', descricao: 'Fundo limpo, divisórias finas na cor de destaque e cabeçalhos de tabela leves.' },
  { id: 'MARCANTE', nome: 'Marcante', descricao: 'Topo destacado na cor da marca e blocos em cartões de borda suave.' },
  { id: 'COMPACTO', nome: 'Compacto', descricao: 'Texto e logo menores e tabelas apertadas: cabe mais por página.' },
  { id: 'ELEGANTE', nome: 'Elegante', descricao: 'Letra serifada, logo centralizada e espaço de sobra nas tabelas.' },
  { id: 'ESPORTIVO', nome: 'Esportivo', descricao: 'Letra condensada, topo em cartão, logo grande e tabelas listradas.' },
] as const;

export type ModeloPdf = (typeof MODELOS_PDF)[number]['id'];

/** Valores de cada modelo. `CLASSICO`, `MINIMALISTA` e `MARCANTE` descrevem o visual de `pdf/cssDosTemas.ts` e `pdf/html.ts`. */
const MODELOS: Record<ModeloPdf, ValoresPdf> = {
  CLASSICO: {
    cores: { destaque: 'MARCA' },
    texto: { fonte: 'SEM_SERIFA', tamanho: 'M' },
    cabecalho: { estilo: 'FAIXA', logo: 'ESQUERDA', tamanhoLogo: 'M', mostrarNome: true },
    tabelas: { estilo: 'LINHAS', densidade: 'NORMAL' },
  },
  MINIMALISTA: {
    cores: { destaque: 'MARCA' },
    texto: { fonte: 'SEM_SERIFA', tamanho: 'M' },
    cabecalho: { estilo: 'LINHA', logo: 'ESQUERDA', tamanhoLogo: 'M', mostrarNome: true },
    tabelas: { estilo: 'LINHAS', densidade: 'NORMAL' },
  },
  MARCANTE: {
    cores: { destaque: 'MARCA' },
    texto: { fonte: 'SEM_SERIFA', tamanho: 'M' },
    cabecalho: { estilo: 'CARTAO', logo: 'ESQUERDA', tamanhoLogo: 'M', mostrarNome: true },
    tabelas: { estilo: 'CARTOES', densidade: 'NORMAL' },
  },
  COMPACTO: {
    cores: { destaque: 'MARCA' },
    texto: { fonte: 'SEM_SERIFA', tamanho: 'P' },
    cabecalho: { estilo: 'FAIXA', logo: 'ESQUERDA', tamanhoLogo: 'P', mostrarNome: true },
    tabelas: { estilo: 'LINHAS', densidade: 'COMPACTA' },
  },
  ELEGANTE: {
    cores: { destaque: 'MARCA' },
    texto: { fonte: 'SERIFADA', tamanho: 'M' },
    cabecalho: { estilo: 'LINHA', logo: 'CENTRO', tamanhoLogo: 'M', mostrarNome: true },
    tabelas: { estilo: 'LINHAS', densidade: 'ESPACOSA' },
  },
  ESPORTIVO: {
    cores: { destaque: 'MARCA' },
    texto: { fonte: 'CONDENSADA', tamanho: 'M' },
    cabecalho: { estilo: 'CARTAO', logo: 'ESQUERDA', tamanhoLogo: 'G', mostrarNome: true },
    tabelas: { estilo: 'LISTRADA', densidade: 'NORMAL' },
  },
};

/** Valor desconhecido, nulo ou ausente cai em `CLASSICO` (o que a API manda é conferido contra a lista, nunca confiado). */
export function modeloValido(valor: unknown): ModeloPdf {
  return MODELOS_PDF.find((m) => m.id === valor)?.id ?? 'CLASSICO';
}

/** Os valores completos do modelo (cópia: quem recebe pode mexer sem alterar o modelo). */
export function valoresDoModelo(modelo: unknown): ValoresPdf {
  return structuredClone(MODELOS[modeloValido(modelo)]);
}

// Acesso genérico por grupo e chave (o `ESQUEMA` dirige tudo); os tipos públicos acima garantem a forma de fora.
type Registro = Record<string, Record<string, unknown>>;

function aceita(regra: readonly unknown[] | typeof BOOLEANO, valor: unknown): boolean {
  return regra === BOOLEANO ? typeof valor === 'boolean' : regra.includes(valor);
}

function objeto(valor: unknown): Record<string, unknown> | null {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor) ? (valor as Record<string, unknown>) : null;
}

/**
 * JSON desconhecido (objeto ou texto JSON) → sobrescritas seguras: só grupo, chave e valor conhecidos entram; o resto é
 * descartado, sem erro. Grupo que sobra vazio some.
 */
export function normalizar(json: unknown): OpcoesPdf {
  let bruto: unknown = json;
  if (typeof json === 'string') {
    try {
      bruto = JSON.parse(json);
    } catch {
      return {};
    }
  }
  const entrada = objeto(bruto);
  const saida: Registro = {};
  if (!entrada) return {};
  for (const [grupo, opcoes] of Object.entries(ESQUEMA)) {
    const dados = Object.hasOwn(entrada, grupo) ? objeto(entrada[grupo]) : null;
    if (!dados) continue;
    for (const [chave, regra] of Object.entries(opcoes)) {
      if (Object.hasOwn(dados, chave) && aceita(regra, dados[chave])) (saida[grupo] ??= {})[chave] = dados[chave];
    }
  }
  return saida as OpcoesPdf;
}

/** Modelo ⊕ sobrescritas: os valores completos. Modelo desconhecido = `CLASSICO`; sobrescrita inválida = o do modelo. */
export function resolver(modelo: unknown, sobrescritas: unknown): ValoresPdf {
  const valores = valoresDoModelo(modelo) as unknown as Registro;
  const extras = normalizar(sobrescritas) as Registro;
  for (const grupo of Object.keys(extras)) Object.assign(valores[grupo], extras[grupo]);
  return valores as unknown as ValoresPdf;
}

/** Modelo escolhido e o que a consultoria mudou nele: o que se grava (`modelo` + `opcoes`). */
export interface ConfigPdf {
  modelo: ModeloPdf;
  sobrescritas: OpcoesPdf;
}

/** Trocar de modelo zera as sobrescritas (D-F3: o editor mostra o Desfazer). */
export function trocarModelo(novo: unknown): ConfigPdf {
  return { modelo: modeloValido(novo), sobrescritas: {} };
}

/** "Restaurar o modelo": volta aos valores dele. */
export function restaurar(atual: ConfigPdf): ConfigPdf {
  return { modelo: atual.modelo, sobrescritas: {} };
}

/** Muda uma opção; valor igual ao do modelo tira a sobrescrita (a configuração volta a ser a do modelo). */
export function definir<G extends keyof ValoresPdf, K extends keyof ValoresPdf[G]>(
  atual: ConfigPdf,
  grupo: G,
  chave: K,
  valor: ValoresPdf[G][K],
): ConfigPdf {
  const sobrescritas = structuredClone(normalizar(atual.sobrescritas)) as Registro;
  const grupoDoModelo = MODELOS[modeloValido(atual.modelo)][grupo] as Record<string, unknown>;
  const g = (sobrescritas[grupo as string] ??= {});
  if (grupoDoModelo[chave as string] === valor) delete g[chave as string];
  else g[chave as string] = valor;
  if (Object.keys(g).length === 0) delete sobrescritas[grupo as string];
  return { modelo: modeloValido(atual.modelo), sobrescritas: normalizar(sobrescritas) };
}

/** Opções (grupo e chave) cujo valor resolvido difere do modelo. */
function alteradas(config: ConfigPdf): { grupo: string; chave: string }[] {
  const modelo = MODELOS[modeloValido(config.modelo)] as unknown as Registro;
  const valores = resolver(config.modelo, config.sobrescritas) as unknown as Registro;
  return Object.entries(ESQUEMA).flatMap(([grupo, opcoes]) =>
    Object.keys(opcoes)
      .filter((chave) => valores[grupo][chave] !== modelo[grupo][chave])
      .map((chave) => ({ grupo, chave })),
  );
}

export function contarAlteracoes(config: ConfigPdf): number {
  return alteradas(config).length;
}

/** Sem nenhuma opção diferente do modelo (sobrescrita igual ao valor do modelo não conta). */
export function eDoModelo(config: ConfigPdf): boolean {
  return contarAlteracoes(config) === 0;
}

export function personalizado(config: ConfigPdf): boolean {
  return !eDoModelo(config);
}

/** Nome de cada opção na tela, no resumo das alterações. */
const ROTULOS: Record<string, Record<string, string>> = {
  cores: { destaque: 'Cor de destaque' },
  texto: { fonte: 'Fonte', tamanho: 'Tamanho do texto' },
  cabecalho: { estilo: 'Estilo do cabeçalho', logo: 'Posição da logo', tamanhoLogo: 'Tamanho da logo', mostrarNome: 'Nome da consultoria' },
  tabelas: { estilo: 'Estilo das tabelas', densidade: 'Densidade das tabelas' },
};

/** Texto curto para o cartão do modelo: "Sem alterações", "1 alteração: Fonte", "3 alterações: A, B e C", "5 alterações: A, B e mais 3". */
export function resumoDasAlteracoes(config: ConfigPdf): string {
  const nomes = alteradas(config).map(({ grupo, chave }) => ROTULOS[grupo][chave]);
  if (nomes.length === 0) return 'Sem alterações';
  const total = `${nomes.length} ${nomes.length === 1 ? 'alteração' : 'alterações'}`;
  if (nomes.length === 1) return `${total}: ${nomes[0]}`;
  if (nomes.length <= 3) return `${total}: ${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
  return `${total}: ${nomes[0]}, ${nomes[1]} e mais ${nomes.length - 2}`;
}

/**
 * Paleta de destaque (D23): `MARCA` vem da marca da consultoria (`cor: null`); as outras sete são FIXAS no código (Grafite
 * e as de `dominio/paletas.ts`), nunca lidas da configuração. Cada cor fixa dá ≥ 4,5:1 como texto sobre o branco do papel
 * (travado em `configuracaoPdf.test.ts`; `avaliarMarca` mede contra os fundos do tema do app, não contra o papel).
 */
export const PALETA_DE_DESTAQUE: readonly { id: DestaquePdf; nome: string; cor: string | null }[] = [
  { id: 'MARCA', nome: 'Cor da marca', cor: null },
  { id: 'GRAFITE', nome: 'Grafite', cor: '#374151' },
  { id: 'AZUL', nome: 'Azul', cor: '#2563EB' },
  { id: 'INDIGO', nome: 'Índigo', cor: '#4F46E5' },
  { id: 'VERDE', nome: 'Verde', cor: '#15803D' },
  { id: 'TURQUESA', nome: 'Turquesa', cor: '#0F766E' },
  { id: 'MAGENTA', nome: 'Magenta', cor: '#BE185D' },
  { id: 'BRONZE', nome: 'Bronze', cor: '#9A5B13' },
];

const BRANCO = '#FFFFFF';
const HEX = /^#[0-9A-Fa-f]{6}$/;
const NEUTRO = '#333333';

/**
 * As três cores do destaque no papel: `fundo` (faixa, linha, topo, cabeçalho de tabela), `texto` (título e link sobre o
 * branco, ≥ 4,5:1) e `sobreFundo` (texto sobre o `fundo`). `marca` é a cor da marca já em `#RRGGBB` (cor inválida usa o
 * neutro, como `corDaMarca` em `pdf/html.ts`). Mesma conta de `corDeTextoDaMarca` e `textoSobre`.
 */
export function coresDoDestaque(destaque: unknown, marca: string | null | undefined): { fundo: string; texto: string; sobreFundo: string } {
  const escolhida = PALETA_DE_DESTAQUE.find((p) => p.id === destaque);
  const fundo = escolhida?.cor ?? (typeof marca === 'string' && HEX.test(marca) ? marca : NEUTRO);
  return { fundo, texto: marcaParaTexto(fundo, BRANCO), sobreFundo: textoSobre(fundo) };
}

/** Célula do cartão do modelo na galeria (seção 3.1 de `orientacoes-de-design-26-11.md`): nunca mais estreita que 220 (miniatura ilegível) nem mais larga que 320. */
export const CELULA_MINIMA_DA_GALERIA = 220;
export const CELULA_MAXIMA_DA_GALERIA = 320;

/** Cartões do modelo por linha na galeria: o maior divisor de 6 que cabe (6, 3, 2 ou 1; nunca 4 + 2), como `mesesPorLinhaDoAno`. */
export function colunasDaGaleria(largura: number, vao: number): number {
  const cabem = colunasPorCelula(largura, CELULA_MINIMA_DA_GALERIA, vao, 6);
  return [6, 3, 2].find((n) => n <= cabem) ?? 1;
}

/** Teto da grade com `colunas` células de no máximo `CELULA_MAXIMA_DA_GALERIA`: a sobra da linha vira margem, nunca cartão esticado. */
export function larguraMaximaDaGaleria(colunas: number, vao: number): number {
  return colunas * CELULA_MAXIMA_DA_GALERIA + (colunas - 1) * vao;
}
