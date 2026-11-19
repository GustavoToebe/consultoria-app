import { Activity, Briefcase, Layers, Settings, type LucideIcon } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { proximoItemDoMenu } from '../dominio/agendaCalendario';
import { topoDoSubmenu, type GrupoDoMenu } from '../dominio/gruposDoMenu';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO, RAIO_CONTROLE } from '../tema/tokens';
import { sobre } from './sobre';
import { Texto } from './Texto';
import { useTeclado } from './usoWeb';

/** Ícone de cada grupo no PC minimizado; nenhum repete o de um item do grupo (submenu dos grupos, 18/11). */
export const ICONES_DOS_GRUPOS: Record<GrupoDoMenu, LucideIcon> = {
  Acompanhamento: Activity,
  Conteúdo: Layers,
  Negócio: Briefcase,
  Configurações: Settings,
};

/** `passagem`: aberto pelo mouse ou pelo foco, fecha quando eles saem. `fixo`: aberto por clique, toque ou tecla. */
type Origem = 'passagem' | 'fixo';
type Foco = 'primeiro' | 'ultimo' | null;
/** `vez` muda a cada pedido de foco, para o mesmo grupo já aberto (pelo foco) receber o ↓ e ir ao primeiro item. */
interface Aberto { grupo: GrupoDoMenu; topo: number; esquerda: number; origem: Origem; foco: Foco; vez: number }

/** Tempo para o mouse atravessar do ícone ao submenu sem ele fechar. */
const ESPERA_AO_SAIR = 200;
const LARGURA_DO_SUBMENU = 240;

const elemento = (no: unknown) => no as HTMLElement | null;

/**
 * Submenu flutuante dos grupos no PC minimizado (submenu dos grupos, 18/11), no padrão "Menu Button" da WAI-ARIA APG:
 * o ícone do grupo é o botão (`aria-haspopup`, `aria-expanded`, `aria-controls`); passar o mouse ou focar mostra o submenu
 * sem tirar o foco do botão; clique, toque, Enter, Espaço e ↓ abrem com o foco no primeiro item, ↑ no último; dentro,
 * ↑ ↓ dão a volta e Home e End vão às pontas; Esc fecha e devolve o foco ao ícone; Tab fecha e segue a ordem a partir do
 * ícone; clique fora fecha. Na web o submenu é desenhado pelo menu, fora da lista que rola (que o cortaria), e no celular
 * largo num `Modal` com fundo que fecha ao tocar (o Voltar do Android também fecha). Sem animação: abre e fecha no lugar,
 * então o movimento reduzido não pede nada a mais.
 */
