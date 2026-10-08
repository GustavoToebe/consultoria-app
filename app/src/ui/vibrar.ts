import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** Falta de suporte ou vibração desativada nunca impede o registro. */
export const vibrar = {
  leve() {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  },
  sucesso() {
    if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  },
};
