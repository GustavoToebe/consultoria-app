import { faixaDeLargura } from '../tema/tokens';
import {
  MODELOS_PDF,
  modeloValido,
  normalizar,
  PALETA_DE_DESTAQUE,
  type ConfigPdf,
  type ModeloPdf,
  type ValoresPdf,
} from './configuracaoPdf';

/**
 * Regras do editor dos PDFs (`/treinador/documentos/personalizar`; plano `docs/planos/documentos-pdf-motor.md`, D-F1 a
 * D-F8, e `docs/planos/orientacoes-de-design-26-11.md` 3.2): arranjo pela ÁREA de conteúdo, zoom da folha e os textos das
 * opções. Sem React nem plataforma.
 */

/** Largura da folha A4 na tela: 210 mm a 96 px por polegada (a mesma de `PreviaDoDocumento.web`). */
export const LARGURA_DA_FOLHA = 794;
/** "Ajustar" nunca reduz a folha abaixo disto: menor, o texto do exemplo fica ilegível. */
export const ZOOM_MINIMO = 0.6;
/** Vão entre o painel de opções e a prévia (o mesmo da coluna de apoio, 0.2 das orientações). */
export const VAO_DO_EDITOR = 32;

export type ZoomDaFolha = 'AJUSTAR' | 'CEM';

export type ArranjoDoEditor =
  | { tipo: 'compacto' }
  | { tipo: 'editor'; painel: number; zoomPadrao: ZoomDaFolha };

/**
 * Pela área de conteúdo (nunca a janela): `compacta` (< 1024) só confirma o modelo; `normal` painel 360 e folha ajustada;
 * `larga` painel 400 e folha a 100%; `ultralarga` painel 440 e folha a 100% (nunca acima: deixaria de parecer o papel).
 */
export function arranjoDoEditor(area: number): ArranjoDoEditor {
  const faixa = faixaDeLargura(area);
  if (faixa === 'compacta') return { tipo: 'compacto' };
  if (faixa === 'normal') return { tipo: 'editor', painel: 360, zoomPadrao: 'AJUSTAR' };
  return { tipo: 'editor', painel: faixa === 'larga' ? 400 : 440, zoomPadrao: 'CEM' };
}

/**
 * A folha no espaço da prévia: `largura` em px na tela (a prévia se reduz por `zoom` para caber nela), `rolaDeLado` quando
 * ela passa do espaço (100% num espaço menor que a A4, ou o piso de 60%) e `zoomMuda` quando "Ajustar" e "100%" dão
 * folhas diferentes (com espaço de sobra, os dois são 100% e o controle não tem o que fazer).
 */
export function folhaNaTela(espaco: number, zoom: ZoomDaFolha): { largura: number; rolaDeLado: boolean; zoomMuda: boolean } {
  const ajustada = Math.min(1, Math.max(ZOOM_MINIMO, espaco / LARGURA_DA_FOLHA));
  const largura = Math.round(LARGURA_DA_FOLHA * (zoom === 'CEM' ? 1 : ajustada));
  return { largura, rolaDeLado: largura > espaco, zoomMuda: espaco < LARGURA_DA_FOLHA };
}

/** O que está gravado na marca: modelo conferido contra a lista e sobrescritas só com chaves conhecidas. */
export function configDaMarca(marca: { temaPdf?: string | null; opcoesPdf?: unknown }): ConfigPdf {
  return { modelo: modeloValido(marca.temaPdf), sobrescritas: normalizar(marca.opcoesPdf) };
}

/** `?modelo=` da galeria: só um id da lista vale; o resto é ignorado (abre o modelo gravado). */
export function modeloDoEndereco(valor: unknown): ModeloPdf | null {
  return MODELOS_PDF.find((m) => m.id === valor)?.id ?? null;
}

/** Mesmo modelo e mesmas sobrescritas (`normalizar` segue a ordem do esquema: a comparação não depende da ordem das chaves). */
export function mesmaConfig(a: ConfigPdf, b: ConfigPdf): boolean {
  return a.modelo === b.modelo && JSON.stringify(normalizar(a.sobrescritas)) === JSON.stringify(normalizar(b.sobrescritas));
}

export function nomeDoModelo(modelo: unknown): string {
  return MODELOS_PDF.find((m) => m.id === modeloValido(modelo))?.nome ?? '';
}

type Opcoes<V> = readonly { valor: V; rotulo: string }[];

