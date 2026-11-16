import { ErroApi } from '@plataforma/web';

import type { ItemDoMarketplace, LojaDoMarketplace, MarcaDaLoja, PaginaDaVitrine } from '../api/vitrineTipos';
import type { PlataformaDoApp } from './financeiro';
import { centavosParaTela } from './formatos';
import { linkDaLoja, NAO_ENCONTRADA, textoDaEspera, type TextosDoEstado } from './loja';
import { ehMarketplaceDesligado } from './marketplaceDesligado';
import { NOME_DA_VITRINE_DE_CONSULTORIAS } from './produto';
import { comoMostrarItem, MOTIVO_SO_DIGITAL_NA_LISTA, type RascunhoDoItem } from './vitrine';

/**
 * Lista pública de consultorias (F3 de `docs/planos/vitrine-e-loja.md`; "marketplace" só por dentro, em texto de tela é
 * `NOME_DA_VITRINE_DE_CONSULTORIAS`): os estados da tela, o que mostrar de cada item por plataforma (D6, `comoMostrarItem`), a
 * paginação "Carregar mais" e os textos do treinador. A compra continua na página de cada consultoria (`/loja/<codigo>`).
 */

// ---- Caminho e paginação ----

/** Rota da página da consultoria dentro do app (a compra acontece lá). */
export const caminhoDaLoja = (codigo: string): string => linkDaLoja(codigo, '');

/** Quantas consultorias a tela pede por página (o padrão da API; ela corta em 100). */
export const LOJAS_POR_PAGINA = 30;

export const ROTULO_CARREGAR_MAIS = 'Carregar mais';

/**
 * Próxima página (base 0) do "Carregar mais", ou `null` quando não há mais. Recebe o `total`, a `pagina` e o `tamanho` que a API
 * devolveu (os efetivos) e quantas consultorias a tela já juntou. Confere as duas contas: com o cache de 1 minuto uma página
 * pode vir vazia com `total` maior, e sem a conta da página o botão ficaria repetindo a mesma.
 */
export function proximaPaginaDaLista(entrada: { total: number; pagina: number; tamanho: number; carregadas: number }): number | null {
  const { total, pagina, tamanho, carregadas } = entrada;
  if (!(tamanho >= 1) || carregadas >= total) return null;
  return (pagina + 1) * tamanho < total ? pagina + 1 : null;
}

// ---- O que a lista mostra de cada consultoria e item ----

export interface ItemDoMarketplaceParaMostrar {
  id: string;
  nome: string;
  descricao: string | null;
  /** Mostrar a foto (o item tem e a plataforma deixa); a imagem vem de `caminhoDaFotoDaLoja(codigoDaLoja, id, fotoAtualizadaEm)`. */
  foto: boolean;
  fotoAtualizadaEm: string | null;
  /** O preço vigente ("R$ 99,00"); nulo no celular (D6) ou sem preço: nada na tela, nunca "—", zero nem "grátis". */
  preco: string | null;
}

/** O item da lista nesta plataforma: no celular o digital mostra só foto, nome e descrição; na web, também o preço. */
export function itemDoMarketplaceParaMostrar(item: ItemDoMarketplace, plataforma: PlataformaDoApp): ItemDoMarketplaceParaMostrar {
  const como = comoMostrarItem(item.tipo, plataforma);
  return {
    id: item.id,
    nome: item.nome,
    descricao: como.descricao ? item.descricao?.trim() || null : null,
    foto: como.foto && item.temFoto,
    fotoAtualizadaEm: item.fotoAtualizadaEm,
    preco: como.preco && item.precoVigenteCentavos != null ? centavosParaTela(item.precoVigenteCentavos) : null,
  };
}

export interface LojaDoMarketplaceParaMostrar {
  /** Código da página da loja: vai em `caminhoDaFotoDaLoja` de cada item. */
  codigo: string;
  nome: string;
  marca: MarcaDaLoja;
  /** `/loja/<codigo>`, para navegar dentro do app. */
  caminho: string;
  itens: ItemDoMarketplaceParaMostrar[];
}

