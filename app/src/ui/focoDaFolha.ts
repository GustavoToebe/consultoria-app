import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, type HostInstance } from 'react-native';

import { ATRASO_DO_FOCO_MS, deveDevolverFoco, gatilhoRecente } from '../dominio/focoDaFolha';
import { quantasFolhasJaAbriramNoNativo } from './historicoDasFolhas';

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

/** Props para a raiz do app e o painel da Folha. Os tipos TS do RN 0.86 ainda não trazem o `onClickCapture` (o runtime tem). */
export const capturaDoGatilho = { onClickCapture: lembrarGatilho } as object;

/** Painel da Folha: guarda o gatilho ao abrir e, ao sair, devolve o foco a ele (cada Folha, empilhada ou não, tem o seu). */
export function useDevolverFocoNoNativo() {
  const [gatilho] = useState(() => {
    const achado = Platform.OS !== 'web' && gatilhoRecente(ultimo, Date.now()) ? ultimo : null;
    // Lido uma vez: a próxima Folha aberta sem clique não herda este gatilho.
    ultimo = null;
    return achado;
  });
  useEffect(() => () => {
    if (!gatilho) return;
    const aberturas = quantasFolhasJaAbriramNoNativo();
    setTimeout(() => {
      // Fechou abrindo outra Folha (ou a guarda na Folha de baixo): o foco é dela, não do gatilho escondido atrás.
      // Painel de confirmação e navegação para outra tela não são vistos aqui (o gatilho some ou fica atrás; ver o plano).
      if (quantasFolhasJaAbriramNoNativo() !== aberturas) return;
      AccessibilityInfo.isScreenReaderEnabled().catch(() => false).then((leitor) => {
        if (!deveDevolverFoco(leitor, { conectado: !!(gatilho.no as { isConnected?: boolean }).isConnected })) return;
        try { AccessibilityInfo.sendAccessibilityEvent(gatilho.no, 'focus'); } catch { /* o gatilho saiu da tela */ }
      });
    }, ATRASO_DO_FOCO_MS);
  }, [gatilho]);
}
