import { useMemo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Configuracao, ExercicioPlano } from '../../api/tipos';
import { linhaDoExercicio } from '../../dominio/inspetorDoTreino';
import { espaco } from '../../tema/tokens';
import { ItemDaListaDoEditor } from '../plano/ItemDaListaDoEditor';
import { AdicionarProximoExercicio } from './CartaoSessao';
import { estadoDoExercicio } from './estadoDoExercicio';

/**
 * Largura da coluna da esquerda (lista) em duas colunas: 30% da linha, entre `LARGURA_MINIMA_DA_LISTA` e
 * `LARGURA_DA_LISTA`; o inspetor fica com o resto. Vale a medida da linha, não a janela: num notebook de 1280 px a lista
 * encolhe e o inspetor mantém Séries, Repetições e Descanso lado a lado (N23, 08/11).
 */
export const LARGURA_DA_LISTA = 360;
const LARGURA_MINIMA_DA_LISTA = espaco(30);

interface Props {
  /** Os itens (`ItemDaListaDeExercicios`), com os grupos de exercícios (`GrupoNaLista`: linha do grupo e os membros embaixo). */
  children: ReactNode;
  adicionar: Parameters<typeof AdicionarProximoExercicio>[0];
}

/**
 * Coluna da esquerda do editor de treino em duas colunas (mestre): um item por exercício da sessão e o bloco tracejado
 * "Adicionar próximo exercício" (com o "Criar grupo"). O exercício escolhido abre no inspetor, à direita. Os totais e a
 * distribuição ficam no cabeçalho da sessão; a sessão vazia nem chega aqui (convite "Monte esta sessão", 10/11).
 */
export function ListaDeExercicios({ children, adicionar }: Props) {
  return (
    <View style={estilos.coluna}>
      <View style={estilos.itens} role="group" accessibilityLabel="Exercícios da sessão">{children}</View>
      <AdicionarProximoExercicio {...adicionar} />
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
  // Só a pendência ganha selo: "Pronto" em todo item virava ruído (10/11).
  const pendente = estado.tipo !== 'sucesso';
  return (
    <ItemDaListaDoEditor numero={posicao + 1} titulo={nome} selo={pendente ? estado : undefined} linha={linha} escolhido={escolhido}
      comProblema={comProblema || estado.tipo === 'perigo'} aoEscolher={aoEscolher}
      rotulo={`Exercício ${posicao + 1} de ${total}: ${nome}${pendente ? `, ${estado.texto}` : ''}. ${linha}`} />
  );
}

const estilos = StyleSheet.create({
  coluna: { flexBasis: '30%', minWidth: LARGURA_MINIMA_DA_LISTA, maxWidth: LARGURA_DA_LISTA, flexShrink: 0, gap: espaco(1.5) },
  itens: { gap: espaco(1) },
});
