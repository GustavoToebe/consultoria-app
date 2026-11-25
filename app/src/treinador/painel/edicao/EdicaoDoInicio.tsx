import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View } from 'react-native';

import { alvoSobOPonteiro } from '../../../dominio/reordenar';
import { useTema } from '../../../tema/TemaProvider';
import { espaco, RAIO } from '../../../tema/tokens';
import { comItensComoAlvos, ItemArrastavel, useArraste } from '../../../ui/ArrasteDaLista';
import { Texto } from '../../../ui/Texto';
import { LinhaDeBlocos } from '../FaixaDoPainel';
import { linhasDaGrade } from '../grade';
import { BarraDoBloco } from './BarraDoBloco';
import { FaixaAdicionarBlocos } from './FaixaAdicionarBlocos';
import {
  elementoDaWeb, focarDepois, idDaEdicao, tamanhosDaGrade, textoDaPosicao,
  type BlocoDoPainelId, type ItemDaEdicao, type OpcaoDoBloco, type TamanhoDoBloco,
} from './tipos';

export const FRASE_DA_EDICAO = 'Arraste, mude o tamanho ou oculte os blocos. Nada muda até você salvar.';
export const FRASE_SEM_BLOCOS = 'Nenhum bloco no Início. Adicione um abaixo.';

export interface PropsDaEdicao {
  /** `blocosParaEditar(ctx, rascunho)`: todos os permitidos, na ordem; os `ligado` vão para a grade, os outros para "Adicionar blocos". */
  itens: readonly ItemDaEdicao[];
  /** `colunasDaGrade(...)`, as mesmas do Início fora da edição. */
  colunas: number;
  /** O bloco de verdade, como no Início (a peça o mostra esmaecido e sem toque). `null`: só o nome e a descrição. */
  renderConteudo: (id: BlocoDoPainelId, tamanho: TamanhoDoBloco) => ReactNode;
  /** Leva o bloco à posição `destino` (0 a N−1) entre os visíveis: `moverBlocoPara(rascunho, id, destino, visiveis)`. */
  aoMover: (id: BlocoDoPainelId, destino: number) => void;
  aoMudarTamanho: (id: BlocoDoPainelId, tamanho: TamanhoDoBloco) => void;
  aoOcultar: (id: BlocoDoPainelId) => void;
  /** O bloco volta no fim da grade, já visível. */
  aoAdicionar: (id: BlocoDoPainelId) => void;
  aoMudarOpcao: (id: BlocoDoPainelId, chave: OpcaoDoBloco['chave'], valor: number) => void;
}

/**
 * O modo de edição do Início no próprio Início, estilo widgets (pedido de 25/11): a mesma grade (`linhasDaGrade`) e o
 * mesmo tamanho de cada bloco, com o conteúdo de verdade esmaecido e sem interação (fora do toque, do Tab e do leitor de
 * tela), a borda tracejada e, no topo de cada bloco, a {@link BarraDoBloco}. Mudar o tamanho é prévia ao vivo: o pai
 * grava no rascunho e a grade se refaz. No fim, "Adicionar blocos" com os ocultos. Cada movimento é anunciado ("Agenda,
 * posição 3 de 8") e o foco volta ao controle depois que a grade se rearruma. O rodapé (`BarraDaEdicao`) fica fora, com
 * o pai.
 *
 * Arrastar (reforço, nunca o único caminho; `ui/ArrasteDaLista`): pela alça ⠿, solta no bloco sob o ponteiro, que ganha a
 * borda na cor de ação. Na web com 1 coluna não arrasta (a alça com `touch-action: none` travaria a rolagem do dedo); lá
 * fica o ⋯. Sem aviso "Ordem alterada." (4.12: tudo é rascunho e Cancelar descarta).
 */
