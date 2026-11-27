import { prescricaoDaAtualizacao } from '../../api/rotas';
import type { Atualizacao, VersaoDetalhe } from '../../api/tipos';
import { useCarregar } from '../../ui/useCarregar';

/**
 * O único acesso da revisão à prescrição de um tipo (treino ou dieta) da pasta desta atualização: a versão que o aluno via
 * no envio (`GET /atualizacoes/{id}/prescricao/{tipo}`; sem envio, a de agora). `null` = nada publicado na pasta até lá.
 * A chave leva o id da atualização: o "Próxima" não reaproveita a prescrição de outra.
 */
export function usePrescricaoDaEpoca(a: Pick<Atualizacao, 'id' | 'pastaId'>, tipo: 'treino' | 'dieta' | null) {
  const { id, pastaId } = a;
  return useCarregar<VersaoDetalhe<unknown> | null>(tipo && id && pastaId ? `prescrito:${tipo}:${id}` : null,
    async () => (await prescricaoDaAtualizacao<unknown>(id!, tipo!)).versao ?? null);
}
