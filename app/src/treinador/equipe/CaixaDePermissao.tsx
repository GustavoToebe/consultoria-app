import { Check, Lock, Minus } from 'lucide-react-native';
import { useId, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, RAIO_CONTROLE } from '../../tema/tokens';
import { coresDoDesabilitado } from '../../ui/desabilitado';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';

interface Props {
  /** "Treino: criar e editar": o nome que o leitor de tela ouve (e que o e2e procura). */
  rotuloAcessivel: string;
  /** Texto ao lado da caixa ("Gerar convite", "Marcar toda a seção"); sem ele, só a caixa (as colunas fixas da matriz). */
  nome?: string;
  valor: boolean | 'misto';
  /** Não muda agora (dependência ou teto): `aria-disabled`, mas continua no Tab, para a pessoa chegar ao motivo. */
  travada?: boolean;
  /** Dica e motivo: descrição acessível; na web aparece com o mouse ou o foco, no celular embaixo do nome. */
  descricao?: string;
  /** Escreve a descrição embaixo, sempre à vista (lista do celular: não há mouse). */
  descricaoVisivel?: boolean;
  /** Balão abaixo da caixa (primeira linha da tabela); o padrão é acima, para não sair do cartão na última. */
  dicaAbaixo?: boolean;
  /** Avisa quem desenha a linha: cada `View` do react-native-web abre um contexto de empilhamento (`zIndex: 0`), então a
   *  linha e a célula com o balão aberto sobem de camada, senão as linhas e células seguintes o cobrem. */
  aoMudarDica?: (aberta: boolean) => void;
  aoMudar: (valor: boolean) => void;
}

/**
 * Caixa de seleção compacta da matriz de permissões (`CaixaSelecao` é a linha inteira, sem estado parcial nem nome
 * acessível próprio). Estado parcial = traço (`aria-checked="mixed"`, Checkbox da WAI-ARIA APG); Espaço e Enter alternam.
 * Travada = visual de desabilitado com o cadeado; o toque não faz nada e o motivo fica na descrição.
 */
export function CaixaDePermissao({ rotuloAcessivel, nome, valor, travada, descricao, descricaoVisivel, dicaAbaixo, aoMudarDica, aoMudar }: Props) {
  const { cores } = useTema();
  const cinza = coresDoDesabilitado(cores);
  const id = useId();
  const [dicaAberta, setDicaAberta] = useState(false);
  const [abaixo, setAbaixo] = useState(!!dicaAbaixo);
  const web = Platform.OS === 'web';
  const marcada = valor !== false;
  const alternar = () => { if (!travada) aoMudar(valor !== true); };
  const Marca = valor === 'misto' ? Minus : Check;
  // Perto do topo da janela o balão de cima ficaria fora da área que rola: abre embaixo.
  const mostrarDica = (v: boolean, alvo?: unknown) => {
    if (!web || !descricao || descricaoVisivel) return;
    if (v) setAbaixo(!!dicaAbaixo || ((alvo as Element | undefined)?.getBoundingClientRect?.().top ?? Infinity) < ALTURA_PERTO_DO_TOPO);
    setDicaAberta(v); aoMudarDica?.(v);
  };
  const teclado = web ? { onKeyDown: (e: { key: string; preventDefault: () => void }) => { if (e.key === ' ') { e.preventDefault(); alternar(); } } } : {};
  return (
    // O mouse é ouvido no envoltório: a caixa travada (`disabled`, que no react-native-web também desliga o hover) segue no
    // Tab pelo `tabIndex` e mostra o motivo no foco.
    <View style={[estilos.envolve, dicaAberta ? estilos.porCima : null]} {...(web ? { onPointerEnter: (e: { currentTarget: unknown }) => mostrarDica(true, e.currentTarget), onPointerLeave: () => mostrarDica(false) } : {})}>
      <Pressable
        role="checkbox"
        accessibilityLabel={rotuloAcessivel}
        aria-checked={valor === 'misto' ? 'mixed' : valor}
        accessibilityState={{ checked: valor === 'misto' ? 'mixed' : valor, disabled: !!travada }}
        disabled={!!travada}
        tabIndex={0}
        aria-describedby={web && descricao ? id : undefined}
        accessibilityHint={descricao}
        onPress={alternar}
        onFocus={(e) => mostrarDica(true, e.currentTarget)}
        onBlur={() => mostrarDica(false)}
        {...(teclado as object)}
        style={(estado) => [estilos.alvo, nome ? estilos.comNome : null, { backgroundColor: sobre(estado) && !travada ? cores.sobre : 'transparent' }]}>
        <View style={[estilos.caixa, {
          backgroundColor: travada ? (marcada ? cinza.texto : cinza.fundo) : marcada ? cores.texto : cores.campo,
          borderColor: travada ? cinza.borda : marcada ? cores.texto : cores.bordaCampo,
        }]}>
          {marcada ? <Marca size={16} strokeWidth={3} color={travada ? cinza.fundo : cores.fundo} /> : null}
        </View>
        {nome ? <Texto style={estilos.nome} cor={travada ? cinza.texto : undefined}>{nome}</Texto> : null}
        {/* Sem nome (coluna da matriz), o cadeado fica fora do alvo, para a caixa seguir no centro da coluna. */}
        {travada ? <View style={nome ? null : estilos.cadeadoAoLado}><Lock size={14} color={cores.textoSuave} aria-hidden /></View> : null}
      </Pressable>
      {descricao ? (
        <View
          id={web ? id : undefined}
          style={descricaoVisivel ? estilos.descricao : dicaAberta ? [estilos.balao, abaixo ? estilos.abaixo : estilos.acima, { backgroundColor: cores.superficie, borderColor: cores.borda }] : estilos.oculta}
          importantForAccessibility="no"
          aria-hidden={!web}>
          <Texto variante="pequeno">{descricao}</Texto>
        </View>
      ) : null}
    </View>
  );
}

/** Topo da caixa a menos disso do topo da janela: o balão abre embaixo (cabeçalho da folha + a altura do balão). */
const ALTURA_PERTO_DO_TOPO = 220;

const estilos = StyleSheet.create({
  envolve: { position: 'relative', alignSelf: 'flex-start', maxWidth: '100%' },
  alvo: { minWidth: ALVO_TOQUE, minHeight: ALVO_TOQUE, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: espaco(1), borderRadius: RAIO_CONTROLE },
  comNome: { justifyContent: 'flex-start', paddingHorizontal: espaco(1), marginHorizontal: -espaco(1) },
  caixa: { width: 22, height: 22, borderWidth: 1, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  nome: { flexShrink: 1 },
  descricao: { paddingLeft: 22 + espaco(1), paddingBottom: espaco(0.5) },
  porCima: { zIndex: 1 },
  cadeadoAoLado: { position: 'absolute', left: ALVO_TOQUE - 6, top: (ALVO_TOQUE - 14) / 2 },
  // Balão da web (painel flutuante: superfície e borda, sem sombra); não rouba o mouse.
  balao: { position: 'absolute', left: 0, width: 280, maxWidth: 280, padding: espaco(1), borderWidth: 1, borderRadius: RAIO_CONTROLE, pointerEvents: 'none' },
  acima: { bottom: ALVO_TOQUE + 2 },
  abaixo: { top: ALVO_TOQUE + 2 },
  oculta: { display: 'none' },
});
