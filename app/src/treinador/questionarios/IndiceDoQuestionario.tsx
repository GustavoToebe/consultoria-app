import { useEffect, useRef, useState, type RefObject } from 'react';
import { Platform, Pressable, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';

import { idDoBloco, itemVisivel, LARGURA_MAXIMA_DOS_ITENS, type ItemDoIndice } from '../../dominio/indiceDoQuestionario';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../../tema/tokens';
import { Selo } from '../../ui/Selo';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';
import { ID_DA_BARRA, mostrarAbaixoDaBarra } from '../plano/TelaDoEditor';

/**
 * Logo abaixo da barra fixa do `TelaDoEditor`, como o resumo do editor de treino e o total do dia da dieta (80 px). Só na
 * web: no nativo o índice nem existe (`arranjoDoEditor`).
 */
export const fixoAbaixoDaBarra = (alturaDaJanela: number) =>
  (Platform.OS === 'web' ? { position: 'sticky', top: espaco(10), maxHeight: alturaDaJanela - espaco(12) } : {}) as unknown as ViewStyle;

/**
 * Índice do editor de questionário na tela larga: "Instruções" e cada seção com quantas perguntas tem; fica parado ao
 * rolar e rola por dentro se passar da janela. O item da seção à vista usa a seleção neutra (`superficie3`), o texto em
 * negrito e o indicador pequeno da marca (o mesmo do índice da Ajuda), com `aria-current`; erro = selo "Corrigir".
 */
export function IndiceDoQuestionario({ itens, atual, largura, aoEscolher }: {
  itens: readonly ItemDoIndice[]; atual: number; largura: number; aoEscolher: (indice: number) => void;
}) {
  const { cores, marcaPeca } = useTema();
  const { height } = useWindowDimensions();
  return (
    <View role="navigation" aria-label="Seções do questionário" testID="indice-do-questionario"
      style={[estilos.indice, { width: largura }, fixoAbaixoDaBarra(height), Platform.OS === 'web' && ({ overflowY: 'auto' } as unknown as ViewStyle)]}>
      <View style={estilos.limite}>
      <Texto variante="secao" style={estilos.titulo}>Nesta página</Texto>
      {itens.map((item, i) => {
        const ativo = i === atual;
        return (
          <Pressable key={item.chave} accessibilityRole="button" aria-current={ativo ? 'location' : undefined}
            accessibilityLabel={[item.titulo, item.resumo, item.erro ? 'precisa de correção' : null].filter(Boolean).join(', ')}
            onPress={() => aoEscolher(i)}
            style={(estado) => [estilos.item, ativo ? { backgroundColor: cores.superficie3 } : sobre(estado) && { backgroundColor: cores.superficie2 }]}>
            {ativo ? <View aria-hidden style={[estilos.indicador, { backgroundColor: marcaPeca }]} /> : null}
            <View style={estilos.textos}>
              <Texto numberOfLines={2} style={{ color: ativo ? cores.texto : cores.textoSuave, fontFamily: ativo ? fontes.semi : fontes.medio }}>{item.titulo}</Texto>
              {item.resumo ? <Texto variante="pequeno" numerico>{item.resumo}</Texto> : null}
            </View>
            {item.erro ? <Selo texto="Corrigir" tipo="perigo" /> : null}
          </Pressable>
        );
      })}
      </View>
    </View>
  );
}

/**
 * Web: qual item do índice está à vista, lido na rolagem da página (ancestral rolável de `ancora`) a cada quadro de
 * rolagem. `marcar` vale para o clique: a rolagem que ele mesmo provoca não tira a marca do item escolhido (seção curta
 * no fim nunca chega à linha da barra).
 */
export function useItemVisivel(chaves: readonly string[], ativo: boolean, ancora: RefObject<View | null>) {
  const [atual, setAtual] = useState(0);
  const ignorarAte = useRef(0);
  const ids = chaves.map(idDoBloco).join('|');
  useEffect(() => {
    if (!ativo || Platform.OS !== 'web') return undefined;
    let rolagem = (ancora.current as unknown as HTMLElement | null)?.parentElement ?? null;
    while (rolagem && !/(auto|scroll)/.test(getComputedStyle(rolagem).overflowY)) rolagem = rolagem.parentElement;
    const el = rolagem;
    if (!el) return undefined;
    let quadro = 0;
    const ler = () => {
      quadro = 0;
      if (performance.now() < ignorarAte.current) return;
      const linha = (document.getElementById(ID_DA_BARRA)?.getBoundingClientRect().bottom ?? el.getBoundingClientRect().top) + espaco(3);
      const topos = ids.split('|').map((id) => document.getElementById(id)?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY);
      const noFim = el.scrollTop > 0 && el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
      setAtual(itemVisivel(topos, linha, noFim));
    };
    const aoRolar = () => { if (!quadro) quadro = requestAnimationFrame(ler); };
    el.addEventListener('scroll', aoRolar, { passive: true });
    ler();
    return () => {
      el.removeEventListener('scroll', aoRolar);
      if (quadro) cancelAnimationFrame(quadro);
    };
  }, [ativo, ids, ancora]);
  const marcar = (i: number) => {
    ignorarAte.current = performance.now() + 500;
    setAtual(i);
  };
  return { atual, marcar };
}

/**
 * Web: leva o bloco (`idDoBloco`) para logo abaixo da barra fixa (`mostrarAbaixoDaBarra`, sempre, mesmo à vista) e depois
 * põe o foco no título dele, sem rolar de novo, para quem usa teclado ou leitor de tela continuar dali. O foco vem no
 * quadro seguinte ao da rolagem: antes dela, o título sob a barra faria o `TelaDoEditor` centralizá-lo (pulo duplo).
 */
export function irParaBloco(chave: string): void {
  if (Platform.OS !== 'web') return;
  const id = idDoBloco(chave);
  mostrarAbaixoDaBarra(id, true);
  requestAnimationFrame(() => {
    const bloco = document.getElementById(id);
    if (!bloco) return;
    const alvo = bloco.querySelector<HTMLElement>('[role="heading"]') ?? bloco;
    if (!alvo.hasAttribute('tabindex')) alvo.setAttribute('tabindex', '-1');
    alvo.focus({ preventScroll: true });
  });
}

const estilos = StyleSheet.create({
  // A folga de 4 px deixa o anel de foco inteiro: o índice rola por dentro e cortaria a borda (o mesmo da Ajuda).
  indice: { alignSelf: 'flex-start', flexShrink: 0, gap: 2, padding: 4 },
  limite: { width: '100%', maxWidth: LARGURA_MAXIMA_DOS_ITENS, gap: 2 },
  titulo: { paddingHorizontal: espaco(1.5), paddingBottom: espaco(1) },
  item: { minHeight: ALVO_TOQUE, flexDirection: 'row', alignItems: 'center', gap: espaco(1), paddingHorizontal: espaco(1.5), paddingVertical: espaco(0.75), borderRadius: RAIO },
  textos: { flex: 1, minWidth: 0, gap: 2 },
  indicador: { position: 'absolute', left: 0, top: '50%', marginTop: -8, width: 3, height: 16, borderTopRightRadius: 2, borderBottomRightRadius: 2 },
});
