import { useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import type { EnfaseDoNumero } from '../dominio/destaque';
import { useTema } from '../tema/TemaProvider';
import { coresDeDestaque, espaco } from '../tema/tokens';
import { aparenciaDoNumero, contornoDoNumero, type AparenciaDoNumero } from './destaqueDoNumero';
import { Texto } from './Texto';

/** A aparência no tema em uso. Para peça tocável que monta o próprio contêiner (`treinador/painel/CartaoMini`). */
export function useAparenciaDoNumero(enfase: EnfaseDoNumero): AparenciaDoNumero {
  const { cores, modo } = useTema();
  const destaques = useMemo(() => coresDeDestaque(cores, modo !== 'CLARO'), [cores, modo]);
  return aparenciaDoNumero(enfase, cores, destaques);
}

interface Props {
  rotulo: string;
  /** Já formatado ("12", "R$ 1.200,00", "100%", "—"). */
  valor: string;
  detalhe?: string | null;
  /** De `dominio/destaque.enfaseDoNumero`, com o número cru (nunca o texto formatado). */
  enfase: EnfaseDoNumero;
  /** `grande` = variante `destaque` (28); `medio` = `titulo` (24), para grade densa. */
  tamanho?: 'grande' | 'medio';
  /** Faz do rótulo um título para o leitor de tela. */
  nivelDoRotulo?: 2 | 3;
  /** Rótulo da peça inteira (`aria-label` na web), sem agrupar: o título continua navegável pelo leitor de tela. */
  rotuloAcessivel?: string;
  style?: StyleProp<ViewStyle>;
  /** Ajuste do número (tamanho menor no celular, por exemplo); a cor continua a da ênfase. */
  estiloDoValor?: StyleProp<TextStyle>;
}

/**
 * Número de indicador com destaque (`docs/planos/cores-de-destaque.md`): rótulo neutro, número na cor da função, faixa
 * lateral e fundo tonalizado; zero ou sem dado em `textoSuave`, sem faixa nem tinta. A cor nunca vem sozinha: o rótulo
 * diz o que é. Textos quebram linha (nada cortado). Só apresenta: carregando e erro são da tela, como antes.
 */
export function NumeroDeDestaque({ rotulo, valor, detalhe, enfase, tamanho = 'grande', nivelDoRotulo, rotuloAcessivel, style, estiloDoValor }: Props) {
  const { cores, bordas } = useTema();
  const a = useAparenciaDoNumero(enfase);
  return (
    <View accessibilityLabel={rotuloAcessivel}
      style={[estilos.peca, contornoDoNumero(a.faixa, cores, bordas.bloco, RECUO), { backgroundColor: a.fundo }, style]}>
      <Texto variante="rotulo" cor={cores.texto} nivel={nivelDoRotulo}>{rotulo}</Texto>
      <Texto variante={tamanho === 'grande' ? 'destaque' : 'titulo'} numerico cor={a.numero} style={estiloDoValor}>{valor}</Texto>
      {detalhe ? <Texto variante="pequeno" cor={cores.textoSuave}>{detalhe}</Texto> : null}
    </View>
  );
}

const RECUO = espaco(2);

const estilos = StyleSheet.create({
  peca: { flexGrow: 1, minWidth: 0, paddingVertical: espaco(1.5), paddingRight: RECUO, gap: espaco(0.5) },
});
