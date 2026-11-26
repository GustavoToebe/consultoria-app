import { Info } from 'lucide-react-native';
import { useEffect, useId, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { lugarDaListaDeTags, type Retangulo } from '../../dominio/selosDaLinhaDeAluno';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, RAIO, RAIO_CONTROLE } from '../../tema/tokens';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';
import { useCliqueFora } from '../../ui/usoWeb';

const ROTULO = 'Sobre esta prévia';
const LARGURA_DO_BALAO = 320;
const FOLGA = 16;

/** Na web o `ref` de uma `View` é o elemento do DOM; aqui sem conversão às cegas. */
function elementoDaWeb(no: unknown): HTMLElement | null {
  return typeof HTMLElement !== 'undefined' && no instanceof HTMLElement ? no : null;
}

/**
 * O ⓘ "Sobre esta prévia" da lista de compras do treinador (26/11), no comportamento do ⓘ do cabeçalho
 * (`ui/AjudaDoCabecalho`, que tem o nome "Sobre esta tela" fixo e mora na barra da página): abre com o mouse em cima, no
 * foco do teclado (`:focus-visible`) e no toque ou Enter/Espaço (alterna); fecham o mouse sair (o que ele abriu), o foco
 * sair, tocar fora e o Esc. O Esc é tratado aqui antes da `Folha` (o `Modal` da web fecha no `keyup` do Esc): o primeiro
 * fecha só o balão, o segundo a folha. O texto é a descrição acessível do ⓘ (`aria-describedby` na web,
 * `accessibilityHint` no celular) e o balão fica fora da leitura para não ser lido duas vezes. O balão abre abaixo do ⓘ,
 * dentro da janela; quem desenha a linha sobe de camada enquanto ele está aberto (`aoMudar`: as peças da `Alvenaria`
 * vêm depois no DOM e pintariam por cima). Sem animação, então o "Reduzir movimento" já vale.
 */
export function DicaDaPrevia({ texto, aoMudar }: { texto: string; aoMudar?: (aberto: boolean) => void }) {
  const { cores, bordas } = useTema();
  const { width, height } = useWindowDimensions();
  const web = Platform.OS === 'web';
  const id = useId();
  const envolve = useRef<View>(null);
  const botao = useRef<View>(null);
  const [ancora, setAncora] = useState<Retangulo | null>(null);
  const [pelo, setPelo] = useState<'mouse' | 'outro' | null>(null);
  const aberto = pelo !== null;

  const abrir = (quem: 'mouse' | 'outro') => {
    botao.current?.measureInWindow((x, y, w, h) => setAncora({ x, y, w, h }));
    setPelo(quem);
    aoMudar?.(true);
  };
  const fechar = () => {
    setPelo(null);
    aoMudar?.(false);
  };

  // Esc: segura o `keydown` e fecha no `keyup`, antes do ouvinte do `Modal` (bolha no `document`), que fecharia a folha.
  useEffect(() => {
    if (!web || !aberto) return undefined;
    const segurar = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      if (e.type === 'keyup') fechar();
    };
    document.addEventListener('keydown', segurar, true);
    document.addEventListener('keyup', segurar, true);
    return () => {
      document.removeEventListener('keydown', segurar, true);
      document.removeEventListener('keyup', segurar, true);
    };
  });
  useCliqueFora(envolve, web && aberto, fechar);

  const largura = Math.min(LARGURA_DO_BALAO, width - 2 * FOLGA);
  const esquerda = ancora ? lugarDaListaDeTags(ancora, { largura, altura: 0 }, { largura: width, altura: height }, FOLGA).esquerda - ancora.x : 0;
  const doMouse = web ? {
    onPointerEnter: (e: { nativeEvent: { pointerType?: string } }) => { if (e.nativeEvent.pointerType === 'mouse' && !aberto) abrir('mouse'); },
    onPointerLeave: (e: { nativeEvent: { pointerType?: string } }) => { if (e.nativeEvent.pointerType === 'mouse' && pelo === 'mouse') fechar(); },
  } : null;

  return (
    <View ref={envolve} collapsable={false} style={[estilos.envolve, aberto && estilos.porCima]} {...doMouse}>
      <Pressable
        ref={botao}
        accessibilityRole="button"
        accessibilityLabel={ROTULO}
        accessibilityHint={web ? undefined : texto}
        aria-describedby={web ? id : undefined}
        aria-expanded={aberto}
        accessibilityState={{ expanded: aberto }}
        // O clique de quem abriu pelo mouse não fecha o balão que ele está lendo: vira aberto "de verdade".
        onPress={() => (pelo === 'mouse' ? setPelo('outro') : aberto ? fechar() : abrir('outro'))}
        onFocus={() => { if (!aberto && elementoDaWeb(botao.current)?.matches(':focus-visible')) abrir('outro'); }}
        onBlur={() => { if (pelo === 'outro') fechar(); }}
        style={estilos.alvo}>
        {(estado) => (
          <View style={[estilos.desenho, { backgroundColor: sobre(estado) || aberto ? cores.sobre : 'transparent' }]}>
            <Info size={18} color={aberto ? cores.texto : cores.textoSuave} strokeWidth={2} />
          </View>
        )}
      </Pressable>
      {web ? <View id={id} style={estilos.oculto}><Texto>{texto}</Texto></View> : null}
      {aberto ? (
        <View aria-hidden={web} importantForAccessibility={web ? 'no-hide-descendants' : 'auto'}
          style={[estilos.balao, { left: esquerda, width: largura, backgroundColor: cores.superficie2, borderColor: cores.divisor, borderWidth: bordas.bloco }]}>
          <Texto>{texto}</Texto>
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  envolve: { position: 'relative', flexShrink: 0 },
  porCima: { zIndex: 10 },
  // O alvo de 44 px centrado na linha do topo, sem deixá-la mais alta que o selo e o segmento.
  alvo: { width: ALVO_TOQUE, height: ALVO_TOQUE, alignItems: 'center', justifyContent: 'center', borderRadius: RAIO_CONTROLE },
  desenho: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: RAIO_CONTROLE },
  oculto: { display: 'none' },
  // Logo abaixo do alvo, sem vão: o mouse passa do ⓘ ao balão sem sair do envoltório (WCAG 1.4.13).
  balao: { position: 'absolute', top: ALVO_TOQUE, borderRadius: RAIO, paddingHorizontal: espaco(2), paddingVertical: espaco(1.5) },
});
