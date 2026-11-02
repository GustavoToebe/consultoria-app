import { listarPlanos } from '../api/rotas';
import type { PlanoResumo, TipoPlano } from '../api/tipos';
import { PERMISSOES_DO_PLANO } from '../dominio/permissoes';
import { planosDaPasta, type PlanosDaPasta } from '../dominio/publicarPasta';
import { useSessao } from '../sessao/SessaoProvider';
import { useCarregar } from '../ui/useCarregar';

/** O carregamento dos planos de um tipo (o mesmo formato do `useCarregar`), repassado ao `CartaoPlanos`. */
export type CargaDosPlanos = ReturnType<typeof useCarregar<PlanoResumo[]>>;

/**
 * Planos do aluno por tipo, carregados uma vez para a Folha da pasta: o `CartaoPlanos` de cada tipo mostra a lista, o
 * "Publicar tudo" sabe quais têm alteração e a cópia sabe quais tipos estão na pasta. Só busca o tipo que a pessoa lê
 * (o resto fica desconhecido e a API decide) e só enquanto `pastaId` existe. `geracao` muda depois de publicar, renovar
 * ou mudar o período: as listas buscam de novo.
 */
export function usePlanosDaPasta(alunoId: string, pastaId: string | null, geracao: number) {
  const { pode, temFuncionalidade } = useSessao();
  const chave = (tipo: TipoPlano) => (pastaId && pode(PERMISSOES_DO_PLANO[tipo].ler) ? `${tipo}:${alunoId}:${geracao}` : null);
  const treino = useCarregar(chave('treino'), () => listarPlanos('treino', alunoId));
  const dieta = useCarregar(chave('dieta'), () => listarPlanos('dieta', alunoId));
  const mobilidade = useCarregar(chave('mobilidade'), () => listarPlanos('mobilidade', alunoId));
  const cargas: Record<TipoPlano, CargaDosPlanos> = { treino, dieta, mobilidade };
  // Lista que falhou ou ainda não chegou conta como desconhecida (nunca como "sem planos"); ao recarregar, vale a anterior.
  const conhecida = (c: CargaDosPlanos) => (c.erro ? null : c.dados ?? null);
  const planos: PlanosDaPasta | null = pastaId
    ? planosDaPasta(pastaId, { treino: conhecida(treino), dieta: conhecida(dieta), mobilidade: conhecida(mobilidade) }, temFuncionalidade('MOBILIDADE'))
    : null;
  /** Primeira carga de algum tipo ainda a caminho: a tela espera antes de liberar o que depende dela. */
  const carregando = Object.values(cargas).some((c) => c.carregando && !c.dados);
  return { cargas, planos, carregando };
}
