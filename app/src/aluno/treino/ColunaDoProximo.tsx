import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { espaco } from '../../tema/tokens';
import { Texto } from '../../ui/Texto';

export interface ProximoDoTreinoDoDia {
  /** "Primeiro exercício" (nada feito ainda) ou "Próximo exercício". */
  titulo: string;
  /** O cartão do exercício a fazer, o mesmo da lista (`CartaoExercicioDoDia`). */
  cartao: ReactNode;
  /** O histórico desse exercício, aberto (`RecentesDoHistorico` e `PorDataDoHistorico`); nulo em cardio e exercício livre. */
  historico: { titulo: string; recentes: ReactNode; porData: (comRotulo: boolean) => ReactNode } | null;
}

/**
 * A 3ª coluna do Treino do dia na web larga (item 7 do pedido de 27/11): o próximo exercício e o histórico dele, com as
 * mesmas peças e o mesmo desenho da 3ª coluna do Exercício (`ExercicioAluno`, que não exporta a dela porque monta o
 * histórico do exercício aberto, não do próximo). Com `emDuas` (a partir de 752 px, `colunasDoExercicio`), a carga por data
 * vai para uma segunda coluna, para o espaço extra virar coluna e nunca um cartão esticado.
 */
export function ColunaDoProximo({ titulo, cartao, historico, emDuas }: ProximoDoTreinoDoDia & { emDuas: boolean }) {
  const secao = (t: string, conteudo: ReactNode) => (
    <View style={estilos.secao}>
      <Texto variante="bloco" nivel={2} numerico>{t}</Texto>
      {conteudo}
    </View>
  );
  const doProximo = secao(titulo, cartao);
  if (emDuas && historico) {
    return (
      <View style={estilos.emDuas}>
        <View style={estilos.coluna}>
          {doProximo}
          {secao(historico.titulo, <View style={estilos.partes}>{historico.recentes}</View>)}
        </View>
        <View style={estilos.coluna}>{secao('Carga por data', historico.porData(false))}</View>
      </View>
    );
  }
  return (
    <>
      {doProximo}
      {historico ? secao(historico.titulo, <View style={estilos.partes}>{historico.recentes}{historico.porData(true)}</View>) : null}
    </>
  );
}

// Os mesmos vãos da 3ª coluna do Exercício: 12 entre o título e a peça, 24 entre as partes do histórico, 32 entre as colunas.
const estilos = StyleSheet.create({
  secao: { gap: espaco(1.5) },
  partes: { gap: espaco(3) },
  emDuas: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(4) },
  coluna: { flex: 1, minWidth: 0, gap: espaco(3) },
});
