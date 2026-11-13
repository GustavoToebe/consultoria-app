import { ArrowDown, ArrowUp, GripVertical, Plus, RotateCcw } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Switch } from '../../components/ui/switch';
import {
  blocosParaEditar,
  blocosVisiveis,
  mostrarBloco,
  moverBloco,
  moverBlocoPara,
  redimensionarBloco,
  restaurarPadrao,
  ROTULOS_DOS_TAMANHOS,
  TAMANHOS_DO_BLOCO,
  type BlocoDoPainelId,
  type BlocoParaEditar,
  type ContextoDoPainel,
  type PainelDoInicioPreferido,
  type TamanhoDoBloco,
} from '../../dominio/painelDoInicio';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, LARGURA_LISTA, LARGURA_MENU_LATERAL } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Cartao } from '../../ui/Cartao';
import { Escolha } from '../../ui/Escolha';
import { LinhaDeAcoes, RodapeDeAcoes } from '../../ui/LinhaDeAcoes';
import { Texto } from '../../ui/Texto';
import { useMovimentoReduzido } from '../../ui/useMovimentoReduzido';
import { FaixaDoPainel, LinhaDeBlocos } from './FaixaDoPainel';
import { linhasDaGrade } from './grade';

/** Uma mudança do rascunho e a frase que o rodapé mostra (e o leitor de tela lê). */
export type MudancaDoPainel = (novo: PainelDoInicioPreferido, mensagem: string) => void;

const OPCOES_DE_TAMANHO = TAMANHOS_DO_BLOCO.map((t) => ({ valor: t, rotulo: ROTULOS_DOS_TAMANHOS[t] }));

/** Caixa em volta de um controle, com `id` na web: o foco volta a ela depois que a grade se rearruma. */
const alvo = (id: BlocoDoPainelId, parte: 'subir' | 'descer' | 'tamanho' | 'aparece' | 'adicionar') => `painel-${parte}-${id}`;

/** Caixas do foco ao entrar na edição (o Restaurar) e ao sair dela (o Editar do cabeçalho). */
export const ID_DO_RESTAURAR = 'painel-restaurar';
export const ID_DO_EDITAR = 'painel-editar';

const FOCAVEL = 'button:not([disabled]):not([aria-disabled="true"]), [role="button"]:not([aria-disabled="true"]), [role="switch"], [role="radio"][aria-checked="true"]';

/**
 * Leva o foco do teclado ao primeiro controle ativo dentro da primeira caixa que existir (`ids` em ordem de preferência),
 * depois que a tela se redesenha. Subir, Descer, ocultar, Adicionar, entrar e sair da edição refazem a grade ou tiram o
 * botão tocado da tela: sem isto o foco cairia no topo da página. Só na web; no celular o leitor de tela segue a mensagem
 * do rodapé.
 */
export function focarDepois(ids: string[]) {
  if (Platform.OS !== 'web' || typeof requestAnimationFrame === 'undefined') return;
  requestAnimationFrame(() => {
    for (const id of ids) {
      const caixa = document.getElementById(id);
      const el = caixa?.matches(FOCAVEL) ? caixa : caixa?.querySelector<HTMLElement>(FOCAVEL);
      if (el) {
        el.focus();
        return;
      }
    }
  });
}

/**
 * Modo de edição do Início, na própria grade (guia de cores de 13/11, P1; `docs/planos/inicio-editavel.md` D3 a D7): cada
 * bloco vira um cartão de edição do mesmo tamanho, sem números (o bloco que volta a aparecer só busca dado depois de
 * Salvar), com Subir e Descer, o tamanho e o interruptor de aparecer; segurar a faixa do título arrasta (reforço, nunca o
 * único caminho). Embaixo, a bandeja dos ocultos com "Adicionar". Tudo mexe num rascunho: quem grava ou descarta é a
 * {@link BarraDaEdicao}.
 */
