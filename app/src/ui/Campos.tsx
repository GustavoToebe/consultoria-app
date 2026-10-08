import { useState } from 'react';
import { Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';

import { dataDaTela, mascaraData, numeroDaTela, numeroParaTela } from '../dominio/formatos';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../tema/tokens';
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
      numerico
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
  const { texto, lido, mudar } = useNumeroDigitado(valor, aoMudar, inteiro);
  return (
    <Campo
      numerico
      rotulo={sufixo ? `${rotulo} (${sufixo})` : rotulo}
      valor={texto}
      aoMudar={mudar}
      keyboardType={inteiro ? 'number-pad' : 'decimal-pad'}
      inputMode={inteiro ? 'numeric' : 'decimal'}
      ajuda={ajuda}
      erro={erro ?? (lido === undefined ? (inteiro ? 'Use só números inteiros.' : 'Número inválido.') : null)}
    />
  );
}

/** Texto do campo numérico: guarda o que foi digitado e só repassa quando é número (ou vazio = `null`). */
function useNumeroDigitado(valor: number | null, aoMudar: (valor: number | null) => void, inteiro?: boolean) {
  const [texto, setTexto] = useState(valor === null ? '' : numeroParaTela(valor, 3));
  const [anterior, setAnterior] = useState(valor);
  if (valor !== anterior) {
    // Valor mudou por fora: o campo acompanha (padrão do React para estado derivado de prop).
    setAnterior(valor);
    if (numeroDaTela(texto, inteiro) !== valor) setTexto(valor === null ? '' : numeroParaTela(valor, 3));
  }
  const mudar = (t: string) => {
    setTexto(t);
    const n = numeroDaTela(t, inteiro);
    if (n !== undefined) {
      setAnterior(n);
      aoMudar(n);
    }
  };
  return { texto, lido: numeroDaTela(texto, inteiro), mudar };
}

/**
 * Número grande para registrar a série no celular: rótulo em caixa alta, valor em destaque e a unidade dentro da
 * caixa. Mesma regra do `CampoNumerico`: grava exatamente o que foi digitado.
 */
export function CampoNumericoGrande({
  rotulo,
  valor,
  aoMudar,
  inteiro,
  sufixo,
  rotuloAcessivel,
  destaque,
}: {
  rotulo: string;
  valor: number | null;
  aoMudar: (valor: number | null) => void;
  inteiro?: boolean;
  sufixo?: string;
  /** Rótulo completo para o leitor de tela ("Peso da série 2"). */
  rotuloAcessivel?: string;
  /** Caixa maior (carga de trabalho do dia). */
  destaque?: boolean;
}) {
  const { cores, marca } = useTema();
  const [foco, setFoco] = useState(false);
  const { texto, lido, mudar } = useNumeroDigitado(valor, aoMudar, inteiro);
  const corBorda = lido === undefined ? cores.perigo : foco ? marca : cores.borda;
  return (
    <View style={estilos.grande}>
      <Texto variante="secao">{rotulo}</Texto>
      <View style={[estilos.caixa, destaque && estilos.caixaDestaque, { backgroundColor: cores.fundo, borderColor: corBorda }]}>
        <TextInput
          accessibilityLabel={rotuloAcessivel ?? rotulo}
          value={texto}
          onChangeText={mudar}
          onFocus={() => setFoco(true)}
          onBlur={() => setFoco(false)}
          placeholder="—"
          placeholderTextColor={cores.textoSuave}
          keyboardType={inteiro ? 'number-pad' : 'decimal-pad'}
          inputMode={inteiro ? 'numeric' : 'decimal'}
          selectTextOnFocus
          style={[estilos.numero, destaque && estilos.numeroDestaque, { color: cores.texto }]}
        />
        {sufixo ? <Texto cor="suave" style={estilos.sufixo}>{sufixo}</Texto> : null}
      </View>
      {lido === undefined ? (
        <Texto variante="pequeno" cor={cores.perigo}>{inteiro ? 'Só números inteiros.' : 'Número inválido.'}</Texto>
      ) : null}
    </View>
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
  grande: { flex: 1, minWidth: 0, gap: espaco(0.75) },
  caixa: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: RAIO,
    minHeight: 52,
    paddingHorizontal: espaco(1.5),
  },
  caixaDestaque: { minHeight: 64, alignSelf: 'stretch', minWidth: 0, maxWidth: '100%' },
  numero: { flex: 1, width: 0, minWidth: 0, fontFamily: fontes.negrito, fontSize: 22, fontVariant: ['tabular-nums'], paddingVertical: espaco(1) },
  numeroDestaque: { fontSize: 28 },
  sufixo: { fontFamily: fontes.semi, marginLeft: espaco(0.5) },
});
