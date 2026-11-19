import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { LARGURA_EDITOR_DE_CAMPOS } from '../../tema/tokens';
import { Vazio } from '../../ui/Estados';
import { CartaoExercicio, type PropsDoCartaoExercicio } from './CartaoExercicio';

/**
 * Coluna da direita do editor de treino em duas colunas (detalhe): o exercício escolhido na lista, sempre aberto.
 *
 * Interface: as mesmas props do `CartaoExercicio` (o editor monta uma vez e usa nas duas larguras), sem `aberto` nem
 * `aoAbrir`, porque o inspetor não fecha. `exercicio` nulo = sessão sem exercício. Por enquanto o miolo é o do próprio
 * `CartaoExercicio`. `grupo` (a edição do grupo de exercícios escolhido na lista) toma o lugar do exercício.
 */
export type PropsDoInspetor = Omit<PropsDoCartaoExercicio, 'aberto' | 'aoAbrir'>;

/** Id no DOM (web) da coluna do inspetor: o editor a traz para baixo da barra ao escolher um item da lista. */
export const ID_DO_INSPETOR = 'inspetor-do-exercicio';

export function InspetorDoExercicio({ props, grupo }: { props: PropsDoInspetor | null; grupo?: ReactNode }) {
  return (
    <View style={estilos.coluna} nativeID={ID_DO_INSPETOR}>
      {grupo ? grupo : props
        ? <CartaoExercicio key={props.exercicio.uid} {...props} aberto />
        : <Vazio texto="Adicione um exercício na lista para editar as séries aqui." />}
    </View>
  );
}

const estilos = StyleSheet.create({
  // Na tela larga o painel para em ~1400 px, à esquerda junto da lista; a sobra fica vazia (nunca campo esticado).
  coluna: { flex: 1, minWidth: 0, maxWidth: LARGURA_EDITOR_DE_CAMPOS },
});
