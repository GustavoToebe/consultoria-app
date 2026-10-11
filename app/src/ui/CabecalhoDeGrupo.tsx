import { ChevronDown, ChevronUp, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, LARGURA_MENU_LATERAL, RAIO } from '../tema/tokens';
import { Selo, type TipoSelo } from './Selo';
import { Texto } from './Texto';

interface Props {
  titulo: string;
  /** Linha `suave` com o resumo ("Segunda · Treino · 5 exercícios"). */
  resumo?: string;
  Icone?: LucideIcon;
  selo?: { texto: string; tipo: TipoSelo };
  /** Ações em ícone/botão pequeno; no celular descem para uma linha abaixo do título. */
  acoes?: ReactNode;
  /** Com `aoAlternar` o título vira botão que recolhe e abre; `aberto` mostra a seta certa. */
  aoAlternar?: () => void;
  aberto?: boolean;
  /** Ações só em ícone: ficam ao lado da seta também no celular, em vez de descer uma linha. */
  acoesJuntas?: boolean;
}

/**
 * Faixa de grupo (nível 2): sessão, refeição, pasta, dia. Fundo `superficie3` (o mais forte dos níveis) ocupando a
 * largura do cartão, com divisor embaixo, para o título se destacar do conteúdo. Vai no `cabecalho` do `Cartao`, que então deixa de ter padding em volta dela.
 */
export function CabecalhoDeGrupo({ titulo, resumo, Icone, selo, acoes, aoAlternar, aberto = true, acoesJuntas }: Props) {
  const { cores } = useTema();
  const { width } = useWindowDimensions();
  const largo = width >= LARGURA_MENU_LATERAL || !!acoesJuntas;
  const Seta = aberto ? ChevronUp : ChevronDown;
  const identificacao = (
    <>
      {Icone ? <Icone size={18} color={cores.textoSuave} /> : null}
      <View style={estilos.textos}>
        <Texto variante="bloco" style={estilos.titulo}>{titulo}</Texto>
        {resumo ? <Texto variante="suave" numerico>{resumo}</Texto> : null}
      </View>
      {selo ? <Selo texto={selo.texto} tipo={selo.tipo} /> : null}
    </>
  );
  return (
    <View
      style={[
        estilos.faixa,
        largo ? estilos.faixaLarga : estilos.faixaEstreita,
        { backgroundColor: cores.superficie3, borderColor: cores.borda },
      ]}>
      {aoAlternar ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${titulo}, ${aberto ? 'aberto' : 'recolhido'}`}
          accessibilityState={{ expanded: aberto }}
          onPress={aoAlternar}
          style={({ pressed }) => [estilos.identificacao, { opacity: pressed ? 0.7 : 1 }]}>
          {identificacao}
          <Seta size={18} color={cores.textoSuave} />
        </Pressable>
      ) : (
        <View style={estilos.identificacao}>{identificacao}</View>
      )}
      {acoes ? <View style={[estilos.acoes, !largo && estilos.acoesEstreitas]}>{acoes}</View> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  faixa: { borderBottomWidth: 1, borderTopLeftRadius: RAIO, borderTopRightRadius: RAIO, paddingHorizontal: espaco(2), paddingVertical: espaco(1) },
  faixaLarga: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1.5) },
  faixaEstreita: { gap: espaco(0.5) },
  identificacao: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), flexShrink: 1, flexGrow: 1, minHeight: ALVO_TOQUE },
  textos: { flexShrink: 1, flexGrow: 1, gap: 1 },
  titulo: { fontSize: 17, lineHeight: 22 },
  acoes: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), flexWrap: 'wrap', maxWidth: '100%' },
  acoesEstreitas: { paddingBottom: espaco(0.5) },
});
