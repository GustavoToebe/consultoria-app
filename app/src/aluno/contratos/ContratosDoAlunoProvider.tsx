import { useFocusEffect } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

import { listarMeusContratos, type ContratoDoAlunoResumo } from '../../api/contratos';
import { useAluno } from '../../offline/AlunoProvider';
import { useSessao } from '../../sessao/SessaoProvider';
import { codigoApi } from '../../ui/erros';
import { useCarregar } from '../../ui/useCarregar';

interface Valor {
  /** Os contratos do aluno (pendentes e assinados); `undefined` sem a chave, sem conexão, ainda carregando ou com erro. */
  contratos: ContratoDoAlunoResumo[] | undefined;
  /** Erro da última busca (sem lista); `undefined` sem erro ou sem buscar. A tela de bloqueio do contrato o mostra. */
  erro: unknown;
  recarregar: () => void;
}

const Contexto = createContext<Valor | null>(null);

/**
 * Contratos do aluno (`GET /aluno/contratos`, `docs/planos/contrato-digital-telas.md`, tela C), só em memória: nada vai ao
 * aparelho. Uma fonte para o Início ("Suas pendências" e o ponto da aba, T2) e para a Conta ("Meus contratos"). Só busca com
 * a chave da plataforma ligada e online; recarrega ao voltar para a frente, quando a internet volta (a chave muda) e depois
 * de assinar (`recarregar`). O 503 `CONTRATOS_INDISPONIVEL` vale como lista vazia. Tem de ficar dentro do `AlunoProvider`.
 */
export function ContratosDoAlunoProvider({ children }: { children: ReactNode }) {
  const { online, repositorio } = useAluno();
  const { contratosHabilitados } = useSessao();
  const chave = contratosHabilitados && online ? `contratos-do-aluno:${repositorio.usuarioId}` : null;
  const carga = useCarregar(chave, () => listarMeusContratos().catch((e: unknown) => {
    if (codigoApi(e) === 'CONTRATOS_INDISPONIVEL') return [];
    throw e;
  }));
  const { recarregar } = carga;

  const buscando = chave !== null;
  useEffect(() => {
    if (!buscando) return;
    if (Platform.OS !== 'web') {
      const assinatura = AppState.addEventListener('change', (estado) => { if (estado === 'active') recarregar(); });
      return () => assinatura.remove();
    }
    if (typeof document === 'undefined') return;
    const aoVoltar = () => { if (document.visibilityState === 'visible') recarregar(); };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => document.removeEventListener('visibilitychange', aoVoltar);
  }, [buscando, recarregar]);

  const contratos = chave === null ? undefined : carga.dados;
  const valor: Valor = { contratos, erro: chave === null ? undefined : carga.erro, recarregar };
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useContratosDoAluno(): Valor {
  const valor = useContext(Contexto);
  if (!valor) throw new Error('useContratosDoAluno fora do ContratosDoAlunoProvider');
  return valor;
}

/** Busca de novo cada vez que a tela volta ao foco (a equipe pode ter gerado ou cancelado um contrato). */
export function useRecarregarContratosAoFocar(): void {
  const { recarregar } = useContratosDoAluno();
  useFocusEffect(useCallback(() => { recarregar(); }, [recarregar]));
}
