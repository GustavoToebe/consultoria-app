import { useEffect, useMemo, useState } from 'react';

import { sessoesConcluidasDoAluno } from '../api/rotas';
import type { SessaoConcluidaDoServidor } from '../api/tipos';
import { hojeIso } from '../dominio/formatos';
import { juntarConclusoes, montarMapa, periodoDoMapa } from '../dominio/mapaDeTreinos';
import { useAluno } from '../offline/AlunoProvider';
import { useSessao } from '../sessao/SessaoProvider';

const NADA: SessaoConcluidaDoServidor[] = [];

/**
 * Mapa de treinos do aluno: o período da API (12 meses) mais as conclusões ainda só do aparelho. Dentro do `AlunoProvider`.
 * Com `retornoHabilitado` falso (`visivel` falso) não chama a rota e a tela não mostra o mapa. Falha de rede ou o 503
 * `RETORNO_INDISPONIVEL` nunca vira erro: fica o que há no aparelho (a fila local, últimos 60 dias) ou vazio.
 */
export function useMapaDeTreinos(hoje: string = hojeIso()) {
  const { retornoHabilitado } = useSessao();
  const { sessoesConcluidasNoAparelho } = useAluno();
  // `hoje` diz de que dia é a resposta: enquanto não chega a do dia atual, está carregando.
  const [lido, setLido] = useState<{ hoje: string; sessoes: SessaoConcluidaDoServidor[] } | null>(null);

  useEffect(() => {
    if (!retornoHabilitado) return;
    let vivo = true;
    sessoesConcluidasDoAluno(periodoDoMapa(hoje).de, hoje)
      .then((r) => ({ hoje, sessoes: r.sessoes }), () => ({ hoje, sessoes: [] }))
      .then((l) => { if (vivo) setLido(l); });
    return () => { vivo = false; };
  }, [retornoHabilitado, hoje]);

  const doServidor = retornoHabilitado && lido?.hoje === hoje ? lido.sessoes : NADA;
  const mapa = useMemo(
    () => montarMapa(juntarConclusoes(doServidor, sessoesConcluidasNoAparelho), hoje),
    [doServidor, sessoesConcluidasNoAparelho, hoje],
  );
  return { visivel: retornoHabilitado, carregando: retornoHabilitado && lido?.hoje !== hoje, mapa };
}
