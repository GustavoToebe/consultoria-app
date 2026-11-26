import { useState, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { larguraMaximaDoConteudo } from '../../../dominio/larguraDoConteudo';
import { useTema } from '../../../tema/TemaProvider';
import { espaco, LARGURA_LISTA, LARGURA_MENU_LATERAL } from '../../../tema/tokens';
import { Botao } from '../../../ui/Botao';
import { AvisoSairSemSalvar } from '../../../ui/GuardaDeSaida';
import { RodapeDeAcoes } from '../../../ui/LinhaDeAcoes';
import { useRegistroDoRodapeFixo } from '../../../ui/rodapeFixoDaPagina';
import { PainelConfirmacao } from '../../../ui/PainelConfirmacao';
import { Texto } from '../../../ui/Texto';
import { textoDaBarra } from './tipos';

/**
 * Rodapé fixo do modo de edição do Início (P1 de `docs/design-e-front.md` 4.6, fora da rolagem, como o do Financeiro e dos
 * Ajustes): à esquerda quantas alterações há (região viva, lida sem mover o foco); à direita "Restaurar padrão" (texto,
 * pergunta antes), "Cancelar" (com alteração, o "Sair sem salvar?" de sempre) e "Salvar", por último. No celular, duas
 * linhas baixas (o estado com o "Restaurar padrão"; Cancelar e Salvar lado a lado, Salvar à direita): em coluna, os três
 * botões tomavam um quarto da tela e a grade em edição mal aparecia. Restaurar só mexe no rascunho: quem grava é o Salvar.
 */
export function BarraDaEdicao({ alteracoes, aoRestaurar, aoCancelar, aoSalvar }: {
  /** Quantas alterações o rascunho tem em relação ao salvo (`contarAlteracoes`). */
  alteracoes: number;
  /** Chamado só depois de confirmar no painel. */
  aoRestaurar: () => void;
  /** Sem alteração, sai na hora; com alteração, só depois de confirmar. */
  aoCancelar: () => void;
  aoSalvar: () => void;
}) {
  const { cores, bordas, preferencias } = useTema();
  const { width } = useWindowDimensions();
  const { bottom } = useSafeAreaInsets();
  const [pergunta, setPergunta] = useState<'restaurar' | 'cancelar' | null>(null);
  const larguraBarra = larguraMaximaDoConteudo(LARGURA_LISTA, preferencias.larguraConteudo);
  // A região existe desde o começo (a que nasce junto com o texto muitas vezes não é lida).
  const status = <View role="status" accessibilityLiveRegion="polite" aria-live="polite"><Texto variante="suave">{textoDaBarra(alteracoes)}</Texto></View>;
  const restaurar = <Botao rotulo="Restaurar padrão" rotuloAcessivel="Restaurar padrão do Início" tipo="fantasma" aoTocar={() => setPergunta('restaurar')} />;
  const cancelar = (estilo?: ViewStyle) => (
    <Botao rotulo="Cancelar" rotuloAcessivel="Cancelar a edição do Início" tipo="secundario" style={estilo}
      aoTocar={() => (alteracoes > 0 ? setPergunta('cancelar') : aoCancelar())} />
  );
  const salvar = (estilo?: ViewStyle) => <Botao rotulo="Salvar" rotuloAcessivel="Salvar o Início" aoTocar={aoSalvar} style={estilo} />;
  return (
    <RodapeRegistrado style={[estilos.barra, { backgroundColor: cores.superficie, borderTopColor: cores.divisor, borderTopWidth: bordas.bloco, paddingBottom: espaco(1.5) + bottom }]}>
      <View style={[estilos.dentro, { maxWidth: larguraBarra }]}>
        {width < LARGURA_MENU_LATERAL ? (
          <View style={estilos.compacta}>
            <View style={estilos.linhaDoEstado}>
              <View style={estilos.estado}>{status}</View>
              {restaurar}
            </View>
            <View style={estilos.linhaDosBotoes}>
              {cancelar(estilos.metade)}
              {salvar(estilos.metade)}
            </View>
          </View>
        ) : (
          <RodapeDeAcoes empilhar={false} status={status}>
            {restaurar}
            {cancelar()}
            {salvar()}
          </RodapeDeAcoes>
        )}
      </View>
      <PainelConfirmacao visivel={pergunta === 'restaurar'} titulo="Restaurar o padrão?"
        mensagem="Volta o Início ao padrão de fábrica: ordem, tamanhos, blocos, Todos/Meus e opções. Nada muda até você salvar."
        rotuloConfirmar="Restaurar padrão" rotuloCancelar="Continuar editando"
        aoCancelar={() => setPergunta(null)}
        aoConfirmar={() => {
          setPergunta(null);
          aoRestaurar();
        }} />
      <AvisoSairSemSalvar visivel={pergunta === 'cancelar'} aoContinuar={() => setPergunta(null)}
        aoSair={() => {
          setPergunta(null);
          aoCancelar();
        }} />
    </RodapeRegistrado>
  );
}

/** Rodapé fixo: o toast do celular sobe acima dele (ui/rodapeFixoDaPagina). Componente à parte: o hook devolve ref. */
function RodapeRegistrado({ style, children }: { style: StyleProp<ViewStyle>; children: ReactNode }) {
  const { ref, onLayout } = useRegistroDoRodapeFixo();
  return <View ref={ref} onLayout={onLayout} style={style}>{children}</View>;
}

const estilos = StyleSheet.create({
  barra: { paddingTop: espaco(1.5), paddingHorizontal: espaco(2) },
  dentro: { width: '100%', alignSelf: 'center' },
  compacta: { gap: espaco(1) },
  linhaDoEstado: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1) },
  estado: { flexShrink: 1 },
  linhaDosBotoes: { flexDirection: 'row', gap: espaco(1) },
  metade: { flex: 1 },
});
