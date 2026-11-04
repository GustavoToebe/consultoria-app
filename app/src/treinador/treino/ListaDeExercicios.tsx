import { ChevronRight } from 'lucide-react-native';
import { useMemo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Configuracao, ExercicioPlano } from '../../api/tipos';
import { linhaDoExercicio, type ResumoDaSessaoPorContagem } from '../../dominio/inspetorDoTreino';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../../tema/tokens';
import { Selo } from '../../ui/Selo';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';
import { AdicionarProximoExercicio } from './CartaoSessao';
import { estadoDoExercicio } from './estadoDoExercicio';
import { ResumoDaSessao } from './ResumoDaSessao';

/** Largura da coluna da esquerda (lista) em duas colunas; o inspetor fica com o resto. */
export const LARGURA_DA_LISTA = 360;

interface Props {
  /** O cartão da metodologia (`MetodologiaDoPlano`), acima da lista. */
  metodologia: ReactNode;
  /** Os itens (`ItemDaListaDeExercicios`), com os grupos de exercícios (`CartaoGrupo`) em volta dos membros. */
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
      <View style={estilos.itens} accessibilityLabel="Exercícios da sessão">
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

/**
 * Item da lista: número, nome, selo de situação (`estadoDoExercicio`) e a linha das séries (`linhaDoExercicio`). O
 * escolhido segue a seleção invertida do app (borda e barra na cor do texto, número invertido, como a aba de série
 * aberta), com `aria-current` e `selected`; a cor da marca ficava igual à do erro em marca vermelha. Tab e Enter escolhem.
 */
export function ItemDaListaDeExercicios({ exercicio: e, posicao, total, config, escolhido, comProblema, aoEscolher }: PropsDoItem) {
  const { cores, bordas } = useTema();
  const estado = useMemo(() => estadoDoExercicio(e, config), [e, config]);
  const linha = useMemo(() => linhaDoExercicio(e, config), [e, config]);
  const nome = e.nome || 'sem nome';
  const erro = comProblema || estado.tipo === 'perigo';
  const borda = escolhido ? cores.texto : erro ? cores.perigo : cores.borda;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: escolhido }}
      aria-current={escolhido ? 'true' : undefined}
      accessibilityLabel={`Exercício ${posicao + 1} de ${total}: ${nome}, ${estado.texto}. ${linha}`}
      onPress={aoEscolher}
      style={(s) => [
        estilos.item,
        {
          borderWidth: bordas.bloco,
          borderLeftWidth: BARRA,
          borderColor: borda,
          borderLeftColor: borda,
          backgroundColor: escolhido ? cores.superficie : sobre(s) ? cores.superficie3 : cores.superficie2,
        },
      ]}>
      <View style={[estilos.numero, escolhido ? { backgroundColor: cores.texto, borderColor: cores.texto } : { borderColor: cores.bordaCampo }]}>
        <Texto numerico style={[estilos.textoDoNumero, { color: escolhido ? cores.fundo : cores.texto }]}>{posicao + 1}</Texto>
      </View>
      <View style={estilos.meio}>
        <Texto style={estilos.nome} numberOfLines={2}>{nome}</Texto>
        <View style={estilos.selo}><Selo texto={estado.texto} tipo={estado.tipo} Icone={estado.Icone} /></View>
        <Texto variante="pequeno" numerico numberOfLines={2}>{linha}</Texto>
      </View>
      <ChevronRight size={18} color={escolhido ? cores.texto : cores.textoSuave} strokeWidth={2} />
    </Pressable>
  );
}

/** Barra da esquerda do item, sempre com a mesma largura (só a cor muda): escolher outro item não empurra o texto. */
const BARRA = 4;

const estilos = StyleSheet.create({
  coluna: { width: LARGURA_DA_LISTA, flexShrink: 0, gap: espaco(1.5) },
  itens: { gap: espaco(1) },
  item: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.25), minHeight: ALVO_TOQUE, borderRadius: RAIO, paddingVertical: espaco(1), paddingHorizontal: espaco(1.25) },
  numero: { width: 28, height: 28, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  textoDoNumero: { fontFamily: fontes.semi, fontSize: 13 },
  meio: { flex: 1, gap: 4 },
  nome: { fontFamily: fontes.semi, fontSize: 15, lineHeight: 20 },
  selo: { flexDirection: 'row' },
});
