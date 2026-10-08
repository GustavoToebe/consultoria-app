import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ScrollView, StyleSheet } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes } from '../tema/tokens';
import { Texto } from './Texto';

interface Props<T extends string> {
  abas: { valor: T; rotulo: string }[];
  ativa: T;
  aoMudar: (valor: T) => void;
}

/** Abas de texto com sublinhado na cor da marca; rolam na horizontal se não couberem no celular. */
export function Abas<T extends string>({ abas, ativa, aoMudar }: Props<T>) {
  const { cores, marca } = useTema();
  return (
    <Tabs value={ativa} onValueChange={(v) => aoMudar(v as T)} style={[estilos.borda, { borderColor: cores.borda }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.linha}>
        <TabsList style={estilos.linha}>
          {abas.map((a) => {
            const sel = a.valor === ativa;
            return (
              <TabsTrigger value={a.valor}
                key={a.valor}
                accessibilityRole="tab"
                accessibilityState={{ selected: sel }}
                style={[estilos.aba, { borderColor: sel ? marca : 'transparent' }]}>
                <Texto style={[estilos.texto, { color: sel ? cores.texto : cores.textoSuave }]}>{a.rotulo}</Texto>
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
    minHeight: ALVO_TOQUE,
    paddingHorizontal: espaco(1.5),
    justifyContent: 'center',
    // O gatilho do RNR traz borda nos quatro lados, cantos e fundo na aba ativa; aqui a aba ativa é só o sublinhado.
    borderWidth: 0,
    borderBottomWidth: 2,
    borderRadius: 0,
    backgroundColor: 'transparent',
    marginBottom: -1,
  },
  texto: { fontFamily: fontes.semi, fontSize: 15 },
});