export function GradeEmEdicao({ ctx, rascunho, colunas, aoMudar }: {
  ctx: ContextoDoPainel;
  rascunho: PainelDoInicioPreferido;
  colunas: number;
  aoMudar: MudancaDoPainel;
}) {
  const { cores } = useTema();
  const lista = blocosParaEditar(ctx, rascunho);
  const porId = new Map(lista.map((b) => [b.id, b]));
  const visiveis = blocosVisiveis(ctx, rascunho);
  const ocultos = lista.filter((b) => !b.ligado);
  const linhas = linhasDaGrade(visiveis, colunas, rascunho.tamanhos);
  // Na web, com o dedo, segurar a faixa trava a rolagem dela (`touch-action: none`): em 1 coluna (celular) ficam só os botões.
  const arrastavel = Platform.OS !== 'web' || colunas > 1;

  // ---- Arrastar: mede os cartões na janela ao começar e solta no cartão que está sob o dedo ----
  const nos = useRef(new Map<BlocoDoPainelId, View | null>());
  const caixas = useRef(new Map<BlocoDoPainelId, { x: number; y: number; w: number; h: number }>());
  const [arrastando, setArrastando] = useState<BlocoDoPainelId | null>(null);
  const comecar = (id: BlocoDoPainelId) => {
    setArrastando(id);
    caixas.current.clear();
    nos.current.forEach((no, b) => no?.measureInWindow((x, y, w, h) => caixas.current.set(b, { x, y, w, h })));
  };
  const soltar = (id: BlocoDoPainelId, x: number, y: number) => {
    setArrastando(null);
    let destino: BlocoDoPainelId | null = null;
    caixas.current.forEach((r, b) => { if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) destino = b; });
    const i = destino ? visiveis.indexOf(destino) : -1;
    if (i < 0 || destino === id) return;
    aoMudar(moverBlocoPara(rascunho, id, i, visiveis), `${porId.get(id)?.titulo}: posição ${i + 1} de ${visiveis.length}.`);
  };

  const mover = (b: BlocoParaEditar, sentido: -1 | 1) => {
    const posicao = (b.posicao ?? 1) + sentido;
    // O botão tocado pode ficar desabilitado na nova posição (chegou ao topo): o foco passa ao outro.
    const foco = sentido < 0 ? [alvo(b.id, 'subir'), alvo(b.id, 'descer')] : [alvo(b.id, 'descer'), alvo(b.id, 'subir')];
    aoMudar(moverBloco(rascunho, b.id, sentido, visiveis), `${b.titulo}: posição ${posicao} de ${b.total}.`);
    focarDepois(foco);
  };
  const redimensionar = (b: BlocoParaEditar, t: TamanhoDoBloco) => {
    aoMudar(redimensionarBloco(rascunho, b.id, t), `${b.titulo}: ${ROTULOS_DOS_TAMANHOS[t]}.`);
    focarDepois([alvo(b.id, 'tamanho')]);
  };
  const ocultar = (b: BlocoParaEditar) => {
    aoMudar(mostrarBloco(rascunho, b.id, false), `${b.titulo} saiu do Início. Está em Blocos ocultos.`);
    focarDepois([alvo(b.id, 'adicionar')]);
  };
  const adicionar = (b: BlocoParaEditar) => {
    aoMudar(mostrarBloco(rascunho, b.id, true), `${b.titulo} voltou ao Início.`);
    focarDepois([alvo(b.id, 'aparece')]);
  };

  const notaDasColunas = colunas === 1
    ? 'Nesta largura cada bloco ocupa a linha inteira; o tamanho vale nas telas mais largas.'
    : colunas === 2 ? 'Nesta largura cabem 2 colunas: Médio e Grande ficam com a mesma largura.' : null;

  return (
    <View style={estilos.edicao}>
      <View style={estilos.intro}>
        <Texto variante="suave">
          {arrastavel ? 'Segure a faixa do título para arrastar, ou use Subir e Descer. ' : 'Use Subir e Descer para mudar a ordem. '}
          Nada muda até você salvar; fica salvo neste aparelho.
        </Texto>
        {notaDasColunas ? <Texto variante="pequeno">{notaDasColunas}</Texto> : null}
        <LinhaDeAcoes>
          <View nativeID={ID_DO_RESTAURAR}>
            <Botao rotulo="Restaurar padrão" tipo="secundario" Icone={RotateCcw}
              aoTocar={() => aoMudar(restaurarPadrao(), 'Padrão restaurado: ordem, tamanhos, blocos e Todos/Meus de fábrica. Salve para aplicar.')} />
          </View>
        </LinhaDeAcoes>
      </View>

      <View style={estilos.grade}>
        {visiveis.length === 0 ? (
          <Texto variante="suave">Nenhum bloco aparece no Início. Adicione um em Blocos ocultos.</Texto>
        ) : linhas.map((linha) => (
          <LinhaDeBlocos key={linha.map((c) => c.id).join(':')}
            style={[estilos.linha, linha.some((c) => c.id === arrastando) ? estilos.linhaPorCima : null]}>
            {linha.map((c) => {
              const b = porId.get(c.id);
              if (!b) return null;
              return (
                <View key={c.id} ref={(no) => { nos.current.set(c.id, no); }} collapsable={false} style={{ flex: c.colunas, flexBasis: 0, minWidth: 0 }}>
                  <CartaoEmEdicao bloco={b} arrastavel={arrastavel} emArraste={arrastando === b.id} aoComecar={() => comecar(b.id)} aoSoltar={(x, y) => soltar(b.id, x, y)}
                    aoMover={(s) => mover(b, s)} aoRedimensionar={(t) => redimensionar(b, t)} aoOcultar={() => ocultar(b)} />
                </View>
              );
            })}
          </LinhaDeBlocos>
        ))}
      </View>

      <Cartao titulo="Blocos ocultos" descricao={ocultos.length ? 'Não aparecem no Início. Adicione para voltar a mostrar.' : undefined}>
        {ocultos.length === 0 ? <Texto variante="suave">Nenhum bloco oculto.</Texto> : (
          <View role="list" style={estilos.ocultos}>
            {ocultos.map((b) => (
              <View key={b.id} role="listitem"
                style={[estilos.oculto, { borderTopColor: cores.divisor }]}>
                <View style={estilos.textosDoOculto}>
                  <Texto variante="rotulo" cor={cores.texto}>{b.titulo}</Texto>
                  <Texto variante="pequeno">{b.descricao}</Texto>
                </View>
                <View nativeID={alvo(b.id, 'adicionar')}>
                  <Botao rotulo="Adicionar" rotuloAcessivel={`Adicionar ${b.titulo} ao Início`} tipo="secundario" Icone={Plus} aoTocar={() => adicionar(b)} />
                </View>
              </View>
            ))}
          </View>
        )}
      </Cartao>
    </View>
  );
}

