import { codigoApi, ErroApi, errosPorCampo, mensagemApi } from '@plataforma/web';

import type { DadosDaPagina, ItemDaLojaPublica, LojaPublica, PaginaDaVitrine } from '../api/vitrineTipos';
import type { PlataformaDoApp } from './financeiro';
import { linkParaAbrir } from './links';
import { ehLojaDesligada } from './lojaDesligada';
import { ehVitrineDesligada } from './vitrineDesligada';
import { comoMostrarItem, textoDoPreco, type TextoDoPreco } from './vitrine';

/**
 * Página pública da loja (F2a de `docs/planos/vitrine-e-loja.md`): o link, o que a página mostra por item e por plataforma
 * (D6, reaproveitando `comoMostrarItem`), os estados da página e a configuração do treinador. Sem frase de pagamento e
 * sem promessa de venda: o botão só abre o link que o treinador cadastrou no item.
 */

// ---- Link e código ----

/** Origem pública do app, a do `APP_URL` de produção: o app não tem outra fonte (o link da inscrição vem pronto da API; o desta página a API só manda o código). */
export const ORIGEM_PUBLICA_DO_APP = 'https://overtraining.app';

/** `APP_URL/loja/<codigo>`. */
export const linkDaLoja = (codigo: string, origem: string = ORIGEM_PUBLICA_DO_APP): string => `${origem.replace(/\/+$/, '')}/loja/${codigo}`;

/** O mesmo formato do código de inscrição (`CodigoDeInscricao`: base64 url-safe, 12 a 64 caracteres). */
const FORMATO_DO_CODIGO = /^[A-Za-z0-9_-]{12,64}$/;

/**
 * Código do parâmetro da rota `/loja/[codigo]`, conferido antes de qualquer requisição: malformado (ou repetido, o
 * Expo Router devolve lista) = `null`, que a tela trata como "não encontrada" sem chamar a API.
 */
export function codigoDaLoja(param: string | string[] | null | undefined): string | null {
  if (typeof param !== 'string') return null;
  const codigo = param.trim();
  return FORMATO_DO_CODIGO.test(codigo) ? codigo : null;
}

// ---- O que a página mostra de cada item ----

export const ROTULO_DO_BOTAO = 'Comprar';

export interface ItemDaLojaParaMostrar {
  id: string;
  nome: string;
  descricao: string | null;
  /** Mostrar a foto (o item tem e a plataforma deixa); a imagem vem de `caminhoDaFotoDaLoja(codigo, id, fotoAtualizadaEm)`. */
  foto: boolean;
  fotoAtualizadaEm: string | null;
  /** Nulo no celular (D6) ou sem preço: a página não mostra nem "—". */
  preco: TextoDoPreco | null;
  /** Nulo no celular (D6) ou sem cupom. */
  cupom: string | null;
  /** Link https já conferido, ou nulo (celular, sem link ou link inválido: sem botão). */
  linkUrl: string | null;
}

/**
 * O item da página pública nesta plataforma. Todo item da página é DIGITAL (a API só manda esses), então no celular
 * sobram foto, nome e descrição; na web, também preço (o vigente, com o especial e o prazo), cupom e o botão do link.
 */
export function itemDaLojaParaMostrar(item: ItemDaLojaPublica, plataforma: PlataformaDoApp): ItemDaLojaParaMostrar {
  const como = comoMostrarItem('DIGITAL', plataforma);
  const cupom = item.cupom?.trim() || null;
  return {
    id: item.id,
    nome: item.nome,
    descricao: como.descricao ? item.descricao?.trim() || null : null,
    foto: como.foto && item.temFoto,
    fotoAtualizadaEm: item.fotoAtualizadaEm,
    preco: como.preco && item.precoVigenteCentavos != null ? textoDoPreco(item) : null,
    cupom: como.cupom ? cupom : null,
    linkUrl: como.link ? linkParaAbrir(item.linkUrl) : null,
  };
}

// ---- Estados da página ----

export interface TextosDoEstado { titulo: string; texto: string }

