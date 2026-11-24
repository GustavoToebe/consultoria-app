import { CalendarPlus, ChevronDown, Plus, UserPlus } from 'lucide-react-native';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, coresDoBotaoPrincipal, espaco, fontes, RAIO, RAIO_CONTROLE } from '../../tema/tokens';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';
import { proximoItemDoMenu } from '../../dominio/agendaCalendario';

interface Props {
  aoCompromisso: () => void;
  aoEvento: () => void;
  /** Avisa a tela que o menu está aberto (os atalhos de teclado esperam ele fechar). */
  aoMudarAberto?: (aberto: boolean) => void;
  /** No topo da coluna da esquerda (PC): o botão ocupa a largura da coluna e o menu abre alinhado pela esquerda. */
  naColuna?: boolean;
}

interface Ancora { x: number; y: number; w: number; h: number }

const LARGURA_DO_MENU = 260;

/**
 * "Criar" da Agenda (o primário da tela, com a seta do menu; Menu Button da WAI-ARIA APG): um menu com "Compromisso com
 * aluno" e "Evento pessoal", colado ao botão (embaixo, alinhado à direita no cabeçalho ou à esquerda no topo da coluna, sem
 * sair da janela). Abre com o foco no primeiro item; na web as setas para cima e para baixo andam entre os itens (dando a
 * volta) e Home e End vão às pontas, como num menu do sistema. Fecha com Esc, tocando fora ou escolhendo, e o foco volta ao
 * "Criar". Os dois itens pedem a mesma permissão (`AGENDA_ALTERAR`), então o menu sempre tem os dois.
 */
export function MenuCriar({ aoCompromisso, aoEvento, aoMudarAberto, naColuna }: Props) {
  const { cores, bordas } = useTema();
  const { width } = useWindowDimensions();
  const [ancora, setAncora] = useState<Ancora | null>(null);
  const botao = useRef<View>(null);
  const primeiro = useRef<View>(null);
  const segundo = useRef<View>(null);

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

  // Setas dentro do menu (web). Escuta na captura do documento: o `Pressable` do react-native-web para a propagação do
  // teclado, então um `onKeyDown` no menu não veria as setas.
  const aberto = ancora !== null;
  useEffect(() => {
    if (!aberto || Platform.OS !== 'web') return undefined;
    const ouvir = (e: KeyboardEvent) => {
      const itens = [primeiro.current, segundo.current].map((r) => r as unknown as HTMLElement | null).filter((el): el is HTMLElement => !!el);
      const atual = itens.indexOf(document.activeElement as HTMLElement);
      const destino = proximoItemDoMenu(e.key, atual, itens.length);
      if (destino === null) return;
      e.preventDefault();
      itens[destino]?.focus();
    };
    document.addEventListener('keydown', ouvir, true);
    return () => document.removeEventListener('keydown', ouvir, true);
  }, [aberto]);

  const inicio = ancora ? (naColuna ? ancora.x : ancora.x + ancora.w - LARGURA_DO_MENU) : 0;
  const esquerda = ancora ? Math.max(espaco(1), Math.min(inicio, width - LARGURA_DO_MENU - espaco(1))) : 0;
  const principal = coresDoBotaoPrincipal(cores);
  return (
    <>
      <Pressable ref={botao} collapsable={false} onPress={abrir} accessibilityRole="button" accessibilityLabel="Criar"
        aria-haspopup="menu" aria-expanded={aberto} accessibilityState={{ expanded: aberto }}
        style={(e) => [estilos.botao, naColuna && estilos.botaoNaColuna, { backgroundColor: sobre(e) ? principal.fundoAoPassar : principal.fundo }]}>
        <Plus size={18} color={principal.texto} strokeWidth={2} />
        <Texto style={[estilos.rotuloDoBotao, { color: principal.texto }]}>Criar</Texto>
        <ChevronDown size={18} color={principal.texto} strokeWidth={2} />
      </Pressable>
      {ancora ? (
        <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={() => fechar()}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => fechar()} accessibilityLabel="Fechar o menu Criar" />
          <View role="menu" aria-label="Criar" accessibilityViewIsModal
            style={[estilos.menu, {
              top: ancora.y + ancora.h + espaco(0.5), left: esquerda, backgroundColor: cores.superficie, borderColor: cores.borda, borderWidth: bordas.bloco,
            }]}>
            <Item refDoItem={primeiro} Icone={UserPlus} rotulo="Compromisso com aluno" descricao="Consulta, retorno ou avaliação" aoTocar={() => fechar(aoCompromisso)} />
            <View style={[estilos.divisor, { backgroundColor: cores.divisor }]} />
            <Item refDoItem={segundo} Icone={CalendarPlus} rotulo="Evento pessoal" descricao="Só seu, sem aluno" aoTocar={() => fechar(aoEvento)} />
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
      style={(e) => [estilos.item, sobre(e) && { backgroundColor: cores.sobre }]}>
      <View style={[estilos.icone, { backgroundColor: cores.superficie2, borderColor: cores.borda }]}>
        <Icone size={20} color={cores.texto} strokeWidth={2} />
      </View>
      <View style={estilos.textos}>
        <Texto style={estilos.rotulo}>{rotulo}</Texto>
        <Texto variante="pequeno" cor={cores.textoSuave}>{descricao}</Texto>
      </View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  // O molde do `Botao` primário (fundo `texto`, rótulo `fundo`), com a seta do menu à direita.
  botao: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: espaco(1), alignSelf: 'flex-start', minHeight: ALVO_TOQUE,
    paddingHorizontal: espaco(2), borderRadius: RAIO_CONTROLE,
  },
  botaoNaColuna: { alignSelf: 'stretch' },
  rotuloDoBotao: { fontFamily: fontes.semi, fontSize: 15 },
  menu: { position: 'absolute', width: LARGURA_DO_MENU, borderRadius: RAIO, paddingVertical: espaco(0.5), overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5), minHeight: ALVO_TOQUE + espaco(1.5), paddingHorizontal: espaco(1.5), paddingVertical: espaco(0.5) },
  icone: { width: 36, height: 36, borderRadius: RAIO, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  divisor: { height: 1, marginHorizontal: espaco(1.5) },
  textos: { flexShrink: 1, gap: 2 },
  rotulo: { fontFamily: fontes.semi },
});
