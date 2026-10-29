import type { InscricaoDetalhe } from '../../api/inscricoesTipos';

/**
 * Ação da folha da inscrição que devolve o detalhe novo: `tipo` marca o botão em andamento, `sucesso` é o aviso e
 * `depois` roda só se deu certo (fechar o formulário). Erros (conflito de versão, plano, outros) a folha trata num
 * lugar só, e resposta que chega com outra inscrição aberta não mexe na tela.
 */
export type Executar = (tipo: string, acao: () => Promise<InscricaoDetalhe>, sucesso: string, depois?: () => void) => void;
