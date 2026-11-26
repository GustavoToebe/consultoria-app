import { Fragment, type ReactNode } from 'react';
import { StyleSheet, Text as TextoNativo, type TextProps } from 'react-native';

import { escalar } from '../dominio/preferencias';
import { Text } from '../components/ui/text';
import { useTema } from '../tema/TemaProvider';
import { fontes } from '../tema/tokens';
import { partirFilhos } from './numerosNoTexto';
import { ESTILOS_TEXTO, NUMERICO, type Variante } from './tipografia';
export type { Variante } from './tipografia';

interface Props extends TextProps {
  variante?: Variante;
  cor?: string;
  numerico?: boolean;
  /**
   * Nível de título para o leitor de tela (h1 a h3). Explícito, não derivado da variante: a tela tem um h1 (o
   * `Cabecalho`), cartões e folhas têm h2 e subtítulos dentro deles h3.
   */
  nivel?: 1 | 2 | 3;
}

/** A fonte das palavras quando um texto com número e palavra cai em `numerico` ou numa variante mono. */
const FONTE_DAS_PALAVRAS: Record<string, string> = { [fontes.mono]: fontes.normal, [fontes.monoSemi]: fontes.semi };
/** O número leva o peso que o chamador pediu: semi e negrito em `monoSemi`, o resto em `mono`. */
const FONTE_DO_NUMERO: Record<string, string> = { [fontes.semi]: fontes.monoSemi, [fontes.negrito]: fontes.monoSemi, [fontes.monoSemi]: fontes.monoSemi };

/**
 * `numerico` e as variantes `destaque` e `numero` valem para o número, não para a frase: "147 ativos, 145 sem acesso"
 * sai em Geist com "147" e "145" em mono (`partirNumeros`). Código (ID, segredo, URL, cupom) fica inteiro em mono com `style={NUMERICO}` e sem `numerico`. Sem palavra no texto (só número, símbolo ou "—"): tudo em mono, como antes. Elemento entre os textos passa como está.
 */
export function Texto({ variante = 'corpo', cor, numerico, nivel, style, children, ...resto }: Props) {
  const { cores, fatorTexto } = useTema();
  const padrao = variante === 'suave' || variante === 'secao' || variante === 'pequeno' || variante === 'rotulo' ? cores.textoSuave : cores.texto;
  // O tamanho do texto da pessoa multiplica fonte e altura de linha, inclusive os tamanhos fixos passados em `style`.
  const estilo = StyleSheet.flatten([ESTILOS_TEXTO[variante], numerico && NUMERICO, { color: cor === 'suave' ? cores.textoSuave : cor ?? padrao }, style]);
  if (fatorTexto !== 1 && estilo.fontSize) {
    estilo.fontSize = escalar(estilo.fontSize, fatorTexto);
    if (estilo.lineHeight) estilo.lineHeight = escalar(estilo.lineHeight, fatorTexto);
  }
  const titulo = nivel ? { role: 'heading' as const, 'aria-level': nivel } : null;
  const partes = numerico || variante === 'destaque' || variante === 'numero' ? partirFilhos(children) : null;
  if (!partes) return <Text maxFontSizeMultiplier={1.5} {...titulo} {...resto} style={estilo}>{children}</Text>;
  const familia = estilo.fontFamily ?? fontes.mono;
  const numeros = { fontFamily: FONTE_DO_NUMERO[familia] ?? fontes.mono, fontVariant: NUMERICO.fontVariant, letterSpacing: estilo.letterSpacing };
  const palavras = { ...estilo, fontFamily: FONTE_DAS_PALAVRAS[familia] ?? familia, fontVariant: undefined, letterSpacing: variante === 'destaque' ? -0.5 : 0 };
  return (
    <Text maxFontSizeMultiplier={1.5} {...titulo} {...resto} style={palavras}>
      {partes.map((p, i) => ('elemento' in p ? <Fragment key={i}>{p.elemento as ReactNode}</Fragment> : p.numerico ? <TextoNativo key={i} style={numeros}>{p.texto}</TextoNativo> : p.texto))}
    </Text>
  );
}
