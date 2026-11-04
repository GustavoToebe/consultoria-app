import type { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import type { TipoDoSeloDoEditor } from '../../dominio/barraDoEditor';
import { useTema } from '../../tema/TemaProvider';
import { espaco, LARGURA_MENU_LATERAL } from '../../tema/tokens';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';

interface Props {
  selo: { texto: string; tipo: TipoDoSeloDoEditor };
  /** Uma linha curta ao lado do selo (período e publicação, "Modelo: o aluno não vê"). */
  info?: string | null;
  /** Motivo de uma falha ao salvar (mensagem da API ou "Confira a internet…"). */
  erro?: string | null;
  /** Antes do selo (a foto pequena do aluno no editor de treino em duas colunas). */
  inicio?: ReactNode;
  /** Os botões: "Salvar" (secundário) e, nos planos, "Publicar" (o único primário). */
  children: ReactNode;
}

/**
 * Barra de ações dos editores: um selo de estado, uma linha de informação e os botões, sempre no mesmo lugar em todo
 * editor (plano, modelo de qualquer tipo, questionário). Vai na `TelaDoEditor`, que a mantém fixa ao rolar.
 */
export function BarraDoEditor({ selo, info, erro, inicio, children }: Props) {
  const { cores } = useTema();
  // No PC a linha de informação cabe inteira (é curta): fica numa linha só ao lado do selo, sem quebrar no meio. Quem
  // desce quando falta largura são os botões, não este trecho. No celular ela pode quebrar, como qualquer texto.
  const largo = useWindowDimensions().width >= LARGURA_MENU_LATERAL;
  return (
    <View style={estilos.barra} accessibilityRole="toolbar" accessibilityLabel="Ações do editor">
      <View style={[estilos.estado, largo && estilos.estadoLargo]}>
        {inicio}
        <Selo texto={selo.texto} tipo={selo.tipo} />
        {info ? <Texto variante="pequeno" numerico numberOfLines={largo ? 1 : undefined} style={largo ? estilos.infoLarga : estilos.info}>{info}</Texto> : null}
        {erro ? <Texto variante="pequeno" cor={cores.perigo} style={estilos.info}>{erro}</Texto> : null}
      </View>
      <View style={estilos.acoes}>{children}</View>
    </View>
  );
}

const estilos = StyleSheet.create({
  barra: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1) },
  estado: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1), flexShrink: 1, flexGrow: 1, flexBasis: 220 },
  // PC: o bloco do estado tem a largura do próprio conteúdo (até a da barra); a barra quebra os botões, não o texto.
  estadoLargo: { flexBasis: 'auto', flexShrink: 0, maxWidth: '100%' },
  info: { flexShrink: 1 },
  infoLarga: { flexShrink: 0 },
  // Encolhe até a largura da barra para os botões quebrarem linha (sem isto o último saía cortado em 390 e 1024).
  acoes: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: espaco(1), marginLeft: 'auto', flexShrink: 1, maxWidth: '100%' },
});
