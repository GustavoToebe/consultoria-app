import { useMemo } from 'react';

import { hojeIso } from '../dominio/formatos';
import { juntarConclusoes, montarMapa } from '../dominio/mapaDeTreinos';
import { useAluno } from '../offline/AlunoProvider';
import { useSessao } from '../sessao/SessaoProvider';

/**
 * Mapa de treinos do aluno: os 12 meses que o `AlunoProvider` já leu da API (uma leitura só para o app todo, sem chamada
 * própria aqui) mais as conclusões ainda só do aparelho. Dentro do `AlunoProvider`. Com `retornoHabilitado` falso
 * (`visivel` falso) a tela não mostra o mapa. Falha de rede ou o 503 `RETORNO_INDISPONIVEL` nunca vira erro: o provedor
 * dá a leitura por feita e fica o que há no aparelho (a fila local, últimos 60 dias) ou vazio.
 */
export function useMapaDeTreinos(hoje: string = hojeIso()) {
  const { retornoHabilitado } = useSessao();
  const { sessoesConcluidasNoAparelho, conclusoesDoServidor, conclusoesDoServidorLidas } = useAluno();

  const mapa = useMemo(
    () => montarMapa(juntarConclusoes(retornoHabilitado ? conclusoesDoServidor : [], sessoesConcluidasNoAparelho), hoje),
    [retornoHabilitado, conclusoesDoServidor, sessoesConcluidasNoAparelho, hoje],
  );
  return { visivel: retornoHabilitado, carregando: retornoHabilitado && !conclusoesDoServidorLidas, mapa };
}
