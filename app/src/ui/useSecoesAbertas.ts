import { useState } from 'react';

import {
  abrir as abrirIds, abrirTodas as abrirTodasIds, alternar as alternarId, buscar, estaAberta, estadoInicial, fecharTodas as fecharTodasIds, sincronizar,
  type EstadoDeSecoes,
} from '../dominio/secoesAbertas';

/**
 * Seções que abrem e fecham, pela regra de `dominio/secoesAbertas` (nascem fechadas; uma só nasce aberta; buscar abre o
 * que tem resultado e limpar volta ao de antes; nada vai ao aparelho). `ids` é a lista COMPLETA de seções, não a filtrada
 * pela busca; `abrirDePartida` são os ids que nascem abertos (destino de link). Item novo e erro apontado usam `abrir`.
 *
 *   const s = useSecoesAbertas(secoes.map((x) => x.id), pastaIdDoLink ? [pastaIdDoLink] : []);
 *   <CabecalhoDeGrupo aberto={s.estaAberta(x.id)} aoAlternar={() => s.alternar(x.id)} />
 *   const buscar = (t: string) => { setBusca(t); s.aoBuscar(t, idsComResultado(t)); };
 */
export function useSecoesAbertas(ids: readonly string[], abrirDePartida: readonly string[] = []) {
  const [estado, setEstado] = useState<EstadoDeSecoes>(() => estadoInicial(ids, abrirDePartida));
  // Lista que mudou (carregou, cresceu, encolheu): põe o estado em dia na própria renderização, sem efeito nem quadro extra.
  const atual = sincronizar(estado, ids, abrirDePartida);
  if (atual !== estado) setEstado(atual);
  const aplicar = (f: (e: EstadoDeSecoes) => EstadoDeSecoes) => setEstado((e) => f(sincronizar(e, ids, abrirDePartida)));
  return {
    estaAberta: (id: string) => estaAberta(atual, id),
    todasAbertas: ids.length > 0 && ids.every((id) => estaAberta(atual, id)),
    alternar: (id: string) => aplicar((e) => alternarId(e, id)),
    abrir: (id: string | readonly string[]) => aplicar((e) => abrirIds(e, typeof id === 'string' ? [id] : id)),
    abrirTodas: () => aplicar((e) => abrirTodasIds(e, ids)),
    fecharTodas: () => aplicar(fecharTodasIds),
    /** Termo vazio restaura o estado de antes da busca; `idsComResultado` abre exatamente as seções que casaram. */
    aoBuscar: (termo: string, idsComResultado: readonly string[]) => aplicar((e) => buscar(e, termo, idsComResultado)),
  };
}
