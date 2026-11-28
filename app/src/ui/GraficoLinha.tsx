import { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgTexto } from 'react-native-svg';

import { faixasSobrePontos, type FaixaDoGrafico } from '../dominio/cicloMenstrual';
import { caminhoReto, caminhoSuave, fracaoNoEixo, marcasDaEscala, marcasDoEixo } from '../dominio/grafico';
import { escalar } from '../dominio/preferencias';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes } from '../tema/tokens';
import { Texto } from './Texto';

export interface PontoGrafico {
  rotulo: string;
  valor: number;
  /** Data ISO, para alinhar as faixas do ciclo atrás da linha. */
  data?: string;
}

/** Segunda série do mesmo gráfico (esquerdo ao lado do direito, por exemplo): tracejada, com pontos vazados. */
export interface SerieDoGrafico {
  pontos: PontoGrafico[];
  cor: string;
  rotulo: string;
}

type QualSerie = 'A' | 'B';

/**
 * Linha do balão: texto simples ou com uma parte pintada (`texto` na `cor`, `depois` neutro), como a variação do peso
 * ("▲ +1,3 kg" na cor da meta e " desde 16/03" na cor do texto). A cor vem da tela; o gráfico não decide nada.
 */
export type LinhaDaDica = string | { texto: string; cor?: string; depois?: string };

const textoDaLinha = (l: LinhaDaDica) => (typeof l === 'string' ? l : `${l.texto}${l.depois ?? ''}`);

/**
 * Na web, o Enter num `role="button"` chega ao `onPress` como clique sintético (`detail` 0) e o soltar da tecla como o
 * próprio evento de teclado; clique do mouse e toque têm `detail` ≥ 1, e no celular o evento não traz nenhum dos dois.
 */
const veioDoTeclado = (e: unknown) => {
  const ev = e as { key?: string; nativeEvent?: { detail?: number } } | null | undefined;
  return !!ev && ('key' in ev || ev.nativeEvent?.detail === 0);
};

interface CentroDoPonto { cx: number; cy: number }

/**
 * Área de toque de um ponto: `ALVO_TOQUE` (44 px) em volta do centro; o desenho do ponto não muda. Dois alvos que se
 * sobreporiam (pontos a menos de 44 px) dividem o espaço no meio do caminho entre os centros, no eixo em que estão mais
 * afastados, e o toque cai sempre no ponto mais próximo (sem isso o último da lista cobriria o anterior e o ponteiro
 * pegaria o ponto ~22 px à direita). `ordenados` está na ordem do eixo (por `cx`), então a busca por vizinhos para cedo.
 * Pontos exatamente no mesmo lugar não se dividem (o de baixo na ordem continua só no teclado e no leitor de tela).
 */
function areaDeToque(ordenados: CentroDoPonto[], i: number) {
  const a = ordenados[i];
  const meio = ALVO_TOQUE / 2;
  const area = { esq: a.cx - meio, dir: a.cx + meio, topo: a.cy - meio, base: a.cy + meio };
  const cortar = (o: CentroDoPonto) => {
    const dx = o.cx - a.cx;
    const dy = o.cy - a.cy;
    if (Math.abs(dy) >= ALVO_TOQUE || (dx === 0 && dy === 0)) return;
    if (Math.abs(dx) >= Math.abs(dy)) {
      if (dx > 0) area.dir = Math.min(area.dir, a.cx + dx / 2);
      else area.esq = Math.max(area.esq, a.cx + dx / 2);
    } else if (dy > 0) area.base = Math.min(area.base, a.cy + dy / 2);
    else area.topo = Math.max(area.topo, a.cy + dy / 2);
  };
  for (let j = i - 1; j >= 0 && a.cx - ordenados[j].cx < ALVO_TOQUE; j--) cortar(ordenados[j]);
  for (let j = i + 1; j < ordenados.length && ordenados[j].cx - a.cx < ALVO_TOQUE; j++) cortar(ordenados[j]);
  return { left: area.esq, top: area.topo, width: area.dir - area.esq, height: area.base - area.topo };
}

