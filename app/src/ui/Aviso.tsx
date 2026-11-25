import { CircleAlert, CircleCheck, TriangleAlert, X, type LucideIcon } from 'lucide-react-native';
import { Portal } from '@rn-primitives/portal';
import { createContext, useCallback, useContext, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../tema/tokens';
import { CamadaDoAviso } from './camadaDoAviso';
import { portalDaFolhaDoTopo } from './historicoDasFolhas';
import { fundoPintado, superficiePintada } from './superficiePintada';
import { Texto } from './Texto';

type TipoAviso = 'sucesso' | 'atencao' | 'perigo' | 'neutro';

/** O ícone diz o tipo junto com a cor (a cor nunca fala sozinha), o mesmo do `Alerta`. */
const ICONE_DO_AVISO: Record<Exclude<TipoAviso, 'neutro'>, LucideIcon> = { sucesso: CircleCheck, atencao: TriangleAlert, perigo: CircleAlert };

/** Ação opcional do aviso (ex.: "Abrir ficha"): fecha o aviso e executa. */
interface AcaoDoAviso {
  rotulo: string;
  aoTocar: () => void;
}

interface ValorAviso {
  avisar: (mensagem: string, tipo?: TipoAviso, acao?: AcaoDoAviso) => void;
}

const Contexto = createContext<ValorAviso | null>(null);

/** Quanto tempo o aviso de sucesso ou neutro fica na tela. O de erro e o de atenção ficam até a pessoa fechar. */
const DURACAO_MS = 4000;
/** Com uma ação para tocar, o aviso fica mais tempo. */
const DURACAO_COM_ACAO_MS = 10000;

/**
 * Mensagem curta no rodapé (substitui o `alert`, que não existe na web). Sucesso e neutro somem sozinhos; erro
 * (`perigo`, vermelho) e atenção (`atencao`, âmbar: o alerta que não é erro, D5 de `docs/planos/auditoria-cores.md`) ficam
 * até ser fechados, porque quatro segundos não bastam para ler o que deu errado ou o que fazer. Os três com cor são
 * pintados (fundo em degradê e borda inteira na cor, ícone do tipo; sem a faixa lateral, 24/11); o neutro fica liso.
 * Fica sempre por cima das Folhas, véus, menus e confirmações (e2e `aviso-acima-das-folhas.spec.ts`).
 */
export function AvisoProvider({ children }: { children: ReactNode }) {
  const { cores, variante } = useTema();
  const margem = useSafeAreaInsets();
  const [aviso, setAviso] = useState<{ mensagem: string; tipo: TipoAviso; acao?: AcaoDoAviso } | null>(null);
  const relogio = useRef<ReturnType<typeof setTimeout> | null>(null);

  const avisar = useCallback((mensagem: string, tipo: TipoAviso = 'neutro', acao?: AcaoDoAviso) => {
    if (relogio.current) clearTimeout(relogio.current);
    setAviso({ mensagem, tipo, acao });
    relogio.current = tipo === 'perigo' || tipo === 'atencao' ? null : setTimeout(() => setAviso(null), acao ? DURACAO_COM_ACAO_MS : DURACAO_MS);
  }, []);

  const valor = useMemo(() => ({ avisar }), [avisar]);
  // Pintado (24/11, `ui/superficiePintada`): degradê e borda inteira na cor do tipo, ícone na cor; o neutro fica liso.
  const cor = aviso && aviso.tipo !== 'neutro' ? cores[aviso.tipo] : null;
  const p = cor ? superficiePintada(cor, cores.superficie2, variante, cores) : null;
  const Icone = aviso && aviso.tipo !== 'neutro' ? ICONE_DO_AVISO[aviso.tipo] : null;

  // Com uma Folha aberta o aviso vai para o portal dela (o `Modal` fica por cima da raiz: na web é outro nó no fim do
  // `body`, no celular outra janela). Lá dentro ele fica acima do véu e do painel, fora do clique que fecha a folha e
  // dentro da trava de foco (o Tab alcança o "Desfazer"); na web, logo acima do rodapé da folha, sem cobrir as ações.
  // Sem folha, na web vai para a camada própria no fim do `body` (`ui/camadaDoAviso`), por cima de menus, Calendário e
  // confirmações. Lido como fonte externa (o React confere de novo depois do commit) e nunca guardado no `avisar`: quem
  // avisa e fecha a folha no mesmo toque ("Item salvo.") tem o aviso fora dela.
  const visivel = !!aviso;
  const destino = useSyncExternalStore(
    // shortcut: a lista de folhas abertas não avisa quando muda; com o aviso na tela, confere 5 vezes por segundo se uma
    // folha abriu ou fechou por fora. Trocar por uma assinatura em `historicoDasFolhas` se isso pesar.
    (mudou) => {
      if (!visivel) return () => undefined;
      const relogioDoHost = setInterval(mudou, 200);
      return () => clearInterval(relogioDoHost);
    },
    () => (visivel ? destinoDoTopo() : ''),
  );
  const [host, rodape] = destino ? destino.split('|') : [];
  const bottom = rodape ? Number(rodape) + espaco(1) : margem.bottom + espaco(10);

  const cartao = aviso ? (
    <View key="aviso" pointerEvents="box-none" style={[estilos.camada, { bottom }]}>
      <View
        role="alert"
        accessibilityLiveRegion={aviso.tipo === 'perigo' ? 'assertive' : 'polite'}
        style={[estilos.aviso, p ? [fundoPintado(p), { borderColor: p.borda }] : { backgroundColor: cores.superficie2, borderColor: cores.borda }]}>
        {Icone && cor ? <Icone size={18} color={cor} strokeWidth={2.5} aria-hidden /> : null}
        <Texto style={estilos.texto}>{aviso.mensagem}</Texto>
        {aviso.acao ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              const acao = aviso.acao;
              setAviso(null);
              acao?.aoTocar();
            }}
            style={estilos.acao}>
            <Texto style={estilos.rotuloAcao}>{aviso.acao.rotulo}</Texto>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Fechar aviso" onPress={() => setAviso(null)} style={estilos.fechar}>
          <X size={18} color={cores.textoSuave} strokeWidth={2} />
        </Pressable>
      </View>
    </View>
  ) : null;

  return (
    <Contexto.Provider value={valor}>
      {children}
      {cartao && host ? <Portal name="aviso" hostName={host}>{cartao}</Portal> : <CamadaDoAviso>{cartao}</CamadaDoAviso>}
    </Contexto.Provider>
  );
}