export function useSubmenuDoTrilho(trilho: RefObject<View | null>) {
  const { height } = useWindowDimensions();
  const [aberto, setAberto] = useState<Aberto | null>(null);
  const [focado, setFocado] = useState<GrupoDoMenu | null>(null);
  const [medida, setMedida] = useState<{ grupo: GrupoDoMenu; altura: number } | null>(null);
  const botoes = useRef(new Map<GrupoDoMenu, View>());
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  // O foco devolvido ao ícone (Esc, Tab, item escolhido) não reabre o submenu.
  const semAbrirNoFoco = useRef(false);
  const pedido = useRef(0);
  // O aberto já desenhado, para `fechar` saber a que ícone devolver o foco sem efeito dentro do `setAberto`.
  const atual = useRef<Aberto | null>(null);
  useEffect(() => {
    atual.current = aberto;
  });

  const cancelarEspera = () => {
    if (espera.current) clearTimeout(espera.current);
    espera.current = null;
  };
  useEffect(() => cancelarEspera, []);

  const abrir = useCallback((grupo: GrupoDoMenu, origem: Origem, foco: Foco = null) => {
    cancelarEspera();
    const no = botoes.current.get(grupo);
    if (!no) return;
    const este = ++pedido.current;
    const pronto = (x: number, y: number, w: number) => {
      // Uma medida que chega depois de outro pedido (outro ícone, fechar) é descartada.
      if (pedido.current !== este) return;
      setAberto((antes) => ({
        grupo, topo: y, esquerda: x + w + espaco(2), foco, vez: este,
        origem: antes?.grupo === grupo && antes.origem === 'fixo' ? 'fixo' : origem,
      }));
    };
    if (Platform.OS === 'web' && trilho.current) no.measureLayout(trilho.current as never, (x, y, w) => pronto(x, y, w), () => undefined);
    else no.measureInWindow((x, y, w) => pronto(x, y, w));
  }, [trilho]);

  const fechar = useCallback((devolverFoco = false) => {
    cancelarEspera();
    pedido.current++;
    const grupo = atual.current?.grupo;
    setAberto(null);
    if (!devolverFoco || !grupo || Platform.OS !== 'web') return;
    const botao = elemento(botoes.current.get(grupo));
    if (botao && document.activeElement !== botao) {
      semAbrirNoFoco.current = true;
      botao.focus();
    }
  }, []);

  // O foco vai ao item pedido depois do desenho (a lista de itens só existe com o submenu na tela).
  const qual = aberto?.foco ?? null;
  const grupoAberto = aberto?.grupo;
  const vez = aberto?.vez;
  useEffect(() => {
    if (!qual || Platform.OS !== 'web') return undefined;
    const relogio = setTimeout(() => {
      const itens = itensDoSubmenu(grupoAberto);
      (qual === 'primeiro' ? itens[0] : itens[itens.length - 1])?.focus();
    }, 0);
    return () => clearTimeout(relogio);
  }, [qual, vez, grupoAberto]);

  const agendarFechar = () => {
    cancelarEspera();
    espera.current = setTimeout(() => setAberto((antes) => (antes?.origem === 'passagem' ? null : antes)), ESPERA_AO_SAIR);
  };

  useTeclado(!!aberto || !!focado, ({ key, ctrl }) => {
    if (ctrl && key.toLowerCase() === 'k') {
      fechar();
      return undefined;
    }
    const ativo = document.activeElement as HTMLElement | null;
    const naCaixa = !!ativo && !!aberto && !!caixaDoSubmenu(aberto.grupo)?.contains(ativo);
    if (naCaixa && aberto) {
      if (key === 'Escape') {
        fechar(true);
        return true;
      }
      // Tab: o foco volta ao ícone antes do padrão do navegador, que então segue a ordem a partir dele (APG).
      if (key === 'Tab') {
        fechar(true);
        return undefined;
      }
      const itens = itensDoSubmenu(aberto.grupo);
      const destino = proximoItemDoMenu(key, itens.indexOf(ativo!), itens.length);
      if (destino === null) return undefined;
      itens[destino]?.focus();
      return true;
    }
    if (focado && (key === 'ArrowDown' || key === 'ArrowUp')) {
      abrir(focado, 'fixo', key === 'ArrowDown' ? 'primeiro' : 'ultimo');
      return true;
    }
    if (key === 'Escape' && aberto) {
      fechar();
      return true;
    }
    return undefined;
  });

  // Clique fora (web): nem no submenu nem no ícone do grupo aberto (o ícone trata o próprio clique).
  useEffect(() => {
    if (Platform.OS !== 'web' || !aberto) return undefined;
    const ouvir = (e: MouseEvent) => {
      const alvo = e.target instanceof Node ? e.target : null;
      if (!alvo || caixaDoSubmenu(aberto.grupo)?.contains(alvo) || elemento(botoes.current.get(aberto.grupo))?.contains(alvo)) return;
      fechar();
    };
    document.addEventListener('mousedown', ouvir);
    return () => document.removeEventListener('mousedown', ouvir);
  }, [aberto, fechar]);

  /** Props do ícone de um grupo. */
  const doBotao = (grupo: GrupoDoMenu) => ({
    registrar: (no: View | null) => {
      if (no) botoes.current.set(grupo, no);
      else botoes.current.delete(grupo);
    },
    aberto: aberto?.grupo === grupo,
    aoPassar: () => {
      cancelarEspera();
      if (aberto?.grupo !== grupo) abrir(grupo, 'passagem');
    },
    aoSairDoMouse: agendarFechar,
    aoFocar: () => {
      setFocado(grupo);
      if (semAbrirNoFoco.current) {
        semAbrirNoFoco.current = false;
        return;
      }
      if (aberto?.grupo !== grupo) abrir(grupo, 'passagem');
    },
    aoDesfocar: (destino: unknown) => {
      setFocado(null);
      if (destino instanceof Node && caixaDoSubmenu(grupo)?.contains(destino)) return;
      setAberto((antes) => (antes?.grupo === grupo && antes.origem === 'passagem' ? null : antes));
    },
    aoTocar: () => {
      if (aberto?.grupo === grupo && aberto.origem === 'fixo') fechar();
      else abrir(grupo, 'fixo', 'primeiro');
    },
  });

  // A altura medida é de um grupo: outro grupo tem outro número de itens e espera a sua.
  const altura = medida && medida.grupo === aberto?.grupo ? medida.altura : null;
  const topo = aberto ? topoDoSubmenu(aberto.topo, altura, height) : 0;
  return {
    aberto,
    fechar,
    doBotao,
    /** Fecha depois de escolher um item: o foco volta ao ícone (a tela nova não o tira dali). */
    aoEscolher: () => fechar(true),
    /** A lista do menu rolou: o submenu acompanha o ícone. */
    aoRolar: () => { if (aberto) abrir(aberto.grupo, aberto.origem); },
    doSubmenu: aberto ? {
      grupo: aberto.grupo,
      topo,
      esquerda: aberto.esquerda,
      medido: altura !== null,
      aoMedir: (valor: number) => setMedida({ grupo: aberto.grupo, altura: valor }),
      aoPassar: cancelarEspera,
      aoSairDoMouse: agendarFechar,
      aoFechar: () => fechar(),
    } : null,
  };
}

