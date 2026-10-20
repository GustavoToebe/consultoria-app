import { useFocusEffect } from 'expo-router';
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';

import type { FinanceiroDoAluno } from '../../api/financeiroTipos';
import { financeiroDoAluno } from '../../api/rotas';
import { useAluno } from '../../offline/AlunoProvider';
import { useSessao } from '../../sessao/SessaoProvider';
import { codigoApi } from '../../ui/erros';
import { useCarregar } from '../../ui/useCarregar';

interface Valor {
  /** O módulo de pagamentos está ligado para a consultoria (vem de `GET /eu`). Desligado, o aluno não vê nada disso. */
  habilitado: boolean;
  /** Sem conexão o financeiro não é mostrado: nada dele fica guardado no aparelho. */
  online: boolean;
  dados: FinanceiroDoAluno | undefined;
  erro: unknown;
  carregando: boolean;
  recarregar: () => void;
}

const Contexto = createContext<Valor | null>(null);

/**
 * O que o aluno vê do próprio plano comercial e das cobranças (`GET /aluno/financeiro`). Fica só em memória: nenhum
 * `repositorio.salvar*`, nada no armazenamento do aparelho, e sem conexão não busca. Com o módulo desligado a rota nem
 * é chamada. Tem de ficar dentro do `AlunoProvider` (precisa do estado de conexão).
 */
export function FinanceiroDoAlunoProvider({ children }: { children: ReactNode }) {
  const { pagamentosHabilitados, usuario } = useSessao();
  const { online } = useAluno();
  const chave = pagamentosHabilitados && online ? `financeiro-do-aluno:${usuario?.id ?? ''}` : null;
  const carga = useCarregar(chave, () => financeiroDoAluno());
  // 503 `FINANCEIRO_INDISPONIVEL`: o módulo foi desligado no servidor; some como se a flag estivesse desligada.
  const indisponivel = codigoApi(carga.erro) === 'FINANCEIRO_INDISPONIVEL';
  const valor = useMemo<Valor>(
    () => ({
      habilitado: pagamentosHabilitados && !indisponivel,
      online,
      dados: chave === null ? undefined : carga.dados,
      erro: carga.erro,
      carregando: carga.carregando,
      recarregar: carga.recarregar,
    }),
    [pagamentosHabilitados, indisponivel, online, chave, carga.dados, carga.erro, carga.carregando, carga.recarregar],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useFinanceiroDoAluno(): Valor {
  const valor = useContext(Contexto);
  if (!valor) throw new Error('useFinanceiroDoAluno fora do FinanceiroDoAlunoProvider');
  return valor;
}

/** Busca de novo cada vez que a tela volta ao foco (depois de o treinador dar a baixa, por exemplo). */
export function useRecarregarFinanceiroAoFocar(): void {
  const { habilitado, online, recarregar } = useFinanceiroDoAluno();
  useFocusEffect(useCallback(() => { if (habilitado && online) recarregar(); }, [habilitado, online, recarregar]));
}
