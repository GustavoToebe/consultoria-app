import { vitrineDoAluno } from '../../api/rotas';
import { useAluno } from '../../offline/AlunoProvider';
import { useSessao } from '../../sessao/SessaoProvider';
import { useCarregar } from '../../ui/useCarregar';

/**
 * Itens ativos da vitrine, só com a chave ligada e internet (nada da vitrine fica no aparelho). Com a chave desligada,
 * inclusive pelo 503 `VITRINE_INDISPONIVEL` no meio do caminho, não busca e não devolve nada: quem usa some.
 */
export function useVitrineDoAluno() {
  const { vitrineHabilitada, usuario } = useSessao();
  const { online } = useAluno();
  const chave = vitrineHabilitada && online && usuario ? `vitrine-do-aluno:${usuario.id}` : null;
  const lista = useCarregar(chave, () => vitrineDoAluno());
  return { ...lista, dados: chave ? lista.dados : undefined, erro: chave ? lista.erro : undefined, vitrineHabilitada, online };
}
