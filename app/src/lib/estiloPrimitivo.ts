import { StyleSheet, type StyleProp, type ViewStyle, type PressableStateCallbackType } from 'react-native';
/** Radix compõe style como objeto na web. Achatar arrays antes dessa fronteira evita índices no CSSStyleDeclaration. */
export function estiloPrimitivo<T>(estilo: T): T {
 if (typeof estilo === 'function') {
  const resolver = estilo as (estado: PressableStateCallbackType) => StyleProp<ViewStyle>;
  return ((estado: PressableStateCallbackType) => StyleSheet.flatten(resolver(estado))) as T;
 }
 return StyleSheet.flatten(estilo as StyleProp<ViewStyle>) as T;
}
