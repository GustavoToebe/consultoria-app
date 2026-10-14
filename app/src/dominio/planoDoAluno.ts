import type { TipoPlano, TipoReceita } from '../api/tipos';

/**
 * Textos que separam o plano do aluno (uma cópia só dele) do modelo do Planejamento (o molde). Só apresentação:
 * a API já copia o modelo ao aplicar e não guarda ligação entre os dois.
 */

const TITULO_DO_PLANO: Record<TipoPlano, { de: string; generico: string }> = {
  treino: { de: 'Treino de', generico: 'Treino do aluno' },
  dieta: { de: 'Dieta de', generico: 'Dieta do aluno' },
  mobilidade: { de: 'Mobilidade de', generico: 'Mobilidade do aluno' },
};

/** "Treino de Ana"; sem o nome à mão, "Treino do aluno". */
export function tituloDoPlanoDoAluno(tipo: TipoPlano, nomeDoAluno: string | null | undefined): string {
  const nome = nomeDoAluno?.trim();
  return nome ? `${TITULO_DO_PLANO[tipo].de} ${nome}` : TITULO_DO_PLANO[tipo].generico;
}

const ESTE: Record<TipoPlano, string> = { treino: 'Este treino', dieta: 'Esta dieta', mobilidade: 'Esta mobilidade' };

export function avisoDoPlanoDoAluno(tipo: TipoPlano): string {
  return `${ESTE[tipo]} é só deste aluno. Mudar aqui não altera o modelo do Planejamento.`;
}

export const AVISO_DO_MODELO = 'Este é um modelo do Planejamento. Mudar aqui não altera os alunos que já receberam uma cópia.';

const TIPO_DO_MODELO: Record<TipoReceita, string> = {
  PLANO_TREINO: 'semana de treino',
  SESSAO_TREINO: 'dia de treino',
  SERIES: 'receita de séries',
  METODOLOGIA: 'metodologia',
  PLANO_DIETA: 'dieta',
  REFEICAO: 'refeição',
  PASTA_PLANO: 'pacote de planos',
  MOBILIDADE: 'mobilidade',
};

/** "Modelo: semana de treino". */
export function tituloDoModelo(tipo: TipoReceita): string {
  return `Modelo: ${TIPO_DO_MODELO[tipo]}`;
}

const EDITAR: Record<TipoPlano, string> = {
  treino: 'Editar treino do aluno',
  dieta: 'Editar dieta do aluno',
  mobilidade: 'Editar mobilidade do aluno',
};

export function rotuloEditarPlano(tipo: TipoPlano): string {
  return EDITAR[tipo];
}

const COPIADO: Record<TipoPlano, string> = { treino: 'Treino copiado', dieta: 'Dieta copiada', mobilidade: 'Mobilidade copiada' };

/** Aviso depois de copiar um plano para outro aluno: vai como rascunho e o plano de origem não muda. */
export function mensagemPlanoCopiado(tipo: TipoPlano, nomeDoAluno: string | null | undefined): string {
  const nome = nomeDoAluno?.trim();
  return `${COPIADO[tipo]} para ${nome || 'o aluno'}, como rascunho. Revise e publique na ficha do aluno.`;
}

/** Ação do aviso de cópia: "Abrir ficha de Ana"; sem nome, "Abrir ficha do aluno". */
export function rotuloAbrirFicha(nomeDoAluno: string | null | undefined): string {
  const nome = nomeDoAluno?.trim();
  return nome ? `Abrir ficha de ${nome}` : 'Abrir ficha do aluno';
}

/** Aviso depois de aplicar um modelo: a cópia é do aluno e o molde não muda. */
export function mensagemCopiaCriada(nomeDoAluno: string | null | undefined): string {
  const nome = nomeDoAluno?.trim();
  return `Cópia criada para ${nome || 'o aluno'}. O modelo continua igual.`;
}
