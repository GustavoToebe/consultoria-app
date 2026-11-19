import { ChevronDown, ChevronRight, CircleAlert, Ellipsis, TriangleAlert } from 'lucide-react-native';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { textoAcessivelDoBloco, textoDaVariacao, type ResumoDoBloco } from '../../dominio/editorDeTreino';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes } from '../../tema/tokens';
import { AlcaDeArraste, ItemArrastavel, LARGURA_DA_ALCA, useArrasteDaLista } from '../../ui/ArrasteDaLista';
import { Selo } from '../../ui/Selo';
import { IconeBotao } from '../../ui/IconeBotao';
import { coresDaEdicao } from '../../ui/selecao';
import { sobre as comMouse } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';
import { acoesDeMover } from '../acoesDeMover';
import { FolhaDeAcoes } from '../FolhaDeAcoes';

export interface LinhaDoBloco {
  /** uid da 1ª série do bloco (o mesmo valor da antiga aba). */
  valor: string;
  /** "Série 2 · WS": começo do nome acessível (os e2e e o leitor de tela procuram por ele). */
  rotulo: string;
  /** "Série 2": a coluna Série. */
  serie: string;
  /** "WS", "Back off": a coluna Tipo (cardio não tem). */
  tipo?: string;
  /** Cor de identificação do tipo (`identificacao[chave]`): só o selo da categoria (a faixa lateral saiu em 19/11). */
  categoria?: { cor: string; fundo: string };
  /** A coluna Carga, já em texto (`cargaDoBloco`); "—" sem carga prescrita; "Falta a carga" com `cargaFalta`. */
  carga: string;
  /** Carga obrigatória ainda vazia: o texto da coluna em âmbar (pendência, não erro; guia premium págs. 4 e 9). */
  cargaFalta?: boolean;
  resumo: ResumoDoBloco;
  problema?: 'perigo' | 'atencao';
  /** "Editando série 2, WS": nome acessível do bloco aberto (o título visível saiu: a própria linha é o título). */
  edicao: string;
}

const TEXTO_DO_PROBLEMA = { perigo: 'com problema a corrigir', atencao: 'com aviso' } as const;

/** Abaixo desta largura da coluna das séries as colunas viram linha empilhada com o editor embaixo (390). */
export const LARGURA_DAS_COLUNAS = 540;
/** Coluna do chevron (→ fechada, ↓ aberta), no fim da linha e do cabeçalho. */
const CHEVRON = 20;
/** Vão entre a alça e a linha. */
const ESPACO_DA_ALCA = espaco(0.25);
/** Vão em volta do ⋯ da linha (fora do botão da linha, dentro do bloco tingido). */
const ESPACO_DO_MENU = espaco(0.5);

/**
 * Tabela dos blocos do exercício (guia premium pág. 9 e 17): Série, Tipo, Carga, Reps e Descanso, uma linha por bloco de
 * `agrupar`, com o que varia entre as séries embaixo do tipo. Sanfona (APG Accordion) no PC e no celular: cada linha é
 * botão com `aria-expanded` e `aria-controls` (setas, Home e End movem o foco; Enter e Espaço abrem e fecham), e o editor
 * (`detalhe`) abre logo abaixo da série escolhida. No PC a linha mostra as colunas; estreito (`empilhado`, 390) ela vira
 * texto corrido.
 * Séries no padrão da dieta (19/11): um nível de destaque por vez. A faixa de ação fica no painel do exercício; aqui a
 * linha fechada não tem borda (hover `superficie2`, chevron →) e a aberta forma um bloco só com o editor embaixo, no fundo
 * tingido de ação (`coresDaEdicao().fundoDoBloco`), sem contorno, halo nem selo "Editando" (chevron ↓ na cor de ação).
 * Só uma aberta por vez; tocar na aberta fecha. Quatro sinais que não se confundem: o foco é o anel do `:focus-visible`;
 * a aberta é o fundo tingido; a categoria é só o selo na cor do tipo; o problema é o ícone na cor da gravidade (a carga
 * ainda vazia é âmbar, "Falta a carga").
 */
