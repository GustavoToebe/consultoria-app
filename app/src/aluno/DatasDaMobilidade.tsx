import { Check } from 'lucide-react-native';
import { useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { dataCurta } from '../dominio/formatos';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../tema/tokens';
import { coresDaSelecao } from '../ui/selecao';
import { Texto } from '../ui/Texto';

/**
 * Escolha do dia para marcar a mobilidade ("Hoje · 19/10", "18/10"...): é um seletor na própria tela, então o dia aberto
 * segue a seleção invertida do app (fundo `texto`, letra `fundo`), como as `Escolha`, e não tem seta de navegar (que os
 * chips do treino têm, porque lá cada data abre outra tela). O ✓ diz que o dia tem algum item feito. A água do dia usa
 * os mesmos chips (`assunto` "Água", ✓ = dia com registro). `arranjo="linha"` (água no apoio do PC, 28/11): os dias
 * anteriores numa linha só, rolável na horizontal e aberta no fim (o dia mais perto de hoje), e "Hoje" fixo à direita, fora
 * da rolagem; o mesmo grupo de rádio. O padrão quebra em várias linhas.
 */
export function DatasDaMobilidade({
  datas,
  hoje,
  atual,
  comAlgoFeito,
  aoAbrir,
  assunto = 'Mobilidade',
  textoDoMarcado = 'com algo feito',
  arranjo = 'quebrar',
}: {
  datas: string[];
  hoje: string;
  /** A data que a tela está mostrando. */
  atual: string;
  comAlgoFeito: (data: string) => boolean;
  aoAbrir: (data: string) => void;
  /** Para o leitor de tela: "Mobilidade, 18/10" / "Dia da mobilidade". */
  assunto?: string;
  /** O que o ✓ quer dizer, para o leitor de tela. */
  textoDoMarcado?: string;
  arranjo?: 'quebrar' | 'linha';
}) {
  const { cores } = useTema();
  const rolagem = useRef<ScrollView>(null);
  const jaAbriuNoFim = useRef(false);
  const chip = (d: string) => {
    const escolhido = d === atual;
    const feito = comAlgoFeito(d);
    const rotulo = d === hoje ? `Hoje · ${dataCurta(d)}` : dataCurta(d);
    return (
      <Pressable
        key={d}
        accessibilityRole="radio"
        accessibilityLabel={`${assunto}, ${dataCurta(d)}${d === hoje ? ', hoje' : ''}${feito ? `, ${textoDoMarcado}` : ''}`}
        aria-checked={escolhido}
        accessibilityState={{ checked: escolhido }}
        onPress={() => { if (!escolhido) aoAbrir(d); }}
        style={({ pressed }) => [
          estilos.chip,
          {
            // Seleção neutra (`ui/selecao`): superfície de seleção + contorno forte, nunca inversão nem cor.
            backgroundColor: coresDaSelecao(cores, escolhido || pressed).fundo,
            borderColor: escolhido ? cores.texto : cores.bordaCampo,
          },
        ]}>
        {feito ? <Check size={16} color={cores.texto} strokeWidth={2.5} /> : null}
        <Texto numerico style={[estilos.texto, { color: cores.texto }]}>{rotulo}</Texto>
      </Pressable>
    );
  };
  const grupo = { accessibilityRole: 'radiogroup', accessibilityLabel: `Dia da ${assunto.toLowerCase()}` } as const;
  if (arranjo === 'linha') {
    const anteriores = datas.filter((d) => d !== hoje);
    return (
      <View style={estilos.linha} {...grupo}>
        {/* Abre no fim uma vez só (o ✓ que aparece depois muda a largura e não pode puxar a rolagem de quem voltou dias). */}
        <ScrollView ref={rolagem} horizontal style={estilos.rolagem} contentContainerStyle={estilos.anteriores}
          onContentSizeChange={() => { if (!jaAbriuNoFim.current) { jaAbriuNoFim.current = true; rolagem.current?.scrollToEnd({ animated: false }); } }}>
          {anteriores.map(chip)}
        </ScrollView>
        {datas.includes(hoje) ? <View style={estilos.hoje}>{chip(hoje)}</View> : null}
      </View>
    );
  }
  return <View style={estilos.chips} {...grupo}>{datas.map(chip)}</View>;
}

const FOLGA_DO_FOCO = 3;

const estilos = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
  linha: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(1) },
  // `minWidth: 0`: sem ele a rolagem cresce até caber todos e empurra o "Hoje" para fora do cartão.
  rolagem: { flex: 1, minWidth: 0 },
  // Folga de 3 px em volta: a rolagem corta o que passa dela, e o anel de foco do chip fica fora dele. A barra de rolagem
  // da web fica embaixo dos chips, sem encostar neles.
  anteriores: { gap: espaco(1), padding: FOLGA_DO_FOCO, paddingBottom: espaco(1) },
  hoje: { paddingVertical: FOLGA_DO_FOCO },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco(0.75),
    minHeight: ALVO_TOQUE,
    paddingHorizontal: espaco(1.5),
    borderRadius: RAIO,
    borderWidth: 1,
  },
  texto: { fontFamily: fontes.semi, fontSize: 15 },
});
