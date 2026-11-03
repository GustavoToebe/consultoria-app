import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, type HostInstance } from 'react-native';

import { ATRASO_DO_FOCO_MS, deveDevolverFoco, gatilhoRecente } from '../dominio/focoDaFolha';

/**
 * Foco do leitor de tela no celular (D4 da auditoria das peças). O clique de acessibilidade (duplo toque do
 * TalkBack/VoiceOver) chega ao `Pressable` como `onClick` e tem o próprio controle como `target`; um `onClickCapture` na
 * raiz do app e no painel da Folha guarda o último, sem que cada chamada da Folha informe quem a abriu.
 */
interface Clique { no: HostInstance; quando: number }
let ultimo: Clique | null = null;

export function lembrarGatilho(evento: { target: unknown; nativeEvent?: object }) {
  // Toque comum (com `pointerType`) tem como alvo o filho mais fundo e não precisa de foco: o `Pressability` também o ignora.
  if (Platform.OS === 'web' || !evento.target || (evento.nativeEvent && 'pointerType' in evento.nativeEvent)) return;
  ultimo = { no: evento.target as HostInstance, quando: Date.now() };
}

/** Painel da Folha: guarda o gatilho ao abrir e, ao sair, devolve o foco a ele (cada Folha, empilhada ou não, tem o seu). */
export function useDevolverFocoNoNativo() {
  const [gatilho] = useState(() => (Platform.OS !== 'web' && gatilhoRecente(ultimo, Date.now()) ? ultimo : null));
  useEffect(() => () => {
    if (!gatilho) return;
    setTimeout(() => {
      AccessibilityInfo.isScreenReaderEnabled().catch(() => false).then((leitor) => {
        if (!deveDevolverFoco(leitor, { conectado: !!(gatilho.no as { isConnected?: boolean }).isConnected })) return;
        try { AccessibilityInfo.sendAccessibilityEvent(gatilho.no, 'focus'); } catch { /* o gatilho saiu da tela */ }
      });
    }, ATRASO_DO_FOCO_MS);
  }, [gatilho]);
}
