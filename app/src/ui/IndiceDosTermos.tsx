import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View, useWindowDimensions, type ViewStyle } from 'react-native';

import { itemVisivel } from '../dominio/indiceDoQuestionario';
import type { SecaoDoDocumento } from '../dominio/termos';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../tema/tokens';
import { useRolagem } from './RolagemComTopo';
import { Texto } from './Texto';
import { sobre } from './sobre';

/**
 * Seção que está à vista (web), lida na rolagem da página (o primeiro ancestral rolável do primeiro h3) a cada quadro, pela
 * regra do índice do questionário e da Ajuda (`itemVisivel`: o último título que passou da linha; no fim da rolagem, o
 * último, para a seção curta do fim acender). O toque no índice trava a leitura por 600 ms: a rolagem que ele provoca não
 * tira a marca da seção escolhida. Fora da web, fica na escolhida.
 */
function useSecaoVisivel(ids: readonly string[]) {
  const [atual, setAtual] = useState(0);
  const ignorarAte = useRef(0);
  const chave = ids.join('|');
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined' || !chave) return undefined;
    const lista = chave.split('|');
    let rolagem = document.getElementById(lista[0])?.parentElement ?? null;
    while (rolagem && !/(auto|scroll)/.test(getComputedStyle(rolagem).overflowY)) rolagem = rolagem.parentElement;
    const el = rolagem;
    if (!el) return undefined;
    let quadro = 0;
    const ler = () => {
      quadro = 0;
      if (performance.now() < ignorarAte.current) return;
      const linha = el.getBoundingClientRect().top + espaco(10);
      const topos = lista.map((id) => document.getElementById(id)?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY);
      const noFim = el.scrollTop > 0 && el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
      setAtual(itemVisivel(topos, linha, noFim));
    };
    const aoRolar = () => { if (!quadro) quadro = requestAnimationFrame(ler); };
    el.addEventListener('scroll', aoRolar, { passive: true });
    quadro = requestAnimationFrame(ler);
    return () => {
      el.removeEventListener('scroll', aoRolar);
      if (quadro) cancelAnimationFrame(quadro);
    };
  }, [chave]);
  const marcar = (i: number) => {
    ignorarAte.current = performance.now() + 600;
    setAtual(i);
  };
  return { atual: Math.min(atual, Math.max(0, ids.length - 1)), marcar };
}

/**
 * "Nesta página" dos termos: as seções numeradas do documento aberto, parado ao rolar (sticky na web) e com a seção visível
 * destacada (seleção neutra `superficie3`, negrito e o traço da marca; a cor nunca é o único sinal; `aria-current`). Tocar
 * rola até a seção. Peça própria dos termos (o índice da Ajuda é outro); só no PC: no celular a tela não o monta.
 */
export function IndiceDosTermos({ secoes }: { secoes: readonly SecaoDoDocumento[] }) {
  const { cores, marcaPeca } = useTema();
  const { height } = useWindowDimensions();
  const { rolarAte } = useRolagem();
  const { atual, marcar } = useSecaoVisivel(secoes.map((s) => s.id));
  const fixo = (Platform.OS === 'web' ? { position: 'sticky', top: espaco(2), maxHeight: height - espaco(4), overflowY: 'auto' } : {}) as unknown as ViewStyle;
  if (!secoes.length) return null;
  return (
    <View role="navigation" aria-label="Nesta página" style={[estilos.indice, fixo]}>
      <Texto variante="secao" style={estilos.titulo}>Nesta página</Texto>
      {secoes.map((s, i) => {
        const ativo = i === atual;
        return (
          <Pressable key={s.id} accessibilityRole="button" aria-current={ativo ? 'location' : undefined}
            onPress={() => {
              marcar(i);
              rolarAte([s.id]);
            }}
            style={(estado) => [estilos.topico, ativo ? { backgroundColor: cores.superficie3 } : sobre(estado) && { backgroundColor: cores.superficie2 }]}>
            {ativo ? <View aria-hidden style={[estilos.indicador, { backgroundColor: marcaPeca }]} /> : null}
            <Texto variante="suave" style={{ color: ativo ? cores.texto : cores.textoSuave, fontFamily: ativo ? fontes.semi : fontes.medio }}>{s.rotulo}</Texto>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Largura do índice; a tela só o mostra com espaço para ele e a coluna de leitura. */
export const LARGURA_DO_INDICE = 260;

const estilos = StyleSheet.create({
  // Os mesmos números do índice da Ajuda: a família de "Nesta página" igual nas duas telas.
  indice: { width: LARGURA_DO_INDICE, alignSelf: 'flex-start', gap: 2, padding: 4 },
  titulo: { paddingHorizontal: espaco(1.5), paddingBottom: espaco(1) },
  topico: { minHeight: ALVO_TOQUE, justifyContent: 'center', paddingHorizontal: espaco(1.5), paddingVertical: espaco(0.75), borderRadius: RAIO },
  indicador: { position: 'absolute', left: 0, top: '50%', marginTop: -8, width: 3, height: 16, borderTopRightRadius: 2, borderBottomRightRadius: 2 },
});
