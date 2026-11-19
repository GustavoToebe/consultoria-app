import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { espaco } from '../tema/tokens';
import { aparenciaDoIndicador, type EstadoDoIndicador, type TomDoIndicador } from './aparenciaDoIndicador';
import { contornoDoNumero } from './destaqueDoNumero';
import { MotivoDoIndisponivel } from './NumeroDeDestaque';
import { Texto } from './Texto';

export type { EstadoDoIndicador, TomDoIndicador } from './aparenciaDoIndicador';

/**
 * Cartão de um indicador (Visão geral, Totais da Cobranças, Números), extraído da Visão geral: rótulo neutro em cima,
 * número grande em fonte numérica e, com tom, a faixa de 4 px à esquerda e o ponto (ou o `Icone`, como o alerta do
 * Vencido) na cor da situação. Contorno em `divisor`. Zero e indisponível ficam sem tom e com o número em `textoSuave`;
 * o indisponível escreve o `motivo` sob o "—". `flexGrow: 1`: na `GradeDeIndicadores` todos da linha têm a mesma altura.
 */
export function CartaoDeIndicador({ rotulo, valor, tom = 'neutro', estado = 'valor', detalhe, motivo, Icone, tamanho = 'grande', lugar = 'pagina', nivelDoRotulo, rotuloAcessivel }: {
  rotulo: string;
  /** Já formatado ("R$ 1.200,00", "12", "—"). */
  valor: string;
  tom?: TomDoIndicador;
  estado?: EstadoDoIndicador;
  /** Linha pequena sob o número. */
  detalhe?: string | null;
  /** Só com `estado="indisponivel"`: por que não há número; padrão "Sem dados". */
  motivo?: string;
  /** No lugar do ponto, na cor do tom (só aparece com tom). */
  Icone?: LucideIcon;
  /** `grande` = `destaque` (30); `medio` = `titulo` (26), para cartão dentro de outro cartão. */
  tamanho?: 'grande' | 'medio';
  /** `pagina`: fundo `superficie`; `cartao`: poço `superficie2`, dentro de um `Cartao`. */
  lugar?: 'pagina' | 'cartao';
  /** Faz do rótulo um título (h2 solto na página, h3 dentro de um `Cartao`). */
  nivelDoRotulo?: 2 | 3;
  /** Padrão: "rótulo: valor", o motivo e o detalhe. */
  rotuloAcessivel?: string;
}) {
  const { cores, bordas } = useTema();
  const a = aparenciaDoIndicador(tom, estado, lugar, cores);
  const indisponivel = estado === 'indisponivel';
  const rotuloPadrao = `${rotulo}: ${valor}${indisponivel && motivo ? `. ${motivo}` : ''}${detalhe ? `. ${detalhe}` : ''}`;
  return (
    <View accessibilityLabel={rotuloAcessivel ?? rotuloPadrao}
      style={[estilos.cartao, contornoDoNumero(a.faixa, cores, bordas.bloco, espaco(2)), estilos.raio, { backgroundColor: a.fundo }]}>
      <View style={estilos.topo}>
        {a.faixa && Icone ? <Icone size={16} color={a.faixa} strokeWidth={2.25} aria-hidden /> : null}
        {a.faixa && !Icone ? <View aria-hidden style={[estilos.ponto, { backgroundColor: a.faixa }]} /> : null}
        <Texto variante="rotulo" cor={a.rotulo} nivel={nivelDoRotulo} style={estilos.encolher}>{rotulo}</Texto>
      </View>
      <Texto variante={tamanho === 'grande' ? 'destaque' : 'titulo'} numerico cor={a.valor}>{valor}</Texto>
      {indisponivel ? <MotivoDoIndisponivel texto={motivo} /> : null}
      {detalhe ? <Texto variante="pequeno" cor={cores.textoSuave}>{detalhe}</Texto> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  // paddingRight menor (visual-ponytail, 17/11): o número em Geist Mono é largo; "R$ 100.000,00" cabe inteiro.
  cartao: { flexGrow: 1, minWidth: 0, paddingVertical: espaco(1.75), paddingRight: espaco(1), gap: espaco(0.5) },
  raio: { borderRadius: 16 },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ponto: { width: 6, height: 6, borderRadius: 3 },
  encolher: { flexShrink: 1 },
});
