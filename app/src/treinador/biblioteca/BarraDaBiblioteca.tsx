import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { espaco } from '../../tema/tokens';
import { Campo } from '../../ui/Campo';
import { Escolha } from '../../ui/Escolha';
import { EscolhaEmFolha, OPCOES_PARA_BUSCAR } from '../../ui/EscolhaEmFolha';

/**
 * Barra única das abas da Biblioteca (revisão de telas de 19/10: cada aba tinha um jeito): busca com placeholder e,
 * ao lado, o filtro. Mesma ordem em todas: busca → filtro → lista.
 */
export function BarraDaBiblioteca({ rotulo, placeholder, valor, aoMudar, children }: {
  rotulo: string; placeholder: string; valor: string; aoMudar: (v: string) => void; children?: ReactNode;
}) {
  return (
    <View style={estilos.barra}>
      <View style={estilos.busca}><Campo rotulo={rotulo} valor={valor} aoMudar={aoMudar} placeholder={placeholder} autoCorrect={false} /></View>
      {children}
    </View>
  );
}

/** Filtro com o componente certo pelo número de opções: chips até oito, folha com busca acima disso. */
export function FiltroDaBiblioteca<T extends string>({ rotulo, valor, opcoes, aoMudar }: { rotulo: string; valor: T; opcoes: { valor: T; rotulo: string }[]; aoMudar: (v: T) => void }) {
  return opcoes.length > OPCOES_PARA_BUSCAR
    ? <EscolhaEmFolha rotulo={rotulo} valor={valor} opcoes={opcoes} aoMudar={aoMudar} style={estilos.aoPe} />
    : <Escolha rotulo={rotulo} valor={valor} opcoes={opcoes} aoMudar={aoMudar} />;
}

const estilos = StyleSheet.create({
  barra: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: espaco(1.5) },
  busca: { flexGrow: 1, flexBasis: 220, maxWidth: 480 },
  aoPe: { alignSelf: 'flex-end' },
});
