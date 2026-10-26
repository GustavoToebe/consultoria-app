import { cicloDaAluna } from '../api/rotas';
import { useAluno } from '../offline/AlunoProvider';
import { useCarregar } from '../ui/useCarregar';

/** O ciclo não fica no aparelho. Sem internet a chave é nula e a tela diz que precisa de conexão. */
export function useCicloDaAluna() {
  const { online } = useAluno();
  const carga = useCarregar(online ? 'aluno-ciclo' : null, () => cicloDaAluna());
  return { ...carga, online };
}
