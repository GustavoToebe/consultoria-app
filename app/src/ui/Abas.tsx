import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes } from '../tema/tokens';
import { Texto } from './Texto';

interface Props<T extends string> {
  /** `contagem` aparece num círculo ao lado do rótulo ("Para revisar 3"). */
  abas: { valor: T; rotulo: string; contagem?: number }[];
  ativa: T;
  aoMudar: (valor: T) => void;
}

/** Abas de texto com sublinhado na cor da marca; rolam na horizontal se não couberem no celular. Alvo de 44 px. */
export function Abas<T extends string>({ abas, ativa, aoMudar }: Props<T>) {
  const { cores, marca } = useTema();
  return (
    <Tabs value={ativa} onValueChange={(v) => aoMudar(v as T)} style={[estilos.borda, { borderColor: cores.borda }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.linha}>
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
    </Tabs>
  );
}

const estilos = StyleSheet.create({
  borda: { borderBottomWidth: 1 },
  linha: { flexDirection: 'row' },
  aba: {
    // 44 px de alvo mais os 2 px do sublinhado, que entram na própria altura.
    minHeight: ALVO_TOQUE + 2,
    paddingHorizontal: espaco(1.5),
    justifyContent: 'center',
    // O gatilho do RNR traz borda nos quatro lados, cantos e fundo na aba ativa; aqui a aba ativa é só o sublinhado.
    borderWidth: 0,
    borderBottomWidth: 2,
    borderRadius: 0,
    backgroundColor: 'transparent',
    marginBottom: -1,
  },
  conteudo: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.75) },
  texto: { fontFamily: fontes.semi, fontSize: 15 },
  contagem: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  textoContagem: { fontFamily: fontes.semi, fontSize: 12, lineHeight: 16 },
});
