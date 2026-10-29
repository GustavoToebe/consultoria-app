import { useCallback, useEffect, useRef, useState } from 'react';

import type { EscolhasDeOpcao, PeriodoDaLista } from '../dominio/listaDeCompras';
import {
  comMarcacoes,
  estadoDaVersao,
  marcacoesDoPeriodo,
  normalizarListaSalva,
  type ListaDeComprasSalva,
  type MarcacoesDoPeriodo,
} from '../dominio/listaDeComprasDoAluno';
import { useAluno } from '../offline/AlunoProvider';

/**
 * Estado da lista de compras do aluno guardado no aparelho (documento `listaDeCompras` do `RepositorioLocal`): período e
 * opções escolhidos, comprados, ajustes e itens avulsos da versão `versaoId`. Grava a cada mudança; versão diferente da
 * guardada começa do zero e, na primeira mudança, substitui o documento. Nada vai à API.
 */
export function useListaDoAparelho(versaoId: string) {
  const { repositorio } = useAluno();
  /** `undefined` = ainda lendo do aparelho. */
  const [salva, setSalva] = useState<ListaDeComprasSalva | null | undefined>(undefined);
  // O último gravado, para duas mudanças seguidas (marcar dois itens rápido) não partirem do mesmo estado antigo.
  const ultima = useRef<ListaDeComprasSalva | null>(null);

  useEffect(() => {
    let viva = true;
    repositorio
      .lerListaDeCompras()
      .then((v) => normalizarListaSalva(v))
      .catch(() => null)
      .then((lida) => {
        if (!viva) return;
        ultima.current = lida;
        setSalva(lida);
      });
    return () => {
      viva = false;
    };
  }, [repositorio]);

  const gravar = useCallback(
    (mudar: (estado: ListaDeComprasSalva) => ListaDeComprasSalva) => {
      const novo = mudar(estadoDaVersao(ultima.current, versaoId));
      ultima.current = novo;
      setSalva(novo);
      // Falha ao gravar no aparelho não trava a tela: a marca vale até sair dela.
      void repositorio.salvarListaDeCompras(novo).catch(() => undefined);
    },
    [repositorio, versaoId],
  );

  const estado = estadoDaVersao(salva ?? null, versaoId);
  const periodo = estado.periodo;
  return {
    carregando: salva === undefined,
    periodo,
    escolhas: estado.escolhas,
    marcacoes: marcacoesDoPeriodo(estado, periodo),
    escolherPeriodo: (p: PeriodoDaLista) => gravar((e) => ({ ...e, periodo: p })),
    escolherOpcoes: (escolhas: EscolhasDeOpcao) => gravar((e) => ({ ...e, escolhas })),
    /** Muda as marcações do período em uso, ou de `noPeriodo` (o "Desfazer" volta ao período em que a ação foi feita). */
    mudarMarcacoes: (mudar: (m: MarcacoesDoPeriodo) => MarcacoesDoPeriodo, noPeriodo?: PeriodoDaLista) =>
      gravar((e) => {
        const p = noPeriodo ?? e.periodo;
        return comMarcacoes(e, p, mudar(marcacoesDoPeriodo(e, p)));
      }),
  };
}
