import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

let ligada = true;

/** Preferência da pessoa ("Vibrar ao marcar série e no fim do descanso"); o provedor do tema chama ao carregar e ao mudar. */
export function definirVibracaoLigada(valor: boolean) {
  ligada = valor;
}

/** Falta de suporte ou vibração desativada nunca impede o registro. */
export const vibrar = {
  leve() {
    if (ligada && Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  },
  sucesso() {
    if (ligada && Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  },
};
