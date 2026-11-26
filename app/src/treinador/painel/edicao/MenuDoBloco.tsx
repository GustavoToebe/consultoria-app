import { ArrowDown, ArrowUp, Check, Ellipsis, type LucideIcon } from 'lucide-react-native';
import { Fragment, useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { proximoItemDoMenu } from '../../../dominio/agendaCalendario';
import { useTema } from '../../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO, RAIO_CONTROLE } from '../../../tema/tokens';
import { sobre } from '../../../ui/sobre';
import { Texto } from '../../../ui/Texto';
import { elementoDaWeb, idDaEdicao, type ItemDaEdicao, type OpcaoDoBloco } from './tipos';

const LARGURA_DO_MENU = 260;
const FOLGA = espaco(1);

/** Uma linha do menu: mover (com o motivo quando não dá) ou um valor de uma opção do bloco. */
export type ItemDoMenu =
  | { tipo: 'mover'; rotulo: 'Subir' | 'Descer'; Icone: LucideIcon; desabilitado: boolean; motivo: string; delta: -1 | 1 }
  | { tipo: 'opcao'; chave: OpcaoDoBloco['chave']; grupo: string; rotulo: string; valor: number; marcado: boolean };

/**
 * O que o ⋯ do bloco oferece: Subir e Descer sempre (nos extremos, desabilitados com o motivo; o mesmo caminho do arrastar,
 * WCAG 2.5.7, e o do teclado), e depois as opções do bloco, um grupo por opção com o valor atual marcado.
 */
export function itensDoMenu(item: Pick<ItemDaEdicao, 'podeSubir' | 'podeDescer' | 'opcoes'>): ItemDoMenu[] {
  return [
    { tipo: 'mover', rotulo: 'Subir', Icone: ArrowUp, desabilitado: !item.podeSubir, motivo: 'Já é o primeiro.', delta: -1 },
    { tipo: 'mover', rotulo: 'Descer', Icone: ArrowDown, desabilitado: !item.podeDescer, motivo: 'Já é o último.', delta: 1 },
    ...(item.opcoes ?? []).flatMap((o) => o.valores.map((v): ItemDoMenu => ({
      tipo: 'opcao', chave: o.chave, grupo: o.rotulo, rotulo: v.rotulo, valor: v.valor, marcado: v.valor === o.atual,
    }))),
  ];
}

/** Os itens em grupos, na ordem: o de mover (`nome` nulo) e um por opção do bloco. */
function grupos(itens: ItemDoMenu[]): { nome: string | null; indices: number[] }[] {
  const saida: { nome: string | null; indices: number[] }[] = [];
  itens.forEach((it, i) => {
    const nome = it.tipo === 'opcao' ? it.grupo : null;
    const ultimo = saida[saida.length - 1];
    if (ultimo && ultimo.nome === nome) ultimo.indices.push(i);
    else saida.push({ nome, indices: [i] });
  });
  return saida;
}

interface Ancora { x: number; y: number; w: number; h: number }

/**
 * O ⋯ do bloco em edição (Menu Button da WAI-ARIA APG, como o "Criar" da Agenda, `treinador/agenda/MenuCriar`): menu
 * colado ao botão, alinhado pela direita e dentro da janela (abre para cima se não couber embaixo). Abre com o foco no
 * primeiro item ativo; na web as setas andam entre os itens ativos (dando a volta) e Home e End vão às pontas. Fecha com
 * Esc, tocando fora ou escolhendo; o foco volta ao ⋯ (se a grade se rearrumou, quem chama leva o foco pelo `nativeID`).
 */
export function MenuDoBloco({ item, aoMover, aoMudarOpcao }: {
  item: ItemDaEdicao;
  aoMover: (delta: -1 | 1) => void;
  aoMudarOpcao: (chave: OpcaoDoBloco['chave'], valor: number) => void;
}) {
  const { cores, bordas } = useTema();
  const { width, height } = useWindowDimensions();
  const [ancora, setAncora] = useState<Ancora | null>(null);
  const [alturaDoMenu, setAlturaDoMenu] = useState(0);
  const botao = useRef<View>(null);
  const refs = useRef<(View | null)[]>([]);
  const itens = itensDoMenu(item);
  const ativos = itens.map((it, i) => (it.tipo === 'mover' && it.desabilitado ? -1 : i)).filter((i) => i >= 0);
  const aberto = ancora !== null;

  const abrir = () => botao.current?.measureInWindow((x, y, w, h) => setAncora({ x, y, w, h }));
  const fechar = (depois?: () => void) => {
    setAncora(null);
    // Na web o foco volta ao ⋯ (o Modal some do DOM e o foco cairia no corpo da página).
    if (Platform.OS === 'web') setTimeout(() => elementoDaWeb(botao.current)?.focus(), 0);
    depois?.();
  };

  useEffect(() => {
    if (!aberto || Platform.OS !== 'web') return undefined;
    const relogio = setTimeout(() => elementoDaWeb(refs.current[ativos[0] ?? -1])?.focus(), 0);
    // Na captura do documento: o `Pressable` do react-native-web para a propagação do teclado.
    const ouvir = (e: KeyboardEvent) => {
      const els = ativos.map((i) => elementoDaWeb(refs.current[i])).filter((el): el is HTMLElement => !!el);
      const destino = proximoItemDoMenu(e.key, els.indexOf(document.activeElement as HTMLElement), els.length);
      if (destino === null) return;
      e.preventDefault();
      els[destino]?.focus();
    };
    document.addEventListener('keydown', ouvir, true);
    return () => {
      clearTimeout(relogio);
      document.removeEventListener('keydown', ouvir, true);
    };
    // `ativos` muda a cada render; o que importa é abrir e fechar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  const esquerda = ancora ? Math.max(FOLGA, Math.min(ancora.x + ancora.w - LARGURA_DO_MENU, width - LARGURA_DO_MENU - FOLGA)) : 0;
  const embaixo = ancora ? ancora.y + ancora.h + espaco(0.5) : 0;
  const topo = ancora && alturaDoMenu && embaixo + alturaDoMenu > height - FOLGA ? Math.max(FOLGA, ancora.y - espaco(0.5) - alturaDoMenu) : embaixo;
  const rotulo = `Mais ações de ${item.titulo}`;

  return (
    <View nativeID={idDaEdicao(item.id, 'menu')}>
      <Pressable ref={botao} collapsable={false} onPress={abrir} accessibilityRole="button" accessibilityLabel={rotulo}
        aria-haspopup="menu" aria-expanded={aberto} accessibilityState={{ expanded: aberto }} style={estilos.alvo}>
        {(e) => (
          <View style={[estilos.desenho, { backgroundColor: sobre(e) || aberto ? cores.sobreNaFaixa : 'transparent' }]}>
            <Ellipsis size={20} color={cores.texto} strokeWidth={2} />
          </View>
        )}
      </Pressable>
      {ancora ? (
        <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={() => fechar()}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => fechar()} accessibilityLabel="Fechar o menu" />
          <View role="menu" aria-label={rotulo} accessibilityViewIsModal onLayout={(e) => setAlturaDoMenu(Math.round(e.nativeEvent.layout.height))}
            style={[estilos.menu, { top: topo, left: esquerda, backgroundColor: cores.superficie, borderColor: cores.borda, borderWidth: bordas.bloco }]}>
            {grupos(itens).map(({ nome, indices }) => {
              const linhas = indices.map((i) => {
                const it = itens[i];
                return (
                  <ItemDoMenuNaTela key={i} item={it} refDoItem={(no) => { refs.current[i] = no; }}
                    aoTocar={() => fechar(() => (it.tipo === 'mover' ? aoMover(it.delta) : aoMudarOpcao(it.chave, it.valor)))} />
                );
              });
              if (nome === null) return <Fragment key="mover">{linhas}</Fragment>;
              return (
                <Fragment key={nome}>
                  <View role="separator" style={[estilos.divisor, { backgroundColor: cores.divisor }]} />
                  {/* O nome do grupo vai no `aria-label`; o texto visível fica fora da leitura para não ser lido duas vezes. */}
                  <View role="group" aria-label={nome}>
                    <Texto variante="rotulo" aria-hidden style={estilos.grupo}>{nome}</Texto>
                    {linhas}
                  </View>
                </Fragment>
              );
            })}
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

function ItemDoMenuNaTela({ item, refDoItem, aoTocar }: { item: ItemDoMenu; refDoItem: (no: View | null) => void; aoTocar: () => void }) {
  const { cores } = useTema();
  const desabilitado = item.tipo === 'mover' && item.desabilitado;
  const radio = item.tipo === 'opcao';
  return (
    // O RN não tipa `menuitemradio`; o react-native-web leva o `role` ao DOM como está.
    <Pressable ref={refDoItem} role="menuitem" {...(radio ? ({ role: 'menuitemradio' } as object) : null)} accessibilityLabel={item.rotulo}
      accessibilityHint={desabilitado ? item.motivo : undefined}
      aria-checked={radio ? item.marcado : undefined} aria-disabled={desabilitado || undefined}
      accessibilityState={radio ? { checked: item.marcado } : { disabled: desabilitado }}
      disabled={desabilitado} onPress={aoTocar}
      style={(e) => [estilos.item, sobre(e) && !desabilitado && { backgroundColor: cores.sobre }]}>
      <View style={estilos.icone}>
        {item.tipo === 'mover' ? <item.Icone size={18} color={desabilitado ? cores.textoSuave : cores.texto} strokeWidth={2} /> : null}
        {radio && item.marcado ? <Check size={18} color={cores.texto} strokeWidth={2.5} /> : null}
      </View>
      <View style={estilos.textos}>
        <Texto style={[estilos.rotulo, { color: desabilitado ? cores.textoSuave : cores.texto }, radio && item.marcado ? { fontFamily: fontes.semi } : null]}>{item.rotulo}</Texto>
        {desabilitado ? <Texto variante="pequeno">{item.motivo}</Texto> : null}
      </View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  alvo: { width: ALVO_TOQUE, height: ALVO_TOQUE, alignItems: 'center', justifyContent: 'center', borderRadius: RAIO_CONTROLE },
  desenho: { width: ALVO_TOQUE, height: ALVO_TOQUE, alignItems: 'center', justifyContent: 'center', borderRadius: RAIO_CONTROLE },
  menu: { position: 'absolute', width: LARGURA_DO_MENU, borderRadius: RAIO, paddingVertical: espaco(0.5), overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), minHeight: ALVO_TOQUE, paddingHorizontal: espaco(1.5), paddingVertical: espaco(0.5) },
  icone: { width: 20, alignItems: 'center' },
  textos: { flexShrink: 1, gap: 2 },
  rotulo: { fontFamily: fontes.medio },
  divisor: { height: 1, marginHorizontal: espaco(1.5), marginVertical: espaco(0.5) },
  grupo: { paddingHorizontal: espaco(1.5), paddingTop: espaco(0.5), paddingBottom: espaco(0.25) },
});
