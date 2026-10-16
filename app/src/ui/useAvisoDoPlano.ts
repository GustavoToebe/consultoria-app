import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { mensagemDoErroDoPlano } from '../dominio/erroDoPlano';
import { useSessao } from '../sessao/SessaoProvider';
import { useAviso } from './Aviso';

/**
 * Ponto único para o erro de limite ou de funcionalidade fora do plano. Devolve uma função que, se o erro for desse
 * tipo, mostra a mensagem num aviso de erro (fica até ser fechado) e responde `true`; com `CONTA_LER` o aviso leva
 * "Ver minha conta" (`antesDeNavegar` fecha o que estiver aberto, como o `aoNavegar` da ficha). Qualquer outro erro responde `false` e quem chamou segue com o tratamento de sempre.
 */
export function useAvisoDoPlano(antesDeNavegar?: () => void): (erro: unknown) => boolean {
  const { avisar } = useAviso();
  const { pode } = useSessao();
  const router = useRouter();
  const podeVerConta = pode('CONTA_LER');
  return useCallback(
    (erro: unknown) => {
      const mensagem = mensagemDoErroDoPlano(erro);
      if (mensagem === null) return false;
      avisar(
        mensagem,
        'perigo',
        podeVerConta ? { rotulo: 'Ver minha conta', aoTocar: () => { antesDeNavegar?.(); router.push('/treinador/minha-conta'); } } : undefined,
      );
      return true;
    },
    [avisar, podeVerConta, router, antesDeNavegar],
  );
}
