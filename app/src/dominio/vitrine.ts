import type { DadosDoItem, ItemDaVitrine, ItemDaVitrineDoAluno, TipoDoItem } from '../api/vitrineTipos';
import { hojeEmBrasilia } from './agendaPresencial';
import { dataNaFaixa, mensagemDaFaixa } from './datasValidas';
import { centavosDaTela, centavosParaCampo, centavosParaTela, dataParaTela } from './formatos';
import { VALOR_MAXIMO_CENTAVOS, type PlataformaDoApp } from './financeiro';
import { erroDoLink } from './links';
import { MAX_CUPOM } from './suplementos';

/**
 * Vitrine da consultoria (F1 de `docs/planos/vitrine-e-loja.md`): validação do editor (espelho da API: mudou uma, mude
 * a outra), o que o celular pode mostrar de cada item (D6) e os textos de preço e validade. O preço que vale hoje é
 * decidido no servidor (`precoVigenteCentavos`, D4); aqui só se formata. Ausência de dado é "—", nunca zero.
 */

export const TETO_DE_ITENS = 30;
export const NOME_MAXIMO = 100;
export const DESCRICAO_MAXIMA = 300;

export const TIPOS_DE_ITEM: readonly { valor: TipoDoItem; rotulo: string }[] = [
  { valor: 'DIGITAL', rotulo: 'Digital' },
  { valor: 'FISICO', rotulo: 'Físico' },
];

export const rotuloDoTipo = (tipo: TipoDoItem): string => TIPOS_DE_ITEM.find((t) => t.valor === tipo)?.rotulo ?? tipo;

// ---- Regra das lojas de aplicativo (D6) ----

export interface ComoMostrarItem {
  foto: boolean;
  nome: boolean;
  descricao: boolean;
  preco: boolean;
  cupom: boolean;
  link: boolean;
}

/**
 * O que a tela mostra de um item nesta plataforma, no molde de `comoPagar`. A web mostra tudo; no celular o item
 * FISICO também; o item DIGITAL mostra só foto, nome e descrição (sem preço, cupom, link, botão nem frase de "compre
 * pelo site"). Sem chave por plataforma agora: liberar depois é um parâmetro novo aqui, vindo do `GET /eu`. A
 * plataforma vem do componente (`plataformaDoApp(Platform.OS)`).
 */
export function comoMostrarItem(tipo: TipoDoItem, plataforma: PlataformaDoApp): ComoMostrarItem {
  const tudo = plataforma === 'web' || tipo === 'FISICO';
  return { foto: true, nome: true, descricao: true, preco: tudo, cupom: tudo, link: tudo };
}

// ---- Textos de preço e validade ----

type ItemParaPreco = Pick<ItemDaVitrine, 'precoCentavos' | 'precoVigenteCentavos' | 'especialAte'> & { precoEspecialCentavos?: number | null };

/** O preço vigente é menor que o normal: o preço especial está valendo (decidido no servidor). */
export function emPromocao(item: ItemParaPreco): boolean {
  const { precoCentavos: normal, precoVigenteCentavos: vigente } = item;
  if (vigente === null || vigente === undefined) return false;
  if (normal !== null && normal !== undefined) return vigente < normal;
  return item.precoEspecialCentavos !== null && item.precoEspecialCentavos !== undefined && vigente === item.precoEspecialCentavos;
}

export interface TextoDoPreco {
  /** O preço que vale hoje ("R$ 99,00"); sem preço, "—". */
  atual: string;
  /** O preço normal, para riscar, só com o especial valendo. */
  antes: string | null;
  /** "Preço especial até 27/11/2026", "Preço especial" (sem prazo) ou, para a equipe, "Preço especial encerrado em 27/11/2026". */
  validade: string | null;
}

export function textoDoPreco(item: ItemParaPreco, hoje: string = hojeEmBrasilia()): TextoDoPreco {
  const atual = centavosParaTela(item.precoVigenteCentavos);
  if (emPromocao(item)) {
    const ate = dataParaTela(item.especialAte);
    return { atual, antes: item.precoCentavos != null ? centavosParaTela(item.precoCentavos) : null, validade: ate ? `Preço especial até ${ate}` : 'Preço especial' };
  }
  const encerrado = item.precoEspecialCentavos != null && !!item.especialAte && item.especialAte < hoje;
  return { atual, antes: null, validade: encerrado ? `Preço especial encerrado em ${dataParaTela(item.especialAte)}` : null };
}

/** Até `maximo` itens para o cartão do Início do aluno: o de preço especial valendo primeiro, o resto na ordem recebida. */
export function itensDoCartaoDoInicio(itens: readonly ItemDaVitrineDoAluno[], maximo = 2): ItemDaVitrineDoAluno[] {
  return [...itens.filter(emPromocao), ...itens.filter((i) => !emPromocao(i))].slice(0, maximo);
}

// ---- Teto e ordem ----

/** "7 de 30" (o `total` é o que a lista da equipe trouxe, ativos e inativos). */
export const contagemDeItens = (total: number): string => `${total} de ${TETO_DE_ITENS}`;

/** Novo item só abaixo do teto (a API confere de novo: 409 `VITRINE_LIMITE`). */
export function podeAdicionarItem(total: number): { pode: boolean; motivo: string | null } {
  return total >= TETO_DE_ITENS
    ? { pode: false, motivo: `A vitrine tem no máximo ${TETO_DE_ITENS} itens. Exclua um para adicionar outro.` }
    : { pode: true, motivo: null };
}

