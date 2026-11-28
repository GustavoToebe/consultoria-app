import { ChevronDown, ChevronUp, CircleAlert, Ellipsis, Plus, TriangleAlert } from 'lucide-react-native';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { textoAcessivelDoBloco, textoDaVariacao, type ResumoDoBloco } from '../../dominio/editorDeTreino';
import { TEXTO_FALTA_DESCANSO } from '../../dominio/pontosParaRevisar';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes } from '../../tema/tokens';
import { AlcaDeArraste, ItemArrastavel, LARGURA_DA_ALCA, useArrasteDaLista } from '../../ui/ArrasteDaLista';
import { Selo } from '../../ui/Selo';
import { IconeBotao } from '../../ui/IconeBotao';
import { CamadaDaSerie, fundoDaSerie } from '../../ui/CamadaDaSerie';
import { LARGURA_DA_FAIXA_DA_SERIE, pinturaDaSerie } from '../../ui/pinturaDaSerie';
import { sobre as comMouse } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';
import { acoesDeMover } from '../acoesDeMover';
import { colunasDasSeries, LARGURA_DA_COLUNA_SERIE, LARGURA_MAXIMA_DAS_COLUNAS as MAXIMA } from './colunasDasSeries';
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
  /** Cor do selo do tipo (`identificacao[chave]`); nula no modo "Cor de ação" das séries (selo neutro, o tipo pelo nome). */
  categoria?: { cor: string; fundo: string };
  /** Cor da série (`ui/pinturaDaSerie.corDaSerie`: a do tipo ou a de ação): linha pintada e faixa reta; nula = linha neutra. */
  cor?: string | null;
  /** A coluna Carga, já em texto (`cargaDoBloco`); "—" sem carga prescrita; "Falta a carga" com `cargaFalta`. */
  carga: string;
  /** Carga obrigatória ainda vazia: o texto da coluna em âmbar (pendência, não erro; guia premium págs. 4 e 9). */
  cargaFalta?: boolean;
  resumo: ResumoDoBloco;
  problema?: 'perigo' | 'atencao';
  /** "Editando série 2, WS": nome acessível do bloco aberto (o título visível saiu: a própria linha é o título). */
  edicao: string;
}

/** Mesmo texto sem diferença de acento, caixa e espaços nas pontas. */
const semAcento = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase();
const mesmoTexto = (a: string, b: string | undefined) => b !== undefined && semAcento(a) === semAcento(b);

const TEXTO_DO_PROBLEMA = { perigo: 'com problema a corrigir', atencao: 'com aviso' } as const;

/** Canto da linha fechada (o mesmo da caixa do botão) e do bloco aberto (linha + editor). */
const RAIO_DA_LINHA = 12;
const RAIO_DO_BLOCO = 14;
/** Altura de uma linha fechada ("Série N" e "N séries" embaixo, mais o vão de cima e de baixo): a do "+ Nova série". */
const ALTURA_DA_LINHA = 21 + 18 + 2 + 2 * espaco(1.25);

/** Abaixo desta largura da coluna das séries as colunas viram linha empilhada com o editor embaixo (390). */
export const LARGURA_DAS_COLUNAS = 540;
/** Coluna do chevron (⌄ fechada, ⌃ aberta, como no quadro de 27/11), no fim da linha e do cabeçalho. */
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
 * Séries no padrão da dieta (19/11): um nível de destaque por vez. A faixa de ação fica no painel do exercício; aqui cada
 * linha fechada é um cartão pintado na cor da série com a faixa reta à esquerda (25/11, `ui/CamadaDaSerie`, a mesma peça da
 * tela do exercício do aluno; hover `superficie2`, chevron ⌄) e a aberta forma um bloco só com o editor embaixo, no mesmo
 * fundo pintado na cor do tipo e com a borda de ação (28/11: na série do treino, o destaque de edição é a borda), sem halo
 * nem selo "Editando" (chevron ⌃ na cor de ação). Só uma aberta por vez; tocar na aberta fecha. Sinais que não se confundem: o foco é o anel do
 * `:focus-visible`; a aberta é a borda de ação; a categoria é a faixa e o selo com o nome do tipo (a cor é a do tipo
 * ou, pela preferência "Cor das séries", a de ação); o problema é o ícone na cor da gravidade (a carga ainda vazia é âmbar,
 * "Falta a carga"; a série sem descanso também, "● Falta o descanso" na coluna Descanso, SERIE-ABERTA 0.6).
 * 27/11: "6 séries · cluster" embaixo do número (a técnica sai do nome por extenso do Tipo), "5 × 5 (25)" na Reps (vem
 * pronto de `resumoDoBloco`) e as colunas pelo modo do exercício (`colunasDasSeries`: sem carga, sem a coluna Carga).
 */
