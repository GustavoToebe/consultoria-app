import {
  PERIODOS_DA_LISTA,
  quantidadeParaTela,
  type EscolhasDeOpcao,
  type LinhaDaLista,
  type PeriodoDaLista,
} from './listaDeCompras';
import { agruparLista, type GrupoDaLista } from './gruposDaLista';

/**
 * O que o aluno faz na própria lista de compras (pedido do Gustavo em 28/10, com a lista de um concorrente como
 * referência): marcar o que já comprou, ajustar a quantidade de um item calculado e acrescentar itens dele. Fica **só no
 * aparelho** (documento `listaDeCompras` do `RepositorioLocal`, que sai no "Sair" e na sessão recusada como a dieta
 * salva) e nunca muda a dieta nem a conta da lista: os ajustes só trocam o texto que a pessoa vê e imprime.
 *
 * Tudo vale para uma versão publicada da dieta e um período: versão nova começa do zero (a lista mudou) e cada período
 * tem as próprias marcações (o que se compra para 7 dias não é o que se compra para 30).
 */

export const LIMITE_NOME_AVULSO = 80;
export const LIMITE_QUANTIDADE_LIVRE = 20;
export const LIMITE_UNIDADE_LIVRE = 20;
/** Teto de itens avulsos por período: a lista é de mercado, não um caderno. */
export const LIMITE_AVULSOS = 100;

/** Quantidade escrita pelo aluno, sem conversão nem soma ("1" "pacote", "2,5" "kg"). */
export interface QuantidadeLivre {
  quantidade: string | null;
  unidade: string | null;
}

export interface ItemAvulso extends QuantidadeLivre {
  id: string;
  nome: string;
}

export interface MarcacoesDoPeriodo {
  /** Chaves dos itens comprados: a `chave` da linha calculada ou `avulso:<id>`. */
  comprados: string[];
  /** Quantidade própria de uma linha calculada, pela `chave` dela. */
  ajustes: Record<string, QuantidadeLivre>;
  avulsos: ItemAvulso[];
}

/** O documento guardado no aparelho: só o da versão da dieta em uso. */
export interface ListaDeComprasSalva {
  versaoId: string;
  /** Último período escolhido, para a tela abrir onde a pessoa estava. */
  periodo: PeriodoDaLista;
  /** Última opção escolhida por refeição (as marcações da opção B não somem ao voltar à tela). */
  escolhas: EscolhasDeOpcao;
  periodos: Partial<Record<PeriodoDaLista, MarcacoesDoPeriodo>>;
}

export const MARCACOES_VAZIAS: MarcacoesDoPeriodo = { comprados: [], ajustes: {}, avulsos: [] };

/** Começo para uma versão sem nada guardado. */
export function listaNova(versaoId: string): ListaDeComprasSalva {
  return { versaoId, periodo: 'semana', escolhas: {}, periodos: {} };
}

/** O guardado vale só para a mesma versão; outra versão (ou nada guardado) começa do zero. */
export function estadoDaVersao(salva: ListaDeComprasSalva | null, versaoId: string): ListaDeComprasSalva {
  return salva && salva.versaoId === versaoId ? salva : listaNova(versaoId);
}

export function marcacoesDoPeriodo(estado: ListaDeComprasSalva, periodo: PeriodoDaLista): MarcacoesDoPeriodo {
  return estado.periodos[periodo] ?? MARCACOES_VAZIAS;
}

export function comMarcacoes(estado: ListaDeComprasSalva, periodo: PeriodoDaLista, marcacoes: MarcacoesDoPeriodo): ListaDeComprasSalva {
  return { ...estado, periodos: { ...estado.periodos, [periodo]: marcacoes } };
}

export const chaveDoAvulso = (id: string) => `avulso:${id}`;

export function alternarComprado(m: MarcacoesDoPeriodo, chave: string): MarcacoesDoPeriodo {
  const comprados = m.comprados.includes(chave) ? m.comprados.filter((c) => c !== chave) : [...m.comprados, chave];
  return { ...m, comprados };
}

/** "Limpar marcações": desmarca tudo; ajustes e avulsos ficam. */
export function limparComprados(m: MarcacoesDoPeriodo): MarcacoesDoPeriodo {
  return { ...m, comprados: [] };
}

