import { HeartPulse } from 'lucide-react-native';
import { useMemo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Configuracao, ExercicioPlano } from '../../api/tipos';
import { agrupar } from '../../dominio/agrupamento';
import { blocoContinuo, resumoDaLista } from '../../dominio/cardio';
import { LARGURA_DA_LISTA_DO_TREINO } from '../../dominio/colunasDoEditor';
import { linhaDoExercicio } from '../../dominio/inspetorDoTreino';
import { blocoSemDescanso, TEXTO_FALTA_DESCANSO } from '../../dominio/pontosParaRevisar';
import { espaco } from '../../tema/tokens';
import { Texto } from '../../ui/Texto';
import { ItemDaListaDoEditor } from '../plano/ItemDaListaDoEditor';
import { AdicionarProximoExercicio } from './CartaoSessao';
import { estadoDoExercicio, type EstadoDoExercicio } from './estadoDoExercicio';

/**
 * Coluna da esquerda (lista) em duas ou três colunas: 30% da linha, entre `LARGURA_MINIMA_DA_LISTA` e 300 px
 * (`LARGURA_DA_LISTA_DO_TREINO`, SERIE-ABERTA 0.5); o inspetor fica com o resto. Vale a medida da linha, não a janela:
 * num notebook de 1280 px a lista encolhe e o inspetor mantém Séries, Repetições e Descanso lado a lado (N23, 08/11).
 */
const LARGURA_MINIMA_DA_LISTA = espaco(30);

interface Props {
  /** Os itens (`ItemDaListaDeExercicios`), com os grupos de exercícios (`GrupoNaLista`: linha do grupo e os membros embaixo). */
  children: ReactNode;
  adicionar: Parameters<typeof AdicionarProximoExercicio>[0];
  /** Quantos exercícios a sessão tem: o título "Exercícios · 7". Sem ele, a lista fica sem título. */
  total?: number;
}

/**
 * Coluna da esquerda do editor de treino (mestre): o título "Exercícios · N", um item por exercício da sessão e o bloco
 * tracejado "Adicionar próximo exercício" (com o "Criar grupo"). O exercício escolhido abre no inspetor, à direita. A
 * sessão vazia nem chega aqui (convite "Monte esta sessão", 10/11).
 */
export function ListaDeExercicios({ children, adicionar, total }: Props) {
  return (
    <View style={estilos.coluna}>
      {total != null ? <Texto variante="rotulo" nivel={3} numerico>{`Exercícios · ${total}`}</Texto> : null}
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
  /** Alça de arrastar (`ui/ArrasteDaLista`). */
  alca?: ReactNode;
  /**
   * Cada série guarda o próprio descanso (falso no membro de grupo com descanso só do grupo: superset, circuito). É o
   * mesmo `descansoPorSerie` do cartão. Sem ele, só o exercício solto entra na pendência "Falta o descanso".
   */
  descansoPorSerie?: boolean;
}

/** "Falta o descanso" (SERIE-ABERTA 0.6): a mesma regra de `pontosDaSessao` (cardio e descanso só do grupo ficam fora). */
function faltaODescanso(e: ExercicioPlano, descansoPorSerie: boolean): boolean {
  return descansoPorSerie && e.modalidade !== 'CARDIO' && agrupar(e.series).some(blocoSemDescanso);
}

/**
 * Selo do item: só pendência ganha selo ("Pronto" em todo item virava ruído, 10/11). Problema, carga ou aviso da
 * validação vêm antes; sem nenhum deles, a série sem descanso vira "Falta o descanso" em âmbar (não trava publicar).
 */
export function seloDoItem(estado: EstadoDoExercicio, semDescanso: boolean): EstadoDoExercicio | { tipo: 'atencao'; texto: string } | undefined {
  if (estado.tipo !== 'sucesso') return estado;
  return semDescanso ? { tipo: 'atencao', texto: TEXTO_FALTA_DESCANSO } : undefined;
}

/** Item da lista: o `ItemDaListaDoEditor` com o selo de pendência e a linha das séries (`linhaDoExercicio`). */
export function ItemDaListaDeExercicios({ exercicio: e, posicao, total, config, escolhido, comProblema, aoEscolher, alca, descansoPorSerie }: PropsDoItem) {
  const estado = useMemo(() => estadoDoExercicio(e, config), [e, config]);
  const selo = seloDoItem(estado, faltaODescanso(e, descansoPorSerie ?? !e.grupoUid));
  // Cardio: o resumo dos blocos ("SIT · 6 × 30 s · ~25 min", "2 blocos · ~30 min"), o mesmo do cabeçalho do inspetor.
  const linha = useMemo(() => (e.modalidade === 'CARDIO' && e.series.length
    ? `Cardio · ${resumoDaLista(e.series.map((s) => s.cardio ?? blocoContinuo()))}`
    : linhaDoExercicio(e, config)), [e, config]);
  const nome = e.nome || 'sem nome';
  return (
    <ItemDaListaDoEditor numero={posicao + 1} titulo={nome} selo={selo} linha={linha} escolhido={escolhido}
      Icone={e.modalidade === 'CARDIO' ? HeartPulse : undefined}
      comProblema={comProblema || estado.tipo === 'perigo'} aoEscolher={aoEscolher} alca={alca}
      rotulo={`Exercício ${posicao + 1} de ${total}: ${nome}${selo ? `, ${selo.texto}` : ''}. ${linha}`} />
  );
}

const estilos = StyleSheet.create({
  coluna: { flexBasis: '30%', minWidth: LARGURA_MINIMA_DA_LISTA, maxWidth: LARGURA_DA_LISTA_DO_TREINO, flexShrink: 0, gap: espaco(1.5) },
  itens: { gap: espaco(1) },
});