export function TabelaDeBlocos({ linhas, ativa, aoMudar, depois, nova, empilhado = false, semCarga = false, detalhe, aoSoltar, aoMover }: {
  linhas: LinhaDoBloco[];
  /** O bloco aberto; nulo = todos fechados. */
  ativa: string | null;
  /** Abre o bloco `valor`; nulo fecha o aberto. */
  aoMudar: (valor: string | null) => void;
  /** Algo logo abaixo da última linha. */
  depois?: ReactNode;
  /**
   * "+ Nova série" como a última linha da tabela (27/11): tracejada, na largura toda, com a altura de uma linha fechada,
   * texto e ícone neutros. Quem usa adiciona e abre a série nova.
   */
  nova?: { rotulo: string; aoTocar: () => void };
  /** Coluna estreita: a linha vira texto corrido em vez de colunas. */
  empilhado?: boolean;
  /** Exercício sem carga (unidade "nenhuma"): sem a coluna Carga (`colunasDasSeries`). */
  semCarga?: boolean;
  /** O editor do bloco aberto, logo abaixo da linha dele, no PC e no celular. */
  detalhe?: ReactNode;
  /** Arrastar pela alça (arrastar, 18/11): soltar o bloco `de` na posição `para`. Sem ele, sem alça. */
  aoSoltar?: (de: number, para: number) => (() => void) | void;
  /** "Mover para cima/baixo" do ⋯ de cada linha: a alternativa sem arrastar (WCAG 2.5.7) e o caminho do teclado. */
  aoMover?: (indice: number, delta: -1 | 1) => void;
}) {
  const { cores, variante, bordas } = useTema();
  const comCarga = colunasDasSeries({ semCarga }).includes('carga');
  // Com alguma série colorida, todas as linhas e o cabeçalho ganham o recuo da faixa (as colunas continuam alinhadas).
  const recuo = linhas.some((l) => l.cor) ? LARGURA_DA_FAIXA_DA_SERIE : 0;
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
    // "6 séries · cluster": a técnica fica com a quantidade (SERIE-ABERTA 3, linha fechada).
    const series = [`${l.resumo.quantidade} ${l.resumo.quantidade === 1 ? 'série' : 'séries'}`, l.resumo.tecnica].filter(Boolean).join(' · ');
    const corDaCarga = l.cargaFalta ? { color: cores.atencao } : null;
    const ambar = { color: cores.atencao };
    const Seta = sel ? ChevronUp : ChevronDown;
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
        {/* O nome por extenso só quando diz mais que o selo ("Preparação · FS"); "Aquecimento" não se repete, e com técnica
            ele só repetiria o "· cluster" que já está embaixo do número. */}
        {l.resumo.nome && !l.resumo.tecnica && !mesmoTexto(l.resumo.nome, l.tipo) ? <Texto variante="pequeno" cor="suave">{l.resumo.nome}</Texto> : null}
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
          {comCarga ? <Texto numerico style={[estilos.carga, corDaCarga]}>{l.carga}</Texto> : null}
          <Texto numerico style={estilos.reps}>{l.resumo.repeticoes}</Texto>
          {l.resumo.semDescanso
            ? <Texto style={[estilos.descanso, estilos.semi, ambar]}>{`● ${TEXTO_FALTA_DESCANSO}`}</Texto>
            : <Texto numerico style={estilos.descanso}>{l.resumo.descanso}</Texto>}
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
            {[series, comCarga && !l.cargaFalta && l.carga !== '—' ? l.carga : null, l.resumo.repeticoes, l.resumo.semDescanso ? null : `descanso ${l.resumo.descanso}`].filter(Boolean).join(' · ')}
          </Texto>
          {comCarga && l.cargaFalta ? <Texto variante="pequeno" style={[estilos.semi, corDaCarga]}>{l.carga}</Texto> : null}
          {l.resumo.semDescanso ? <Texto variante="pequeno" style={[estilos.semi, ambar]}>{`● ${TEXTO_FALTA_DESCANSO}`}</Texto> : null}
        </View>
        {chevron}
      </View>
    );
  };
  const rotuloDe = (l: LinhaDoBloco) => [
    textoAcessivelDoBloco(l.rotulo, l.resumo),
    !comCarga ? null : l.cargaFalta ? 'falta a carga' : l.carga !== '—' ? `carga ${l.carga}` : null,
    l.problema ? TEXTO_DO_PROBLEMA[l.problema] : null,
  ].filter(Boolean).join(', ');

  const linha = (l: LinhaDoBloco, i: number) => {
    const sel = l.valor === ativa;
    // Séries pintadas (25/11, a mesma peça da tela do exercício): a fechada é um cartão na cor da série, com borda e faixa
    // reta; a aberta (Gustavo, 28/11) fica com o mesmo fundo na cor do tipo e a borda de ação (`ATIVA`, a da série da vez
    // no aluno). A camada recorta a faixa; o item não tem `overflow: hidden`, que cortaria o anel de foco da linha.
    const p = pinturaDaSerie(l.cor ?? null, sel ? 'ATIVA' : 'CHEIA', cores, variante, bordas.item);
    return (
      <View key={l.valor} testID={sel ? 'bloco-aberto' : undefined}
        style={[estilos.item, { paddingLeft: recuo }, sel ? estilos.bloco : null, fundoDaSerie(p, cores.superficie)]}>
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
        <CamadaDaSerie pintura={p} ativa={sel} raio={sel ? RAIO_DO_BLOCO : RAIO_DA_LINHA} testID={`bloco-${i + 1}`} />
      </View>
    );
  };

  const linhaNova = nova ? (
    <Pressable accessibilityRole="button" accessibilityLabel={nova.rotulo} onPress={nova.aoTocar} testID="nova-serie"
      style={(st) => [estilos.nova, { borderColor: cores.bordaCampo, backgroundColor: comMouse(st) ? cores.superficie2 : 'transparent' }]}>
      <Plus size={18} color={cores.textoSuave} strokeWidth={2} />
      <Texto style={[estilos.forte, { color: cores.textoSuave }]}>{nova.rotulo}</Texto>
    </Pressable>
  ) : null;

  if (empilhado) {
    return (
      <View style={estilos.tabela}>
        <View style={estilos.lista} role="group" aria-label="Blocos do exercício">{linhas.map(linha)}{linhaNova}</View>
        {depois ? <View style={estilos.depois}>{depois}</View> : null}
        {acoesDoMenu.length ? <FolhaDeAcoes titulo={`Série ${(menuDe ?? 0) + 1}`} aoFechar={() => setMenuDe(null)} acoes={acoesDoMenu} /> : null}
      </View>
    );
  }

  return (
    <View style={estilos.tabela}>
      {/* Cabeçalho só visual: cada linha já diz os valores no nome acessível. */}
      <View testID="cabecalho-das-series" style={[estilos.linha, estilos.cabecalho, comAlca ? estilos.cabecalhoComAlca : null, comMenu ? estilos.cabecalhoComMenu : null, { marginLeft: recuo }]} aria-hidden importantForAccessibility="no-hide-descendants">
        <Texto variante="rotulo" style={estilos.serie} testID="cabecalho-serie">Série</Texto>
        <Texto variante="rotulo" style={estilos.tipo} testID="cabecalho-tipo">Tipo</Texto>
        {comCarga ? <Texto variante="rotulo" style={estilos.carga} testID="cabecalho-carga">Carga</Texto> : null}
        <Texto variante="rotulo" style={estilos.reps} testID="cabecalho-reps">Reps</Texto>
        <Texto variante="rotulo" style={estilos.descanso} testID="cabecalho-descanso">Descanso</Texto>
        <View style={estilos.chevron} testID="cabecalho-chevron" />
      </View>
      <View style={estilos.lista} role="group" aria-label="Blocos do exercício">{linhas.map(linha)}{linhaNova}</View>
      {depois ? <View style={estilos.depois}>{depois}</View> : null}
      {acoesDoMenu.length ? <FolhaDeAcoes titulo={`Série ${(menuDe ?? 0) + 1}`} aoFechar={() => setMenuDe(null)} acoes={acoesDoMenu} /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  tabela: { gap: espaco(0.5) },
  // Cada série é um cartão (25/11): pintado na cor dela, separado das vizinhas pelo vão (o fio `divisor` saiu).
  lista: { flexDirection: 'column', width: '100%', gap: espaco(0.75) },
  item: { width: '100%', borderRadius: RAIO_DA_LINHA },
  bloco: { borderRadius: RAIO_DO_BLOCO },
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
  serie: { width: LARGURA_DA_COLUNA_SERIE, flexShrink: 0 },
  // A sobra da linha é repartida (11/11): antes ia toda para o Tipo e Carga, Reps e Descanso ficavam colados à direita.
  // O Tipo tem base própria (16/11): com base 0 ficava com ~60 px em 1280 e o selo e a variação quebravam em várias
  // linhas, com o Descanso sobrando. Tipo e Carga (os textos longos) cedem quando falta espaço.
  // Com o ⋯ de cada linha (19/11) a sobra encolheu no inspetor de 1280: o Tipo segura 140 e quem cede é a Carga.
  // Teto por coluna (26/11, ultralarga sem o teto do inspetor): passado o máximo a coluna para de crescer e a sobra fica
  // antes do chevron, que vai para a borda (`marginLeft: 'auto'`, zero enquanto as colunas ainda crescem, até 1600).
  tipo: { flexGrow: 3, flexShrink: 1, flexBasis: 150, minWidth: 140, maxWidth: MAXIMA.tipo },
  carga: { flexGrow: 3, flexShrink: 1, flexBasis: 120, minWidth: 96, maxWidth: MAXIMA.carga },
  reps: { flexGrow: 1, flexShrink: 0, flexBasis: 80, maxWidth: MAXIMA.reps },
  descanso: { flexGrow: 1, flexShrink: 0, flexBasis: 72, maxWidth: MAXIMA.descanso },
  chevron: { width: CHEVRON, flexShrink: 0, alignItems: 'center', marginLeft: 'auto' },
  titulo: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.75), flexWrap: 'wrap' },
  forte: { fontFamily: fontes.semi, fontSize: 15, lineHeight: 21, flexShrink: 1 },
  semi: { fontFamily: fontes.semi },
  empilhado: { gap: espaco(0.5), flex: 1, minWidth: 0 },
  depois: { alignItems: 'flex-start', paddingTop: espaco(0.5) },
  nova: { width: '100%', minHeight: ALTURA_DA_LINHA, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: espaco(0.75), borderWidth: 1.5, borderStyle: 'dashed', borderRadius: RAIO_DA_LINHA, paddingHorizontal: espaco(1.5) },
});