export function ajustarQuantidade(m: MarcacoesDoPeriodo, chave: string, quantidade: QuantidadeLivre): MarcacoesDoPeriodo {
  return { ...m, ajustes: { ...m.ajustes, [chave]: quantidadeLimpa(quantidade) } };
}

export function voltarAoCalculado(m: MarcacoesDoPeriodo, chave: string): MarcacoesDoPeriodo {
  const ajustes = { ...m.ajustes };
  delete ajustes[chave];
  return { ...m, ajustes };
}

/** Acrescenta no fim, ou troca o de mesmo `id` (edição). */
export function gravarAvulso(m: MarcacoesDoPeriodo, item: ItemAvulso): MarcacoesDoPeriodo {
  const limpo: ItemAvulso = { id: item.id, nome: textoLimpo(item.nome) ?? '', ...quantidadeLimpa(item) };
  const existe = m.avulsos.some((a) => a.id === item.id);
  return { ...m, avulsos: existe ? m.avulsos.map((a) => (a.id === item.id ? limpo : a)) : [...m.avulsos, limpo] };
}

/** Tira o avulso e a marca de comprado dele. */
export function removerAvulso(m: MarcacoesDoPeriodo, id: string): MarcacoesDoPeriodo {
  const chave = chaveDoAvulso(id);
  return { ...m, avulsos: m.avulsos.filter((a) => a.id !== id), comprados: m.comprados.filter((c) => c !== chave) };
}

/** Desfazer da remoção: o avulso volta no mesmo lugar, com a marca de comprado se tinha. */
export function restaurarAvulso(m: MarcacoesDoPeriodo, item: ItemAvulso, indice: number, comprado: boolean): MarcacoesDoPeriodo {
  if (m.avulsos.some((a) => a.id === item.id)) return m;
  const avulsos = [...m.avulsos];
  avulsos.splice(Math.max(0, Math.min(indice, avulsos.length)), 0, item);
  const chave = chaveDoAvulso(item.id);
  return { ...m, avulsos, comprados: comprado && !m.comprados.includes(chave) ? [...m.comprados, chave] : m.comprados };
}

/** Desfazer do "Limpar marcações": as marcas voltam, somadas ao que foi marcado depois. */
export function restaurarComprados(m: MarcacoesDoPeriodo, chaves: readonly string[]): MarcacoesDoPeriodo {
  return { ...m, comprados: [...new Set([...m.comprados, ...chaves])] };
}

// ---- Validação dos campos livres ----

const textoLimpo = (t: string | null | undefined): string | null => {
  const semControle = [...(t ?? '')].map((c) => (c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127 ? ' ' : c)).join('');
  const limpo = semControle.replace(/\s+/g, ' ').trim();
  return limpo || null;
};

const quantidadeLimpa = (q: QuantidadeLivre): QuantidadeLivre => ({ quantidade: textoLimpo(q.quantidade), unidade: textoLimpo(q.unidade) });

export interface ErrosDoItem {
  nome?: string;
  quantidade?: string;
  unidade?: string;
}

function errosDaQuantidade(q: QuantidadeLivre): ErrosDoItem {
  const erros: ErrosDoItem = {};
  if ((textoLimpo(q.quantidade) ?? '').length > LIMITE_QUANTIDADE_LIVRE) erros.quantidade = `Até ${LIMITE_QUANTIDADE_LIVRE} caracteres.`;
  if ((textoLimpo(q.unidade) ?? '').length > LIMITE_UNIDADE_LIVRE) erros.unidade = `Até ${LIMITE_UNIDADE_LIVRE} caracteres.`;
  return erros;
}

/** Ajuste de um item calculado: a quantidade é obrigatória (sem ela, é "Voltar ao calculado"). */
export function errosDoAjuste(q: QuantidadeLivre): ErrosDoItem {
  const erros = errosDaQuantidade(q);
  if (!textoLimpo(q.quantidade)) erros.quantidade = 'Informe a quantidade.';
  return erros;
}

