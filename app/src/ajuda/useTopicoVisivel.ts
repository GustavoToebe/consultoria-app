import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { itemVisivel } from '../dominio/indiceDoQuestionario';
import { espaco } from '../tema/tokens';

/** Id no DOM (`nativeID`) do tópico do artigo: o "Nesta página" lê a posição dele. */
export const idDoTopicoNaPagina = (topico: string) => `ajuda-topico-${topico}`;

/**
 * Web: qual tópico do artigo está à vista, lido na rolagem da página (o primeiro ancestral rolável do primeiro tópico)
 * a cada quadro de rolagem, pela regra do índice do questionário (`itemVisivel`). `marcar` vale para o clique: a rolagem
 * que ele provoca não tira a marca do tópico escolhido. Fora da web (ou `ativo` falso), fica no escolhido.
 */
export function useTopicoVisivel(topicos: readonly string[], ativo: boolean) {
  const [atual, setAtual] = useState(0);
  const ignorarAte = useRef(0);
  const ids = topicos.join('|');
  useEffect(() => {
    if (!ativo || Platform.OS !== 'web' || !ids) return undefined;
    const lista = ids.split('|');
    let rolagem = document.getElementById(idDoTopicoNaPagina(lista[0]))?.parentElement ?? null;
    while (rolagem && !/(auto|scroll)/.test(getComputedStyle(rolagem).overflowY)) rolagem = rolagem.parentElement;
    const el = rolagem;
    if (!el) return undefined;
    let quadro = 0;
    const ler = () => {
      quadro = 0;
      if (performance.now() < ignorarAte.current) return;
      const linha = el.getBoundingClientRect().top + espaco(10);
      const topos = lista.map((id) => document.getElementById(idDoTopicoNaPagina(id))?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY);
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
  }, [ativo, ids]);
  const marcar = (i: number) => {
    ignorarAte.current = performance.now() + 600;
    setAtual(i);
  };
  return { atual, marcar };
}
