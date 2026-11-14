import { useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { MOTIVO_SEM_DADOS, type EnfaseDoNumero } from '../dominio/destaque';
import { useTema } from '../tema/TemaProvider';
import { coresDeDestaque, espaco } from '../tema/tokens';
import { aparenciaDoNumero, contornoDoNumero, type AparenciaDoNumero } from './destaqueDoNumero';
import { Texto } from './Texto';

/** Os destaques no tema em uso (também para gráficos: a mesma cor do cartão, D13). */
export function useDestaques() {
  const { cores, variante } = useTema();
  return useMemo(() => coresDeDestaque(cores, variante), [cores, variante]);
}

/** A aparência no tema em uso. Para peça tocável que monta o próprio contêiner (`treinador/painel/CartaoMini`). */
export function useAparenciaDoNumero(enfase: EnfaseDoNumero): AparenciaDoNumero {
  const { cores } = useTema();
  return aparenciaDoNumero(enfase, cores, useDestaques());
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
  /** Só com `enfase: 'indisponivel'`: por que não há número ("Sem entradas no período"); padrão "Sem dados". */
  motivo?: string;
}

/**
 * Motivo escrito sob o "—" do número indisponível (D14): o zero é só "0"; o indisponível é "—" mais esta linha, em fonte
 * normal, menor que o número e em `textoSuave` (4,5:1 sobre `superficie` e `superficie2`, `tema/tokens.test.ts`).
 */
export function MotivoDoIndisponivel({ texto = MOTIVO_SEM_DADOS }: { texto?: string }) {
  const { cores } = useTema();
  return <Texto variante="pequeno" cor={cores.textoSuave}>{texto}</Texto>;
}

/**
 * Número de indicador com destaque (`docs/planos/cores-de-destaque.md`): rótulo neutro, número na cor da função, faixa
 * lateral e fundo tonalizado; zero ("0") e sem dado ("—" com o motivo escrito) em `textoSuave`, sem faixa nem tinta,
 * e distintos entre si (D14). A cor nunca vem sozinha: o rótulo
 * diz o que é. Textos quebram linha (nada cortado). Só apresenta: carregando e erro são da tela, como antes.
 */
export function NumeroDeDestaque({ rotulo, valor, detalhe, enfase, tamanho = 'grande', nivelDoRotulo, rotuloAcessivel, style, estiloDoValor, motivo }: Props) {
  const { cores, bordas } = useTema();
  const a = useAparenciaDoNumero(enfase);
  return (
    <View accessibilityLabel={rotuloAcessivel}
      style={[estilos.peca, contornoDoNumero(a.faixa, cores, bordas.bloco, RECUO), { backgroundColor: a.fundo }, style]}>
      <Texto variante="rotulo" cor={cores.texto} nivel={nivelDoRotulo}>{rotulo}</Texto>
      <Texto variante={tamanho === 'grande' ? 'destaque' : 'titulo'} numerico cor={a.numero} style={estiloDoValor}>{valor}</Texto>
      {enfase === 'indisponivel' ? <MotivoDoIndisponivel texto={motivo} /> : null}
      {detalhe ? <Texto variante="pequeno" cor={cores.textoSuave}>{detalhe}</Texto> : null}
    </View>
  );
}

const RECUO = espaco(2);

const estilos = StyleSheet.create({
  peca: { flexGrow: 1, minWidth: 0, paddingVertical: espaco(1.5), paddingRight: RECUO, gap: espaco(0.5) },
});
