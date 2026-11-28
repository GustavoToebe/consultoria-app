import { ChevronRight } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes } from '../../tema/tokens';
import { NumeroInvertido } from '../../ui/NumeroInvertido';
import { coresDaEdicao } from '../../ui/selecao';
import { SeloEditando } from '../../ui/SeloEditando';
import { Selo, type TipoSelo } from '../../ui/Selo';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';
import type { LucideIcon } from 'lucide-react-native';

interface Props {
  numero: number;
  titulo: string;
  selo?: { texto: string; tipo: TipoSelo; Icone?: LucideIcon };
  /** Linha de resumo embaixo do título ("3 séries: 3 WS", "540 kcal · 3 itens"). */
  linha: string;
  rotulo: string;
  /** É o que está no inspetor. */
  escolhido: boolean;
  /** Borda vermelha (erro da validação casado com o item). */
  comProblema: boolean;
  aoEscolher: () => void;
  /** Alça de arrastar (`ui/ArrasteDaLista`), à esquerda e fora do botão: tocar nela não escolhe o item. */
  alca?: ReactNode;
  /** Ícone antes do título (o cardio na lista do treino), decorativo: o resumo já diz o tipo. */
  Icone?: LucideIcon;
}

/**
 * Item da lista (mestre) dos editores em duas colunas (exercício, refeição, seção da mobilidade): número, título, selo,
 * resumo e a seta. O escolhido é o item EM EDIÇÃO (visual-ponytail, 17/11, `coresDaEdicao`): fundo `acaoSuave`, contorno e
 * barra na cor de ação com halo, número cheio e o selo "Editando", com `aria-current` e `selected`. Os outros ficam sem
 * fundo nem contorno (só o hover), como as linhas do canvas.
 */
export function ItemDaListaDoEditor({ numero, titulo, selo, linha, rotulo, escolhido, comProblema, aoEscolher, alca, Icone }: Props) {
  const { cores, bordas } = useTema();
  const edicao = coresDaEdicao(cores);
  const borda = escolhido ? edicao.borda : comProblema ? cores.perigo : 'transparent';
  const item = (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: escolhido }}
      aria-current={escolhido ? 'true' : undefined}
      accessibilityLabel={rotulo}
      onPress={aoEscolher}
      style={(s) => [
        estilos.item,
        alca ? estilos.aoLado : null,
        {
          borderWidth: bordas.bloco,
          borderLeftWidth: BARRA,
          borderColor: borda,
          // Escolhido e com erro: o contorno é o da seleção, a barra continua vermelha (o erro não some ao escolher).
          borderLeftColor: comProblema ? cores.perigo : borda,
          backgroundColor: escolhido ? edicao.fundo : sobre(s) ? cores.sobre : 'transparent',
          boxShadow: escolhido ? edicao.halo : undefined,
        },
      ]}>
      <NumeroInvertido numero={numero} invertido={escolhido} emEdicao={escolhido} />
      <View style={estilos.meio}>
        {Icone ? (
          <View style={estilos.titulo}>
            <View aria-hidden style={estilos.iconeDoTitulo}><Icone size={16} color={cores.textoSuave} strokeWidth={2} /></View>
            <Texto style={[estilos.nome, estilos.nomeAoLado]} numberOfLines={2}>{titulo}</Texto>
          </View>
        ) : <Texto style={estilos.nome} numberOfLines={2}>{titulo}</Texto>}
        {escolhido ? <SeloEditando /> : null}
        {selo ? <View style={estilos.selo}><Selo texto={selo.texto} tipo={selo.tipo} Icone={selo.Icone} /></View> : null}
        <Texto variante="pequeno" numerico numberOfLines={2}>{linha}</Texto>
      </View>
      <ChevronRight size={18} color={escolhido ? cores.acao : cores.textoSuave} strokeWidth={2} />
    </Pressable>
  );
  return alca ? <View style={estilos.comAlca}>{alca}{item}</View> : item;
}

/** Barra da esquerda do item, sempre com a mesma largura (só a cor muda): escolher outro item não empurra o texto. */
const BARRA = 4;

const estilos = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.25), minHeight: ALVO_TOQUE, borderRadius: 12, paddingVertical: espaco(1), paddingHorizontal: espaco(1.25) },
  meio: { flex: 1, gap: 4 },
  nome: { fontFamily: fontes.semi, fontSize: 15, lineHeight: 20 },
  // O ícone alinha com a primeira linha do título (20 px de altura de linha, ícone de 16).
  titulo: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(0.75) },
  nomeAoLado: { flex: 1, minWidth: 0 },
  iconeDoTitulo: { marginTop: 2 },
  selo: { flexDirection: 'row' },
  comAlca: { flexDirection: 'row', alignItems: 'stretch', gap: espaco(0.25) },
  aoLado: { flex: 1, minWidth: 0 },
});