/** O cartão de um bloco no modo de edição: faixa (alça do arraste), descrição, tamanho, ordem e "Aparece no Início". */
function CartaoEmEdicao({ bloco: b, arrastavel, emArraste, aoComecar, aoSoltar, aoMover, aoRedimensionar, aoOcultar }: {
  bloco: BlocoParaEditar;
  arrastavel: boolean;
  /** Este cartão está sendo arrastado: ganha o contorno do foco (também com o movimento reduzido, quando não segue o dedo). */
  emArraste: boolean;
  aoComecar: () => void;
  aoSoltar: (x: number, y: number) => void;
  aoMover: (sentido: -1 | 1) => void;
  aoRedimensionar: (t: TamanhoDoBloco) => void;
  aoOcultar: () => void;
}) {
  const { cores } = useTema();
  const reduzido = useMovimentoReduzido();
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const ativo = useSharedValue(0);
  // Movimento reduzido: o cartão não segue o dedo; fica no lugar com o contorno do foco, e soltar continua valendo.
  const estilo = useAnimatedStyle(() => (ativo.get() && !reduzido ? { transform: [{ translateX: x.get() }, { translateY: y.get() }], opacity: 0.92 } : {}));
  // Segurar antes de arrastar: o toque rápido e a rolagem da página continuam livres.
  const gesto = Gesture.Pan().enabled(arrastavel).activateAfterLongPress(250)
    .onStart(() => { ativo.set(1); scheduleOnRN(aoComecar); })
    .onUpdate((e) => { x.set(e.translationX); y.set(e.translationY); })
    .onEnd((e) => { scheduleOnRN(aoSoltar, e.absoluteX, e.absoluteY); })
    .onFinalize(() => { ativo.set(0); x.set(0); y.set(0); });
  const posicao = `Posição ${b.posicao} de ${b.total}`;
  const faixa = (
    <GestureDetector gesture={gesto}>
      {/* A faixa é só a alça do arraste: Subir e Descer fazem o mesmo pelo teclado e pelo leitor de tela. */}
      <View collapsable={false} style={arrastavel && Platform.OS === 'web' ? estilos.alca : null}>
        <FaixaDoPainel titulo={b.titulo} descricao={posicao}
          acoes={arrastavel ? <View aria-hidden importantForAccessibility="no-hide-descendants" style={estilos.grip}><GripVertical size={20} color={cores.textoSuave} /></View> : null} />
      </View>
    </GestureDetector>
  );
  return (
    <Animated.View style={estilo}>
      <Cartao cabecalho={faixa} style={{ borderColor: emArraste ? cores.anelFoco : cores.bordaCampo }}>
        <Texto variante="pequeno">{b.descricao}</Texto>
        <View nativeID={alvo(b.id, 'tamanho')} style={estilos.campo}>
          <Texto variante="rotulo" cor={cores.texto}>Tamanho</Texto>
          <Escolha descricao={`Tamanho de ${b.titulo}`} opcoes={OPCOES_DE_TAMANHO} valor={b.tamanho} aoMudar={aoRedimensionar} />
        </View>
        {/* Topo: o motivo do botão desligado fica embaixo dele sem descentralizar o outro. */}
        <LinhaDeAcoes style={estilos.topo}>
          <View nativeID={alvo(b.id, 'subir')}>
            <Botao rotulo="Subir" rotuloAcessivel={`Subir ${b.titulo} (${posicao.toLowerCase()})`} tipo="secundario" Icone={ArrowUp}
              desabilitado={!b.podeSubir} motivo="Já é o primeiro." aoTocar={() => aoMover(-1)} />
          </View>
          <View nativeID={alvo(b.id, 'descer')}>
            <Botao rotulo="Descer" rotuloAcessivel={`Descer ${b.titulo} (${posicao.toLowerCase()})`} tipo="secundario" Icone={ArrowDown}
              desabilitado={!b.podeDescer} motivo="Já é o último." aoTocar={() => aoMover(1)} />
          </View>
        </LinhaDeAcoes>
        <View nativeID={alvo(b.id, 'aparece')} style={estilos.aparece}>
          <Texto variante="rotulo" cor={cores.texto} style={estilos.textoAparece}>Aparece no Início</Texto>
          <Switch checked onCheckedChange={(v) => { if (!v) aoOcultar(); }} accessibilityLabel={`${b.titulo} aparece no Início`} />
        </View>
      </Cartao>
    </Animated.View>
  );
}