const ALTURA_BASE = 240;
const MARGEM_BASE = { topo: 14, base: 24, esq: 58, dir: 18 };
const LARGURA_DICA = 120;
/** Balão com mais de uma linha (texto da tela ou duas séries): cabe "01/09/2026 · 87,0 cm" e a referência. */
const LARGURA_DICA_LARGA = 208;
const LINHA_DICA = 16;
const ESPACO_DICA = 12;
const MARGEM_SEGURA = 4;
const TRACEJADO = '6 4';

/**
 * Gráfico de linha (SVG): curva suave com a área abaixo preenchida, pontos nos registros e eixo vertical com a
 * unidade ("82 kg"). O eixo horizontal acompanha a data quando todo ponto a traz; sem data, o espaço segue a lista.
 * Pontos já na ordem do eixo; só desenha o que foi registrado. A linha é da cor do texto, nunca da marca (a marca não
 * é dado); `cor` troca só a curva, a área e os pontos, para o gráfico acompanhar a tabela da mesma medida (o azul de
 * indicador, cores-de-destaque D12). Rótulos e eixo continuam neutros, e a série segue legível sem a cor
 * (rótulo das datas, pontos e "Último…"). Ao passar o mouse, tocar ou focar cada ponto, exibe o balão com o valor e a
 * data; o teclado anda pelos pontos com as setas (Home e End nas pontas) e o Esc fecha o balão. O balão é painel
 * flutuante (`superficie` + borda `borda`, 4.3 do design-e-front) com o texto na cor do texto; só a parte de uma linha
 * que a tela pinta (`LinhaDaDica.cor`, a variação do peso pela meta) e o ponto em foco (`corDoPonto`) levam cor.
 * `semUltimo`: quem já mostra o resumo "Último…" acima não repete a linha de baixo.
 *
 * Opcionais do guia de peso e avaliação (avaliacao-fisica-visual D4, D5, D7; peso-visual D4), todos desligados por
 * padrão: `segmentos="retos"`, `semArea`, `serieB` (tracejada, mesma escala e mesmo eixo de datas, legenda em texto),
 * `textoDaDica`, `legendaDaEscala` (que também rotula as duas pontas do eixo) e `destacarUltimo`.
 */
