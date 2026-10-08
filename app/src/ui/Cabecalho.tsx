import type { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { useSessao } from '../sessao/SessaoProvider';
import { espaco, LARGURA_MENU_LATERAL } from '../tema/tokens';
import { MarcaTitulo } from './MarcaTitulo';
import { Selo } from './Selo';
import { Texto } from './Texto';

interface Props {
  titulo?: string;
  acoes?: ReactNode;
  /** `sempre` (área do aluno, sem menu lateral) ou `celular` (treinador: no PC a marca já está no menu). */
  mostrarMarca?: 'sempre' | 'celular';
}

/** Topo das telas: marca do treinador (ou título da página), selo de "sem conexão" e ações à direita. */
export function Cabecalho({ titulo, acoes, mostrarMarca }: Props) {
  const { marca, offline } = useSessao();
  const { width } = useWindowDimensions();
  const comMarca = mostrarMarca === 'sempre' || (mostrarMarca === 'celular' && width < LARGURA_MENU_LATERAL);
  return (
    <View style={estilos.cabecalho}>
      <View style={estilos.esquerda}>
        {comMarca ? <MarcaTitulo marca={marca} /> : null}
        {titulo ? <Texto variante="titulo">{titulo}</Texto> : null}
        {offline ? <Selo texto="Sem conexão" tipo="neutro" /> : null}
      </View>
      {acoes ? <View style={estilos.acoes}>{acoes}</View> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  cabecalho: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: espaco(1) },
  esquerda: { flexShrink: 1, gap: espaco(0.5) },
  acoes: { flexDirection: 'row', gap: espaco(1), flexWrap: 'wrap', justifyContent: 'flex-end' },
});