/**
 * Rodapé fixo do modo de edição (P1 de `docs/design-e-front.md` 4.6), fora da rolagem: a última mudança (lida pelo leitor
 * de tela) à esquerda e Cancelar e Salvar à direita, Salvar por último; no celular, em coluna e cheios.
 */
export function BarraDaEdicao({ mensagem, alterado, aoCancelar, aoSalvar }: {
  mensagem: string | null;
  alterado: boolean;
  aoCancelar: () => void;
  aoSalvar: () => void;
}) {
  const { cores, bordas } = useTema();
  const { width } = useWindowDimensions();
  const { bottom } = useSafeAreaInsets();
  const status = mensagem ?? (alterado ? 'Alterações ainda não salvas.' : 'Nenhuma alteração ainda.');
  return (
    <View style={[estilos.barra, { backgroundColor: cores.superficie, borderTopColor: cores.divisor, borderTopWidth: bordas.bloco, paddingBottom: espaco(1.5) + bottom }]}>
      <View style={estilos.barraDentro}>
        <RodapeDeAcoes empilhar={width < LARGURA_MENU_LATERAL}
          status={<View accessibilityLiveRegion="polite" aria-live="polite"><Texto variante="suave">{status}</Texto></View>}>
          <Botao rotulo="Cancelar" rotuloAcessivel="Cancelar a edição do Início" tipo="secundario" aoTocar={aoCancelar} />
          <Botao rotulo="Salvar" rotuloAcessivel="Salvar o Início" aoTocar={aoSalvar} />
        </RodapeDeAcoes>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  edicao: { gap: espaco(3) },
  intro: { gap: espaco(1) },
  grade: { gap: espaco(2) },
  // Como na grade normal do Início: cada cartão com a própria altura.
  linha: { flexDirection: 'row', gap: espaco(2), alignItems: 'flex-start' },
  topo: { alignItems: 'flex-start' },
  // A linha do cartão arrastado passa por cima das de baixo enquanto ele anda.
  linhaPorCima: { zIndex: 10 },
  // Segurar e arrastar com o mouse não seleciona o título.
  alca: { cursor: 'grab', userSelect: 'none' } as never,
  grip: { minHeight: ALVO_TOQUE, justifyContent: 'center', paddingHorizontal: espaco(0.5) },
  campo: { gap: espaco(0.5) },
  aparece: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5), minHeight: ALVO_TOQUE },
  textoAparece: { flex: 1 },
  ocultos: { gap: 0 },
  oculto: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1.5), paddingVertical: espaco(1.25), borderTopWidth: 1 },
  textosDoOculto: { flexGrow: 1, flexShrink: 1, flexBasis: 220, gap: 2 },
  barra: { paddingTop: espaco(1.5), paddingHorizontal: espaco(2) },
  barraDentro: { width: '100%', maxWidth: LARGURA_LISTA, alignSelf: 'center' },
});
