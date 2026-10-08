import type { Configuracao, TipoReceita } from '../../api/tipos';
import { normalizarDieta, novaRefeicao } from '../../dominio/dieta';
import { normalizarTreino, novaSerie, novaSessao } from '../../dominio/editorTreino';
import { mobilidadeParaApi, normalizarMobilidade } from '../../dominio/mobilidade';

export const CATEGORIAS: { valor: TipoReceita; rotulo: string; descricao: string }[] = [
  { valor: 'METODOLOGIA', rotulo: 'Metodologias', descricao: 'Regras de séries e preparação que acompanham uma semana de treino.' },
  { valor: 'SERIES', rotulo: 'Séries', descricao: 'Estrutura de séries (tipos, faixas e intensidade) para reutilizar em exercícios.' },
  { valor: 'SESSAO_TREINO', rotulo: 'Treinos / sessões', descricao: 'Um dia de treino pronto para acrescentar a qualquer plano.' },
  { valor: 'PLANO_TREINO', rotulo: 'Semanas de treino', descricao: 'A semana inteira de treino, com sessões, exercícios e séries.' },
  { valor: 'PLANO_DIETA', rotulo: 'Dietas', descricao: 'A dieta inteira, com refeições, opções e itens.' },
  { valor: 'REFEICAO', rotulo: 'Refeições / seções', descricao: 'Uma refeição ou seção pronta para acrescentar a uma dieta.' },
  { valor: 'PASTA_PLANO', rotulo: 'Pastas de plano', descricao: 'Treinos e dietas de um período, para aplicar de uma vez a um aluno.' },
  { valor: 'MOBILIDADE', rotulo: 'Mobilidade / alongamento', descricao: 'Sequências de alongamento e mobilidade, com vídeo.' },
];

export function conteudoInicial(tipo: TipoReceita, config: Configuracao): unknown {
  switch (tipo) {
    case 'METODOLOGIA': return JSON.parse(JSON.stringify(config));
    case 'SERIES': return { series: [novaSerie(config)] };
    case 'SESSAO_TREINO': return { ...normalizarTreino(null), sessoes: [novaSessao(null)] };
    case 'PLANO_TREINO': return normalizarTreino(null);
    case 'PLANO_DIETA': return normalizarDieta(null);
    case 'REFEICAO': return { ...normalizarDieta(null), refeicoes: [novaRefeicao()] };
    case 'PASTA_PLANO': return { planos: [] };
    case 'MOBILIDADE': return mobilidadeParaApi(normalizarMobilidade(null));
  }
}