/** Item avulso: só o nome é obrigatório. `quantos` = avulsos já no período (para o teto, só ao acrescentar). */
export function errosDoAvulso(item: Omit<ItemAvulso, 'id'>, quantos = 0): ErrosDoItem {
  const erros = errosDaQuantidade(item);
  const nome = textoLimpo(item.nome);
  if (!nome) erros.nome = 'Informe o nome do item.';
  else if (nome.length > LIMITE_NOME_AVULSO) erros.nome = `Até ${LIMITE_NOME_AVULSO} caracteres.`;
  else if (quantos >= LIMITE_AVULSOS) erros.nome = `A lista já tem ${LIMITE_AVULSOS} itens adicionados por você.`;
  return erros;
}

export const semErros = (e: ErrosDoItem) => !e.nome && !e.quantidade && !e.unidade;

// ---- O que a tela e o PDF mostram ----

/** "1 pacote", "2" ou "—" quando nada foi escrito. */
export function textoDaQuantidadeLivre(q: QuantidadeLivre): string {
  return [textoLimpo(q.quantidade), textoLimpo(q.unidade)].filter(Boolean).join(' ') || '—';
}

/** Quantidade calculada como a tela mostra: "420 g cru", "700 g (como na dieta)". */
export function textoDoCalculado(l: LinhaDaLista): string {
  return `${quantidadeParaTela(l.quantidade, l.unidade)}${l.cru ? ' cru' : ''}${l.semFator ? ' (como na dieta)' : ''}`;
}

/**
 * Valores iniciais do formulário de ajuste: o ajuste guardado, ou o calculado separado em número e unidade
 * ("1,80 kg" → "1,80" e "kg"), para a pessoa só trocar o número.
 */
export function quantidadeParaAjustar(l: LinhaDaLista, ajuste: QuantidadeLivre | undefined): { quantidade: string; unidade: string } {
  if (ajuste) return { quantidade: ajuste.quantidade ?? '', unidade: ajuste.unidade ?? '' };
  const [quantidade = '', unidade = ''] = quantidadeParaTela(l.quantidade, l.unidade).split(' ');
  return { quantidade, unidade };
}

export type OrigemDoItem = 'calculado' | 'ajustado' | 'avulso';

export interface ItemDaListaDoAluno {
  /** `chave` da linha calculada ou `avulso:<id>`. */
  chave: string;
  nome: string;
  origem: OrigemDoItem;
  /** Texto da quantidade: o calculado ("420 g cru") ou o escrito pelo aluno ("1 pacote"). */
  quantidade: string;
  /** O calculado, quando o aluno ajustou (para ele comparar); `null` nos outros casos. */
  calculado: string | null;
  /** O item calculado foi convertido para cru (vale também quando ajustado: a linha é a mesma). */
  cru: boolean;
  /** Grupo do alimento (o da linha calculada); `null` sem grupo e no avulso, que vai para "Adicionados por você". */
  grupo: string | null;
  comprado: boolean;
  /** Linha da conta (nula no avulso), para o formulário de ajuste. */
  linha: LinhaDaLista | null;
  avulso: ItemAvulso | null;
}

/** Linhas calculadas (com o ajuste, se houver) e depois os avulsos, na ordem em que foram acrescentados. */
export function itensDoAluno(linhas: readonly LinhaDaLista[], m: MarcacoesDoPeriodo): ItemDaListaDoAluno[] {
  const comprados = new Set(m.comprados);
  const calculados = linhas.map((l): ItemDaListaDoAluno => {
    const ajuste = m.ajustes[l.chave];
    const calculado = textoDoCalculado(l);
    return {
      chave: l.chave,
      nome: l.nome,
      origem: ajuste ? 'ajustado' : 'calculado',
      quantidade: ajuste ? textoDaQuantidadeLivre(ajuste) : calculado,
      calculado: ajuste ? calculado : null,
      cru: l.cru,
      grupo: l.grupo,
      comprado: comprados.has(l.chave),
      linha: l,
      avulso: null,
    };
  });
  const avulsos = m.avulsos.map((a): ItemDaListaDoAluno => ({
    chave: chaveDoAvulso(a.id),
    nome: a.nome,
    origem: 'avulso',
    quantidade: textoDaQuantidadeLivre(a),
    calculado: null,
    cru: false,
    grupo: null,
    comprado: comprados.has(chaveDoAvulso(a.id)),
    linha: null,
    avulso: a,
  }));
  return [...calculados, ...avulsos];
}

