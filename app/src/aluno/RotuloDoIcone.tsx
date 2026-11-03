import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Texto } from '../ui/Texto';

/**
 * Texto curto embaixo de um botão de ícone ("Vídeo", "Descanso"): quem usa o app pela primeira vez não adivinha o que o
 * ícone faz (auditoria 03/11). O botão já tem nome acessível; o texto é só visual e o leitor de tela não o repete.
 */
export function RotuloDoIcone({ texto, children }: { texto: string; children: ReactNode }) {
  return (
    <View style={estilos.coluna}>
      {children}
      <Texto variante="pequeno" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={estilos.texto}>{texto}</Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  coluna: { alignItems: 'center' },
  texto: { textAlign: 'center' },
});
