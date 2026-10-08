import { useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { dataDaTela, mascaraData, numeroDaTela, numeroParaTela } from '../dominio/formatos';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes } from '../tema/tokens';
import { Campo } from './Campo';
import { Texto } from './Texto';

/**
 * Data digitada como DD/MM/AAAA (nunca o seletor nativo da web). O texto fica com a tela; quem usa converte com
 * `dataDaTela` (ISO, `null` se vazio, `undefined` se inválida).
 */
export function CampoData({
  rotulo,
  valor,
  aoMudar,
  erro,
}: {
  rotulo: string;
  valor: string;
  aoMudar: (texto: string) => void;
  erro?: string | null;
}) {
  const invalida = valor.length === 10 && dataDaTela(valor) === undefined;
  return (
    <Campo
      rotulo={rotulo}
      valor={valor}
      aoMudar={(t) => aoMudar(mascaraData(t))}
      placeholder="DD/MM/AAAA"
      keyboardType="number-pad"
      inputMode="numeric"
      maxLength={10}
      erro={erro ?? (invalida ? 'Data inválida.' : null)}
    />
  );
}

/**
 * Número ligado a um valor do plano. Guarda o texto enquanto a pessoa digita ("8," não vira 8 no meio) e só avisa
 * quem usa quando o texto é um número (ou vazio = `null`). Mudança de fora (receita, regra FS) atualiza o texto.
 */
export function CampoNumerico({
  rotulo,
  valor,
  aoMudar,
  inteiro,
  sufixo,
  ajuda,
  erro,
}: {
  rotulo: string;
  valor: number | null;
  aoMudar: (valor: number | null) => void;
  inteiro?: boolean;
  sufixo?: string;
  ajuda?: string;
  erro?: string | null;
}) {
  const [texto, setTexto] = useState(valor === null ? '' : numeroParaTela(valor, 3));
  const [anterior, setAnterior] = useState(valor);
  if (valor !== anterior) {
    // Valor mudou por fora: o campo acompanha (padrão do React para estado derivado de prop).
    setAnterior(valor);
    if (numeroDaTela(texto, inteiro) !== valor) setTexto(valor === null ? '' : numeroParaTela(valor, 3));
  }
  const lido = numeroDaTela(texto, inteiro);
  return (
    <Campo
      rotulo={sufixo ? `${rotulo} (${sufixo})` : rotulo}
      valor={texto}
      aoMudar={(t) => {
        setTexto(t);
        const n = numeroDaTela(t, inteiro);
        if (n !== undefined) {
          setAnterior(n);
          aoMudar(n);
        }
      }}
      keyboardType={inteiro ? 'number-pad' : 'decimal-pad'}
      inputMode={inteiro ? 'numeric' : 'decimal'}
      ajuda={ajuda}
      erro={erro ?? (lido === undefined ? (inteiro ? 'Use só números inteiros.' : 'Número inválido.') : null)}
    />
  );
}

/** Liga/desliga com o texto ao lado (o rótulo inteiro também alterna). */
export function Interruptor({
  rotulo,
  valor,
  aoMudar,
  ajuda,
}: {
  rotulo: string;
  valor: boolean;
  aoMudar: (valor: boolean) => void;
  ajuda?: string;
}) {
  const { cores, marca } = useTema();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={rotulo}
      accessibilityState={{ checked: valor }}
      onPress={() => aoMudar(!valor)}
      style={estilos.interruptor}>
      <View style={estilos.textos}>
        <Texto style={estilos.rotulo}>{rotulo}</Texto>
        {ajuda ? <Texto variante="pequeno">{ajuda}</Texto> : null}
      </View>
      <Switch
        value={valor}
        onValueChange={aoMudar}
        trackColor={{ true: marca, false: cores.borda }}
        thumbColor="#FFFFFF"
        // Na web o react-native-web pinta o botão ligado de verde-água se não receber esta cor.
        {...({ activeThumbColor: '#FFFFFF' } as object)}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  interruptor: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5), minHeight: ALVO_TOQUE },
  textos: { flex: 1, gap: 2 },
  rotulo: { fontFamily: fontes.semi },
});
