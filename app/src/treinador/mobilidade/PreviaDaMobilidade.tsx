import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { CartaoDaSecaoDaMobilidade, CartaoDasOrientacoesDaMobilidade } from '../../aluno/PecasDaMobilidade';
import { type ConteudoMobilidade, mobilidadeParaApi } from '../../dominio/mobilidade';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, RAIO } from '../../tema/tokens';
import { Texto } from '../../ui/Texto';
import { useMovimentoReduzido } from '../../ui/useMovimentoReduzido';
import { elementoDaWeb } from '../painel/edicao/tipos';
import { useFixoAbaixoDaBarra } from '../plano/TelaDoEditor';

const nada = () => undefined;

/**
 * Espaço livre abaixo da prévia: a folga do "Voltar ao início" (`RolagemComTopo`, 16 + 44 + 8) que a rolagem põe embaixo
 * das colunas no fim da página; sem descontá-la, no fim a prévia subia e o título dela ficava embaixo da barra.
 */
const FOLGA_DO_FIM = espaco(2) + ALVO_TOQUE + espaco(1);
/** A prévia nunca fica mais baixa que isto (janela muito baixa ou topo da página alto). */
const ALTURA_MINIMA = 320;

/**
 * Prévia ao vivo do editor de mobilidade (3ª coluna, da faixa `larga` em diante; `dominio/colunasDaMobilidade`): o que o
 * aluno vê no celular, com os cartões da tela dele (`aluno/PecasDaMobilidade`), sobre o estado atual do editor (salvo ou
 * não) passado por `mobilidadeParaApi`, para mostrar o que a publicação entrega ("—" sem prescrição, sem "Ver vídeo" com
 * link inválido). Fica grudada abaixo da barra (como a prévia do questionário) e rola até a seção em edição quando ela
 * muda (não a cada tecla). Só olha: o conteúdo é inerte e fora do leitor de tela (a rolagem continua com a roda do mouse).
 */
export function PreviaDaMobilidade({ conteudo, secaoUid, largura }: { conteudo: ConteudoMobilidade; secaoUid: string | null; largura: number }) {
  const { cores } = useTema();
  const reduzido = useMovimentoReduzido();
  // Grudada abaixo da barra (o `top` do editor), mas a altura máxima é posta abaixo, pelo DOM, a cada rolagem.
  const fixo = useFixoAbaixoDaBarra();
  const topoGrudado = typeof fixo?.top === 'number' ? fixo.top : null;
  const coluna = useRef<View>(null);
  const rolagem = useRef<ScrollView>(null);
  const cartoes = useRef<View>(null);
  // Topo de cada seção dentro da rolagem (o `onLayout` do cartão, filho direto da pilha).
  const [topos, setTopos] = useState<Record<string, number>>({});
  const api = mobilidadeParaApi(conteudo);
  useEffect(() => { elementoDaWeb(cartoes.current)?.setAttribute('inert', ''); }, []);
  // A prévia cabe sempre na parte visível da janela, da posição dela (ou da barra, quando já grudou) até embaixo: com a
  // página no topo, a seção em edição fica à vista rolando só a prévia, nunca cortada pela borda da janela. Sincroniza com a
  // rolagem da página (fora do React), sem refazer a tela a cada quadro.
  useEffect(() => {
    const el = elementoDaWeb(coluna.current);
    if (!el || topoGrudado === null) return undefined;
    let pagina = el.parentElement;
    while (pagina && !/(auto|scroll)/.test(getComputedStyle(pagina).overflowY)) pagina = pagina.parentElement;
    const ajustar = () => {
      const limite = (pagina?.getBoundingClientRect().top ?? 0) + topoGrudado;
      const topoAgora = Math.max(el.getBoundingClientRect().top, limite);
      el.style.maxHeight = `${Math.max(ALTURA_MINIMA, Math.round(window.innerHeight - topoAgora - FOLGA_DO_FIM))}px`;
    };
    ajustar();
    pagina?.addEventListener('scroll', ajustar, { passive: true });
    window.addEventListener('resize', ajustar);
    // O que fica acima pode mudar de altura sem rolar (Configuração do plano aberta, aviso de Desfazer, problemas); no quadro
    // seguinte, para a mudança da própria prévia não virar laço do observador.
    const conteudo = pagina?.firstElementChild;
    const observador = conteudo && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => requestAnimationFrame(ajustar)) : null;
    if (conteudo) observador?.observe(conteudo);
    return () => { pagina?.removeEventListener('scroll', ajustar); window.removeEventListener('resize', ajustar); observador?.disconnect(); };
  }, [topoGrudado]);
  // Rolagem da coluna (fora do React) acompanha a seção em edição: só quando ela muda ou o topo dela chega/muda.
  // A primeira seção volta ao topo (as orientações ficam à vista); as outras, `topo` medido na pilha, que começa no recuo de
  // 16 da rolagem: rolar até ele deixa a seção a 16 da borda de cima.
  const topo = !secaoUid ? undefined : api.secoes[0]?.uid === secaoUid ? 0 : topos[secaoUid];
  useEffect(() => {
    if (topo !== undefined) rolagem.current?.scrollTo({ y: topo, animated: !reduzido });
  }, [secaoUid, topo, reduzido]);
  return (
    <View ref={coluna} role="complementary" aria-labelledby="titulo-da-previa-da-mobilidade" testID="previa-da-mobilidade"
      style={[estilos.coluna, { width: largura }, fixo ? { ...fixo, maxHeight: undefined } : null]}>
      <View style={[estilos.moldura, { backgroundColor: cores.fundo, borderColor: cores.borda }]}>
        <View style={[estilos.topo, { borderBottomColor: cores.divisor }]}>
          <Texto variante="rotulo" nativeID="titulo-da-previa-da-mobilidade">Prévia para o aluno</Texto>
          <Texto variante="pequeno">Como fica no celular dele. Atualiza enquanto você edita.</Texto>
        </View>
        <ScrollView ref={rolagem} style={estilos.rolagem} contentContainerStyle={estilos.conteudo}>
          <View ref={cartoes} pointerEvents="none" aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={estilos.pilha}>
            <CartaoDasOrientacoesDaMobilidade texto={api.orientacoes} />
            {api.secoes.map((s) => (
              <View key={s.uid} testID={`previa-secao-${s.uid}`}
                onLayout={(e) => { const y = e.nativeEvent.layout.y; setTopos((t) => (t[s.uid] === y ? t : { ...t, [s.uid]: y })); }}>
                <CartaoDaSecaoDaMobilidade secao={s} aoVerVideo={nada} />
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  coluna: { alignSelf: 'flex-start', flexShrink: 0 },
  // `minHeight: 0` e `flexShrink`: a moldura cabe na altura da coluna grudada e a rolagem de dentro rola.
  moldura: { flexShrink: 1, minHeight: 0, borderWidth: 1, borderRadius: RAIO, overflow: 'hidden' },
  topo: { gap: 2, paddingHorizontal: espaco(2), paddingVertical: espaco(1.25), borderBottomWidth: 1 },
  rolagem: { flexShrink: 1 },
  conteudo: { padding: espaco(2) },
  pilha: { gap: espaco(2) },
});
