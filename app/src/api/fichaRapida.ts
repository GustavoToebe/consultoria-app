import { requisicao } from './cliente';
import type {
  AceiteInscricao,
  CampoDaInscricao,
  ConfiguracaoInscricao,
  ConfiguracaoInscricaoRequest,
  LinkDeInscricao,
} from './inscricoesTipos';

const seg = (v: string | number) => encodeURIComponent(String(v));

/** Lista todos os links públicos de inscrição da consultoria (padrão e extras, como a Ficha rápida). */
export const listarLinksDeInscricao = () => requisicao<LinkDeInscricao[]>('/inscricoes/links');

/** Cria a Ficha rápida (segundo link público curto pós-WhatsApp). */
export const criarFichaRapida = (nome?: string) =>
  requisicao<LinkDeInscricao>('/inscricoes/links/ficha-rapida', {
    metodo: 'POST',
    corpo: nome ? { nome } : {},
  });

/** Configuração do link público de um questionário de inscrição específico. */
export const configuracaoLinkQuestionario = (id: string) =>
  requisicao<ConfiguracaoInscricao>(`/questionarios/${seg(id)}/link`);

/** Salva abertura, responsável padrão e texto do link público de um questionário de inscrição específico. */
export const alterarConfiguracaoLinkQuestionario = (id: string, corpo: ConfiguracaoInscricaoRequest) =>
  requisicao<ConfiguracaoInscricao>(`/questionarios/${seg(id)}/link`, { metodo: 'PUT', corpo });

/** Salva os campos fixos ocultos de um questionário de inscrição específico. */
export const esconderCamposDoLinkQuestionario = (id: string, camposOcultos: CampoDaInscricao[], versao: number) =>
  requisicao<ConfiguracaoInscricao>(`/questionarios/${seg(id)}/link/campos-ocultos`, {
    metodo: 'PUT',
    corpo: { camposOcultos, versao },
  });

/** Gera um novo código público para um questionário de inscrição específico (o anterior para de funcionar). */
export const novoLinkQuestionario = (id: string, versao: number) =>
  requisicao<ConfiguracaoInscricao>(`/questionarios/${seg(id)}/link/novo-link`, {
    metodo: 'POST',
    corpo: { versao },
  });

/** Aceita a inscrição cadastrando o aluno; `semCobranca: true` registra aceite como cortesia sem pagamento confirmado. */
export const aceitarInscricaoComPagamento = (
  id: string,
  dados: { convidar: boolean; anamneseQuestionarioId: string | null; versao: number; semCobranca?: boolean },
) =>
  requisicao<AceiteInscricao>(`/inscricoes/${seg(id)}/aceitar`, {
    metodo: 'POST',
    corpo: {
      convidar: dados.convidar,
      anamneseQuestionarioId: dados.anamneseQuestionarioId,
      versao: dados.versao,
      ...(dados.semCobranca ? { semCobranca: true } : {}),
    },
  });