export function GraficoLinha({
  pontos, unidade, descricao, semUltimo, faixas, escala, cor, larguraInicial = 0,
  segmentos = 'suaves', semArea, serieB, rotuloA, textoDaDica, faladoDaDica, corDoPonto, legendaDaEscala, destacarUltimo, deslocamentoDoPonto,
}: {
  pontos: PontoGrafico[]; unidade: string; descricao: string; semUltimo?: boolean; faixas?: FaixaDoGrafico[];
  /** Cor da série (curva, área e pontos), com contraste de 3:1 sobre a superfície do cartão. Sem ela, a cor do texto. */
  cor?: string;
  /** Escala fixa (a NOTA de 1 a 5, por exemplo): o eixo vai do mínimo ao máximo dela, com as duas pontas marcadas. Sem ela, o eixo se ajusta aos pontos. */
  escala?: { min: number; max: number };
  /** Largura inicial (útil para testes ou renderização direta). */
  larguraInicial?: number;
  /** `retos` liga os pontos por segmentos retos, sem sugerir valores entre as datas medidas. */
  segmentos?: 'suaves' | 'retos';
  /** Sem o preenchimento sob a linha. */
  semArea?: boolean;
  /** Segunda série (no máximo duas). Data sem valor fica fora da lista: nunca é interpolada. */
  serieB?: SerieDoGrafico;
  /** Nome da série principal na legenda e no rótulo dos pontos; passe junto com `serieB`. */
  rotuloA?: string;
  /** Linhas do balão (data, valor, referência da diferença), montadas pela tela. Sem ela, "data · valor". */
  textoDaDica?: (ponto: PontoGrafico, indice: number, serie: QualSerie) => LinhaDaDica[];
  /** O que o leitor de tela ouve no lugar das linhas (sem "▲", com "subiu"); sem ela, as linhas juntas. */
  faladoDaDica?: (ponto: PontoGrafico, indice: number, serie: QualSerie) => string;
  /** Cor do miolo do ponto em foco (o anel continua na cor da série); `undefined` mantém a da série. */
  corDoPonto?: (ponto: PontoGrafico, indice: number, serie: QualSerie) => string | undefined;
  /** Texto pequeno abaixo do gráfico; liga também o rótulo das duas pontas. Passe `escala` com os mesmos números do texto. */
  legendaDaEscala?: string;
  /** Destaque discreto (raio e anel maiores, sem cor nova) no último ponto de cada série. */
  destacarUltimo?: boolean;
  /**
   * Afastamento horizontal (px) do marcador e do alvo de toque de um ponto, sem mexer na linha: dois pontos no mesmo lugar
   * (direito = esquerdo, `dominio/ladosDoGrafico`) aparecem lado a lado em vez de um cobrir o outro. Sem ela, nenhum.
   */
  deslocamentoDoPonto?: (serie: QualSerie, indice: number) => number;
}) {
  const { cores, fatorTexto } = useTema();
  const linha = cor ?? cores.texto;
  // Os rótulos do eixo acompanham o tamanho do texto; margens e altura crescem junto para não cortar.
  const fonte = escalar(11, fatorTexto);
  const MARGEM = { ...MARGEM_BASE, base: escalar(MARGEM_BASE.base, fatorTexto), esq: escalar(MARGEM_BASE.esq, fatorTexto) };
  const ALTURA = ALTURA_BASE + (MARGEM.base - MARGEM_BASE.base);
  const [largura, setLargura] = useState(larguraInicial);
  const [ativo, setAtivo] = useState<string | null>(null);
  const [medida, setMedida] = useState<{ texto: string; altura: number } | null>(null);
  const alvosNaTela = useRef<Record<string, { focus?: () => void } | null>>({});
  const aoMedir = (e: LayoutChangeEvent) => setLargura(e.nativeEvent.layout.width);
  if (pontos.length === 0) return null;

  const pontosB = serieB?.pontos ?? [];
  const todos = pontosB.length > 0 ? [...pontos, ...pontosB] : pontos;
  const valores = todos.map((p) => p.valor);
  const folga = Math.max((Math.max(...valores) - Math.min(...valores)) * 0.15, 0.5);
  // Com escala, o eixo é o dela; um ponto fora (escala trocada pelo treinador) alarga o eixo em vez de sumir do desenho.
  const min = escala ? Math.min(escala.min, ...valores) : Math.min(...valores) - folga;
  const max = escala ? Math.max(escala.max, ...valores) : Math.max(...valores) + folga;
  const w = Math.max(largura, 1);
  const areaW = w - MARGEM.esq - MARGEM.dir;
  const areaH = ALTURA - MARGEM.topo - MARGEM.base;
  // Duas séries com data em todo ponto: o tempo é o da união das datas; senão cada série segue a própria lista.
  // Com uma data só na união, `fracaoNoEixo` daria 0 (tudo na coluna dos rótulos): cada série cai no meio, como numa série só.
  const pelaUniao = pontosB.length > 0 && todos.every((p) => p.data) && new Set(todos.map((p) => p.data)).size > 1;
  const xDe = (s: QualSerie, i: number) =>
    MARGEM.esq + (pelaUniao ? fracaoNoEixo(todos, s === 'A' ? i : pontos.length + i) : fracaoNoEixo(s === 'A' ? pontos : pontosB, i)) * areaW;
  const x = (i: number) => xDe('A', i);
  // Só o marcador e o alvo de toque se afastam; a linha e o eixo continuam na data.
  const xDoMarcador = (s: QualSerie, i: number) => xDe(s, i) + (deslocamentoDoPonto?.(s, i) ?? 0);
  const y = (v: number) => MARGEM.topo + (1 - (v - min) / (max - min)) * areaH;
  const marcas = escala || legendaDaEscala !== undefined ? marcasDaEscala(min, max) : marcasDoEixo(min, max);
  const tracar = segmentos === 'retos' ? caminhoReto : caminhoSuave;
  const curva = tracar(pontos.map((p, i) => ({ x: x(i), y: y(p.valor) })));
  const curvaB = tracar(pontosB.map((p, i) => ({ x: xDe('B', i), y: y(p.valor) })));
  const bandas = faixasSobrePontos(pontos, faixas ?? []);
  const meio = pontos.length <= 1 ? 12 : Math.abs(x(1) - x(0)) / 2;
  const formato = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',');
  const rotuloDaSerie = (s: QualSerie) => (pontosB.length === 0 ? undefined : s === 'A' ? rotuloA : serieB?.rotulo);

  // Datas do eixo: as da série principal; com duas séries, a união (uma data que só a B tem também aparece).
  const datasDoEixo = pontosB.length === 0
    ? pontos.map((p, i) => ({ rotulo: p.rotulo, x: x(i) }))
    : [...pontos.map((p, i) => ({ rotulo: p.rotulo, x: x(i) })), ...pontosB.map((p, i) => ({ rotulo: p.rotulo, x: xDe('B', i) }))]
        .sort((a, b) => a.x - b.x)
        .filter((d, i, lista) => i === 0 || d.rotulo !== lista[i - 1].rotulo || Math.abs(d.x - lista[i - 1].x) > 0.5);
  const passoRotulo = Math.max(1, Math.ceil(datasDoEixo.length / Math.max(Math.floor(areaW / 72), 1)));

  // Alvos de toque e de teclado, na ordem do eixo (A antes de B na mesma data): as setas andam nesta ordem.
  const alvos = [
    ...pontos.map((p, i) => ({ chave: `A${i}`, serie: 'A' as QualSerie, i, p, cx: xDoMarcador('A', i), cy: y(p.valor) })),
    ...pontosB.map((p, i) => ({ chave: `B${i}`, serie: 'B' as QualSerie, i, p, cx: xDoMarcador('B', i), cy: y(p.valor) })),
  ].sort((a, b) => a.cx - b.cx || (a.serie < b.serie ? -1 : a.serie > b.serie ? 1 : 0));
  const areasDeToque = alvos.map((_, i) => areaDeToque(alvos, i));
  const atual = alvos.find((a) => a.chave === ativo) ?? null;
  // Uma parada só do Tab (tabindex móvel): o ponto ativo, senão o mais recente da série principal.
  const paradaDoTab = atual?.chave ?? `A${pontos.length - 1}`;

  const valorComUnidade = (v: number) => `${formato(v)}${unidade ? ` ${unidade}` : ''}`;
  const prefixo = (s: QualSerie) => (rotuloDaSerie(s) ? `${rotuloDaSerie(s)} · ` : '');
  const linhasDaDica: LinhaDaDica[] = !atual
    ? []
    : textoDaDica
      ? textoDaDica(atual.p, atual.i, atual.serie)
      : [`${prefixo(atual.serie)}${atual.p.rotulo ? `${atual.p.rotulo} · ` : ''}${valorComUnidade(atual.p.valor)}`];
  const textoDaDicaJunto = linhasDaDica.map(textoDaLinha).join('. ');
  const faladoJunto = atual && faladoDaDica ? faladoDaDica(atual.p, atual.i, atual.serie) : textoDaDicaJunto;
  const larga = !!textoDaDica || pontosB.length > 0;
  const larguraDica = Math.min(escalar(larga ? LARGURA_DICA_LARGA : LARGURA_DICA, fatorTexto), w - 2 * MARGEM_SEGURA);
  const alturaEstimada = linhasDaDica.length * escalar(LINHA_DICA, fatorTexto) + 10;
  const alturaDica = medida?.texto === textoDaDicaJunto ? medida.altura : alturaEstimada;

  const cxAtivo = atual?.cx ?? 0;
  const cyAtivo = atual?.cy ?? 0;
  // Clampa a posição horizontal para garantir que a dica nunca corte nas bordas esquerda e direita
  const maxLeft = Math.max(MARGEM_SEGURA, w - larguraDica - MARGEM_SEGURA);
  const dicaLeft = Math.max(MARGEM_SEGURA, Math.min(cxAtivo - larguraDica / 2, maxLeft));
  // Se o ponto estiver muito alto (perto do topo), posiciona a dica abaixo do ponto para não cortar no topo
  const cabeAcima = cyAtivo - alturaDica - ESPACO_DICA >= MARGEM_SEGURA;
  const dicaTop = cabeAcima ? cyAtivo - alturaDica - ESPACO_DICA : cyAtivo + ESPACO_DICA;

  const fecharSeFor = (chave: string) => setAtivo((a) => (a === chave ? null : a));
  const teclar = (posicao: number) => (e: { key: string; preventDefault?: () => void; stopPropagation?: () => void }) => {
    if (e.key === 'Escape') {
      if (ativo === null) return;
      // Fecha só o balão: a folha em volta não fecha junto.
      e.stopPropagation?.();
      e.preventDefault?.();
      setAtivo(null);
      return;
    }
    const salto = ({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<string, number>)[e.key];
    const destino = salto !== undefined ? posicao + salto : e.key === 'Home' ? 0 : e.key === 'End' ? alvos.length - 1 : null;
    if (destino === null) return;
    e.preventDefault?.();
    const alvo = alvos[Math.min(alvos.length - 1, Math.max(0, destino))];
    setAtivo(alvo.chave);
    alvosNaTela.current[alvo.chave]?.focus?.();
  };

  const circulo = (s: QualSerie, i: number, p: PontoGrafico, cx: number, total: number) => {
    const corDaSerie = s === 'A' ? linha : (serieB?.cor ?? linha);
    const selecionado = ativo === `${s}${i}`;
    const destacado = !!destacarUltimo && i === total - 1;
    // Série B com o ponto vazado: a forma também separa as séries, além do tracejado.
    const vazado = s === 'B';
    const miolo = (selecionado ? corDoPonto?.(p, i, s) : undefined) ?? (vazado ? cores.superficie : corDaSerie);
    return (
      <G key={`${s}${p.rotulo}${i}`}>
        {selecionado ? <Circle cx={cx} cy={y(p.valor)} r={10} fill={corDaSerie} fillOpacity={0.18} /> : null}
        <Circle
          cx={cx}
          cy={y(p.valor)}
          r={selecionado ? 6 : destacado ? 5.5 : 4}
          fill={miolo}
          stroke={vazado ? corDaSerie : cores.superficie}
          strokeWidth={(vazado ? 2 : selecionado ? 2 : 1.5) + (destacado ? 1 : 0)}
        />
      </G>
    );
  };

  return (
    <View onLayout={aoMedir} style={{ gap: espaco(0.5) }}>
      {largura > 0 ? (
        <View style={{ position: 'relative', width: w, height: ALTURA }}>
          {/* Só o desenho é a imagem: os pontos ficam fora dela para o leitor de tela e o teclado chegarem neles. */}
          <View accessible accessibilityRole="image" accessibilityLabel={descricao}>
            <Svg width={w} height={ALTURA} aria-hidden>
              {bandas.map((f) => (
                <Rect key={`${f.rotulo}${f.de}`} x={Math.max(MARGEM.esq, x(f.de) - meio)} y={MARGEM.topo}
                  width={Math.max(4, Math.min(w - MARGEM.dir, x(f.ate) + meio) - Math.max(MARGEM.esq, x(f.de) - meio))}
                  height={areaH} fill={f.tom} fillOpacity={0.45} />
              ))}
              {marcas.map((m) => (
                <Line key={m} x1={MARGEM.esq} x2={w - MARGEM.dir} y1={y(m)} y2={y(m)} stroke={cores.borda} strokeWidth={1} />
              ))}
              {marcas.map((m) => (
                <SvgTexto key={`t${m}`} x={MARGEM.esq - 6} y={y(m) + 4} fontSize={fonte} fill={cores.textoSuave} textAnchor="end">
                  {formato(m)} {unidade}
                </SvgTexto>
              ))}
              {semArea ? null : (
                <Path d={`${curva}L${x(pontos.length - 1)},${y(min)}L${x(0)},${y(min)}Z`} fill={linha} fillOpacity={0.08} />
              )}
              <Path d={curva} fill="none" stroke={linha} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
              {serieB && pontosB.length > 0 ? (
                <Path d={curvaB} fill="none" stroke={serieB.cor} strokeWidth={2.5} strokeDasharray={TRACEJADO} strokeLinejoin="round" />
              ) : null}
              {atual ? (
                <Line
                  x1={atual.cx}
                  x2={atual.cx}
                  y1={MARGEM.topo}
                  y2={ALTURA - MARGEM.base}
                  stroke={cores.divisor}
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
              ) : null}
              {pontos.map((p, i) => circulo('A', i, p, xDoMarcador('A', i), pontos.length))}
              {pontosB.map((p, i) => circulo('B', i, p, xDoMarcador('B', i), pontosB.length))}
              {datasDoEixo.map((d, i) =>
                i % passoRotulo === 0 || i === datasDoEixo.length - 1 ? (
                  <SvgTexto key={`r${i}`} x={d.x} y={ALTURA - 6} fontSize={fonte} fill={cores.textoSuave} textAnchor="middle">
                    {d.rotulo}
                  </SvgTexto>
                ) : null,
              )}
            </Svg>
          </View>
          {alvos.map((a, posicao) => (
            <Pressable
              key={`alvo-${a.serie}${a.p.rotulo}${a.i}`}
              ref={(no) => { alvosNaTela.current[a.chave] = no as { focus?: () => void } | null; }}
              accessibilityRole="button"
              accessibilityLabel={`${rotuloDaSerie(a.serie) ? `${rotuloDaSerie(a.serie)}, ` : ''}${a.p.rotulo}: ${formato(a.p.valor)} ${unidade}`}
              accessibilityState={{ selected: ativo === a.chave }}
              {...({ onKeyDown: teclar(posicao), ...(Platform.OS === 'web' ? { tabIndex: a.chave === paradaDoTab ? 0 : -1 } : null) } as object)}
              onHoverIn={() => setAtivo(a.chave)}
              onHoverOut={() => fecharSeFor(a.chave)}
              onFocus={() => setAtivo(a.chave)}
              onBlur={() => fecharSeFor(a.chave)}
              // Enter e Espaço só abrem; o toque e o clique alternam.
              onPress={(e) => (veioDoTeclado(e) ? setAtivo(a.chave) : setAtivo((atualmente) => (atualmente === a.chave ? null : a.chave)))}
              style={{
                position: 'absolute',
                ...areasDeToque[posicao],
                borderRadius: Math.min(areasDeToque[posicao].width, areasDeToque[posicao].height) / 2,
                cursor: 'pointer',
              }}
            />
          ))}
          {atual ? (
            <View
              pointerEvents="none"
              // Na web `summary` vira landmark sem nome a cada hover; no celular a dica é o único lugar com a linha da diferença.
              accessibilityRole={Platform.OS === 'web' ? undefined : 'summary'}
              accessibilityLabel={Platform.OS === 'web' ? undefined : faladoJunto}
              onLayout={(e) => setMedida({ texto: textoDaDicaJunto, altura: e.nativeEvent.layout.height })}
              style={[
                estilos.dica,
                {
                  width: larguraDica,
                  backgroundColor: cores.superficie,
                  borderColor: cores.borda,
                  left: dicaLeft,
                  top: dicaTop,
                },
              ]}
            >
              {larga ? (
                linhasDaDica.map((l, i) => (
                  <Texto key={i} numerico style={[estilos.textoDica, { color: cores.texto }, i > 0 ? estilos.linhaDeApoio : null]}>
                    {typeof l === 'string' ? l : (
                      <>
                        <Texto numerico style={[estilos.textoDica, estilos.parteColorida, { color: l.cor ?? cores.texto }]}>{l.texto}</Texto>
                        {l.depois ?? ''}
                      </>
                    )}
                  </Texto>
                ))
              ) : (
                <Texto numberOfLines={1} numerico style={[estilos.textoDica, { color: cores.texto }]}>
                  {textoDaLinha(linhasDaDica[0])}
                </Texto>
              )}
            </View>
          ) : null}
        </View>
      ) : (
        <View style={{ height: ALTURA }} />
      )}
      {/* O ponto que mudou é anunciado; os valores continuam na tabela da tela, nunca só aqui. */}
      <Texto style={estilos.soParaLeitor} accessibilityLiveRegion="polite">
        {faladoJunto}
      </Texto>
      {serieB && pontosB.length > 0 ? (
        <View style={estilos.legenda}>
          {[
            { rotulo: rotuloA, cor: linha, tracejada: false },
            { rotulo: serieB.rotulo, cor: serieB.cor, tracejada: true },
          ].map((s) =>
            s.rotulo ? (
              <View key={`${s.tracejada}`} style={estilos.itemDaLegenda}>
                <Svg width={28} height={12} aria-hidden>
                  <Line x1={1} x2={27} y1={6} y2={6} stroke={s.cor} strokeWidth={2.5} strokeDasharray={s.tracejada ? TRACEJADO : undefined} />
                  <Circle cx={14} cy={6} r={4} fill={s.tracejada ? cores.superficie : s.cor} stroke={s.tracejada ? s.cor : cores.superficie} strokeWidth={s.tracejada ? 2 : 1.5} />
                </Svg>
                <Texto variante="pequeno" cor={cores.texto}>{s.rotulo}</Texto>
              </View>
            ) : null,
          )}
        </View>
      ) : null}
      {bandas.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) }}>
          {[...new Map(bandas.map((f) => [f.rotulo, f.tom])).entries()].map(([rotulo, tom]) => (
            <View key={rotulo} style={{ flexDirection: 'row', alignItems: 'center', gap: espaco(0.5) }}>
              <View style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: tom }} />
              <Texto variante="pequeno">{rotulo}</Texto>
            </View>
          ))}
        </View>
      ) : null}
      {legendaDaEscala ? <Texto variante="pequeno">{legendaDaEscala}</Texto> : null}
      {semUltimo ? null : (
        <Texto variante="pequeno">
          Último: {formato(pontos[pontos.length - 1].valor)} {unidade} em {pontos[pontos.length - 1].rotulo}
        </Texto>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  dica: {
    position: 'absolute',
    paddingHorizontal: espaco(1),
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  textoDica: {
    fontFamily: fontes.semi,
    fontSize: 12,
    lineHeight: LINHA_DICA,
    textAlign: 'center',
  },
  linhaDeApoio: { fontFamily: fontes.normal },
  // A parte pintada (seta e número) fica no peso da primeira linha, como na coluna Variação da lista.
  parteColorida: { fontFamily: fontes.semi },
  soParaLeitor: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
  legenda: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espaco(2), rowGap: espaco(0.5) },
  itemDaLegenda: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.75) },
});