export type EstadoDaLoja =
  | { tipo: 'carregando'; texto: string }
  | ({ tipo: 'nao_encontrada' } & TextosDoEstado)
  | ({ tipo: 'muitas_tentativas'; esperaSegundos: number | null; podeTentarDeNovo: true } & TextosDoEstado)
  | ({ tipo: 'erro_de_rede'; podeTentarDeNovo: true } & TextosDoEstado)
  | ({ tipo: 'erro'; podeTentarDeNovo: true } & TextosDoEstado)
  | ({ tipo: 'vazia'; loja: LojaPublica } & TextosDoEstado)
  | { tipo: 'pronta'; loja: LojaPublica };

export const TEXTO_CARREGANDO_A_LOJA = 'Carregando a página…';
export const ROTULO_TENTAR_DE_NOVO = 'Tentar de novo';
/** A mesma frase da API para código inexistente, malformado, página desligada e vitrine desligada: nada distingue um do outro. */
const NAO_ENCONTRADA: TextosDoEstado = { titulo: 'Página não encontrada.', texto: 'O endereço pode estar errado ou a página não está disponível.' };

/** `Retry-After` (segundos inteiros ou data HTTP) em segundos de espera, pelo menos 1; ilegível ou ausente = `null`. */
export function esperaDoRetryAfter(valor: string | null | undefined, agora: number = Date.now()): number | null {
  const texto = valor?.trim();
  if (!texto) return null;
  if (/^\d+$/.test(texto)) return Math.max(1, Number(texto));
  const data = Date.parse(texto);
  return Number.isNaN(data) ? null : Math.max(1, Math.ceil((data - agora) / 1000));
}

/** "Tente de novo em 30 segundos." / "…em 2 minutos." / sem o tempo, "…em instantes." */
export function textoDaEspera(segundos: number | null): string {
  if (segundos === null) return 'Tente de novo em instantes.';
  if (segundos < 60) return `Tente de novo em ${segundos} ${segundos === 1 ? 'segundo' : 'segundos'}.`;
  const minutos = Math.ceil(segundos / 60);
  return `Tente de novo em ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}.`;
}

/**
 * O que a tela mostra, na ordem: código malformado (sem requisição) → erro → lista → carregando. `esperaSegundos` é o
 * `Retry-After` do 429, que o cliente da API ainda não repassa (a tela passa `null`: "…em instantes").
 */
export function estadoDaLoja(entrada: {
  codigo: string | null;
  loja: LojaPublica | null | undefined;
  erro?: unknown;
  esperaSegundos?: number | null;
}): EstadoDaLoja {
  if (entrada.codigo === null) return { tipo: 'nao_encontrada', ...NAO_ENCONTRADA };
  const { erro, loja } = entrada;
  if (erro !== undefined && erro !== null) {
    // 503 `LOJA_INDISPONIVEL` (chave desligada) é o mesmo "não encontrada": o visitante não fica sabendo que existe uma chave.
    if (ehLojaDesligada(erro) || (erro instanceof ErroApi && erro.status === 404)) return { tipo: 'nao_encontrada', ...NAO_ENCONTRADA };
    if (erro instanceof ErroApi && erro.status === 429) {
      const esperaSegundos = entrada.esperaSegundos ?? null;
      return { tipo: 'muitas_tentativas', esperaSegundos, podeTentarDeNovo: true, titulo: 'Muitas tentativas', texto: textoDaEspera(esperaSegundos) };
    }
    if (erro instanceof ErroApi && erro.semConexao) {
      return { tipo: 'erro_de_rede', podeTentarDeNovo: true, titulo: 'Sem conexão', texto: 'Confira a internet e tente de novo.' };
    }
    return { tipo: 'erro', podeTentarDeNovo: true, titulo: 'Não foi possível abrir a página', texto: 'Tente de novo.' };
  }
  if (!loja) return { tipo: 'carregando', texto: TEXTO_CARREGANDO_A_LOJA };
  if (loja.itens.length === 0) return { tipo: 'vazia', loja, titulo: 'Nenhum item por aqui', texto: 'Esta página ainda não tem itens.' };
  return { tipo: 'pronta', loja };
}

// ---- Configuração da página (treinador) ----

