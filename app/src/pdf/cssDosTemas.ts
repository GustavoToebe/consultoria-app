import { marcaParaTexto } from '../tema/tokens';

/**
 * Cores neutras fixas dos PDFs, usadas pelo `cssDasOpcoes` (o CSS de cada opção, que substituiu o `cssDoTema` dos três temas
 * em 26/11; a paridade ficou travada por hash em `cssDasOpcoes.test.ts`) e pelos geradores da dieta e das cargas. Cor da
 * marca e do destaque nunca entram aqui como valor fixo: vêm de `coresDoDestaque` (`textoSobreCinza`, no fim, só faz a conta
 * do texto de marca sobre estas superfícies).
 */

/** Fundo leve do cabeçalho de tabela do topo `CARTAO` (também usado nas tabelas escuras da dieta nesse estilo). */
export const FUNDO_LEVE = '#F3F4F6';
/** Borda suave dos cartões (`tabelas.estilo` `CARTOES`) e da linha do cabeçalho de tabela leve do `CARTAO`. */
export const BORDA_SUAVE = '#DCDEE3';
/** Linha neutra sob o cabeçalho de tabela do topo `LINHA`: a cor de destaque fica só no título de seção, no topo e no rodapé. */
export const DIVISORIA_NEUTRA = '#C8C8C8';

/**
 * Cinza do macro por item da dieta (`.item .macros`): 5,74:1 sobre o branco e 5,22:1 sobre o `FUNDO_LEVE`, a superfície
 * neutra mais escura em que o texto cai (o `#777` de antes dava 4,48:1 sobre o branco; D7, 26/11).
 */
export const CINZA_DO_TEXTO_FRACO = '#666666';

/**
 * A cor da marca ou do destaque como TEXTO que pode cair sobre superfície neutra (linha listrada, cabeçalho leve, cartão): a
 * mesma conta de `corDeTextoDaMarca`, só que medida contra o `FUNDO_LEVE` (o mais escuro desses fundos) e não contra o
 * branco; passando ali, passa em todos (link e valor em tabela listrada ficavam em ~4,3:1 com a marca perto do limite).
 */
export const textoSobreCinza = (cor: string): string => marcaParaTexto(cor, FUNDO_LEVE);
