import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, LINHA_DA_FAIXA } from '../tema/tokens';
import { Esmaecido, useEsmaecimento } from './FaixaDeChips';
import { Texto } from './Texto';

interface Props<T extends string> {
  /** `contagem` aparece num círculo ao lado do rótulo ("Para revisar 3"). */
  abas: { valor: T; rotulo: string; contagem?: number }[];
  ativa: T;
  aoMudar: (valor: T) => void;
  /** Cor atrás das abas (fundo da tela ou superfície do cartão), para o esmaecido das bordas casar. */
  fundo?: string;
}

/**
 * Abas de texto com sublinhado de 3 px na cor da marca (a mesma espessura da linha da faixa, `LINHA_DA_FAIXA`); rolam na horizontal se não couberem no celular, com a borda esmaecida
 * do lado em que há mais abas (sem isso "Atua…" parecia cortado). Alvo de 44 px.
 */
export function Abas<T extends string>({ abas, ativa, aoMudar, fundo }: Props<T>) {
  const { cores, marca } = useTema();
  const { direita, esquerda, medidas } = useEsmaecimento();
  const cor = fundo ?? cores.fundo;
  return (
    <Tabs value={ativa} onValueChange={(v) => aoMudar(v as T)} style={[estilos.borda, { borderColor: cores.borda }]}>
      <View style={estilos.area}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.linha} {...medidas}>
        <TabsList style={estilos.linha}>
          {abas.map((a) => {
            const sel = a.valor === ativa;
            const rotulo = a.contagem === undefined ? a.rotulo : `${a.rotulo} (${a.contagem})`;
            return (
              <TabsTrigger value={a.valor}
                key={a.valor}
                accessibilityRole="tab"
                accessibilityLabel={rotulo}
                accessibilityState={{ selected: sel }}
                style={[estilos.aba, { borderColor: sel ? marca : 'transparent' }]}>
                <View style={estilos.conteudo}>
                  <Texto style={[estilos.texto, { color: sel ? cores.texto : cores.textoSuave }]}>{a.rotulo}</Texto>
                  {a.contagem === undefined ? null : (
                    <View style={[estilos.contagem, { backgroundColor: sel ? cores.texto : cores.superficie2, borderColor: sel ? cores.texto : cores.borda }]}>
                      <Texto numerico style={[estilos.textoContagem, { color: sel ? cores.fundo : cores.textoSuave }]}>{a.contagem}</Texto>
                    </View>
                  )}
                </View>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </ScrollView>
      {direita ? <Esmaecido cor={cor} lado="direita" /> : null}
      {esquerda ? <Esmaecido cor={cor} lado="esquerda" /> : null}
      </View>
    </Tabs>
  );
}

const estilos = StyleSheet.create({
  borda: { borderBottomWidth: 1 },
  area: { position: 'relative' },
  linha: { flexDirection: 'row' },
  aba: {
    // 44 px de alvo mais o sublinhado, que entra na própria altura.
    minHeight: ALVO_TOQUE + LINHA_DA_FAIXA,
    paddingHorizontal: espaco(1.5),
    justifyContent: 'center',
    // O gatilho do RNR traz borda nos quatro lados, cantos e fundo na aba ativa; aqui a aba ativa é só o sublinhado.
    borderWidth: 0,
    borderBottomWidth: LINHA_DA_FAIXA,
    borderRadius: 0,
    backgroundColor: 'transparent',
    marginBottom: -1,
  },
  conteudo: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.75) },
  texto: { fontFamily: fontes.semi, fontSize: 15 },
  contagem: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  textoContagem: { fontFamily: fontes.semi, fontSize: 12, lineHeight: 16 },
});
