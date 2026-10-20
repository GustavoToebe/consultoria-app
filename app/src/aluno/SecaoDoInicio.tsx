import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { espaco } from '../tema/tokens';
import { Texto } from '../ui/Texto';

/** Título de seção do início do aluno ("Hoje", "Divisões da semana") sobre o fundo, com algo opcional à direita. */
export function SecaoDoInicio({ titulo, direita, children }: { titulo: string; direita?: ReactNode; children: ReactNode }) {
  return (
    <View style={estilos.secao}>
      <View style={estilos.topo}>
        <Texto variante="bloco" nivel={2} style={estilos.titulo}>{titulo}</Texto>
        {direita}
      </View>
      {children}
    </View>
  );
}

const estilos = StyleSheet.create({
  secao: { gap: espaco(1) },
  topo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1) },
  titulo: { flexShrink: 1 },
});
