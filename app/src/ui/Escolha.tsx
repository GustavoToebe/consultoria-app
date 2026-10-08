import { Pressable, StyleSheet, View } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../tema/tokens';
import { Texto } from './Texto';

export interface OpcaoEscolha<T> {
  valor: T;
  rotulo: string;
}

interface Props<T> {
  opcoes: OpcaoEscolha<T>[];
  valor: T;
  aoMudar: (valor: T) => void;
  rotulo?: string;
  /** Rótulo lido pelo leitor de tela quando não há rótulo visível. */
  descricao?: string;
}

/** Escolha entre poucas opções (dia da semana, tipo de série, tema): botões lado a lado que quebram linha. */
export function Escolha<T extends string | number | null>({ opcoes, valor, aoMudar, rotulo, descricao }: Props<T>) {
  const { cores, marca, sobreMarca } = useTema();
  return (
    <View style={estilos.campo}>
      {rotulo ? <Texto variante="pequeno" style={estilos.rotulo}>{rotulo}</Texto> : null}
      <View style={estilos.linha} accessibilityRole="radiogroup" accessibilityLabel={rotulo ?? descricao}>
        {opcoes.map((o) => {
          const ativo = o.valor === valor;
          return (
            <Pressable
              key={String(o.valor)}
              accessibilityRole="radio"
              accessibilityLabel={o.rotulo}
              accessibilityState={{ checked: ativo }}
              onPress={() => aoMudar(o.valor)}
              style={({ pressed }) => [
                estilos.opcao,
                {
                  backgroundColor: ativo ? marca : cores.superficie2,
                  borderColor: ativo ? marca : cores.borda,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}>
              <Texto style={[estilos.texto, { color: ativo ? sobreMarca : cores.texto }]}>{o.rotulo}</Texto>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  campo: { gap: espaco(0.5) },
  rotulo: { fontFamily: fontes.semi },
  linha: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(0.75) },
  opcao: {
    maxWidth: '100%',
    minHeight: 40,
    minWidth: 44,
    paddingHorizontal: espaco(1.5),
    borderRadius: RAIO,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texto: { fontFamily: fontes.semi, fontSize: 14, flexShrink: 1, paddingVertical: 4 },
});