export const lojaDoMarketplaceParaMostrar = (loja: LojaDoMarketplace, plataforma: PlataformaDoApp): LojaDoMarketplaceParaMostrar => ({
  codigo: loja.codigo,
  nome: loja.marca.nome,
  marca: loja.marca,
  caminho: caminhoDaLoja(loja.codigo),
  itens: loja.itens.map((i) => itemDoMarketplaceParaMostrar(i, plataforma)),
});

// ---- Estados da tela pública ----

export type FalhaDaLista =
  | ({ tipo: 'indisponivel' } & TextosDoEstado)
  | ({ tipo: 'muitas_tentativas'; esperaSegundos: number | null; podeTentarDeNovo: true } & TextosDoEstado)
  | ({ tipo: 'erro_de_rede'; podeTentarDeNovo: true } & TextosDoEstado)
  | ({ tipo: 'erro'; podeTentarDeNovo: true } & TextosDoEstado);

export type EstadoDaLista =
  | { tipo: 'carregando'; texto: string }
  | ({ tipo: 'vazia' } & TextosDoEstado)
  /** `falhaAoCarregarMais`: a página seguinte falhou; a lista que já veio fica na tela, com o aviso e "Tentar de novo" (`ROTULO_TENTAR_DE_NOVO` de `loja.ts`). */
  | { tipo: 'pronta'; lojas: LojaDoMarketplace[]; falhaAoCarregarMais: Exclude<FalhaDaLista, { tipo: 'indisponivel' }> | null }
  | FalhaDaLista;

export const TEXTO_CARREGANDO_A_LISTA = 'Carregando as consultorias…';

function falhaDaLista(erro: unknown, esperaSegundos: number | null): FalhaDaLista {
  // 503 `MARKETPLACE_INDISPONIVEL` (chave desligada) é o mesmo "não encontrada" da loja: o visitante não fica sabendo que existe uma chave.
  if (ehMarketplaceDesligado(erro) || (erro instanceof ErroApi && erro.status === 404)) return { tipo: 'indisponivel', ...NAO_ENCONTRADA };
  if (erro instanceof ErroApi && erro.status === 429) {
    return { tipo: 'muitas_tentativas', esperaSegundos, podeTentarDeNovo: true, titulo: 'Muitas tentativas', texto: textoDaEspera(esperaSegundos) };
  }
  if (erro instanceof ErroApi && erro.semConexao) {
    return { tipo: 'erro_de_rede', podeTentarDeNovo: true, titulo: 'Sem conexão', texto: 'Confira a internet e tente de novo.' };
  }
  return { tipo: 'erro', podeTentarDeNovo: true, titulo: 'Não foi possível abrir a lista', texto: 'Tente de novo.' };
}

/**
 * O que a tela mostra, na ordem: erro → lista → carregando. `lojas` é o que a tela já juntou (as páginas carregadas, em ordem);
 * `undefined` ou `null` = nada chegou ainda. Erro com a lista já na tela (pedido do "Carregar mais") não derruba a lista:
 * vira `falhaAoCarregarMais`, salvo se a lista passou a "não encontrada". `esperaSegundos` é o `Retry-After` do 429
 * (`esperaDoRetryAfter` de `loja.ts`); sem ele, "…em instantes".
 */
export function estadoDaLista(entrada: {
  lojas: LojaDoMarketplace[] | null | undefined;
  erro?: unknown;
  esperaSegundos?: number | null;
}): EstadoDaLista {
  const { lojas, erro } = entrada;
  if (erro !== undefined && erro !== null) {
    const falha = falhaDaLista(erro, entrada.esperaSegundos ?? null);
    if (falha.tipo === 'indisponivel' || !lojas || lojas.length === 0) return falha;
    return { tipo: 'pronta', lojas, falhaAoCarregarMais: falha };
  }
  if (!lojas) return { tipo: 'carregando', texto: TEXTO_CARREGANDO_A_LISTA };
  if (lojas.length === 0) return { tipo: 'vazia', titulo: 'Nenhuma consultoria por aqui ainda', texto: 'Volte mais tarde para ver as consultorias.' };
  return { tipo: 'pronta', lojas, falhaAoCarregarMais: null };
}

