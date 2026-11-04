import { useMemo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Configuracao, ExercicioPlano } from '../../api/tipos';
import { linhaDoExercicio, type ResumoDaSessaoPorContagem } from '../../dominio/inspetorDoTreino';
import { espaco } from '../../tema/tokens';
import { Texto } from '../../ui/Texto';
import { ItemDaListaDoEditor } from '../plano/ItemDaListaDoEditor';
import { AdicionarProximoExercicio } from './CartaoSessao';
import { estadoDoExercicio } from './estadoDoExercicio';
import { ResumoDaSessao } from './ResumoDaSessao';

/** Largura da coluna da esquerda (lista) em duas colunas; o inspetor fica com o resto. */
export const LARGURA_DA_LISTA = 360;

interface Props {
  /** O cartão da metodologia (`MetodologiaDoPlano`), acima da lista. */
  metodologia: ReactNode;
  /** Os itens (`ItemDaListaDeExercicios`), com os grupos de exercícios (`GrupoNaLista`: linha do grupo e os membros embaixo). */
  children: ReactNode;
  vazia: boolean;
  resumo: ResumoDaSessaoPorContagem;
  adicionar: Parameters<typeof AdicionarProximoExercicio>[0];
}

/**
 * Coluna da esquerda do editor de treino em duas colunas (mestre): metodologia, um item por exercício da sessão, o bloco
 * tracejado "Adicionar próximo exercício" e o "Resumo da sessão". O exercício escolhido abre no inspetor, à direita.
 */
export function ListaDeExercicios({ metodologia, children, vazia, resumo, adicionar }: Props) {
  return (
    <View style={estilos.coluna}>
      {metodologia}
      <View style={estilos.itens} role="group" accessibilityLabel="Exercícios da sessão">
        {vazia ? <Texto variante="suave">Nenhum exercício nesta sessão ainda.</Texto> : children}
      </View>
      <AdicionarProximoExercicio {...adicionar} />
      <ResumoDaSessao resumo={resumo} />
    </View>
  );
}

interface PropsDoItem {
  exercicio: ExercicioPlano;
  posicao: number;
  total: number;
  config: Configuracao | null;
  /** É o que está no inspetor. */
  escolhido: boolean;
  /** Erro da validação do servidor ou da local casado com este exercício (borda vermelha, como no cartão). */
  comProblema: boolean;
  aoEscolher: () => void;
}

/** Item da lista: o `ItemDaListaDoEditor` com o selo de situação (`estadoDoExercicio`) e a linha das séries (`linhaDoExercicio`). */
export function ItemDaListaDeExercicios({ exercicio: e, posicao, total, config, escolhido, comProblema, aoEscolher }: PropsDoItem) {
  const estado = useMemo(() => estadoDoExercicio(e, config), [e, config]);
  const linha = useMemo(() => linhaDoExercicio(e, config), [e, config]);
  const nome = e.nome || 'sem nome';
  return (
    <ItemDaListaDoEditor numero={posicao + 1} titulo={nome} selo={estado} linha={linha} escolhido={escolhido}
      comProblema={comProblema || estado.tipo === 'perigo'} aoEscolher={aoEscolher}
      rotulo={`Exercício ${posicao + 1} de ${total}: ${nome}, ${estado.texto}. ${linha}`} />
  );
}

const estilos = StyleSheet.create({
  coluna: { width: LARGURA_DA_LISTA, flexShrink: 0, gap: espaco(1.5) },
  itens: { gap: espaco(1) },
});