export type SituacaoDaPagina = 'SEM_LINK' | 'DESLIGADA' | 'LIGADA';

export interface TextoDaPagina {
  situacao: SituacaoDaPagina;
  /** Curto, para o selo ou o título do cartão. */
  rotulo: string;
  descricao: string;
  /** O link para copiar e abrir; nulo sem código. Com a página desligada ele existe, mas dá "Página não encontrada.". */
  link: string | null;
}

/** `pagina` nulo = ainda não carregou ou a API não devolveu: tratado como sem configuração. */
export function textoDaPagina(pagina: PaginaDaVitrine | null | undefined): TextoDaPagina {
  if (!pagina?.codigo) {
    return { situacao: 'SEM_LINK', rotulo: 'Sem link ainda', descricao: 'O link aparece quando você ligar a página.', link: null };
  }
  const link = linkDaLoja(pagina.codigo);
  return pagina.paginaLigada
    ? { situacao: 'LIGADA', rotulo: 'Ligada', descricao: 'Quem tem o link vê os itens digitais marcados para a página.', link }
    : { situacao: 'DESLIGADA', rotulo: 'Desligada', descricao: 'Quem abrir o link vê "Página não encontrada.".', link };
}

/** Corpo do `PUT`: a `versao` que a tela leu (nula só enquanto não há configuração). */
export const corpoDaPagina = (paginaLigada: boolean, pagina: PaginaDaVitrine | null | undefined): DadosDaPagina => ({
  paginaLigada, versao: pagina?.versao ?? null,
});

/** Novo link só com configuração gravada (precisa da versão); devolve a `versao` a enviar no `POST .../novo-link`. */
export function novoLinkDaPagina(pagina: PaginaDaVitrine | null | undefined): { pode: boolean; versao: number | null; motivo: string | null } {
  return pagina?.codigo && pagina.versao != null
    ? { pode: true, versao: pagina.versao, motivo: null }
    : { pode: false, versao: null, motivo: 'Ligue a página para gerar o link.' };
}

/** O aviso aos treinadores antes de gerar outro link: o antigo deixa de funcionar. */
export const AVISO_DO_NOVO_LINK = 'O link atual deixa de funcionar. Quem o tiver vai ver "Página não encontrada.".';

export interface ErroDaPagina {
  mensagem: string;
  /** A tela busca a configuração de novo (409): o que ela tinha estava velho. */
  recarregar: boolean;
}

export const MENSAGEM_PAGINA_ALTERADA = 'A página foi alterada em outro lugar. Recarregamos para você conferir.';
export const MENSAGEM_PADRAO_DA_PAGINA = 'Não foi possível salvar a página. Tente de novo.';

/**
 * Erro de gravar a configuração ou gerar o link: 409 `CONFLITO_EDICAO` recarrega com aviso; 422 `VITRINE_PAGINA_INVALIDA`
 * mostra o texto da API (no campo `paginaLigada`); vitrine desligada na plataforma (503 `VITRINE_INDISPONIVEL`, que o cliente
 * já trata escondendo a vitrine), sem conexão e sem permissão (403) e loja desligada (503 `LOJA_INDISPONIVEL`) mostram o que a API disse; o resto, a frase padrão.
 */
export function traduzirErroDaPagina(erro: unknown): ErroDaPagina {
  const codigo = codigoApi(erro);
  if (codigo === 'CONFLITO_EDICAO') return { mensagem: MENSAGEM_PAGINA_ALTERADA, recarregar: true };
  if (codigo === 'VITRINE_PAGINA_INVALIDA') {
    return { mensagem: errosPorCampo(erro).paginaLigada ?? mensagemApi(erro, MENSAGEM_PADRAO_DA_PAGINA), recarregar: false };
  }
  const daApi = ehVitrineDesligada(erro) || ehLojaDesligada(erro) || (erro instanceof ErroApi && (erro.semConexao || erro.status === 403));
  return { mensagem: daApi ? mensagemApi(erro, MENSAGEM_PADRAO_DA_PAGINA) : MENSAGEM_PADRAO_DA_PAGINA, recarregar: false };
}
