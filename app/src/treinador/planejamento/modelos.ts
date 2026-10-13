import type { Configuracao, TipoReceita } from '../../api/tipos';
import { normalizarDieta, novaRefeicao } from '../../dominio/dieta';
import { normalizarTreino, novaSerie, novaSessao } from '../../dominio/editorTreino';
import { mobilidadeParaApi, normalizarMobilidade } from '../../dominio/mobilidade';

/**
 * Tipos de modelo do Planejamento (só apresentação; o enum `TipoReceita` e a API não mudam). A descrição diz onde a peça
 * é usada. Mapas por tipo são `Record<TipoReceita, …>` para o compilador apontar tipo novo esquecido.
 */
const INFORMACOES: Record<TipoReceita, { rotulo: string; descricao: string }> = {
  PLANO_TREINO: { rotulo: 'Semanas de treino', descricao: 'A semana inteira de treino. Aplicada ao aluno, vira o treino de uma pasta dele.' },
  SESSAO_TREINO: { rotulo: 'Dias de treino', descricao: 'Um dia de treino pronto, com exercícios e séries. Entra numa semana pelo editor de treino.' },
  SERIES: { rotulo: 'Receitas de séries', descricao: 'Estrutura de séries (tipos, faixas e intensidade). Entra num exercício pelo editor de treino.' },
  METODOLOGIA: { rotulo: 'Metodologias', descricao: 'Regras de séries e preparação. É vinculada à semana na configuração do editor de treino.' },
  PLANO_DIETA: { rotulo: 'Dietas', descricao: 'A dieta inteira, com refeições, opções e itens. Aplicada ao aluno, vira a dieta de uma pasta dele.' },
  REFEICAO: { rotulo: 'Refeições', descricao: 'Uma refeição pronta. Entra numa dieta pelo editor de dieta.' },
  PASTA_PLANO: { rotulo: 'Pacotes (treino, dieta e mobilidade)', descricao: 'Treinos, dietas e mobilidade de um período. Aplicado ao aluno, cria a pasta dele com tudo de uma vez.' },
  MOBILIDADE: { rotulo: 'Mobilidade', descricao: 'Sequências de alongamento e mobilidade, com vídeo. Aplicada ao aluno, vira a mobilidade de uma pasta dele.' },
};

/** Abas agrupadas: Treino, Dieta, Pacotes e Mobilidade (no celular, cada grupo rola na horizontal). */
export const GRUPOS_DE_MODELOS: { rotulo: string; tipos: TipoReceita[] }[] = [
  { rotulo: 'Treino', tipos: ['PLANO_TREINO', 'SESSAO_TREINO', 'SERIES', 'METODOLOGIA'] },
  { rotulo: 'Dieta', tipos: ['PLANO_DIETA', 'REFEICAO'] },
  { rotulo: 'Pacotes', tipos: ['PASTA_PLANO'] },
  { rotulo: 'Mobilidade', tipos: ['MOBILIDADE'] },
];

/** A aba dos questionários mora no Planejamento ao lado dos grupos de modelos. */
export const ABA_ATUALIZACAO = 'Atualização';

/** Valor de `?aba=` de uma aba do Planejamento: o rótulo sem acento nem maiúscula (`treino`, `dieta`, `atualizacao`). */
export const slugDaAba = (rotulo: string): string => rotulo.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase();

/**
 * Aba aberta pelo endereço (`?aba=`). A aba é um passo do histórico, então o voltar a desfaz. Só entram as abas que o
 * perfil pode ver (modelos com `MODELO_LER`, Atualização com `QUESTIONARIO_LER`); sem parâmetro ou com um que não vale,
 * abre a primeira.
 */
export function abaDoPlanejamento(parametro: string | string[] | undefined, veModelos: boolean, veAtualizacao: boolean): string {
  const rotulos = [...(veModelos ? GRUPOS_DE_MODELOS.map((g) => g.rotulo) : []), ...(veAtualizacao ? [ABA_ATUALIZACAO] : [])];
  const pedida = Array.isArray(parametro) ? parametro[0] : parametro;
  return rotulos.find((r) => slugDaAba(r) === pedida) ?? rotulos[0] ?? GRUPOS_DE_MODELOS[0].rotulo;
}

export const CATEGORIAS: { valor: TipoReceita; rotulo: string; descricao: string }[] =
  GRUPOS_DE_MODELOS.flatMap((g) => g.tipos.map((valor) => ({ valor, ...INFORMACOES[valor] })));

const USO: Record<TipoReceita, { aplicavel: boolean; linha: string | null }> = {
  PLANO_TREINO: { aplicavel: true, linha: null },
  PLANO_DIETA: { aplicavel: true, linha: null },
  PASTA_PLANO: { aplicavel: true, linha: null },
  SESSAO_TREINO: { aplicavel: false, linha: 'Use dentro do editor de treino: "Adicionar treino do modelo".' },
  SERIES: { aplicavel: false, linha: 'Use dentro do editor de treino: "Usar receita" em cada exercício.' },
  METODOLOGIA: { aplicavel: false, linha: 'Use dentro do editor de treino: "Vincular" na configuração do plano.' },
  REFEICAO: { aplicavel: false, linha: 'Use dentro do editor de dieta, ao acrescentar uma refeição.' },
  MOBILIDADE: { aplicavel: true, linha: null },
};

/** Semanas, dietas e pacotes são aplicados ao aluno; as peças entram dentro dos editores. */
export const usoDoModelo = (tipo: TipoReceita) => USO[tipo];

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
