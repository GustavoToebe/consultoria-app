import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { espaco } from '../tema/tokens';
import { aparenciaDoIndicador, corDoTom, type EstadoDoIndicador, type TomDoIndicador } from './aparenciaDoIndicador';
import { MotivoDoIndisponivel } from './NumeroDeDestaque';
import { fundoPintado } from './superficiePintada';
import { Texto } from './Texto';

export type { EstadoDoIndicador, TomDoIndicador } from './aparenciaDoIndicador';

/**
 * Cartão de um indicador (Financeiro, Números, Interessados, resumo do aluno): rótulo em cima, número grande em fonte
 * numérica e detalhe em `textoSuave`. Cor só onde significa algo (pintado, 23/11): com `tom` (situação) ou
 * `corDeCategoria` (identificação), o cartão é pintado (`ui/superficiePintada`: degradê de 135° da cor à base, borda de
 * 1 px na cor a 50%, rótulo e número na cor quando ela passa 4,5:1) e ganha o ponto com brilho (ou o `Icone`, como o
 * alerta do Vencido). `corDoMarcador` (25/11) pinta só a bolinha (8 px, sem brilho) num cartão neutro (cor de categoria como
 * marca, ≥ 3:1; o rótulo continua dizendo o que é). `textual` põe o valor em fonte normal (frase). Neutro: base, contorno `divisor`, sem ponto. Zero e indisponível ficam neutros, com o número em
 * `textoSuave`; o indisponível escreve o `motivo` sob o "—". `flexGrow: 1`: na `GradeDeIndicadores` todos da linha têm a
 * mesma altura.
 */
export function CartaoDeIndicador({ rotulo, valor, tom = 'neutro', corDeCategoria, corDoMarcador, estado = 'valor', detalhe, motivo, Icone, textual, tamanho = 'grande', lugar = 'pagina', nivelDoRotulo, rotuloAcessivel }: {
  rotulo: string;
  /** Já formatado ("R$ 1.200,00", "12", "—"). */
  valor: string;
  tom?: TomDoIndicador;
  /** Cor de categoria do tema (`useTema().identificacao[chave].cor`); no lugar do `tom`. */
  corDeCategoria?: string | null;
  /** Cor de categoria só na bolinha (sem `tom` nem `corDeCategoria`): o cartão, a borda, o rótulo e o valor ficam neutros. */
  corDoMarcador?: string | null;
  estado?: EstadoDoIndicador;
  /** Linha pequena sob o número. */
  detalhe?: string | null;
  /** Só com `estado="indisponivel"`: por que não há número; padrão "Sem dados". */
  motivo?: string;
  /** No lugar do ponto, na cor do tom (só aparece com cor). */
  Icone?: LucideIcon;
  /** O valor é uma frase ou uma palavra ("Ontem", "Sem atualização pendente"), não um número: fonte normal, não a mono. */
  textual?: boolean;
  /** `grande` = `destaque` (30); `medio` = `titulo` (26), para cartão dentro de outro cartão. */
  tamanho?: 'grande' | 'medio';
  /** `pagina`: base `superficie`; `cartao`: poço `superficie2`, dentro de um `Cartao`. */
  lugar?: 'pagina' | 'cartao';
  /** Faz do rótulo um título (h2 solto na página, h3 dentro de um `Cartao`). */
  nivelDoRotulo?: 2 | 3;
  /** Padrão: "rótulo: valor", o motivo e o detalhe. */
  rotuloAcessivel?: string;
}) {
  const { cores, bordas, variante } = useTema();
  const a = aparenciaDoIndicador(corDeCategoria ?? corDoTom(tom, cores), estado, lugar, cores, variante, corDoMarcador);
  const indisponivel = estado === 'indisponivel';
  const rotuloPadrao = `${rotulo}: ${valor}${indisponivel && motivo ? `. ${motivo}` : ''}${detalhe ? `. ${detalhe}` : ''}`;
  return (
    <View accessibilityLabel={rotuloAcessivel ?? rotuloPadrao}
      style={[estilos.cartao, { borderWidth: bordas.bloco, borderColor: a.borda }, a.pintura ? fundoPintado(a.pintura) : { backgroundColor: a.fundo }]}>
      <View style={estilos.topo}>
        {a.marca && Icone ? <Icone size={16} color={a.marca} strokeWidth={2.25} aria-hidden /> : null}
        {a.marca && !Icone ? <View aria-hidden style={[a.pintura ? [estilos.ponto, { boxShadow: `0px 0px 10px ${a.marca}` }] : estilos.marcador, { backgroundColor: a.marca }]} /> : null}
        <Texto variante="rotulo" cor={a.rotulo} nivel={nivelDoRotulo} style={estilos.encolher}>{rotulo}</Texto>
      </View>
      <Texto variante={tamanho === 'grande' && !textual ? 'destaque' : 'titulo'} numerico={!textual} cor={a.valor}>{valor}</Texto>
      {indisponivel ? <MotivoDoIndisponivel texto={motivo} /> : null}
      {detalhe ? <Texto variante="pequeno" cor={cores.textoSuave}>{detalhe}</Texto> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  // paddingRight menor (visual-ponytail, 17/11): o número em Geist Mono é largo; "R$ 100.000,00" cabe inteiro.
  cartao: { flexGrow: 1, minWidth: 0, borderRadius: 16, paddingVertical: espaco(1.75), paddingLeft: espaco(2), paddingRight: espaco(1), gap: espaco(0.5) },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ponto: { width: 6, height: 6, borderRadius: 3 },
  // Só o marcador, sem o degradê nem o brilho: 8 px, o tamanho das marcas de categoria (macros, modalidade).
  marcador: { width: 8, height: 8, borderRadius: 4 },
  encolher: { flexShrink: 1 },
});