// ---- Textos do treinador ----

const lista = NOME_DA_VITRINE_DE_CONSULTORIAS.toLowerCase();

/** Rótulo dos dois interruptores (da consultoria e do item). */
export const ROTULO_DA_LISTA = `Aparece na ${lista}`;

export const AVISO_DE_DEMORA_NA_LISTA = 'Mudanças levam até 1 minuto para aparecer na lista.';

export interface InterruptorDaLista {
  /** A chave da plataforma está ligada (`marketplaceHabilitado` da sessão); sem ela o interruptor some, mas o corpo continua levando o valor que veio da API. */
  visivel: boolean;
  /** Falso: não dá para ligar (o `motivo` explica). */
  habilitado: boolean;
  motivo: string | null;
  rotulo: string;
  /** O que o interruptor faz e o que a lista exige, sempre visível. */
  explicacao: string;
  /** Com o interruptor ligado mas sem aparecer na lista, o porquê; `null` = vai aparecer (depois do minuto do cache). */
  semEfeito: string | null;
}

/**
 * Interruptor da consultoria (cartão da página pública). Nunca fica travado: o PUT aceita ligar com a página desligada, e travar
 * prenderia quem ligou antes. `pagina` nulo = ainda não carregou: tratado como sem configuração.
 */
export function interruptorDaListaDaConsultoria(pagina: PaginaDaVitrine | null | undefined, marketplaceHabilitado: boolean): InterruptorDaLista {
  const paginaNoAr = !!pagina?.paginaLigada && !!pagina.codigo;
  return {
    visivel: marketplaceHabilitado,
    habilitado: true,
    motivo: null,
    rotulo: ROTULO_DA_LISTA,
    explicacao: `Mostra a sua consultoria e os itens digitais que você marcar na ${lista}. Precisa da página pública ligada. A compra continua na sua página. ${AVISO_DE_DEMORA_NA_LISTA}`,
    semEfeito: pagina?.noMarketplace && !paginaNoAr ? 'Sem efeito enquanto a página pública estiver desligada.' : null,
  };
}

/**
 * Interruptor do item (Folha do item). Só o item digital pode ser marcado (`motivo`); para aparecer ele também precisa estar ativo,
 * estar na página pública e a consultoria participar da lista (`consultoriaNaLista` = `noMarketplace` da configuração). O
 * rascunho vem da tela, então o aviso acompanha o que a pessoa acabou de mexer.
 */
export function interruptorDoItemNaLista(
  r: Pick<RascunhoDoItem, 'tipo' | 'ativo' | 'naPaginaPublica' | 'noMarketplace'>,
  marketplaceHabilitado: boolean,
  consultoriaNaLista: boolean,
): InterruptorDaLista {
  const digital = r.tipo === 'DIGITAL';
  let semEfeito: string | null = null;
  if (r.noMarketplace && digital) {
    if (!r.ativo) semEfeito = 'Sem efeito enquanto o item estiver inativo.';
    else if (!r.naPaginaPublica) semEfeito = 'Sem efeito enquanto o item não aparecer na página pública.';
    else if (!consultoriaNaLista) semEfeito = `Sem efeito enquanto a consultoria não aparecer na ${lista}.`;
  }
  return {
    visivel: marketplaceHabilitado,
    habilitado: digital,
    motivo: digital ? null : MOTIVO_SO_DIGITAL_NA_LISTA,
    rotulo: ROTULO_DA_LISTA,
    explicacao: `Mostra este item na ${lista}. Só aparece se for digital, estiver ativo e estiver na página pública. ${AVISO_DE_DEMORA_NA_LISTA}`,
    semEfeito,
  };
}
