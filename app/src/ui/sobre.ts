import type { PressableStateCallbackType } from 'react-native';

/** Pressionado ou, na web, com o mouse em cima: os dois usam `superficie3`. */
export function sobre(estado: PressableStateCallbackType): boolean {
  return estado.pressed || !!(estado as PressableStateCallbackType & { hovered?: boolean }).hovered;
}