export function EdicaoDoInicio({ itens, colunas, renderConteudo, aoMover, aoMudarTamanho, aoOcultar, aoAdicionar, aoMudarOpcao }: PropsDaEdicao) {
  const { cores } = useTema();
  const [anuncio, setAnuncio] = useState({ texto: '', vez: 0 });
  const visiveis = itens.filter((b) => b.ligado);
  const ids = visiveis.map((b) => b.id);
  const porId = new Map(visiveis.map((b) => [b.id, b]));
  const ocultos = itens.filter((b) => !b.ligado);
  const tamanhos = Object.fromEntries(visiveis.map((b) => [b.id, b.tamanho])) as Partial<Record<BlocoDoPainelId, TamanhoDoBloco>>;
  const linhas = linhasDaGrade(ids, colunas, tamanhos);
  const tamanhosDisponiveis = tamanhosDaGrade(colunas);

  const anunciar = (texto: string) => {
    setAnuncio((a) => ({ texto, vez: a.vez + 1 }));
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(texto);
  };
  const mover = (b: ItemDaEdicao, destino: number) => {
    aoMover(b.id, destino);
    anunciar(textoDaPosicao(b.titulo, destino + 1, visiveis.length));
  };

  const arraste = comItensComoAlvos(useArraste<BlocoDoPainelId, BlocoDoPainelId>({
    ativo: (Platform.OS !== 'web' || colunas > 1) && visiveis.length > 1,
    destino: (_de, ponto, blocos) => alvoSobOPonteiro([...blocos], ponto),
    aoSoltar: (id, alvo) => {
      const destino = ids.indexOf(alvo);
      const b = porId.get(id);
      if (destino < 0 || alvo === id || !b) return false;
      mover(b, destino);
      return true;
    },
  }));

  return (
    <View style={estilos.edicao}>
      <Texto variante="suave">{FRASE_DA_EDICAO}</Texto>
      {/* Anúncio da posição (visualmente escondido); a chave refaz o texto para repetir a mesma frase. */}
      <View role="status" accessibilityLiveRegion="polite" aria-live="polite" style={estilos.soLeitor}>
        {anuncio.texto ? <Texto key={anuncio.vez}>{anuncio.texto}</Texto> : null}
      </View>

      {visiveis.length === 0 ? <Texto variante="suave">{FRASE_SEM_BLOCOS}</Texto> : (
        <View style={estilos.grade}>
          {linhas.map((linha) => (
            <LinhaDeBlocos key={linha.map((c) => c.id).join(':')}
              style={[estilos.linha, linha.some((c) => c.id === arraste.de) ? estilos.linhaPorCima : null]}>
              <AlturaDasBarras>{(barras) => linha.map((c) => {
                const b = porId.get(c.id);
                if (!b) return null;
                const destino = arraste.para === b.id && arraste.de !== null && arraste.de !== b.id;
                return (
                  <ItemArrastavel key={c.id} arraste={arraste} indice={c.id} style={{ flex: c.colunas, flexBasis: 0, minWidth: 0 }}>
                    <View role="group" aria-label={b.titulo}
                      style={[estilos.bloco, { backgroundColor: cores.superficie }, destino
                        ? { borderColor: cores.acao, borderStyle: 'solid' }
                        : { borderColor: cores.bordaCampo, borderStyle: 'dashed' }]}>
                      <BarraDoBloco item={b} arraste={arraste} tamanhos={tamanhosDisponiveis} alturaMinima={barras.maior} aoMedir={(h) => barras.informar(b.id, h)}
                        aoMudarTamanho={(t) => {
                          aoMudarTamanho(b.id, t);
                          focarDepois([idDaEdicao(b.id, 'tamanho')]);
                        }}
                        aoOcultar={() => {
                          aoOcultar(b.id);
                          anunciar(`${b.titulo} saiu do Início. Está em Adicionar blocos.`);
                          focarDepois([idDaEdicao(b.id, 'adicionar')]);
                        }}
                        aoMover={(delta) => {
                          mover(b, (b.posicao ?? 1) - 1 + delta);
                          focarDepois([idDaEdicao(b.id, 'menu')]);
                        }}
                        aoMudarOpcao={(chave, valor) => aoMudarOpcao(b.id, chave, valor)} />
                      <ConteudoEsmaecido descricao={b.descricao}>{renderConteudo(b.id, b.tamanho)}</ConteudoEsmaecido>
                    </View>
                  </ItemArrastavel>
                );
              })}</AlturaDasBarras>
            </LinhaDeBlocos>
          ))}
        </View>
      )}

      <FaixaAdicionarBlocos ocultos={ocultos}
        aoAdicionar={(id) => {
          const b = ocultos.find((o) => o.id === id);
          aoAdicionar(id);
          if (b) anunciar(textoDaPosicao(b.titulo, visiveis.length + 1, visiveis.length + 1));
          focarDepois([idDaEdicao(id, 'bloco')]);
        }} />
    </View>
  );
}

/**
 * A maior altura natural das barras de uma linha (o padrão da `LinhaDeBlocos` para as faixas): num bloco P a barra quebra
 * em duas linhas e no M vizinho não; sem isto o conteúdo dos dois começaria em alturas diferentes.
 */
function AlturaDasBarras({ children }: { children: (barras: { maior: number; informar: (id: BlocoDoPainelId, altura: number) => void }) => ReactNode }) {
  const [alturas, setAlturas] = useState<Partial<Record<BlocoDoPainelId, number>>>({});
  const informar = useCallback((id: BlocoDoPainelId, altura: number) => {
    setAlturas((a) => (a[id] === altura ? a : { ...a, [id]: altura }));
  }, []);
  return <>{children({ maior: Math.max(0, ...Object.values(alturas)), informar })}</>;
}

/**
 * O conteúdo de verdade do bloco, a 60%, sem toque, fora do Tab (`inert` na web, posto pelo DOM: o react-native-web não
 * repassa a prop) e escondido do leitor de tela, que já tem o nome na barra. Sem conteúdo (o bloco que acabou de voltar
 * ainda não buscou nada), a frase do que ele mostra.
 */
function ConteudoEsmaecido({ descricao, children }: { descricao: string; children: ReactNode }) {
  const caixa = useRef<View>(null);
  useEffect(() => { elementoDaWeb(caixa.current)?.setAttribute('inert', ''); }, []);
  return (
    <View ref={caixa} testID="conteudo-do-bloco" pointerEvents="none" aria-hidden accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants" style={estilos.conteudo}>
      {children ?? <Texto variante="suave">{descricao}</Texto>}
    </View>
  );
}

const estilos = StyleSheet.create({
  edicao: { gap: espaco(3) },
  grade: { gap: espaco(2) },
  // Como no Início: os blocos de uma linha com a mesma altura.
  linha: { flexDirection: 'row', gap: espaco(2), alignItems: 'stretch' },
  // A linha do bloco arrastado passa por cima das de baixo enquanto ele anda.
  linhaPorCima: { zIndex: 10 },
  bloco: { flexGrow: 1, gap: espaco(0.5), padding: espaco(0.5), borderWidth: 1.5, borderRadius: RAIO },
  // O recuo do corpo do bloco no Início (o do `Cartao`), menos a moldura de 4 px desta caixa.
  conteudo: { flexGrow: 1, opacity: 0.6, paddingHorizontal: espaco(1.5), paddingTop: espaco(1), paddingBottom: espaco(1.5) },
  soLeitor: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
});
