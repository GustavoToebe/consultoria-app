import { router } from 'expo-router';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { criarRenovacaoDoPush } from '../../dominio/pushDoAluno';
import { useSessao } from '../../sessao/SessaoProvider';
import { ouvirToqueNaNotificacao, registrarPushDoTreinador } from './pushDoTreinador';
import { recebePushDeAtencao } from './regraDoPushDoTreinador';

/**
 * Na área do treinador: registra de novo o token deste aparelho ao abrir (também depois de entrar de novo, quando a troca de
 * perfil derrubou a sessão e o servidor apagou os tokens) e, ao voltar para a frente, no máximo uma vez a cada 24 h (o servidor
 * apaga o que não renova em 30 dias). Só com a permissão do aparelho já dada (nunca pede; quem pede é o cartão "Avisos no
 * celular"). Também leva o toque na notificação de atenção à lista filtrada. Erros são ignorados. Não desenha nada.
 */
export function SincronizarPushDoTreinador() {
  const { usuario, pode, pushHabilitado, regrasAtencaoHabilitada } = useSessao();
  const recebe = recebePushDeAtencao({
    os: Platform.OS, pushHabilitado, regrasAtencaoHabilitada, podeVer: pode('ATUALIZACAO_LER') && pode('ALUNO_SENSIVEL_LER'),
  });
  const usuarioId = usuario?.id;

  useEffect(() => {
    if (!recebe || !usuarioId) return;
    const renovacao = criarRenovacaoDoPush(registrarPushDoTreinador);
    renovacao.talvez().catch(() => undefined);
    const assinatura = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') renovacao.talvez().catch(() => undefined);
    });
    return () => assinatura.remove();
  }, [recebe, usuarioId]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let parar: (() => void) | null = null;
    let vivo = true;
    ouvirToqueNaNotificacao((destino) => router.push(destino as never)).then(
      (p) => { if (vivo) parar = p; else p(); },
      () => undefined,
    );
    return () => {
      vivo = false;
      parar?.();
    };
  }, []);
  return null;
}