const idDoSubmenu = (grupo: GrupoDoMenu) => `submenu-${grupo.normalize('NFD').replace(/[^A-Za-z]/g, '').toLowerCase()}`;
// Na web o submenu é achado pelo id (o `nativeID` dele), o mesmo do `aria-controls` do ícone.
const caixaDoSubmenu = (grupo: GrupoDoMenu | undefined) => (grupo && Platform.OS === 'web' ? document.getElementById(idDoSubmenu(grupo)) : null);
const itensDoSubmenu = (grupo: GrupoDoMenu | undefined): HTMLElement[] => [...(caixaDoSubmenu(grupo)?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];

/**
 * Ícone de um grupo no PC minimizado. Selecionado (seleção neutra e a barrinha da marca, como o item) quando a tela aberta
 * é de um item dele; o ponto aparece se algum item tem pendência. O nome acessível começa pelo nome do grupo.
 */
export function IconeDoGrupo({ grupo, atual, ponto, sinais, botao }: {
  grupo: GrupoDoMenu;
  atual: boolean;
  ponto: boolean;
  sinais: string[];
  botao: ReturnType<ReturnType<typeof useSubmenuDoTrilho>['doBotao']>;
}) {
  const { cores, marcaPeca } = useTema();
  const Icone = ICONES_DOS_GRUPOS[grupo];
  const no = useRef<View | null>(null);
  const { registrar } = botao;
  const ref = useCallback((n: View | null) => {
    no.current = n;
    registrar(n);
  }, [registrar]);
  // O grupo da tela aberta não fica cortado no fim da lista (o item dele está dentro do submenu).
  useEffect(() => {
    if (Platform.OS === 'web' && atual) elemento(no.current)?.scrollIntoView?.({ block: 'nearest' });
  }, [atual]);
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={[grupo, ...sinais].join(', ')}
      aria-haspopup="menu"
      aria-expanded={botao.aberto}
      aria-controls={botao.aberto ? idDoSubmenu(grupo) : undefined}
      // `true`, não `page`: o ícone é do grupo; a página atual é o item dentro do submenu.
      aria-current={atual ? 'true' : undefined}
      accessibilityState={{ expanded: botao.aberto, selected: atual }}
      onPress={botao.aoTocar}
      onHoverIn={botao.aoPassar}
      onHoverOut={botao.aoSairDoMouse}
      onFocus={botao.aoFocar}
      onBlur={(e) => botao.aoDesfocar('relatedTarget' in e.nativeEvent ? e.nativeEvent.relatedTarget : null)}
      style={(estado) => [
        estilos.icone,
        (atual || botao.aberto || sobre(estado)) && { backgroundColor: cores.superficie2 },
      ]}>
      {atual ? <View aria-hidden style={[estilos.indicador, { backgroundColor: marcaPeca }]} /> : null}
      <View>
        <Icone size={20} color={atual ? cores.texto : cores.textoSuave} strokeWidth={2} />
        {ponto ? <View aria-hidden style={[estilos.ponto, { backgroundColor: cores.atencao, borderColor: cores.fundo }]} /> : null}
      </View>
    </Pressable>
  );
}

