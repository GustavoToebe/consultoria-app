import { useEffect, useState } from 'react';

import { ErroApi } from '../../api/cliente';
import { dietaAluno } from '../../api/rotas';
import type { Atualizacao, ConteudoDieta, ItensDisponiveis, VersaoDetalhe } from '../../api/tipos';
import { hojeIso } from '../../dominio/formatos';
import { fontesDoQuestionario, itensDoQuestionario } from '../../dominio/itensDoPlano';
import { useAluno } from '../../offline/AlunoProvider';

type Dieta = VersaoDetalhe<ConteudoDieta> | null;

/**
 * Lista de cada fonte das perguntas ITENS_DO_PLANO da atualização, montada no aparelho (funciona sem internet): o treino do
 * pacote salvo, os registros (aparelho e servidor fundidos, menos os recusados, que o servidor não tem) e a dieta (só se
 * alguma pergunta usa os alimentos: busca e guarda; sem conexão, a última vista).
 */
export function useItensDaAtualizacao(atualizacao: Pick<Atualizacao, 'modelo' | 'dataAtualizacao'>): ItensDisponiveis {
  const { pacote, registros, repositorio, online } = useAluno();
  const modelo = atualizacao.modelo;
  const precisaDieta = !!modelo && fontesDoQuestionario(modelo).includes('ALIMENTOS_DA_DIETA');
  const [dieta, setDieta] = useState<Dieta>(null);
  useEffect(() => {
    if (!precisaDieta) return;
    let vivo = true;
    (async (): Promise<Dieta> => {
      if (online) {
        try {
          const { dieta: nova } = await dietaAluno();
          if (nova) await repositorio.salvarDieta(nova).catch(() => undefined);
          return nova;
        } catch (e) {
          if (!(e instanceof ErroApi && e.semConexao)) return repositorio.lerDieta().catch(() => null);
        }
      }
      return repositorio.lerDieta().catch(() => null);
    })().then((d) => { if (vivo) setDieta(d); }, () => undefined);
    return () => { vivo = false; };
  }, [precisaDieta, online, repositorio]);
  if (!modelo) return {};
  return itensDoQuestionario(modelo, {
    treino: pacote?.pacote.treino ?? null,
    dieta,
    registros: registros.filter((r) => r.situacao !== 'FALHOU'),
    dataDaAtualizacao: atualizacao.dataAtualizacao ?? hojeIso(),
  });
}
