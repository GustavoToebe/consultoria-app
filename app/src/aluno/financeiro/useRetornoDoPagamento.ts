import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { retornoDoPagamento } from '../../api/rotas';
import { AVISO_RETORNO_DO_PAGAMENTO, AVISO_RETORNO_SEM_CONFIRMAR, lerRetornoDoPagamento } from '../../dominio/financeiro';
import { useAviso } from '../../ui/Aviso';
import { useFinanceiroDoAluno } from './FinanceiroDoAlunoProvider';

/**
 * A volta do navegador depois do pagamento (só na web, e só na Conta do aluno): a InfinitePay manda o aluno de volta a
 * `/aluno/conta` com `order_nsu`, `transaction_nsu`, `slug`, `capture_method` (e `receipt_url`, que não usamos) na query.
 * Com os dois NSU válidos, avisa a API UMA vez, limpa o endereço (`replace`: nenhum passo novo no histórico, e a query
 * não fica à vista nem em favoritos), recarrega o financeiro e diz que a confirmação pode demorar. Falha da API não
 * quebra a tela: aviso neutro e sem repetir. Nada é guardado no aparelho; quem dá a baixa é o servidor, depois de
 * consultar a InfinitePay.
 */
export function useRetornoDoPagamento(): void {
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const { habilitado, recarregar } = useFinanceiroDoAluno();
  const { avisar } = useAviso();
  const tratado = useRef(false);
  useEffect(() => {
    if (Platform.OS !== 'web' || tratado.current) return;
    const { presente, retorno } = lerRetornoDoPagamento(params);
    if (!presente) return;
    tratado.current = true;
    router.replace('/aluno/conta');
    if (!retorno || !habilitado) return;
    retornoDoPagamento(retorno).then(
      () => {
        recarregar();
        avisar(AVISO_RETORNO_DO_PAGAMENTO, 'neutro');
      },
      () => {
        recarregar();
        avisar(AVISO_RETORNO_SEM_CONFIRMAR, 'neutro');
      },
    );
  }, [params, habilitado, recarregar, avisar]);
}
