import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { ESTILOS_TEXTO } from './tipografia';
import { useState } from 'react';
import { StyleSheet, View, type TextInputProps } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../tema/tokens';
import { Texto } from './Texto';

interface Props extends Omit<TextInputProps, 'style' | 'onChangeText' | 'value'> {
  numerico?: boolean;
  rotulo: string;
  valor: string;
  aoMudar: (texto: string) => void;
  erro?: string | null;
  ajuda?: string;
  /** Campo de várias linhas (observações). */
  linhas?: number;
}

export function Campo({ rotulo, valor, aoMudar, erro, ajuda, linhas, numerico, ...resto }: Props) {
  const { cores, marca } = useTema();
  const [foco, setFoco] = useState(false);
  const corBorda = erro ? cores.perigo : foco ? marca : cores.borda;
  return (
    <View style={estilos.campo}>
      <Label style={[ESTILOS_TEXTO.pequeno, estilos.rotulo, { color: cores.textoSuave }]}>{rotulo}</Label>
      <Input
        {...resto}
        accessibilityLabel={rotulo}
        value={valor}
        onChangeText={aoMudar}
        onFocus={(e) => {
          setFoco(true);
          resto.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFoco(false);
          resto.onBlur?.(e);
        }}
        multiline={!!linhas}
        numberOfLines={linhas}
        placeholderTextColor={cores.textoSuave}
        style={[
          estilos.entrada,
          numerico ? { fontVariant: ['tabular-nums'] } : null,
          linhas ? { minHeight: linhas * 22 + 20, textAlignVertical: 'top' } : null,
          { color: cores.texto, backgroundColor: cores.superficie2, borderColor: corBorda },
        ]}
      />
      {erro ? <Texto variante="pequeno" cor={cores.perigo}>{erro}</Texto> : null}
      {!erro && ajuda ? <Texto variante="pequeno">{ajuda}</Texto> : null}
    </View>
  );
}

/**
 * Campo numérico com teclado decimal. Aceita vírgula e guarda exatamente o que foi digitado (o arredondamento é
 * só para sugestão; o valor do aluno nunca é arredondado).
 */
export function CampoNumero(props: Omit<Props, 'keyboardType'>) {
  return <Campo {...props} numerico keyboardType="decimal-pad" inputMode="decimal" />;
}

const estilos = StyleSheet.create({
  campo: { gap: espaco(0.5) },
  rotulo: { fontFamily: fontes.semi },
  entrada: {
    minHeight: ALVO_TOQUE,
    borderWidth: 1,
    borderRadius: RAIO,
    paddingHorizontal: espaco(1.5),
    paddingVertical: espaco(1),
    fontFamily: fontes.normal,
    fontSize: 16,
  },
});

