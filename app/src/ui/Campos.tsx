import { Switch } from '../components/ui/switch';
import { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { dataDaTela, dataParaTela, mascaraData, numeroDaTela, numeroParaTela } from '../dominio/formatos';
import { escalar } from '../dominio/preferencias';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../tema/tokens';
import { type Ancora, BotaoCalendario, Calendario } from './Calendario';
import { Campo } from './Campo';
import { Texto } from './Texto';

/**
 * Data digitada como DD/MM/AAAA ou escolhida no calendário do ícone (nunca o seletor nativo da web). O texto fica
 * com a tela; quem usa converte com `dataDaTela` (ISO, `null` se vazio, `undefined` se inválida).
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
  const [ancora, setAncora] = useState<Ancora | null>(null);
  const botao = useRef<View>(null);
  const iso = dataDaTela(valor);
  return (
    <>
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
      acao={
        <View ref={botao} collapsable={false}>
          <BotaoCalendario aoTocar={() => botao.current?.measureInWindow((x, y, w, h) => setAncora({ x, y, w, h }))} />
        </View>
      }
    />
    {ancora ? (
      <Calendario
        ancora={ancora}
        valor={iso ?? null}
        aoFechar={() => setAncora(null)}
        aoEscolher={(escolhida) => {
          setAncora(null);
          aoMudar(dataParaTela(escolhida));
        }}
        aoLimpar={() => {
          setAncora(null);
          aoMudar('');
        }}
      />
    ) : null}
    </>
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
  mascara,
  aoValidade,
}: {
  rotulo: string;
  valor: number | null;
  aoMudar: (valor: number | null) => void;
  inteiro?: boolean;
  sufixo?: string;
  ajuda?: string;
  erro?: string | null;
  /** Ajusta o texto a cada digitação (ex.: `mascaraDeNumero`); sem ela, vale o que foi digitado. */
  mascara?: (texto: string) => string;
  /** `false` quando o texto não é número (decimal num campo inteiro). Vazio conta como válido. */
  aoValidade?: (valido: boolean) => void;
}) {
  const { texto, lido, mudar } = useNumeroDigitado(valor, aoMudar, inteiro, aoValidade, mascara);
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
function useNumeroDigitado(valor: number | null, aoMudar: (valor: number | null) => void, inteiro?: boolean, aoValidade?: (valido: boolean) => void, mascara?: (texto: string) => string) {
  const [texto, setTexto] = useState(valor === null ? '' : numeroParaTela(valor, 3));
  const [anterior, setAnterior] = useState(valor);
  if (valor !== anterior) {
    // Valor mudou por fora: o campo acompanha (padrão do React para estado derivado de prop).
    setAnterior(valor);
    if (numeroDaTela(texto, inteiro) !== valor) setTexto(valor === null ? '' : numeroParaTela(valor, 3));
  }
  const mudar = (digitado: string) => {
    const t = mascara ? mascara(digitado) : digitado;
    setTexto(t);
    const n = numeroDaTela(t, inteiro);
    aoValidade?.(n !== undefined);
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
  ajuda,
  rotuloOculto,
  aoValidade,
}: {
  rotulo: string;
  valor: number | null;
  aoMudar: (valor: number | null) => void;
  inteiro?: boolean;
  sufixo?: string;
  /** Sem o rótulo em cima (a unidade dentro da caixa já diz o que é; o leitor de tela lê `rotuloAcessivel`). */
  rotuloOculto?: boolean;
  /** Avisa a cada digitação se o texto é número (ou vazio): quem grava trava o ✓ enquanto não for. */
  aoValidade?: (valido: boolean) => void;
  /** Rótulo completo para o leitor de tela ("Peso da série 2"). */
  rotuloAcessivel?: string;
  /** Caixa maior (carga de trabalho do dia). */
  destaque?: boolean;
  /** Linha pequena abaixo da caixa (ex.: "Sugerida pelo plano"). */
  ajuda?: string;
}) {
  const { cores, fatorTexto } = useTema();
  const [foco, setFoco] = useState(false);
  const { texto, lido, mudar } = useNumeroDigitado(valor, aoMudar, inteiro, aoValidade);
  const corBorda = lido === undefined ? cores.perigo : foco ? cores.anelFoco : cores.bordaCampo;
  const destaqueBorda = foco || lido === undefined ? 1 : 0;
  return (
    <View style={estilos.grande}>
      {rotuloOculto ? null : <Texto variante="rotulo">{rotulo}</Texto>}
      <View style={[estilos.caixa, destaque && estilos.caixaDestaque, { backgroundColor: cores.campo, borderColor: corBorda, borderWidth: 1 + destaqueBorda, paddingHorizontal: espaco(1.5) - destaqueBorda }]}>
        <TextInput
          accessibilityLabel={rotuloAcessivel ?? rotulo}
          aria-invalid={lido === undefined}
          value={texto}
          onChangeText={mudar}
          onFocus={() => setFoco(true)}
          onBlur={() => setFoco(false)}
          placeholder="—"
          placeholderTextColor={cores.textoSuave}
          keyboardType={inteiro ? 'number-pad' : 'decimal-pad'}
          inputMode={inteiro ? 'numeric' : 'decimal'}
          selectTextOnFocus
          style={[estilos.numero, destaque && estilos.numeroDestaque, semContornoNaWeb, { color: cores.texto, fontSize: escalar(destaque ? 28 : 22, fatorTexto) }]}
        />
        {sufixo ? <Texto variante="suave" style={estilos.sufixo}>{sufixo}</Texto> : null}
      </View>
      {lido === undefined ? (
        <Texto variante="pequeno" cor={cores.perigo}>{inteiro ? 'Só números inteiros.' : 'Número inválido.'}</Texto>
      ) : ajuda ? (
        <Texto variante="pequeno">{ajuda}</Texto>
      ) : null}
    </View>
  );
}

/**
 * Na web o anel de foco do navegador ficava dentro da caixa, atravessando o número e a unidade; quem mostra o foco é a
 * borda da caixa (cor `anelFoco`, mais grossa).
 */
const semContornoNaWeb = Platform.OS === 'web' ? { outlineWidth: 0 } : null;

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
  const { cores } = useTema();
  return (
    <View
      style={estilos.interruptor}>
      <Pressable accessible={false} tabIndex={-1} onPress={() => aoMudar(!valor)} style={estilos.textos}>
        <Texto variante="rotulo" cor={cores.texto}>{rotulo}</Texto>
        {ajuda ? <Texto variante="pequeno">{ajuda}</Texto> : null}
      </Pressable>
      <Switch checked={valor} onCheckedChange={aoMudar} accessibilityLabel={rotulo} />
    </View>
  );
}

const estilos = StyleSheet.create({
  interruptor: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5), minHeight: ALVO_TOQUE },
  textos: { flex: 1, gap: 2 },
  grande: { flex: 1, minWidth: 0, gap: espaco(0.75) },
  caixa: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RAIO,
    minHeight: 52,
  },
  caixaDestaque: { minHeight: 64, alignSelf: 'stretch', minWidth: 0, maxWidth: 320 },
  numero: { flex: 1, width: 0, minWidth: 0, fontFamily: fontes.negrito, fontSize: 22, fontVariant: ['tabular-nums'], paddingVertical: espaco(1) },
  numeroDestaque: { fontSize: 28 },
  sufixo: { fontFamily: fontes.semi, marginLeft: espaco(0.5) },
});