export function TabelaDeBlocos({ linhas, ativa, aoMudar, depois, empilhado = false, detalhe, aoSoltar, aoMover }: {
  linhas: LinhaDoBloco[];
  /** O bloco aberto; nulo = todos fechados. */
  ativa: string | null;
  /** Abre o bloco `valor`; nulo fecha o aberto. */
  aoMudar: (valor: string | null) => void;
  /** "+ Nova série", logo abaixo da última linha. */
  depois?: ReactNode;
  /** Coluna estreita: a linha vira texto corrido em vez de colunas. */
  empilhado?: boolean;
  /** O editor do bloco aberto, logo abaixo da linha dele, no PC e no celular. */
  detalhe?: ReactNode;
  /** Arrastar pela alça (arrastar, 18/11): soltar o bloco `de` na posição `para`. Sem ele, sem alça. */
  aoSoltar?: (de: number, para: number) => (() => void) | void;
  /** "Mover para cima/baixo" do ⋯ de cada linha: a alternativa sem arrastar (WCAG 2.5.7) e o caminho do teclado. */
  aoMover?: (indice: number, delta: -1 | 1) => void;
}) {
  const { cores } = useTema();
  // Só a linha anda (o editor aberto embaixo dela fica); as setas ficam no ⋯ da linha, fora do botão dela.
  const arraste = useArrasteDaLista({ total: aoSoltar ? linhas.length : 0, aoSoltar: aoSoltar ?? (() => undefined), folga: espaco(0.25) });
  const comAlca = !!aoSoltar && linhas.length > 1;
  const comMenu = !!aoMover && linhas.length > 1;
  const [menuDe, setMenuDe] = useState<number | null>(null);
  const acoesDoMenu = menuDe !== null && aoMover && menuDe < linhas.length
    ? acoesDeMover({ nome: `série ${menuDe + 1}`, posicao: menuDe, total: linhas.length, aoMover: (d) => aoMover(menuDe, d) })
    : [];
  const idDoDetalhe = `detalhe-da-serie-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  // Teclado na sanfona (APG Accordion, opcional): setas para cima e para baixo, Home e End movem o foco entre as linhas
  // sem escolher; Enter e Espaço abrem. Devolve a navegação por setas que as abas tinham.
  const linhasRef = useRef<(View | null)[]>([]);
  const aoTecla = (i: number) => (e: { nativeEvent?: { key?: string }; key?: string; preventDefault?: () => void }) => {
    const tecla = e.key ?? e.nativeEvent?.key;
    const alvo = tecla === 'ArrowDown' ? i + 1 : tecla === 'ArrowUp' ? i - 1 : tecla === 'Home' ? 0 : tecla === 'End' ? linhas.length - 1 : null;
    if (alvo === null) return;
    e.preventDefault?.();
    linhasRef.current[(alvo + linhas.length) % linhas.length]?.focus();
  };
  const teclado = (i: number) => (Platform.OS === 'web' ? ({ onKeyDown: aoTecla(i) } as object) : {});
  const fundoDoBloco = coresDaEdicao(cores).fundoDoBloco;
  // "Fechar edição" (web) some com o bloco e o foco cairia no corpo da página: ele volta à linha, que continua montada
  // (WCAG 2.4.3). Só quando o foco se perdeu: fechar pela própria linha já deixa o foco nela.
  const aberta = useRef(ativa);
  useEffect(() => {
    const antes = aberta.current;
    aberta.current = ativa;
    if (Platform.OS !== 'web' || ativa !== null || antes === null) return;
    const foco = typeof document === 'undefined' ? null : document.activeElement;
    if (foco && foco !== document.body) return;
    linhasRef.current[linhas.findIndex((l) => l.valor === antes)]?.focus();
  }, [ativa, linhas]);

  const conteudo = (l: LinhaDoBloco, sel: boolean) => {
    const Icone = l.problema === 'perigo' ? CircleAlert : TriangleAlert;
    const variacao = textoDaVariacao(l.resumo.variacao);
    const series = `${l.resumo.quantidade} ${l.resumo.quantidade === 1 ? 'série' : 'séries'}`;
    const corDaCarga = l.cargaFalta ? { color: cores.atencao } : null;
    const Seta = sel ? ChevronDown : ChevronRight;
    const chevron = <View style={estilos.chevron} aria-hidden><Seta size={18} color={sel ? cores.acao : cores.textoSuave} strokeWidth={2} /></View>;
    const numero = (
      <View style={estilos.titulo}>
        {l.problema ? <Icone size={16} color={cores[l.problema]} strokeWidth={2.5} aria-hidden /> : null}
        <Texto style={estilos.forte}>{l.serie}</Texto>
      </View>
    );
    const tipo = (
      <View style={estilos.titulo}>
        {l.tipo ? <Selo texto={l.tipo} categoria={l.categoria} /> : <Texto cor="suave">—</Texto>}
      </View>
    );
    const detalhes = (
      <>
        {l.resumo.nome ? <Texto variante="pequeno" cor="suave">{l.resumo.nome}</Texto> : null}
        {variacao ? <Texto variante="pequeno" cor="suave">{variacao}</Texto> : null}
      </>
    );
    if (!empilhado) {
      return (
        <View style={estilos.linha}>
          <View style={[estilos.serie, estilos.celula]}>
            {numero}
            <Texto variante="pequeno" numerico cor="suave">{series}</Texto>
          </View>
          <View style={[estilos.tipo, estilos.celula]}>{tipo}{detalhes}</View>
          <Texto numerico style={[estilos.carga, corDaCarga]}>{l.carga}</Texto>
          <Texto numerico style={estilos.reps}>{l.resumo.repeticoes}</Texto>
          <Texto numerico style={estilos.descanso}>{l.resumo.descanso}</Texto>
          {chevron}
        </View>
      );
    }
    return (
      <View style={estilos.linha}>
        <View style={estilos.empilhado}>
          <View style={estilos.titulo}>{numero}{tipo}</View>
          {detalhes}
          <Texto variante="pequeno" numerico>
            {[series, !l.cargaFalta && l.carga !== '—' ? l.carga : null, l.resumo.repeticoes, `descanso ${l.resumo.descanso}`].filter(Boolean).join(' · ')}
          </Texto>
          {l.cargaFalta ? <Texto variante="pequeno" style={[estilos.semi, corDaCarga]}>{l.carga}</Texto> : null}
        </View>
        {chevron}
      </View>
    );
  };
  const rotuloDe = (l: LinhaDoBloco) => [
    textoAcessivelDoBloco(l.rotulo, l.resumo),
    l.cargaFalta ? 'falta a carga' : l.carga !== '—' ? `carga ${l.carga}` : null,
    l.problema ? TEXTO_DO_PROBLEMA[l.problema] : null,
  ].filter(Boolean).join(', ');

  const linha = (l: LinhaDoBloco, i: number) => {
    const sel = l.valor === ativa;
    // Linha e editor num bloco só (o fundo tingido); sem `overflow: hidden`, que cortaria o anel de foco da linha.
    return (
      <View key={l.valor} testID={sel ? 'bloco-aberto' : undefined}
        style={[estilos.item, i > 0 ? { borderTopWidth: 1, borderTopColor: cores.divisor } : null, sel ? [estilos.bloco, { backgroundColor: fundoDoBloco }] : null]}>
        <ItemArrastavel arraste={arraste} indice={i} style={comAlca || comMenu ? estilos.comAlca : null}>
          {comAlca ? <AlcaDeArraste arraste={arraste} indice={i} /> : null}
          <Pressable ref={(n) => { linhasRef.current[i] = n; }} {...teclado(i)} accessibilityRole="button" accessibilityLabel={rotuloDe(l)} aria-expanded={sel}
            {...(Platform.OS === 'web' && sel && detalhe ? ({ 'aria-controls': idDoDetalhe } as object) : {})}
            onPress={() => aoMudar(sel ? null : l.valor)}
            style={(st) => [estilos.caixa, { backgroundColor: !sel && comMouse(st) ? cores.superficie2 : 'transparent' }, comAlca || comMenu ? estilos.aoLado : null]}>
            {conteudo(l, sel)}
          </Pressable>
          {comMenu ? <View style={estilos.menu}><IconeBotao Icone={Ellipsis} rotulo={`Mais ações da série ${i + 1}`} aoTocar={() => setMenuDe(i)} /></View> : null}
        </ItemArrastavel>
        {sel && detalhe ? <View nativeID={idDoDetalhe} role="region" aria-label={l.edicao}>{detalhe}</View> : null}
      </View>
    );
  };

  if (empilhado) {
    return (
      <View style={estilos.tabela}>
        <View style={estilos.lista} role="group" aria-label="Blocos do exercício">{linhas.map(linha)}</View>
        {depois ? <View style={estilos.depois}>{depois}</View> : null}
        {acoesDoMenu.length ? <FolhaDeAcoes titulo={`Série ${(menuDe ?? 0) + 1}`} aoFechar={() => setMenuDe(null)} acoes={acoesDoMenu} /> : null}
      </View>
    );
  }

  return (
    <View style={estilos.tabela}>
      {/* Cabeçalho só visual: cada linha já diz os valores no nome acessível. */}
      <View style={[estilos.linha, estilos.cabecalho, comAlca ? estilos.cabecalhoComAlca : null, comMenu ? estilos.cabecalhoComMenu : null]} aria-hidden importantForAccessibility="no-hide-descendants">
        <Texto variante="rotulo" style={estilos.serie}>Série</Texto>
        <Texto variante="rotulo" style={estilos.tipo}>Tipo</Texto>
        <Texto variante="rotulo" style={estilos.carga}>Carga</Texto>
        <Texto variante="rotulo" style={estilos.reps}>Reps</Texto>
        <Texto variante="rotulo" style={estilos.descanso}>Descanso</Texto>
        <View style={estilos.chevron} />
      </View>
      <View style={estilos.lista} role="group" aria-label="Blocos do exercício">{linhas.map(linha)}</View>
      {depois ? <View style={estilos.depois}>{depois}</View> : null}
      {acoesDoMenu.length ? <FolhaDeAcoes titulo={`Série ${(menuDe ?? 0) + 1}`} aoFechar={() => setMenuDe(null)} acoes={acoesDoMenu} /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  tabela: { gap: espaco(0.5) },
  // Linhas coladas, separadas pelo fio `divisor` (protótipo de 19/11); o bloco aberto se afasta um pouco das vizinhas.
  // A lista e o gatilho do `components/ui/tabs` nascem em linha, `w-fit` e centrados: aqui são coluna e linha cheia.
  lista: { flexDirection: 'column', width: '100%' },
  item: { width: '100%' },
  bloco: { borderRadius: 14, marginVertical: espaco(0.75) },
  caixa: {
    width: '100%', height: 'auto', minHeight: ALVO_TOQUE, justifyContent: 'flex-start', alignItems: 'stretch',
    paddingHorizontal: espaco(1.5), paddingVertical: espaco(1.25), borderRadius: 12,
  },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(2), width: '100%' },
  // Mesmo recuo da linha, para as colunas do cabeçalho caírem sobre os valores.
  cabecalho: { paddingHorizontal: espaco(1.5) },
  // Com a alça à esquerda de cada linha, o cabeçalho anda a largura dela e o vão.
  cabecalhoComAlca: { paddingLeft: espaco(1.5) + LARGURA_DA_ALCA + ESPACO_DA_ALCA },
  // E, com o ⋯ à direita de cada linha, a largura dele e os vãos.
  cabecalhoComMenu: { paddingRight: espaco(1.5) + ALVO_TOQUE + 2 * ESPACO_DO_MENU },
  menu: { justifyContent: 'center', marginHorizontal: ESPACO_DO_MENU },
  comAlca: { flexDirection: 'row', alignItems: 'stretch', gap: ESPACO_DA_ALCA },
  aoLado: { flex: 1, width: 'auto', minWidth: 0 },
  celula: { gap: espaco(0.25), minWidth: 0 },
  serie: { width: 72, flexShrink: 0 },
  // A sobra da linha é repartida (11/11): antes ia toda para o Tipo e Carga, Reps e Descanso ficavam colados à direita.
  // O Tipo tem base própria (16/11): com base 0 ficava com ~60 px em 1280 e o selo e a variação quebravam em várias
  // linhas, com o Descanso sobrando. Tipo e Carga (os textos longos) cedem quando falta espaço.
  // Com o ⋯ de cada linha (19/11) a sobra encolheu no inspetor de 1280: o Tipo segura 140 e quem cede é a Carga.
  tipo: { flexGrow: 3, flexShrink: 1, flexBasis: 150, minWidth: 140 },
  carga: { flexGrow: 3, flexShrink: 1, flexBasis: 120, minWidth: 96 },
  reps: { flexGrow: 1, flexShrink: 0, flexBasis: 80 },
  descanso: { flexGrow: 1, flexShrink: 0, flexBasis: 72 },
  chevron: { width: CHEVRON, flexShrink: 0, alignItems: 'center' },
  titulo: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.75), flexWrap: 'wrap' },
  forte: { fontFamily: fontes.semi, fontSize: 15, flexShrink: 1 },
  semi: { fontFamily: fontes.semi },
  empilhado: { gap: espaco(0.5), flex: 1, minWidth: 0 },
  depois: { alignItems: 'flex-start', paddingTop: espaco(0.5) },
});
