import { Activity, Briefcase, Layers, Settings, type LucideIcon } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View, type PointerEvent } from 'react-native';

import { proximoItemDoMenu } from '../dominio/agendaCalendario';
import { rumoAoSubmenu, topoDoSubmenu, type GrupoDoMenu, type Ponto } from '../dominio/gruposDoMenu';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, LARGURA_MENU_EXPANDIDO, RAIO, RAIO_CONTROLE } from '../tema/tokens';
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
/** Atraso antes de trocar de grupo quando o ponteiro só raspa num ícone vizinho indo em diagonal para o submenu aberto. */
const ESPERA_TROCA_DIAGONAL = 150;
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
export function useSubmenuDoTrilho(trilho: RefObject<View | null>, ativo = true) {
  const { height } = useWindowDimensions();
  const [aberto, setAberto] = useState<Aberto | null>(null);
  const [focado, setFocado] = useState<GrupoDoMenu | null>(null);
  const [medidas, setMedidas] = useState<Partial<Record<GrupoDoMenu, number>>>({});
  const botoes = useRef(new Map<GrupoDoMenu, View>());
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  const troca = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sobreBotao = useRef<GrupoDoMenu | null>(null);
  const sobreSubmenu = useRef<GrupoDoMenu | null>(null);
  const pontoNoIconeAberto = useRef<Ponto | null>(null);
  const ultimoPonto = useRef<Ponto | null>(null);
  // O foco devolvido ao ícone (Esc, Tab, item escolhido) não reabre o submenu.
  const semAbrirNoFoco = useRef(false);
  const pedido = useRef(0);

  const abertoVisivel = ativo ? aberto : null;
  const focadoVisivel = ativo ? focado : null;

  // O aberto já desenhado, para handlers saberem o estado atual sem depender de closures velhas.
  const atual = useRef<Aberto | null>(null);
  useEffect(() => {
    atual.current = abertoVisivel;
  });

  const cancelarEspera = useCallback(() => {
    if (espera.current) clearTimeout(espera.current);
    espera.current = null;
  }, []);

  const cancelarTroca = useCallback(() => {
    if (troca.current) clearTimeout(troca.current);
    troca.current = null;
  }, []);

  useEffect(() => () => {
    cancelarEspera();
    cancelarTroca();
  }, [cancelarEspera, cancelarTroca]);

  useEffect(() => {
    if (ativo) return undefined;
    cancelarEspera();
    cancelarTroca();
    atual.current = null;
    sobreBotao.current = null;
    sobreSubmenu.current = null;
    pontoNoIconeAberto.current = null;
    ultimoPonto.current = null;
    const id = setTimeout(() => { setAberto(null); setFocado(null); }, 0);
    return () => clearTimeout(id);
  }, [ativo, cancelarEspera, cancelarTroca]);

  const aoMedir = useCallback((grupoMedido: GrupoDoMenu, valor: number) => {
    if (valor <= 0) return;
    setMedidas((antes) => (antes[grupoMedido] === valor ? antes : { ...antes, [grupoMedido]: valor }));
  }, []);

  const abrir = useCallback((grupo: GrupoDoMenu, origem: Origem, foco: Foco = null) => {
    cancelarEspera();
    cancelarTroca();
    if (atual.current?.grupo !== grupo) sobreSubmenu.current = null;
    const no = botoes.current.get(grupo);
    if (!no) return;
    const este = ++pedido.current;
    const pronto = (x: number, y: number, w: number) => {
      // Uma medida que chega depois de outro pedido (outro ícone, fechar) é descartada.
      if (pedido.current !== este) return;
      const antes = atual.current;
      const proximo: Aberto = {
        grupo,
        topo: y,
        esquerda: x + w + espaco(2),
        foco,
        vez: este,
        origem: antes?.grupo === grupo && antes.origem === 'fixo' ? 'fixo' : origem,
      };
      atual.current = ativo ? proximo : null;
      setAberto(proximo);
    };
    if (Platform.OS === 'web') {
      const elBotao = elemento(no);
      const elTrilho = elemento(trilho.current);
      if (typeof elBotao?.getBoundingClientRect === 'function' && typeof elTrilho?.getBoundingClientRect === 'function') {
        const rBotao = elBotao.getBoundingClientRect();
        const rTrilho = elTrilho.getBoundingClientRect();
        if (rBotao.width > 0 || rBotao.height > 0) {
          pontoNoIconeAberto.current = sobreBotao.current === grupo && ultimoPonto.current
            ? ultimoPonto.current
            : { x: rBotao.left + rBotao.width / 2, y: rBotao.top + rBotao.height / 2 };
          pronto(rBotao.left - rTrilho.left, rBotao.top - rTrilho.top, rBotao.width);
          return;
        }
      }
      if (trilho.current) {
        no.measureLayout(trilho.current as never, (x, y, w) => pronto(x, y, w), () => undefined);
        return;
      }
    }
    no.measureInWindow((x, y, w) => pronto(x, y, w));
  }, [ativo, cancelarEspera, cancelarTroca, trilho]);

  const fechar = useCallback((devolverFoco = false) => {
    cancelarEspera();
    cancelarTroca();
    pedido.current++;
    const grupo = atual.current?.grupo;
    atual.current = null;
    sobreSubmenu.current = null;
    pontoNoIconeAberto.current = null;
    setAberto(null);
    if (!devolverFoco || !grupo || Platform.OS !== 'web') return;
    const botao = elemento(botoes.current.get(grupo));
    if (botao && document.activeElement !== botao) {
      semAbrirNoFoco.current = true;
      botao.focus();
    }
  }, [cancelarEspera, cancelarTroca]);

  // O foco vai ao item pedido depois do desenho (a lista de itens só existe com o submenu na tela).
  const qual = abertoVisivel?.foco ?? null;
  const grupoAberto = abertoVisivel?.grupo;
  const vez = abertoVisivel?.vez;
  useEffect(() => {
    if (!qual || Platform.OS !== 'web') return undefined;
    const relogio = setTimeout(() => {
      const itens = itensDoSubmenu(grupoAberto);
      (qual === 'primeiro' ? itens[0] : itens[itens.length - 1])?.focus();
    }, 0);
    return () => clearTimeout(relogio);
  }, [qual, vez, grupoAberto]);

  const agendarFechar = useCallback(() => {
    cancelarEspera();
    espera.current = setTimeout(() => {
      espera.current = null;
      const antes = atual.current;
      if (!antes || antes.origem !== 'passagem') return;
      if (sobreBotao.current === antes.grupo || sobreSubmenu.current === antes.grupo) return;
      atual.current = null;
      pontoNoIconeAberto.current = null;
      setAberto(null);
    }, ESPERA_AO_SAIR);
  }, [cancelarEspera]);

  useTeclado(!!abertoVisivel || !!focadoVisivel, ({ key, ctrl }) => {
    if (ctrl && key.toLowerCase() === 'k') {
      fechar();
      return undefined;
    }
    const ativoEl = document.activeElement as HTMLElement | null;
    const naCaixa = !!ativoEl && !!abertoVisivel && !!caixaDoSubmenu(abertoVisivel.grupo)?.contains(ativoEl);
    if (naCaixa && abertoVisivel) {
      if (key === 'Escape') {
        fechar(true);
        return true;
      }
      // Tab: o foco volta ao ícone antes do padrão do navegador, que então segue a ordem a partir dele (APG).
      if (key === 'Tab') {
        fechar(true);
        return undefined;
      }
      const itens = itensDoSubmenu(abertoVisivel.grupo);
      const destino = proximoItemDoMenu(key, itens.indexOf(ativoEl!), itens.length);
      if (destino === null) return undefined;
      itens[destino]?.focus();
      return true;
    }
    if (focadoVisivel && (key === 'ArrowDown' || key === 'ArrowUp')) {
      abrir(focadoVisivel, 'fixo', key === 'ArrowDown' ? 'primeiro' : 'ultimo');
      return true;
    }
    if (key === 'Escape' && abertoVisivel) {
      fechar();
      return true;
    }
    return undefined;
  });

  // Clique fora (web): ignora o submenu aberto e qualquer ícone de grupo (o ícone trata o próprio clique).
  useEffect(() => {
    if (Platform.OS !== 'web' || !abertoVisivel) return undefined;
    const ouvir = (e: MouseEvent) => {
      const alvo = e.target instanceof Node ? e.target : null;
      if (!alvo || caixaDoSubmenu(abertoVisivel.grupo)?.contains(alvo)) return;
      for (const botao of botoes.current.values()) {
        if (elemento(botao)?.contains(alvo)) return;
      }
      fechar();
    };
    document.addEventListener('mousedown', ouvir);
    return () => document.removeEventListener('mousedown', ouvir);
  }, [abertoVisivel, fechar]);

  // Redimensionamento (web): acompanha o ícone ou fecha ao sair do modo PC minimizado (< 1024 px).
  useEffect(() => {
    if (Platform.OS !== 'web' || !abertoVisivel) return undefined;
    const aoRedimensionar = () => {
      if (window.innerWidth < LARGURA_MENU_EXPANDIDO) fechar();
      else abrir(abertoVisivel.grupo, abertoVisivel.origem);
    };
    window.addEventListener('resize', aoRedimensionar);
    return () => window.removeEventListener('resize', aoRedimensionar);
  }, [abertoVisivel, abrir, fechar]);

  const estaRumoAoSubmenuAberto = (ponto: Ponto): boolean => {
    const grupoAtual = atual.current?.grupo;
    if (!grupoAtual || Platform.OS !== 'web' || !pontoNoIconeAberto.current) return false;
    const caixa = caixaDoSubmenu(grupoAtual)?.getBoundingClientRect();
    if (!caixa || caixa.height <= 0) return false;
    return rumoAoSubmenu(pontoNoIconeAberto.current, ponto, {
      esquerda: caixa.left,
      topo: caixa.top,
      altura: caixa.height,
    });
  };

  /** Props do ícone de um grupo. */
  const doBotao = (grupo: GrupoDoMenu) => ({
    registrar: (no: View | null) => {
      if (no) botoes.current.set(grupo, no);
      else botoes.current.delete(grupo);
    },
    aberto: abertoVisivel?.grupo === grupo,
    aoEntrar: (clientX?: number, clientY?: number) => {
      sobreBotao.current = grupo;
      cancelarEspera();
      const ponto = typeof clientX === 'number' && typeof clientY === 'number' ? { x: clientX, y: clientY } : null;
      if (ponto) ultimoPonto.current = ponto;
      if (atual.current?.grupo === grupo) {
        cancelarTroca();
        if (ponto) pontoNoIconeAberto.current = ponto;
        return;
      }
      if (atual.current && ponto && estaRumoAoSubmenuAberto(ponto)) {
        cancelarTroca();
        troca.current = setTimeout(() => {
          troca.current = null;
          if (sobreBotao.current === grupo) {
            pontoNoIconeAberto.current = ultimoPonto.current ?? ponto;
            abrir(grupo, 'passagem');
          }
        }, ESPERA_TROCA_DIAGONAL);
        return;
      }
      cancelarTroca();
      pontoNoIconeAberto.current = ponto;
      abrir(grupo, 'passagem');
    },
    aoMover: (clientX: number, clientY: number) => {
      sobreBotao.current = grupo;
      cancelarEspera();
      const ponto: Ponto = { x: clientX, y: clientY };
      ultimoPonto.current = ponto;
      if (atual.current?.grupo === grupo) {
        pontoNoIconeAberto.current = ponto;
        return;
      }
      if (troca.current && !estaRumoAoSubmenuAberto(ponto)) {
        cancelarTroca();
        pontoNoIconeAberto.current = ponto;
        abrir(grupo, 'passagem');
      }
    },
    aoSair: () => {
      if (sobreBotao.current === grupo) sobreBotao.current = null;
      cancelarTroca();
      agendarFechar();
    },
    aoFocar: () => {
      cancelarEspera();
      setFocado(grupo);
      if (semAbrirNoFoco.current) {
        semAbrirNoFoco.current = false;
        return;
      }
      if (atual.current?.grupo !== grupo) {
        cancelarTroca();
        abrir(grupo, 'passagem');
      }
    },
    aoDesfocar: (destino: unknown) => {
      setFocado((antes) => (antes === grupo ? null : antes));
      if (destino instanceof Node && caixaDoSubmenu(grupo)?.contains(destino)) return;
      if (sobreBotao.current === grupo || sobreSubmenu.current === grupo) return;
      if (atual.current?.grupo === grupo && atual.current.origem === 'passagem') {
        atual.current = null;
        pontoNoIconeAberto.current = null;
        setAberto(null);
      }
    },
    aoTocar: () => {
      cancelarTroca();
      cancelarEspera();
      if (sobreBotao.current === grupo) {
        abrir(grupo, 'fixo', 'primeiro');
        return;
      }
      if (atual.current?.grupo === grupo && atual.current.origem === 'fixo') fechar();
      else abrir(grupo, 'fixo', 'primeiro');
    },
  });

  const aoMedirDoSubmenu = useCallback((valor: number) => {
    if (grupoAberto) aoMedir(grupoAberto, valor);
  }, [grupoAberto, aoMedir]);

  // Cada grupo guarda a própria altura medida: voltar ao mesmo grupo abre já medido.
  const altura = abertoVisivel ? (medidas[abertoVisivel.grupo] ?? null) : null;
  const topo = abertoVisivel ? topoDoSubmenu(abertoVisivel.topo, altura, height) : 0;
  return {
    aberto: abertoVisivel,
    fechar,
    doBotao,
    /** Fecha depois de escolher um item: o foco volta ao ícone (a tela nova não o tira dali). */
    aoEscolher: () => fechar(true),
    /** A lista do menu rolou: o submenu acompanha o ícone. */
    aoRolar: () => { if (abertoVisivel) abrir(abertoVisivel.grupo, abertoVisivel.origem); },
    doSubmenu: abertoVisivel ? {
      grupo: abertoVisivel.grupo,
      topo,
      esquerda: abertoVisivel.esquerda,
      medido: altura !== null,
      aoMedir: aoMedirDoSubmenu,
      aoPassar: () => {
        sobreSubmenu.current = abertoVisivel.grupo;
        cancelarTroca();
        cancelarEspera();
      },
      aoSairDoMouse: () => {
        if (sobreSubmenu.current === abertoVisivel.grupo) sobreSubmenu.current = null;
        agendarFechar();
      },
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
  const eventosDePonteiro = Platform.OS === 'web' ? {
    onPointerEnter: (e: PointerEvent) => {
      if (e.nativeEvent.pointerType !== 'touch') botao.aoEntrar(e.nativeEvent.clientX, e.nativeEvent.clientY);
    },
    onPointerMove: (e: PointerEvent) => {
      if (e.nativeEvent.pointerType !== 'touch') botao.aoMover(e.nativeEvent.clientX, e.nativeEvent.clientY);
    },
    onPointerLeave: (e: PointerEvent) => {
      if (e.nativeEvent.pointerType !== 'touch') botao.aoSair();
    },
  } : {
    onHoverIn: () => botao.aoEntrar(),
    onHoverOut: botao.aoSair,
  };
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
      {...eventosDePonteiro}
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
  const { height: alturaJanela } = useWindowDimensions();
  const { aoMedir } = submenu;
  const refDaCaixa = useCallback((n: View | null) => {
    if (Platform.OS !== 'web' || !n) return;
    const el = elemento(n);
    if (!el) return;
    const h = el.getBoundingClientRect?.().height || el.offsetHeight;
    if (h > 0) aoMedir(h);
  }, [aoMedir]);
  const posicao = {
    top: submenu.topo,
    left: submenu.esquerda,
    // Até a altura ser medida não aparece: assim não pisca no lugar errado antes de subir para caber.
    opacity: submenu.medido ? 1 : 0,
  };
  const caixa = (
    <View
      ref={refDaCaixa}
      nativeID={idDoSubmenu(submenu.grupo)}
      role="menu"
      aria-label={submenu.grupo}
      onLayout={(e) => submenu.aoMedir(e.nativeEvent.layout.height)}
      onPointerEnter={Platform.OS !== 'web' ? (e) => { if (e.nativeEvent.pointerType !== 'touch') submenu.aoPassar(); } : undefined}
      onPointerLeave={Platform.OS !== 'web' ? (e) => { if (e.nativeEvent.pointerType !== 'touch') submenu.aoSairDoMouse(); } : undefined}
      style={[
        Platform.OS !== 'web' && estilos.camada,
        Platform.OS !== 'web' && posicao,
        estilos.submenu,
        {
          maxHeight: Math.max(ALVO_TOQUE * 2, alturaJanela - 16),
          backgroundColor: cores.superficie,
          borderColor: cores.borda,
          borderWidth: bordas.bloco,
        },
        Platform.OS === 'web' && ({ overflowY: 'auto' } as never),
      ]}>
      <Texto aria-hidden numberOfLines={1} style={[estilos.titulo, { color: cores.textoSuave }]}>{submenu.grupo}</Texto>
      {children}
    </View>
  );
  if (Platform.OS === 'web') {
    return (
      <View
        onPointerEnter={(e) => { if (e.nativeEvent.pointerType !== 'touch') submenu.aoPassar(); }}
        onPointerMove={(e) => { if (e.nativeEvent.pointerType !== 'touch') submenu.aoPassar(); }}
        onPointerLeave={(e) => { if (e.nativeEvent.pointerType !== 'touch') submenu.aoSairDoMouse(); }}
        style={[estilos.camada, posicao]}>
        <View aria-hidden style={estilos.ponte} />
        {caixa}
      </View>
    );
  }
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
  camada: { position: 'absolute', zIndex: 50 },
  ponte: { position: 'absolute', left: -espaco(2), width: espaco(2), top: 0, bottom: 0 },
  submenu: { width: LARGURA_DO_SUBMENU, borderRadius: RAIO, padding: espaco(0.5), gap: 2 },
  titulo: { fontFamily: fontes.medio, fontSize: 13, lineHeight: 18, paddingHorizontal: espaco(1.5), paddingTop: espaco(0.5), paddingBottom: 4 },
});
