import { StyleSheet, View } from 'react-native';

import { Vazio } from '../../ui/Estados';
import { CartaoExercicio, type PropsDoCartaoExercicio } from './CartaoExercicio';

/**
 * Coluna da direita do editor de treino em duas colunas (detalhe): o exercício escolhido na lista, sempre aberto.
 *
 * Interface: as mesmas props do `CartaoExercicio` (o editor monta uma vez e usa nas duas larguras), sem `aberto` nem
 * `aoAbrir`, porque o inspetor não fecha. `exercicio` nulo = sessão sem exercício. Por enquanto o miolo é o do próprio
 * `CartaoExercicio`; a etapa seguinte troca o interior (abas das séries) sem mudar esta interface.
 */
export type PropsDoInspetor = Omit<PropsDoCartaoExercicio, 'aberto' | 'aoAbrir'>;

export function InspetorDoExercicio({ props }: { props: PropsDoInspetor | null }) {
  return (
    <View style={estilos.coluna}>
      {props
        ? <CartaoExercicio key={props.exercicio.uid} {...props} aberto />
        : <Vazio texto="Adicione um exercício na lista para editar as séries aqui." />}
    </View>
  );
}

const estilos = StyleSheet.create({
  coluna: { flex: 1, minWidth: 0 },
});