/**
 * Para onde vai o aviso: `''` = camada da raiz (sem folha, ou com outro `Modal` por cima da folha do topo); senão o nome do portal da Folha do topo e, na web, `|` e a distância do
 * topo do rodapé dela ao pé da janela. Na web só vale a folha cujo nó ainda está na página (a que fecha neste commit já
 * saiu do DOM, mas só sai da lista no efeito); no celular a folha que fecha já vem marcada.
 */
function destinoDoTopo(): string {
  const folha = portalDaFolhaDoTopo();
  if (!folha) return '';
  if (Platform.OS !== 'web') return folha.nome;
  if (!folha.elemento?.isConnected) return '';
  // Um `Modal` aberto depois da folha (menu, Calendário, seleção) fica por cima dela: o aviso vai para a camada do `body`.
  let raiz: Element | null = folha.elemento;
  while (raiz && raiz.parentElement !== document.body) raiz = raiz.parentElement;
  for (let irmao = raiz?.nextElementSibling; irmao; irmao = irmao.nextElementSibling) {
    if (irmao.childElementCount > 0 && !irmao.hasAttribute('data-camada')) return '';
  }
  // O nó do portal é irmão do painel dentro do `Modal` desta folha; o rodapé é marcado na `Folha` (`data-rodape-da-folha`).
  const rodape = folha.elemento.parentElement?.querySelector('[data-rodape-da-folha]');
  return rodape ? `${folha.nome}|${Math.max(0, Math.round(window.innerHeight - rodape.getBoundingClientRect().top))}` : folha.nome;
}

export function useAviso(): ValorAviso {
  const valor = useContext(Contexto);
  if (!valor) {
    throw new Error('useAviso fora do AvisoProvider');
  }
  return valor;
}

const estilos = StyleSheet.create({
  // Acima do véu da confirmação (`PainelConfirmacao`, `z-50`) que abre no mesmo portal da folha.
  camada: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: espaco(2), zIndex: 100 },
  aviso: {
    maxWidth: 520,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco(1),
    borderWidth: 1,
    borderRadius: RAIO,
    paddingVertical: espaco(0.5),
    paddingLeft: espaco(1.5),
    paddingRight: espaco(0.5),
  },
  texto: { fontFamily: fontes.semi, flex: 1, paddingVertical: espaco(0.5) },
  acao: { minHeight: ALVO_TOQUE, justifyContent: 'center', paddingHorizontal: espaco(1), borderRadius: RAIO },
  rotuloAcao: { fontFamily: fontes.semi, textDecorationLine: 'underline' },
  fechar: { width: ALVO_TOQUE, height: ALVO_TOQUE, alignItems: 'center', justifyContent: 'center', borderRadius: RAIO },
});
