import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { TipoDoSeloDoEditor } from '../../dominio/barraDoEditor';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';

interface Props {
  selo: { texto: string; tipo: TipoDoSeloDoEditor };
  /** Uma linha curta ao lado do selo (período e publicação, "Modelo: o aluno não vê"). */
  info?: string | null;
  /** Motivo de uma falha ao salvar (mensagem da API ou "Confira a internet…"). */
  erro?: string | null;
  /** Os botões: "Salvar" (secundário) e, nos planos, "Publicar" (o único primário). */
  children: ReactNode;
}

/**
 * Barra de ações dos editores: um selo de estado, uma linha de informação e os botões, sempre no mesmo lugar em todo
 * editor (plano, modelo de qualquer tipo, questionário). Vai na `TelaDoEditor`, que a mantém fixa ao rolar.
 */
export function BarraDoEditor({ selo, info, erro, children }: Props) {
  const { cores } = useTema();
  return (
    <View style={estilos.barra} accessibilityRole="toolbar" accessibilityLabel="Ações do editor">
      <View style={estilos.estado}>
        <Selo texto={selo.texto} tipo={selo.tipo} />
        {info ? <Texto variante="pequeno" numerico style={estilos.info}>{info}</Texto> : null}
        {erro ? <Texto variante="pequeno" cor={cores.perigo} style={estilos.info}>{erro}</Texto> : null}
      </View>
      <View style={estilos.acoes}>{children}</View>
    </View>
  );
}

const estilos = StyleSheet.create({
  barra: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1) },
  estado: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1), flexShrink: 1, flexGrow: 1, flexBasis: 220 },
  info: { flexShrink: 1 },
  acoes: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1), marginLeft: 'auto' },
});
