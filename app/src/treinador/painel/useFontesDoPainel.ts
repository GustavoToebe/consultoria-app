import { useCallback, useEffect, useMemo, useRef } from 'react';

import {
  contagensInscricoes,
  listarInadimplentes,
  painelFinanceiro,
  painelTreinador,
  recordesDaSemana,
  resumoDaAgenda,
} from '../../api/rotas';
import { chaveDaConsulta, fonteDaConsulta, type ConsultaDoPainel, type Fonte, type FontesDoPainel } from '../../dominio/painelDoInicio';
import { useCarregar } from '../../ui/useCarregar';

type Escopo = 'todos' | 'meus';
type Vaga = `${ConsultaDoPainel['fonte']}:${Escopo}`;

/**
 * Cada consulta mora numa vaga fixa (fonte + Todos/Meus): os hooks não podem ficar num laço, e duas consultas com a mesma
 * `chaveDaConsulta` caem na mesma vaga (uma chamada só). Dentro de uma vaga as consultas só diferem por `dias` e pelo
 * período, que são os mesmos para todos os blocos.
 */
function vagaDe(c: ConsultaDoPainel): Vaga {
  const meus = c.fonte === 'agenda' ? c.responsavel !== null : c.meus;
  return `${c.fonte}:${meus ? 'meus' : 'todos'}`;
}

function buscar(c: ConsultaDoPainel): Promise<unknown> {
  switch (c.fonte) {
    case 'painel': return painelTreinador(c.meus, c.dias);
    case 'interessados': return contagensInscricoes({ meus: c.meus });
    case 'recordes': return recordesDaSemana(c.meus);
    case 'agenda': return resumoDaAgenda({ de: c.de, ate: c.ate, responsavel: c.responsavel });
    case 'inadimplentes': return listarInadimplentes({ meus: c.meus });
    case 'financeiro': return painelFinanceiro({ de: c.de, ate: c.ate, meus: c.meus });
  }
}

/** Uma vaga: busca a consulta pedida (ou nada, com `null`). */
function useVaga(c: ConsultaDoPainel | undefined) {
  const r = useCarregar<unknown>(c ? chaveDaConsulta(c) : null, () => (c ? buscar(c) : Promise.resolve(null)));
  return { ...r, ligada: !!c };
}

/**
 * As consultas do painel inteiro (todos os blocos visíveis, o Próximo passo e os Primeiros passos), sem repetir. Devolve a
 * `Fonte` de cada consulta, os dados crus (para as Folhas) e o "atualizar" de um bloco (só as vagas dele) ou de tudo.
 */
export function useFontesDoPainel(consultas: readonly ConsultaDoPainel[]) {
  const porVaga = useMemo(() => {
    const m = new Map<Vaga, ConsultaDoPainel>();
    for (const c of consultas) if (!m.has(vagaDe(c))) m.set(vagaDe(c), c);
    return m;
  }, [consultas]);

  const vagas: Record<Vaga, ReturnType<typeof useVaga>> = {
    'painel:todos': useVaga(porVaga.get('painel:todos')),
    'painel:meus': useVaga(porVaga.get('painel:meus')),
    'interessados:todos': useVaga(porVaga.get('interessados:todos')),
    'interessados:meus': useVaga(porVaga.get('interessados:meus')),
    'recordes:todos': useVaga(porVaga.get('recordes:todos')),
    'recordes:meus': useVaga(porVaga.get('recordes:meus')),
    'agenda:todos': useVaga(porVaga.get('agenda:todos')),
    'agenda:meus': useVaga(porVaga.get('agenda:meus')),
    'inadimplentes:todos': useVaga(porVaga.get('inadimplentes:todos')),
    'inadimplentes:meus': useVaga(porVaga.get('inadimplentes:meus')),
    'financeiro:todos': useVaga(porVaga.get('financeiro:todos')),
    'financeiro:meus': useVaga(porVaga.get('financeiro:meus')),
  };

  const fonte = <T>(c: ConsultaDoPainel): Fonte<T> => {
    const v = vagas[vagaDe(c)];
    if (!v.ligada) return { situacao: 'carregando' };
    return fonteDaConsulta<T>({ dados: v.dados as T | undefined, erro: v.erro, carregando: v.carregando });
  };

  /** A Folha do Início usa isto: dado de outra chave não entra na lista. Os cartões continuam com `fonte`. */
  const dadosDeOutraChave = (c: ConsultaDoPainel) => vagas[vagaDe(c)].dadosDeOutraChave;

  /** As fontes de um bloco, no formato de `montarBloco`. */
  const fontesDe = (cs: readonly ConsultaDoPainel[]): FontesDoPainel => {
    const f: Record<string, Fonte<unknown>> = {};
    for (const c of cs) f[c.fonte] = fonte(c);
    return f as FontesDoPainel;
  };

  // Cada vaga pelo nome, nunca pela posição numa lista. O ref acompanha o render (as funções `recarregar` do
  // `useCarregar` são estáveis) e deixa o `recarregar` daqui estável também.
  const vagasAtuais = useRef(vagas);
  useEffect(() => {
    vagasAtuais.current = vagas;
  });
  const recarregar = useCallback((cs: readonly ConsultaDoPainel[]) => {
    for (const vaga of new Set(cs.map(vagaDe))) vagasAtuais.current[vaga].recarregar();
  }, []);

  return { fonte, dadosDeOutraChave, fontesDe, recarregar };
}
