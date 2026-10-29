import { CalendarPlus, Plus, UserPlus } from 'lucide-react-native';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';

interface Props {
  aoCompromisso: () => void;
  aoEvento: () => void;
  /** Avisa a tela que o menu está aberto (os atalhos de teclado esperam ele fechar). */
  aoMudarAberto?: (aberto: boolean) => void;
}

interface Ancora { x: number; y: number; w: number; h: number }

const LARGURA_DO_MENU = 260;

/**
 * "Criar" da Agenda (o primário da tela): um menu com "Compromisso com aluno" e "Evento", colado ao botão (embaixo, alinhado
 * à direita, sem sair da janela). Abre com o foco no primeiro item, fecha com Esc, tocando fora ou escolhendo, e o foco volta
 * ao "Criar".
 */
export function MenuCriar({ aoCompromisso, aoEvento, aoMudarAberto }: Props) {
  const { cores } = useTema();
  const { width } = useWindowDimensions();
  const [ancora, setAncora] = useState<Ancora | null>(null);
  const botao = useRef<View>(null);
  const primeiro = useRef<View>(null);

  const abrir = () => botao.current?.measureInWindow((x, y, w, h) => { setAncora({ x, y, w, h }); aoMudarAberto?.(true); });
  const fechar = (depois?: () => void) => {
    setAncora(null);
    aoMudarAberto?.(false);
    // Na web o foco volta ao botão (o Modal some do DOM e o foco cairia no corpo da página).
    if (Platform.OS === 'web') setTimeout(() => (botao.current as unknown as HTMLElement | null)?.focus?.(), 0);
    depois?.();
  };

  useEffect(() => {
    if (!ancora || Platform.OS !== 'web') return;
    const relogio = setTimeout(() => (primeiro.current as unknown as HTMLElement | null)?.focus?.(), 0);
    return () => clearTimeout(relogio);
  }, [ancora]);

  const esquerda = ancora ? Math.max(espaco(1), Math.min(ancora.x + ancora.w - LARGURA_DO_MENU, width - LARGURA_DO_MENU - espaco(1))) : 0;
  return (
    <>
      <View ref={botao} collapsable={false}>
        <Botao rotulo="Criar" Icone={Plus} aoTocar={abrir} />
      </View>
      {ancora ? (
        <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={() => fechar()}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => fechar()} accessibilityLabel="Fechar o menu Criar" />
          <View role="menu" aria-label="Criar" accessibilityViewIsModal
            style={[estilos.menu, { top: ancora.y + ancora.h + espaco(0.5), left: esquerda, backgroundColor: cores.superficie, borderColor: cores.borda }]}>
            <Item refDoItem={primeiro} Icone={UserPlus} rotulo="Compromisso com aluno" descricao="Consulta, retorno ou avaliação" aoTocar={() => fechar(aoCompromisso)} />
            <Item Icone={CalendarPlus} rotulo="Evento" descricao="Só seu, sem aluno" aoTocar={() => fechar(aoEvento)} />
          </View>
        </Modal>
      ) : null}
    </>
  );
}

function Item({ Icone, rotulo, descricao, aoTocar, refDoItem }: {
  Icone: typeof Plus; rotulo: string; descricao: string; aoTocar: () => void; refDoItem?: RefObject<View | null>;
}) {
  const { cores } = useTema();
  return (
    <Pressable ref={refDoItem} role="menuitem" accessibilityLabel={`${rotulo}. ${descricao}`} onPress={aoTocar}
      style={(e) => [estilos.item, sobre(e) && { backgroundColor: cores.superficie3 }]}>
      <Icone size={20} color={cores.texto} strokeWidth={2} />
      <View style={estilos.textos}>
        <Texto style={estilos.rotulo}>{rotulo}</Texto>
        <Texto variante="pequeno" cor={cores.textoSuave}>{descricao}</Texto>
      </View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  menu: { position: 'absolute', width: LARGURA_DO_MENU, borderWidth: 1, borderRadius: RAIO, paddingVertical: espaco(0.5) },
  item: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5), minHeight: ALVO_TOQUE + espaco(1), paddingHorizontal: espaco(1.5) },
  textos: { flexShrink: 1, gap: 2 },
  rotulo: { fontFamily: fontes.semi },
});