/** Rótulos dos valores de cada opção, na ordem em que aparecem no painel. */
export const OPCOES_DO_PDF = {
  fonte: [
    { valor: 'SEM_SERIFA', rotulo: 'Sem serifa' },
    { valor: 'SERIFADA', rotulo: 'Serifada' },
    { valor: 'CONDENSADA', rotulo: 'Condensada' },
  ] satisfies Opcoes<ValoresPdf['texto']['fonte']>,
  tamanhoDoTexto: [
    { valor: 'P', rotulo: 'Pequeno' },
    { valor: 'M', rotulo: 'Médio' },
    { valor: 'G', rotulo: 'Grande' },
  ] satisfies Opcoes<ValoresPdf['texto']['tamanho']>,
  estiloDoCabecalho: [
    { valor: 'FAIXA', rotulo: 'Faixa cheia' },
    { valor: 'LINHA', rotulo: 'Linha fina' },
    { valor: 'CARTAO', rotulo: 'Cartão' },
  ] satisfies Opcoes<ValoresPdf['cabecalho']['estilo']>,
  logo: [
    { valor: 'ESQUERDA', rotulo: 'À esquerda' },
    { valor: 'CENTRO', rotulo: 'Centralizada' },
  ] satisfies Opcoes<ValoresPdf['cabecalho']['logo']>,
  tamanhoDaLogo: [
    { valor: 'P', rotulo: 'Pequena' },
    { valor: 'M', rotulo: 'Média' },
    { valor: 'G', rotulo: 'Grande' },
  ] satisfies Opcoes<ValoresPdf['cabecalho']['tamanhoLogo']>,
  estiloDasTabelas: [
    { valor: 'LINHAS', rotulo: 'Linhas' },
    { valor: 'LISTRADA', rotulo: 'Listrada' },
    { valor: 'CARTOES', rotulo: 'Cartões' },
  ] satisfies Opcoes<ValoresPdf['tabelas']['estilo']>,
  densidade: [
    { valor: 'COMPACTA', rotulo: 'Compacta' },
    { valor: 'NORMAL', rotulo: 'Normal' },
    { valor: 'ESPACOSA', rotulo: 'Espaçosa' },
  ] satisfies Opcoes<ValoresPdf['tabelas']['densidade']>,
};

function rotulo<V>(opcoes: Opcoes<V>, valor: V): string {
  return opcoes.find((o) => o.valor === valor)?.rotulo ?? '';
}

export type GrupoDoEditor = 'modelo' | keyof ValoresPdf;

/** Resumo no cabeçalho fechado de cada grupo do painel ("Faixa cheia · logo à esquerda · média"). */
export function resumoDoGrupo(grupo: GrupoDoEditor, config: ConfigPdf, valores: ValoresPdf): string {
  switch (grupo) {
    case 'modelo':
      return nomeDoModelo(config.modelo);
    case 'cores':
      return `Destaque: ${PALETA_DE_DESTAQUE.find((p) => p.id === valores.cores.destaque)?.nome ?? ''}`;
    case 'texto':
      return `${rotulo(OPCOES_DO_PDF.fonte, valores.texto.fonte)} · texto ${rotulo(OPCOES_DO_PDF.tamanhoDoTexto, valores.texto.tamanho).toLowerCase()}`;
    case 'cabecalho': {
      const c = valores.cabecalho;
      const partes = [rotulo(OPCOES_DO_PDF.estiloDoCabecalho, c.estilo), `logo ${rotulo(OPCOES_DO_PDF.logo, c.logo).toLowerCase()}`, rotulo(OPCOES_DO_PDF.tamanhoDaLogo, c.tamanhoLogo).toLowerCase()];
      return [...partes, ...(c.mostrarNome ? [] : ['sem o nome'])].join(' · ');
    }
    case 'tabelas':
      return `${rotulo(OPCOES_DO_PDF.estiloDasTabelas, valores.tabelas.estilo)} · ${rotulo(OPCOES_DO_PDF.densidade, valores.tabelas.densidade).toLowerCase()}`;
  }
}

const NOME_DO_GRUPO: Record<string, string> = { cores: 'Cores', texto: 'Texto', cabecalho: 'Cabeçalho', tabelas: 'Tabelas' };

/**
 * 422 `DOCUMENTOS_PDF_INVALIDOS`: a mensagem do primeiro campo, com o grupo na frente quando o caminho diz qual
 * (`opcoes.cabecalho.estilo` → "Cabeçalho: …"). Sem campo, a mensagem geral.
 */
export function mensagemDoErroDeCampo(campos: readonly { field: string; message: string }[], geral: string): string {
  const campo = campos[0];
  if (!campo) return geral;
  const grupo = NOME_DO_GRUPO[campo.field.split('.')[1] ?? ''];
  return grupo ? `${grupo}: ${campo.message}` : campo.message;
}
