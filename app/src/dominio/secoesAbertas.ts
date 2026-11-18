/**
 * Seções que abrem e fecham (regra de 18/11/2026, `docs/design-e-front.md` 4.8): tudo nasce fechado; uma seção só nasce
 * aberta; o destino de um link, o item recém-criado e o erro apontado abrem; buscar abre o que tem resultado e limpar a
 * busca volta ao estado de antes. Regra pura: nada é guardado no aparelho (cada abertura da tela começa de novo).
 * Os ids são os da lista COMPLETA de seções, nunca a filtrada pela busca (id que some da lista sai do estado).
 */
export interface EstadoDeSecoes {
  /** Ids que o estado já conhece: só o que chega depois de conhecido é novo (e nasce fechado). */
  vistas: ReadonlySet<string>;
  abertas: ReadonlySet<string>;
  /** Abertas de antes da busca; `null` fora da busca. */
  antesDaBusca: ReadonlySet<string> | null;
}

const VAZIO: EstadoDeSecoes = { vistas: new Set(), abertas: new Set(), antesDaBusca: null };

const semOsQueSumiram = (conjunto: ReadonlySet<string>, ids: ReadonlySet<string>) => {
  const mantidos = [...conjunto].filter((id) => ids.has(id));
  return mantidos.length === conjunto.size ? conjunto : new Set(mantidos);
};

/**
 * Põe o estado em dia com a lista atual de ids: o que sumiu sai; o que chegou entra fechado, exceto se `abrirDePartida` o
 * pede ou se é a única seção de uma lista que ainda não tinha nenhuma. Devolve o mesmo objeto quando nada muda.
 */
export function sincronizar(estado: EstadoDeSecoes, ids: readonly string[], abrirDePartida: readonly string[] = []): EstadoDeSecoes {
  const atuais = new Set(ids);
  const novas = ids.filter((id) => !estado.vistas.has(id));
  const saiu = estado.vistas.size > 0 && [...estado.vistas].some((id) => !atuais.has(id));
  if (!novas.length && !saiu) return estado;
  const aAbrir = novas.filter((id) => (estado.vistas.size === 0 && ids.length === 1) || abrirDePartida.includes(id));
  const comNovas = (conjunto: ReadonlySet<string>) => {
    const sem = semOsQueSumiram(conjunto, atuais);
    return aAbrir.length ? new Set([...sem, ...aAbrir]) : sem;
  };
  return {
    vistas: atuais,
    abertas: comNovas(estado.abertas),
    antesDaBusca: estado.antesDaBusca ? comNovas(estado.antesDaBusca) : null,
  };
}

export const estadoInicial = (ids: readonly string[], abrirDePartida: readonly string[] = []): EstadoDeSecoes => sincronizar(VAZIO, ids, abrirDePartida);

export const estaAberta = (estado: EstadoDeSecoes, id: string) => estado.abertas.has(id);

/** Durante a busca vale só durante a busca: ao limpar, volta o que estava antes dela. */
export function alternar(estado: EstadoDeSecoes, id: string): EstadoDeSecoes {
  const abertas = new Set(estado.abertas);
  if (!abertas.delete(id)) abertas.add(id);
  return { ...estado, abertas };
}

/** Abre ids que a tela escolhe abrir (item novo, erro apontado, destino de link). */
export function abrir(estado: EstadoDeSecoes, ids: readonly string[]): EstadoDeSecoes {
  if (ids.every((id) => estado.abertas.has(id))) return estado;
  return { ...estado, abertas: new Set([...estado.abertas, ...ids]) };
}

export const abrirTodas = (estado: EstadoDeSecoes, ids: readonly string[]): EstadoDeSecoes => ({ ...estado, abertas: new Set(ids) });

export const fecharTodas = (estado: EstadoDeSecoes): EstadoDeSecoes => ({ ...estado, abertas: new Set() });

/**
 * Termo não vazio: guarda o estado de antes (só na primeira vez da busca) e abre exatamente as seções com resultado; mudar
 * o termo reabre conforme o novo resultado, sem perder o estado guardado. Termo vazio: restaura o guardado.
 */
export function buscar(estado: EstadoDeSecoes, termo: string, idsComResultado: readonly string[]): EstadoDeSecoes {
  if (!termo.trim()) {
    return estado.antesDaBusca ? { ...estado, abertas: estado.antesDaBusca, antesDaBusca: null } : estado;
  }
  return { ...estado, antesDaBusca: estado.antesDaBusca ?? estado.abertas, abertas: new Set(idsComResultado.filter((id) => estado.vistas.has(id))) };
}
