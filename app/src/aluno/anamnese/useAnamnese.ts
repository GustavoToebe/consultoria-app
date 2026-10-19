import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { ErroApi } from '../../api/cliente';
import { anamneseDoAlunoLogado } from '../../api/rotas';
import type { AnamneseDetalhe } from '../../api/tipos';
import { useAluno } from '../../offline/AlunoProvider';
import { useCarregar } from '../../ui/useCarregar';

/**
 * A anamnese do aluno (a pendente ou a última enviada). Online, pergunta à API e guarda uma cópia no aparelho, para
 * continuar respondendo sem internet; 404 = nenhuma (e a cópia sai). Sem conexão, usa a cópia.
 */
export function useAnamnese() {
  const { repositorio, online } = useAluno();
  const resultado = useCarregar<AnamneseDetalhe | null>(`anamnese:${online}`, async () => {
    if (online) {
      try {
        const atual = await anamneseDoAlunoLogado();
        await repositorio.salvarAnamnese(atual);
        return atual;
      } catch (erro) {
        if (erro instanceof ErroApi && erro.status === 404) {
          await repositorio.salvarAnamnese(null);
          return null;
        }
        if (!(erro instanceof ErroApi && erro.semConexao)) throw erro;
      }
    }
    return repositorio.lerAnamnese();
  });
  const { recarregar } = resultado;
  useFocusEffect(useCallback(() => { recarregar(); }, [recarregar]));
  return resultado;
}