/** O submenu de um grupo: o nome do grupo em cima e os itens (`menuitem`, o da tela aberta com `aria-current`). */
export function SubmenuDoGrupo({ submenu, children }: {
  submenu: NonNullable<ReturnType<typeof useSubmenuDoTrilho>['doSubmenu']>;
  children: ReactNode;
}) {
  const { cores, bordas } = useTema();
  const caixa = (
    <View
      nativeID={idDoSubmenu(submenu.grupo)}
      role="menu"
      aria-label={submenu.grupo}
      onLayout={(e) => submenu.aoMedir(e.nativeEvent.layout.height)}
      onPointerEnter={(e) => { if (e.nativeEvent.pointerType !== 'touch') submenu.aoPassar(); }}
      onPointerLeave={(e) => { if (e.nativeEvent.pointerType !== 'touch') submenu.aoSairDoMouse(); }}
      style={[estilos.submenu, {
        top: submenu.topo,
        left: submenu.esquerda,
        backgroundColor: cores.superficie,
        borderColor: cores.borda,
        borderWidth: bordas.bloco,
        // Até a altura ser medida não aparece: assim não pisca no lugar errado antes de subir para caber.
        opacity: submenu.medido ? 1 : 0,
      }]}>
      <Texto aria-hidden numberOfLines={1} style={[estilos.titulo, { color: cores.textoSuave }]}>{submenu.grupo}</Texto>
      {children}
    </View>
  );
  if (Platform.OS === 'web') return caixa;
  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={submenu.aoFechar}>
      <Pressable style={StyleSheet.absoluteFill} onPress={submenu.aoFechar} accessibilityLabel={`Fechar ${submenu.grupo}`} />
      {caixa}
    </Modal>
  );
}

const estilos = StyleSheet.create({
  icone: { minHeight: ALVO_TOQUE, alignItems: 'center', justifyContent: 'center', borderRadius: RAIO_CONTROLE },
  indicador: { position: 'absolute', left: 0, top: '50%', marginTop: -8, width: 3, height: 16, borderTopRightRadius: 2, borderBottomRightRadius: 2 },
  ponto: { position: 'absolute', right: -5, top: -3, width: 9, height: 9, borderRadius: 5, borderWidth: 1 },
  submenu: { position: 'absolute', width: LARGURA_DO_SUBMENU, borderRadius: RAIO, padding: espaco(0.5), gap: 2, zIndex: 50 },
  titulo: { fontFamily: fontes.medio, fontSize: 13, lineHeight: 18, paddingHorizontal: espaco(1.5), paddingTop: espaco(0.5), paddingBottom: 4 },
});
