import { Check } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import type { CorDaTag } from '../../api/tipos';
import { COR_DAS_TAGS } from '../../dominio/tagsDeAluno';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE } from '../../tema/tokens';
import { sobre } from '../../ui/sobre';

const BOLINHA = 28;
type Focavel = { focus: () => void };

/** O react-native-web não repassa `title`: vai direto no elemento (só na web; reforço do mouse, nunca o único caminho). */
const dentro = (grupo: unknown, alvo: unknown) => typeof Node !== 'undefined' && grupo instanceof Node && alvo instanceof Node && grupo.contains(alvo);
const comTitulo = (dica: string) => (el: View | null) => {
  if (Platform.OS === 'web' && el && 'setAttribute' in el && typeof el.setAttribute === 'function') el.setAttribute('title', dica);
};

/**
 * As 5 cores de identificação da tag em bolinhas de 28 px (alvo de 44), para criar e para trocar na linha. Escolha única
 * (regra 17, 28/11): grupo de rádio (`radiogroup` com o nome do grupo, cada bolinha `radio` com `aria-checked`, "Cor:
 * Violeta", e o nome no `title`); a escolhida tem o anel na cor do texto e o ✓ na cor do fundo da tag (o par do selo,
 * ≥ 4,5:1 em `tokens.test.ts`). Teclado do rádio da APG: um só ponto no Tab (a escolhida), setas, Home e End movem o foco
 * E escolhem, Espaço escolhe a focada. Na linha da lista cada escolha grava na hora (uma por seta); com `ocupado` (uma
 * gravação em curso) a seta é ignorada e o foco fica onde está, sem `disabled`, que tiraria o foco da bolinha.
 */
export function CoresDaTag({ rotulo, valor, aoEscolher, desabilitado, ocupado }: {
  /** Nome do grupo, com o nome da tag na linha ("Cor da tag Online"): sem ele, N grupos iguais na leitura. */
  rotulo: string; valor: CorDaTag; aoEscolher: (cor: CorDaTag) => void; desabilitado?: boolean;
  /** Gravando outra coisa: as bolinhas não respondem (apagadas), mas continuam focáveis. */
  ocupado?: boolean;
}) {
  const { cores, identificacao } = useTema();
  const refs = useRef<(Focavel | null)[]>([]);
  const atual = Math.max(0, COR_DAS_TAGS.findIndex((c) => c.valor === valor));
  // Quem fica no Tab: a escolhida, até as setas levarem o foco a outra (que fica no Tab até sair do grupo).
  const [noTab, setNoTab] = useState<number | null>(null);
  const indiceDoTab = noTab ?? atual;
  const parado = !!desabilitado || !!ocupado;

  const escolher = (i: number) => {
    setNoTab(i);
    const cor = COR_DAS_TAGS[i];
    if (cor && cor.valor !== valor) aoEscolher(cor.valor);
  };
  const aoTeclar = (e: { key: string; repeat?: boolean; preventDefault: () => void }) => {
    const n = COR_DAS_TAGS.length;
    const de = indiceDoTab;
    if (e.key === ' ') {
      e.preventDefault();
      if (!parado && !e.repeat) escolher(de);
      return;
    }
    const destino = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (de + 1) % n
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? (de - 1 + n) % n
        : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : null;
    if (destino === null) return;
    e.preventDefault();
    if (parado) return;
    refs.current[destino]?.focus();
    escolher(destino);
  };

  return (
    <View role="radiogroup" aria-label={rotulo} accessibilityLabel={rotulo} aria-disabled={parado} style={estilos.grupo}
      // O foco saiu do grupo: na volta, o Tab cai de novo na escolhida.
      {...(Platform.OS === 'web' ? { onKeyDown: aoTeclar, onBlur: (e: { currentTarget: unknown; relatedTarget?: unknown }) => { if (!dentro(e.currentTarget, e.relatedTarget)) setNoTab(null); } } : null)}>
      {COR_DAS_TAGS.map((c, i) => {
        const marcada = c.valor === valor;
        const { cor, fundo } = identificacao[c.valor];
        return (
          <Pressable
            key={c.valor}
            ref={(no) => { refs.current[i] = no as Focavel | null; comTitulo(c.rotulo)(no); }}
            role="radio"
            accessibilityRole="radio"
            accessibilityLabel={`Cor: ${c.rotulo}`}
            aria-checked={marcada}
            accessibilityState={{ checked: marcada, disabled: parado }}
            aria-disabled={parado}
            // Só o `desabilitado` de verdade tira o toque; o `ocupado` ignora no `onPress` para o foco não cair.
            disabled={desabilitado}
            tabIndex={i === indiceDoTab ? 0 : -1}
            onPress={() => { if (!parado) escolher(i); }}
            style={(estado) => [estilos.alvo, {
              borderColor: marcada ? cores.texto : 'transparent',
              backgroundColor: sobre(estado) && !parado ? cores.sobre : 'transparent',
              opacity: parado ? 0.5 : 1,
            }]}>
            <View aria-hidden style={[estilos.bolinha, { backgroundColor: cor }]}>
              {marcada ? <Check size={16} color={fundo} strokeWidth={3} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  // Sem espaço entre os alvos: as bolinhas de 28 ficam a 16 px uma da outra pelo próprio alvo de 44.
  grupo: { flexDirection: 'row', alignItems: 'center' },
  alvo: { width: ALVO_TOQUE, height: ALVO_TOQUE, borderRadius: ALVO_TOQUE / 2, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  bolinha: { width: BOLINHA, height: BOLINHA, borderRadius: BOLINHA / 2, alignItems: 'center', justifyContent: 'center' },
});
