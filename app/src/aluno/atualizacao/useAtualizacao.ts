import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { atualizacaoAluno, detalheAtualizacaoAluno } from '../../api/rotas';
import { ErroApi } from '../../api/cliente';
import { faseAtualizacao } from '../../dominio/atualizacao';
import { hojeIso } from '../../dominio/formatos';
import { useAluno } from '../../offline/AlunoProvider';
import { useCarregar } from '../../ui/useCarregar';

/** Uma cópia do próprio aluno permite ler o modelo e continuar o rascunho sem rede. */
export function useAtualizacao(id?: string) {
  const {repositorio,online}=useAluno();
  const resultado=useCarregar(`atualizacao:${id??'atual'}:${online}:${hojeIso()}`,async()=>{
    const salva=await repositorio.lerAtualizacao();
    let atual=salva && (!id || salva.id===id) ? salva : null;
    if (online) {
      try {
        atual=id ? await detalheAtualizacaoAluno(id) : await atualizacaoAluno();
        if (!id) await repositorio.salvarAtualizacao(atual);
      } catch (erro) { if (!(erro instanceof ErroApi && erro.semConexao && atual)) throw erro; }
    }
    if (!atual) throw new Error('Conecte-se uma vez para baixar sua atualização.');
    return {...atual,...faseAtualizacao(hojeIso(),atual.dataAtualizacao,atual.atrasoAte,atual.fase)};
  });
  const {recarregar}=resultado;
  useFocusEffect(useCallback(()=>{recarregar();},[recarregar]));
  return resultado;
}
