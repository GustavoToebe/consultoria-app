import type { Configuracao, TipoReceita } from '../../api/tipos';
import { normalizarDieta, novaRefeicao } from '../../dominio/dieta';
import { normalizarTreino, novaSerie, novaSessao } from '../../dominio/editorTreino';
import { mobilidadeParaApi, normalizarMobilidade } from '../../dominio/mobilidade';

export const CATEGORIAS: { valor: TipoReceita; rotulo: string }[] = [
  { valor: 'METODOLOGIA', rotulo: 'Metodologias' }, { valor: 'SERIES', rotulo: 'Séries' },
  { valor: 'SESSAO_TREINO', rotulo: 'Treinos / sessões' }, { valor: 'PLANO_TREINO', rotulo: 'Semanas de treino' },
  { valor: 'PLANO_DIETA', rotulo: 'Dietas' }, { valor: 'REFEICAO', rotulo: 'Refeições / seções' },
  { valor: 'PASTA_PLANO', rotulo: 'Pastas de plano' }, { valor: 'MOBILIDADE', rotulo: 'Mobilidade / alongamento' },
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
