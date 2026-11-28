import { CircleAlert } from 'lucide-react-native';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { idDoBloco, itemVisivel, type ItemDoIndice } from '../../dominio/indiceDoQuestionario';
import type { ProblemaDoIndice } from '../../dominio/resumoDoQuestionario';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../../tema/tokens';
import { Selo } from '../../ui/Selo';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';
import { ID_DA_BARRA, mostrarAbaixoDaBarra, useFixoAbaixoDaBarra } from '../plano/TelaDoEditor';

/** O item dos campos fixos da Inscrição ("Seu contato · 4 campos fixos"), antes das seções; leva à prévia, não ao editor. */
export interface CamposFixosDoIndice { resumo: string; aoEscolher: () => void }

/**
 * Índice do editor de questionário na tela larga: "Instruções" e cada seção com quantas perguntas tem (na Inscrição, antes
 * delas, os campos fixos da página); fica parado ao rolar, com a altura da área visível, e rola por dentro se passar dela.
 * O item da seção à vista usa a seleção neutra (`superficie3`), o texto em negrito e o indicador pequeno da marca (o mesmo
 * do índice da Ajuda), com `aria-current`; erro = selo "Corrigir". Embaixo das seções, sem deixar a coluna vazia: o resumo
 * do rascunho, a situação em relação ao publicado e os problemas que travam a publicação, cada um um link até o lugar.
 */
export function IndiceDoQuestionario({ itens, atual, largura, aoEscolher, camposFixos, resumo, situacao, problemas, aoIrAoProblema }: {
  itens: readonly ItemDoIndice[]; atual: number; largura: number; aoEscolher: (indice: number) => void;
  camposFixos?: CamposFixosDoIndice | null;
  resumo: string; situacao: string;
  problemas: readonly ProblemaDoIndice[]; aoIrAoProblema: (problema: ProblemaDoIndice) => void;
}) {
  const { cores, marcaPeca } = useTema();
  const fixo = useFixoAbaixoDaBarra();
  const item = (chave: string, titulo: string, linha: string | null, ativo: boolean, erro: boolean, aoTocar: () => void, dica?: string) => (
    <View key={chave} role="listitem">
      <Pressable accessibilityRole="button" aria-current={ativo ? 'location' : undefined}
        accessibilityLabel={[titulo, linha, erro ? 'precisa de correção' : null].filter(Boolean).join(', ')} accessibilityHint={dica}
        onPress={aoTocar}
        style={(estado) => [estilos.item, ativo ? { backgroundColor: cores.superficie3 } : sobre(estado) && { backgroundColor: cores.superficie2 }]}>
        {ativo ? <View aria-hidden style={[estilos.indicador, { backgroundColor: marcaPeca }]} /> : null}
        <View style={estilos.textos}>
          <Texto numberOfLines={2} style={{ color: ativo ? cores.texto : cores.textoSuave, fontFamily: ativo ? fontes.semi : fontes.medio }}>{titulo}</Texto>
          {linha ? <Texto variante="pequeno" numerico>{linha}</Texto> : null}
        </View>
        {erro ? <Selo texto="Corrigir" tipo="perigo" /> : null}
      </Pressable>
    </View>
  );
  return (
    <View role="navigation" aria-label="Seções do questionário" testID="indice-do-questionario"
      style={[estilos.indice, { width: largura }, fixo, Platform.OS === 'web' && ({ overflowY: 'auto' } as unknown as ViewStyle)]}>
      <Texto variante="secao" style={estilos.titulo}>Nesta página</Texto>
      <View role="list" style={estilos.lista}>
        {camposFixos ? item('campos-fixos', 'Seu contato', camposFixos.resumo, false, false, camposFixos.aoEscolher, 'Mostra na prévia; os campos fixos não se editam aqui.') : null}
        {itens.map((x, i) => item(x.chave, x.titulo, x.resumo, i === atual, x.erro, () => aoEscolher(i)))}
      </View>
      <View style={[estilos.rodape, { borderTopColor: cores.divisor }]}>
        <View style={estilos.bloco}>
          <Texto variante="secao">Resumo</Texto>
          <Texto variante="pequeno" numerico testID="resumo-do-questionario">{resumo}</Texto>
          <Texto variante="pequeno" numerico testID="situacao-do-questionario">{situacao}</Texto>
        </View>
        {problemas.length ? <View style={estilos.bloco}>
          <Texto variante="secao">Para publicar</Texto>
          <View role="list">
            {problemas.map((p) => (
              <View key={p.rotulo} role="listitem">
                <Pressable accessibilityRole="link" accessibilityLabel={`${p.rotulo}. Ir até o problema`}
                  onPress={() => aoIrAoProblema(p)}
                  style={(estado) => [estilos.problema, sobre(estado) && { backgroundColor: cores.superficie2 }]}>
                  <CircleAlert aria-hidden size={16} color={cores.perigo} />
                  <Texto numerico style={[estilos.textoDoProblema, { color: cores.texto }]}>{p.rotulo}</Texto>
                </Pressable>
              </View>
            ))}
          </View>
        </View> : null}
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
  titulo: { paddingHorizontal: espaco(1.5), paddingBottom: espaco(1) },
  lista: { gap: 2 },
  item: { minHeight: ALVO_TOQUE, flexDirection: 'row', alignItems: 'center', gap: espaco(1), paddingHorizontal: espaco(1.5), paddingVertical: espaco(0.75), borderRadius: RAIO },
  textos: { flex: 1, minWidth: 0, gap: 2 },
  indicador: { position: 'absolute', left: 0, top: '50%', marginTop: -8, width: 3, height: 16, borderTopRightRadius: 2, borderBottomRightRadius: 2 },
  // Fio + 16 acima: o grupo de baixo é outro assunto (o espaço entre grupos é o dobro do de dentro).
  rodape: { marginTop: espaco(2), paddingTop: espaco(2), paddingHorizontal: espaco(1.5), borderTopWidth: 1, gap: espaco(2) },
  bloco: { gap: espaco(0.5) },
  problema: { minHeight: ALVO_TOQUE, flexDirection: 'row', alignItems: 'center', gap: espaco(1), marginHorizontal: -espaco(1.5), paddingHorizontal: espaco(1.5), borderRadius: RAIO },
  textoDoProblema: { flex: 1, minWidth: 0 },
});
