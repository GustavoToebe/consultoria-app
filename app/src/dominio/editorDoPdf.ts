import { faixaDeLargura } from '../tema/tokens';
import type { SeloDoEditor } from './barraDoEditor';
import {
  MODELOS_PDF,
  modeloValido,
  normalizar,
  PALETA_DE_DESTAQUE,
  resolver,
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
/** Nem amplia acima disto: maior, deixa de parecer o papel (a sobra da coluna vira mesa dos dois lados). */
export const ZOOM_MAXIMO = 1.25;
/** Vão entre o painel de opções e a prévia (o mesmo da coluna de apoio, 0.2 das orientações). */
export const VAO_DO_EDITOR = 32;
/** Coluna de opções à esquerda, fixa ao rolar (27/11). */
export const LARGURA_DO_PAINEL = 420;
/**
 * A partir desta JANELA, opções à esquerda e prévia ao lado; abaixo (e fora do compacto), opções em cima e prévia embaixo.
 * Exceção à regra de medir a área (4.10), como a das Configurações: o "1280" do pedido é a janela; pela área, a janela de
 * 1280 com o menu aberto (~1040 de área) cairia no empilhado.
 */
export const JANELA_DAS_COLUNAS = 1280;
/** A partir desta largura de CONTEÚDO (já sem o recuo e com o teto da preferência), Treino e Dieta lado a lado. */
export const CONTEUDO_DAS_DUAS_PREVIAS = 2400;

/** O papel dos PDFs é branco em qualquer tema (o `.previa-pdf`; a mesma exceção da `MESA_DA_PREVIA`, 4.10). */
export const PAPEL_DA_FOLHA = '#FFFFFF';

export type ZoomDaFolha = 'AJUSTAR' | 'CEM';

export type ArranjoDoEditor =
  | { tipo: 'compacto' }
  | { tipo: 'empilhado' }
  | { tipo: 'colunas'; painel: number; previas: 1 | 2 };

/**
 * `area` é a área de conteúdo (4.10); `conteudo`, o que sobra dentro da `TelaDoEditor` (recuo lateral e teto da "Largura do
 * conteúdo" descontados); `janela`, a largura da janela. Abaixo de 1024 de área só se confirma o modelo (D24); com janela
 * abaixo de 1280 (menu recolhido ou minimizado), opções em cima e prévia embaixo; de 1280 de janela em diante, painel de 420
 * à esquerda e a prévia no resto; com 2400 de conteúdo, duas prévias lado a lado (com a preferência "Limitada", 1800, nunca).
 */
export function arranjoDoEditor(area: number, conteudo: number = area, janela: number = area): ArranjoDoEditor {
  if (faixaDeLargura(area) === 'compacta') return { tipo: 'compacto' };
  if (janela < JANELA_DAS_COLUNAS) return { tipo: 'empilhado' };
  return { tipo: 'colunas', painel: LARGURA_DO_PAINEL, previas: conteudo >= CONTEUDO_DAS_DUAS_PREVIAS ? 2 : 1 };
}

/**
 * A folha no espaço da prévia: `largura` em px na tela, sempre na proporção da A4. "Ajustar" acompanha o espaço entre 60% e
 * 125%; "100%" é a A4 real e só vale (e o controle só aparece, `zoomMuda`) quando a folha ajustada fica menor que ela. Com
 * espaço de sobra a escolha antiga de "100%" é ignorada: o controle sumiu e não haveria como voltar. `rolaDeLado` quando a
 * folha passa do espaço (100% ou o piso de 60%).
 */
export function folhaNaTela(espaco: number, zoom: ZoomDaFolha): { largura: number; rolaDeLado: boolean; zoomMuda: boolean } {
  const ajustada = Math.min(ZOOM_MAXIMO, Math.max(ZOOM_MINIMO, espaco / LARGURA_DA_FOLHA));
  const zoomMuda = espaco < LARGURA_DA_FOLHA;
  const largura = Math.round(LARGURA_DA_FOLHA * (zoomMuda && zoom === 'CEM' ? 1 : ajustada));
  return { largura, rolaDeLado: largura > espaco, zoomMuda };
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

/**
 * O rascunho depois de um salvar concluído: some só se ainda for o que foi gravado (`alvo`); se a pessoa mexeu nas opções
 * com a requisição em voo, o rascunho continua (agora diferente da base recém-gravada) para não perder a mudança.
 */
export function rascunhoDepoisDeSalvar(rascunho: ConfigPdf | null, alvo: ConfigPdf): ConfigPdf | null {
  return rascunho && !mesmaConfig(rascunho, alvo) ? rascunho : null;
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

/** Quantas opções têm valor diferente do gravado (comparando os valores resolvidos, não as sobrescritas). */
export function opcoesMudadas(atual: ConfigPdf, salvo: ConfigPdf): number {
  const a = resolver(atual.modelo, atual.sobrescritas) as unknown as Record<string, Record<string, unknown>>;
  const b = resolver(salvo.modelo, salvo.sobrescritas) as unknown as Record<string, Record<string, unknown>>;
  return Object.keys(a).reduce((n, g) => n + Object.keys(a[g]).filter((k) => a[g][k] !== b[g][k]).length, 0);
}

/**
 * A barra do editor diz UM estado (27/11): salvando, falha, "Alterações não salvas" com o que mudou em relação ao gravado,
 * ou "Em uso nos PDFs · <modelo> · Sem alterações". O `resumoDasAlteracoes` compara com o modelo, não com o gravado: no
 * pendente ele dizia "Sem alterações" ao lado de "Alterações não salvas" (modelo trocado sem mexer em nada); saiu da barra.
 */
export function estadoDaBarra(atual: ConfigPdf, salvo: ConfigPdf, situacao: { salvando: boolean; erro: boolean }): { selo: SeloDoEditor; info: string } {
  const nome = nomeDoModelo(atual.modelo);
  if (situacao.salvando) return { selo: { texto: 'Salvando…', tipo: 'neutro' }, info: nome };
  const pendente = !mesmaConfig(atual, salvo);
  if (situacao.erro) return { selo: { texto: 'Falha ao salvar', tipo: 'perigo' }, info: nome };
  // O texto do pedido (27/11): as personalizações gravadas aparecem no resumo de cada grupo, não aqui ("1 alteração" ao lado
  // de "Em uso" repetiria a confusão com o não salvo).
  if (!pendente) return { selo: { texto: 'Em uso nos PDFs', tipo: 'sucesso' }, info: `${nome} · Sem alterações` };
  const selo: SeloDoEditor = { texto: 'Alterações não salvas', tipo: 'neutro', naoSalvo: true };
  if (atual.modelo !== salvo.modelo) return { selo, info: `${nome} · os PDFs ainda usam ${nomeDoModelo(salvo.modelo)}` };
  const n = opcoesMudadas(atual, salvo);
  // 0: só a forma gravada muda (uma sobrescrita igual ao valor do modelo some ao restaurar).
  return { selo, info: `${nome} · ${n === 0 ? 'valores do modelo' : `${n} ${n === 1 ? 'opção mudada' : 'opções mudadas'}`}` };
}