/**
 * Os itens da lista do aluno agrupados como na tela e no PDF (`agruparLista`): grupos do alimento, "Outros itens" e,
 * por último, os avulsos em "Adicionados por você". O item ajustado continua no grupo do alimento.
 */
export function gruposDoAluno(itens: readonly ItemDaListaDoAluno[]): GrupoDaLista<ItemDaListaDoAluno>[] {
  return agruparLista(itens, (i) => i.grupo, (i) => i.origem === 'avulso');
}

/** Marca de origem na tela e no PDF; o calculado não tem marca. */
export function textoDaOrigem(origem: OrigemDoItem): string | null {
  if (origem === 'ajustado') return 'Ajustado por você';
  if (origem === 'avulso') return 'Adicionado por você';
  return null;
}

/** Só conta itens da lista atual: a marca de um item que saiu (outra opção escolhida) fica guardada, mas não soma. */
export function contagemDeComprados(itens: readonly ItemDaListaDoAluno[]): { comprados: number; total: number } {
  return { comprados: itens.filter((i) => i.comprado).length, total: itens.length };
}

/** "2 de 6 comprados" (singular com um item só). */
export function textoDaContagem({ comprados, total }: { comprados: number; total: number }): string {
  return `${comprados} de ${total} ${total === 1 ? 'comprado' : 'comprados'}`;
}

// ---- Leitura do que está guardado ----

const PERIODOS = new Set<string>(PERIODOS_DA_LISTA);
const ehTexto = (v: unknown): v is string => typeof v === 'string';
const ehObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const textoOuNulo = (v: unknown, max: number): string | null => (ehTexto(v) ? textoLimpo(v.slice(0, max)) : null);

function quantidadeGuardada(v: Record<string, unknown>): QuantidadeLivre {
  return { quantidade: textoOuNulo(v.quantidade, LIMITE_QUANTIDADE_LIVRE), unidade: textoOuNulo(v.unidade, LIMITE_UNIDADE_LIVRE) };
}

function marcacoesGuardadas(v: unknown): MarcacoesDoPeriodo | null {
  if (!ehObjeto(v)) return null;
  const comprados = Array.isArray(v.comprados) ? [...new Set(v.comprados.filter(ehTexto))] : [];
  const ajustes: Record<string, QuantidadeLivre> = {};
  if (ehObjeto(v.ajustes)) {
    for (const [chave, q] of Object.entries(v.ajustes)) {
      if (!ehObjeto(q)) continue;
      const ajuste = quantidadeGuardada(q);
      if (ajuste.quantidade) ajustes[chave] = ajuste;
    }
  }
  const avulsos: ItemAvulso[] = [];
  const ids = new Set<string>();
  for (const a of Array.isArray(v.avulsos) ? v.avulsos : []) {
    if (!ehObjeto(a) || !ehTexto(a.id) || !a.id || ids.has(a.id)) continue;
    const nome = textoOuNulo(a.nome, LIMITE_NOME_AVULSO);
    if (!nome || avulsos.length >= LIMITE_AVULSOS) continue;
    ids.add(a.id);
    avulsos.push({ id: a.id, nome, ...quantidadeGuardada(a) });
  }
  return { comprados, ajustes, avulsos };
}

/**
 * Documento lido do aparelho, conferido campo a campo: o que não confere sai (nunca derruba a tela). Sem versão, não
 * há o que aproveitar.
 */
export function normalizarListaSalva(valor: unknown): ListaDeComprasSalva | null {
  if (!ehObjeto(valor) || !ehTexto(valor.versaoId) || !valor.versaoId) return null;
  const periodo = ehTexto(valor.periodo) && PERIODOS.has(valor.periodo) ? (valor.periodo as PeriodoDaLista) : 'semana';
  const escolhas: Record<string, string> = {};
  if (ehObjeto(valor.escolhas)) for (const [r, o] of Object.entries(valor.escolhas)) if (ehTexto(o)) escolhas[r] = o;
  const periodos: Partial<Record<PeriodoDaLista, MarcacoesDoPeriodo>> = {};
  if (ehObjeto(valor.periodos)) {
    for (const p of PERIODOS_DA_LISTA) {
      const m = marcacoesGuardadas(valor.periodos[p]);
      if (m) periodos[p] = m;
    }
  }
  return { versaoId: valor.versaoId, periodo, escolhas, periodos };
}