/** Subir/Descer: o item troca de lugar com o vizinho; na ponta, a ordem não muda. */
export function moverItem(ids: readonly string[], id: string, sentido: 'subir' | 'descer'): string[] {
  const i = ids.indexOf(id);
  const j = sentido === 'subir' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ids.length) return [...ids];
  const novo = [...ids];
  [novo[i], novo[j]] = [novo[j], novo[i]];
  return novo;
}

// ---- Editor ----

/** O que a tela guarda enquanto a pessoa digita: preços como texto, a data em ISO (vazia = sem prazo). */
export interface RascunhoDoItem {
  nome: string;
  descricao: string;
  tipo: TipoDoItem;
  preco: string;
  precoEspecial: string;
  especialAte: string;
  cupom: string;
  linkUrl: string;
  ativo: boolean;
}

/** Item novo: digital (o que mostra menos no celular) e ativo. */
export const rascunhoVazio = (): RascunhoDoItem => ({
  nome: '', descricao: '', tipo: 'DIGITAL', preco: '', precoEspecial: '', especialAte: '', cupom: '', linkUrl: '', ativo: true,
});

export const rascunhoDoItem = (i: ItemDaVitrine): RascunhoDoItem => ({
  nome: i.nome,
  descricao: i.descricao ?? '',
  tipo: i.tipo,
  preco: centavosParaCampo(i.precoCentavos),
  precoEspecial: centavosParaCampo(i.precoEspecialCentavos),
  especialAte: i.especialAte ?? '',
  cupom: i.cupom ?? '',
  linkUrl: i.linkUrl ?? '',
  ativo: i.ativo,
});

/** Preço digitado: vazio = sem preço (`null`); preenchido e ilegível ou grande demais = `undefined` (erro no campo). */
function lerPreco(texto: string): number | null | undefined {
  if (!texto.trim()) return null;
  const c = centavosDaTela(texto);
  return c === null || c > VALOR_MAXIMO_CENTAVOS ? undefined : c;
}

/**
 * Problemas por campo, com as chaves do `fieldErrors` da API (422 `VITRINE_ITEM_INVALIDO`): `nome`, `descricao`,
 * `precoCentavos`, `precoEspecialCentavos`, `especialAte`, `cupom` e `linkUrl`. Objeto vazio = pode salvar. As
 * mensagens nunca repetem o valor digitado.
 */
export function problemasDoItem(r: RascunhoDoItem, hoje: string = hojeEmBrasilia()): Record<string, string> {
  const erros: Record<string, string> = {};
  const nome = r.nome.trim();
  if (!nome) erros.nome = 'Informe o nome do item.';
  else if (nome.length > NOME_MAXIMO) erros.nome = `Use no máximo ${NOME_MAXIMO} caracteres.`;
  if (r.descricao.trim().length > DESCRICAO_MAXIMA) erros.descricao = `Use no máximo ${DESCRICAO_MAXIMA} caracteres.`;
  const mensagemDoPreco = 'Informe um valor maior que zero, por exemplo 150,00 (até R$ 10.000.000,00).';
  if (lerPreco(r.preco) === undefined) erros.precoCentavos = mensagemDoPreco;
  const especial = lerPreco(r.precoEspecial);
  if (especial === undefined) erros.precoEspecialCentavos = mensagemDoPreco;
  else if (especial !== null) {
    // As duas regras são da API (422 em `precoEspecialCentavos`) e do CHECK do banco.
    const normal = lerPreco(r.preco);
    if (normal === null) erros.precoEspecialCentavos = 'Informe o preço normal para usar o preço especial.';
    else if (normal !== undefined && especial >= normal) erros.precoEspecialCentavos = 'O preço especial precisa ser menor que o preço normal.';
  }
  if (r.especialAte) {
    if (especial === null) erros.especialAte = 'Informe o preço especial para usar o prazo.';
    else if (!dataNaFaixa(r.especialAte, 'PLANEJAMENTO', hoje)) erros.especialAte = mensagemDaFaixa('Prazo do preço especial', 'PLANEJAMENTO', hoje);
  }
  if (r.cupom.trim().length > MAX_CUPOM) erros.cupom = `Use no máximo ${MAX_CUPOM} caracteres.`;
  const link = erroDoLink(r.linkUrl);
  if (link) erros.linkUrl = link;
  return erros;
}

/** Corpo do POST/PUT: textos sem espaços nas pontas e em branco = nulo; `versao` só na edição. Chame depois de `problemasDoItem` vazio. */
export function corpoDoItem(r: RascunhoDoItem, versao?: number): DadosDoItem {
  const corpo: DadosDoItem = {
    nome: r.nome.trim(),
    descricao: r.descricao.trim() || null,
    tipo: r.tipo,
    precoCentavos: lerPreco(r.preco) ?? null,
    precoEspecialCentavos: lerPreco(r.precoEspecial) ?? null,
    especialAte: r.especialAte || null,
    cupom: r.cupom.trim() || null,
    linkUrl: r.linkUrl.trim() || null,
    ativo: r.ativo,
  };
  if (versao !== undefined) corpo.versao = versao;
  return corpo;
}
