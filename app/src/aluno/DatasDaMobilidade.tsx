import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { dataCurta } from '../dominio/formatos';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../tema/tokens';
import { Texto } from '../ui/Texto';

/**
 * Escolha do dia para marcar a mobilidade ("Hoje · 19/10", "18/10"...): é um seletor na própria tela, então o dia aberto
 * segue a seleção invertida do app (fundo `texto`, letra `fundo`), como as `Escolha`, e não tem seta de navegar (que os
 * chips do treino têm, porque lá cada data abre outra tela). O ✓ diz que o dia tem algum item feito. A água do dia usa
 * os mesmos chips (`assunto` "Água", ✓ = dia com registro).
 */
export function DatasDaMobilidade({
  datas,
  hoje,
  atual,
  comAlgoFeito,
  aoAbrir,
  assunto = 'Mobilidade',
  textoDoMarcado = 'com algo feito',
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
}) {
  const { cores } = useTema();
  return (
    <View style={estilos.chips} accessibilityRole="radiogroup" accessibilityLabel={`Dia da ${assunto.toLowerCase()}`}>
      {datas.map((d) => {
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
                backgroundColor: escolhido ? cores.texto : cores.superficie2,
                borderColor: escolhido ? cores.texto : cores.borda,
                opacity: pressed && !escolhido ? 0.75 : 1,
              },
            ]}>
            {feito ? <Check size={16} color={escolhido ? cores.fundo : cores.sucesso} strokeWidth={2.5} /> : null}
            <Texto numerico style={[estilos.texto, { color: escolhido ? cores.fundo : cores.texto }]}>{rotulo}</Texto>
          </Pressable>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
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
