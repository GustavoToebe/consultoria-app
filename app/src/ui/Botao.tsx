import { forwardRef } from 'react';
import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Button } from '../components/ui/button';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO_CONTROLE, textoSobre } from '../tema/tokens';
import { coresDoDesabilitado, visualDoInativo } from './desabilitado';
import { useArranjoDasAcoes } from './LinhaDeAcoes';
import { sobre } from './sobre';
import { Texto } from './Texto';
import { useMovimentoReduzido } from './useMovimentoReduzido';

type Tipo = 'primario' | 'secundario' | 'perigo' | 'fantasma' | 'perigoTexto';

interface Props {
  rotulo: string;
  /** Texto lido pelo leitor de tela quando o rótulo na tela é mais curto que a ação ("Editar" → "Editar treino do aluno"). */
  rotuloAcessivel?: string;
  aoTocar: () => void;
  tipo?: Tipo;
  /** Ícone lucide; pintado com a cor do texto do botão. */
  Icone?: LucideIcon;
  desabilitado?: boolean;
  /**
   * Por que o botão está desabilitado ("Preencha o nome", "Escolha um aluno"). Aparece como linha pequena abaixo do
   * botão e vai no `accessibilityHint`; sem isto o botão apagado não explica nada. Só aparece com `desabilitado`.
   */
  motivo?: string;
  carregando?: boolean;
  /** Ocupa a largura toda (entrar, ação única da tela no celular). Sem isto o botão tem o tamanho do texto, menos no rodapé empilhado do celular (`RodapeDeAcoes`), onde já é cheio. */
  cheio?: boolean;
  autoFocus?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Identificador para os testes de tela. */
  testID?: string;
}

/**
 * Ação principal com a cor da marca (no máximo uma por área; mouse em cima ou apertado = `marcaHover`); secundária com o
 * contorno forte (`bordaCampo`, ≥ 3:1); fantasma só texto, para ação
 * rara ou de baixo risco; `perigoTexto` é o fantasma com texto vermelho (remover, inativar), sempre com confirmação.
 * `perigo` (preenchido, `perigoFundo`) é só para o botão de confirmação do painel. O rótulo quebra em até duas
 * linhas e nunca estoura o cartão; vários botões lado a lado vão numa `LinhaDeAcoes`.
 */
export const Botao = forwardRef<View, Props>(function Botao(
  { rotulo, rotuloAcessivel, aoTocar, tipo = 'primario', Icone, desabilitado, motivo, carregando, cheio, autoFocus, style, testID }: Props,
  ref
) {
  const { cores, marca, marcaHover, sobreMarca } = useTema();
  const reduzido = useMovimentoReduzido();
  // Na fila de ações do rodapé no celular todo botão é cheio; um `cheio` explícito vale mais.
  const arranjo = useArranjoDasAcoes();
  const largo = cheio ?? arranjo.empilhar;
  const inativo = desabilitado || carregando;
  const semFundo = tipo === 'fantasma' || tipo === 'perigoTexto';
  const cinza = coresDoDesabilitado(cores);
  const visual = visualDoInativo(desabilitado, carregando);
  const fundo = visual.cinza && !semFundo ? cinza.fundo : tipo === 'primario' ? marca : tipo === 'perigo' ? cores.perigoFundo : 'transparent';
  const texto = visual.cinza ? cinza.texto : tipo === 'primario' ? sobreMarca : tipo === 'perigo' ? textoSobre(cores.perigoFundo) : tipo === 'perigoTexto' ? cores.perigo : cores.texto;
  const borda = visual.cinza && !semFundo ? cinza.borda : tipo === 'secundario' ? cores.bordaCampo : fundo;
  const explicacao = desabilitado && !carregando && motivo ? motivo : undefined;
  /** Mouse em cima ou apertado: a marca um tom adiante no principal, a superfície elevada nos outros (o perigo fica). */
  const corAoPassar = (ativo: boolean) => {
    if (!ativo || tipo === 'perigo') return { backgroundColor: fundo, borderColor: borda };
    if (tipo === 'primario') return { backgroundColor: marcaHover, borderColor: marcaHover };
    return { backgroundColor: cores.superficie2, borderColor: semFundo ? cores.superficie2 : borda };
  };
  // Ação e motivo são um bloco (P5): numa fila alinhada à direita o botão fica na ponta e o motivo, colado sob ele,
  // alinhado à mesma borda; o motivo mais largo que o botão não o empurra para dentro.
  const aDireita = !!explicacao && !largo && arranjo.alinhar === 'fim';
  const botao = (
    <Button
      ref={ref}
      autoFocus={autoFocus}
      variant={tipo === 'primario' ? 'default' : tipo === 'perigo' ? 'destructive' : tipo === 'secundario' ? 'outline' : 'ghost'}
      accessibilityRole="button"
      testID={testID}
      accessibilityLabel={rotuloAcessivel ?? rotulo}
      accessibilityHint={explicacao}
      accessibilityState={{ disabled: !!inativo, busy: !!carregando }}
      disabled={inativo}
      onPress={aoTocar}
      style={(estado) => [
        estilos.botao,
        !reduzido && Platform.OS === 'web' ? estilos.transicao : null,
        corAoPassar(sobre(estado) && !inativo),
        { opacity: visual.apagado ? 0.5 : 1 },
        // Apertar afunda o botão um pouco (sem movimento com "reduzir movimento").
        estado.pressed && !inativo && !reduzido ? estilos.apertado : null,
        largo && estilos.cheio,
        aDireita && estilos.naPonta,
        explicacao ? null : style,
      ]}>
      <View style={estilos.linha}>
        {carregando ? <ActivityIndicator size="small" color={texto} /> : Icone ? <Icone size={18} color={texto} strokeWidth={2} /> : null}
        <Texto numberOfLines={2} style={[estilos.rotulo, { color: texto }]}>{rotulo}</Texto>
      </View>
    </Button>
  );
  if (!explicacao) return botao;
  return (
    <View style={[estilos.comMotivo, largo && estilos.cheio, aDireita && estilos.comMotivoADireita, style]}>
      {botao}
      <Texto variante="pequeno" style={largo ? estilos.motivoCentro : aDireita ? estilos.motivoADireita : null}>{explicacao}</Texto>
    </View>
  );
});

const estilos = StyleSheet.create({
  botao: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    minHeight: ALVO_TOQUE,
    paddingHorizontal: espaco(2),
    paddingVertical: espaco(0.75),
    borderRadius: RAIO_CONTROLE,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cheio: { alignSelf: 'stretch' },
  apertado: { transform: [{ translateY: 1 }, { scale: 0.98 }] },
  // Só na web (o RN não anima estilo): 120 ms nas cores e no afundar.
  transicao: { transitionProperty: 'background-color, border-color, transform', transitionDuration: '120ms' } as ViewStyle,
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), maxWidth: '100%' },
  rotulo: { fontFamily: fontes.semi, fontSize: 15, flexShrink: 1, textAlign: 'center' },
  comMotivo: { alignSelf: 'flex-start', maxWidth: '100%', gap: espaco(0.5) },
  motivoCentro: { textAlign: 'center' },
  comMotivoADireita: { alignItems: 'flex-end' },
  naPonta: { alignSelf: 'flex-end' },
  motivoADireita: { textAlign: 'right' },
});
