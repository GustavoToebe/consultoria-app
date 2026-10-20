import { useFocusEffect } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

import type { FinanceiroDoAluno } from '../../api/financeiroTipos';
import { financeiroDoAluno } from '../../api/rotas';
import { comoPagar, plataformaDoApp, type ComoPagar } from '../../dominio/financeiro';
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
  /**
   * Como o aluno vê as cobranças em aberto nesta plataforma (`comoPagar`): botão "Pagar", só informação (celular sem a
   * chave da plataforma) ou "o treinador combina". Uma conta só para a Conta e para as pendências do Início.
   */
  modoDePagamento: ComoPagar;
  recarregar: () => void;
}

const Contexto = createContext<Valor | null>(null);

/**
 * O que o aluno vê do próprio plano comercial e das cobranças (`GET /aluno/financeiro`). Fica só em memória: nenhum
 * `repositorio.salvar*`, nada no armazenamento do aparelho, e sem conexão não busca. Com o módulo desligado a rota nem
 * é chamada. Tem de ficar dentro do `AlunoProvider` (precisa do estado de conexão).
 */
export function FinanceiroDoAlunoProvider({ children }: { children: ReactNode }) {
  const { pagamentosHabilitados, usuario, pagarNoIos, pagarNoAndroid } = useSessao();
  const { online } = useAluno();
  const chave = pagamentosHabilitados && online ? `financeiro-do-aluno:${usuario?.id ?? ''}` : null;
  const carga = useCarregar(chave, () => financeiroDoAluno());
  // 503 `FINANCEIRO_INDISPONIVEL`: o módulo foi desligado no servidor; some como se a flag estivesse desligada.
  const indisponivel = codigoApi(carga.erro) === 'FINANCEIRO_INDISPONIVEL';
  // O "Pagar" abre fora do app (outra aba na web, o navegador no celular): ao voltar, a lista confere se o pagamento já
  // caiu. O `useFocusEffect` não cobre isso (a tela continua em foco no roteador). O estado só muda no retorno da busca,
  // nunca aqui no efeito.
  const { recarregar } = carga;
  const buscando = chave !== null;
  useEffect(() => {
    if (!buscando) return;
    if (Platform.OS !== 'web') {
      const assinatura = AppState.addEventListener('change', (estado) => {
        if (estado === 'active') recarregar();
      });
      return () => assinatura.remove();
    }
    if (typeof document === 'undefined') return;
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') recarregar();
    };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => document.removeEventListener('visibilitychange', aoVoltar);
  }, [buscando, recarregar]);
  const pagamentoOnline = chave !== null && carga.dados?.pagamentoOnline === true;
  const modoDePagamento = comoPagar(plataformaDoApp(Platform.OS), pagamentoOnline, { pagarNoIos, pagarNoAndroid });
  const valor = useMemo<Valor>(
    () => ({
      habilitado: pagamentosHabilitados && !indisponivel,
      online,
      dados: chave === null ? undefined : carga.dados,
      erro: carga.erro,
      carregando: carga.carregando,
      modoDePagamento,
      recarregar: carga.recarregar,
    }),
    [pagamentosHabilitados, indisponivel, online, chave, carga.dados, carga.erro, carga.carregando, modoDePagamento, carga.recarregar],
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
