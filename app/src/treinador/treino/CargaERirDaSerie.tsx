import { Repeat } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import type { Carga, Configuracao, ModoDeCarga, Serie } from '../../api/tipos';
import { modoDoGrupo, type GrupoDeSeries } from '../../dominio/agrupamento';
import { alterarGrupo, alterarRirDaSerie } from '../../dominio/editorTreino';
import { mascaraDeNumero } from '../../dominio/formatos';
import { cargaERirIguais, percentuaisEmTodas, rirEmTodas, rpeEmTodas } from '../../dominio/camposDaSerie';
import { nomeDaSerieDeTrabalho, papelDe } from '../../dominio/metodologia';
import { escalar } from '../../dominio/preferencias';
import { CASAS_EM_LIBRA, kgParaTela, nomeDaUnidade, telaParaKg, type UnidadeDeCarga } from '../../dominio/unidadeDeCarga';
import { mensagemDaCargaFixa, type Problemas } from '../../dominio/validacaoDeSerie';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { CampoNumerico, Interruptor } from '../../ui/Campos';
import { Escolha } from '../../ui/Escolha';
import { EscolhaSuspensa } from '../../ui/EscolhaSuspensa';
import { Texto } from '../../ui/Texto';
import { useUnidadeDeCarga } from '../../ui/unidadeDeCargaEmUso';
import { BotaoDeTexto } from './BotaoDeAbrir';
import { AvisoDoCampo, CampoSozinho, ErroDoCampo, useCamposLadoALado } from './CamposBasicos';
import { cargaPendente, escolhaDeCargaDoPapel, FALTA_A_CARGA, modoAoEscolher, OPCOES_DO_RIR, percentuaisNoGrupo } from './cargaDaSerie';
import { ajudaDaCarga, problemasDoGrupoDeSeries, rotulosDaFaixa, type ProblemasDaSerie } from './opcoesDoEditor';

/**
 * A carga fixa na unidade de quem edita (kg ou lb, `useUnidadeDeCarga`): decimal com vírgula, até 2 casas em kg e 1 em libra
 * (a máscara não deixa passar a seguinte). `valor` e `aoMudar` falam sempre kg: a conversão é só da borda
 * (`kgParaTela`/`telaParaKg`), então o plano continua guardando kg. O rótulo não repete o nome da opção ("Carga fixa (kg)"),
 * para o leitor de tela não ouvir dois controles com o mesmo nome.
 */
export function CampoDaCargaFixa({ valor, aoMudar, erro, rotulo = 'Peso da carga fixa', emKg = false, rotuloOculto = false }: {
  valor: number | null | undefined; aoMudar: (kg: number | null) => void; erro?: string | null; rotulo?: string;
  /** A metodologia fica sempre em kg, qualquer que seja a unidade de quem vê. */
  emKg?: boolean;
  /** Na linha da série (27/11): sem o rótulo em cima, a unidade dentro da caixa. */
  rotuloOculto?: boolean;
}) {
  const preferida = useUnidadeDeCarga();
  const unidade = emKg ? 'kg' : preferida;
  const emLibra = unidade === 'lb';
  // A mensagem da regra (compartilhada com a API) fala do teto em kg; aqui ela sai no número que a pessoa lê.
  const mensagem = emLibra && erro === mensagemDaCargaFixa() ? mensagemDaCargaFixa(unidade) : erro;
  return <CampoSozinho>
    <CampoNumerico rotulo={rotulo} rotuloAcessivel={emLibra ? `${rotulo}, em ${nomeDaUnidade(unidade)}` : undefined} sufixo={unidade} rotuloOculto={rotuloOculto} sufixoNaCaixa={rotuloOculto}
      valor={kgParaTela(valor, unidade)} mascara={(t) => mascaraDeNumero(t, emLibra ? CASAS_EM_LIBRA : 2)}
      aoMudar={(v) => aoMudar(telaParaKg(v, unidade))} erro={mensagem} />
  </CampoSozinho>;
}

/** O percentual (mínimo e máximo opcional) do padrão do tipo na metodologia; nada nas formas sem percentual. */
export function FaixaDeCarga({ carga, config, aoMudar, erros }: {
  carga: Carga | null | undefined; config: Configuracao | null; aoMudar: (min: number | null, max: number | null) => void; erros: Problemas;
}) {
  const rotulos = rotulosDaFaixa(carga?.modo, config);
  if (!rotulos) return null;
  return <View style={estilos.bloco}>
    <View style={estilos.faixa}>
      <View style={estilos.campoDaFaixa}><CampoNumerico rotulo={rotulos.minimo} sufixo="%" valor={carga?.percentualMin ?? null}
        aoMudar={(v) => aoMudar(v, carga?.percentualMax ?? null)} erro={erros.percentualMin} /></View>
      <View style={estilos.campoDaFaixa}><CampoNumerico rotulo={rotulos.maximo} sufixo="%" valor={carga?.percentualMax ?? null}
        aoMudar={(v) => aoMudar(carga?.percentualMin ?? null, v)} erro={erros.percentualMax} /></View>
    </View>
    <Texto variante="pequeno">{rotulos.ajuda}</Texto>
  </View>;
}

/** O RIR numa lista suspensa: "—" (não prescrito), "0" (até a falha) e 1 a 10 (onze chips por série não caberiam em 390 px). */
export function EscolhaDoRir({ rotulo, valor, aoMudar, style }: {
  rotulo: string; valor: number | null; aoMudar: (rir: number | null) => void; style?: StyleProp<ViewStyle>;
}) {
  return <EscolhaSuspensa<number | null> rotulo={rotulo} opcoes={OPCOES_DO_RIR} valor={valor} aoMudar={aoMudar} style={[estilos.rir, style]} />;
}

/** A partir desta largura da faixa, "Série i" e o RIR ficam na mesma linha dos campos; abaixo, o nome em cima e o RIR embaixo. */
const LARGURA_EM_LINHA = 440;
const LARGURA_DO_PERCENTUAL = 72;
const LARGURA_DA_SERIE = 64;
const LARGURA_DO_RIR = 150;

/** Cluster em carga de trabalho: a ajuda da carga numa linha só (a base do dia, não a série anterior). */
const AJUDA_DA_CARGA_DO_CLUSTER = 'A sugestão e os percentuais saem da carga que o aluno informa para o dia, não da série anterior.';

/** O texto do ⓘ do título "Carga e RIR" (27/11; era a linha de ajuda embaixo das séries). Nulo sem nada a explicar. */
export function ajudaDaCargaDoGrupo(g: GrupoDeSeries, config: Configuracao, semCarga: boolean, unidade: UnidadeDeCarga): string | null {
  if (semCarga) return null;
  const s = g.series[0];
  const papel = papelDe(config, s.tipo);
  const modo = modoDoGrupo(g);
  const escolha = escolhaDeCargaDoPapel(config, papel, modo, unidade, 'serie');
  if (escolha.marcado === 'PERCENTUAL_WS') return papel === 'AQUECIMENTO' ? 'Em branco, o aluno não recebe sugestão de carga.' : rotulosDaFaixa('PERCENTUAL_WS', config)?.ajuda ?? null;
  if (s.tecnica?.tipo === 'CLUSTER' && modo === 'CARGA_TRABALHO') return AJUDA_DA_CARGA_DO_CLUSTER;
  return modo === 'CARGA_FIXA' ? ajudaDaCarga(modo, config, unidade) : null;
}

/**
 * Faixa 3 do grupo de séries (27/11): a forma de carga pelo papel ("% da WS · Carga fixa (kg)") e, embaixo, uma linha por
 * série: "Série 1" | [mín] a [máx] % da WS (ou a carga) | RIR. Com mais de uma série, "Mesmo valor para todas" (ligado
 * quando todas estão iguais) mostra uma linha só, que vale para o grupo inteiro. O RIR é de cada série
 * (`alterarRirDaSerie`) e não separa o grupo. Na série de trabalho, uma alternância discreta troca o RIR pelo RPE.
 */
export function CargaERirDaSerie({ grupo: g, series, config, porSerie, semCarga, aoMudar }: {
  grupo: GrupoDeSeries; series: Serie[]; config: Configuracao; porSerie: readonly ProblemasDaSerie[]; semCarga: boolean; aoMudar: (novas: Serie[]) => void;
}) {
  const { cores, fatorTexto } = useTema();
  const unidade = useUnidadeDeCarga();
  const janelaLarga = useCamposLadoALado();
  const [largura, setLargura] = useState<number | null>(null);
  const emLinha = largura === null ? janelaLarga : largura >= escalar(LARGURA_EM_LINHA, fatorTexto);
  const s = g.series[0];
  const papel = papelDe(config, s.tipo);
  const modo = modoDoGrupo(g);
  const escolha = escolhaDeCargaDoPapel(config, papel, modo, unidade, 'serie');
  const percentual = !semCarga && escolha.marcado === 'PERCENTUAL_WS';
  const { erros, avisos } = problemasDoGrupoDeSeries(porSerie, g.inicio, g.series.length);
  // RPE (C10, C11): só na série de trabalho, ou onde já está gravado (continua visível e editável).
  const temRpe = g.series.some((x) => x.esforco?.rpe != null);
  const [usarRpe, setUsarRpe] = useState(temRpe);
  const podeRpe = papel === 'TRABALHO' || temRpe;
  const rpe = usarRpe && podeRpe;
  const varias = g.series.length > 1;
  const [mesmo, setMesmo] = useState(() => varias && cargaERirIguais(g));
  const todas = varias && mesmo;
  const trocarEsforco = () => { setUsarRpe(!rpe); aoMudar(alterarGrupo(series, g, { esforco: null }, config)); };
  // Ligar com valores diferentes copia a Série 1 para as outras (o aviso embaixo do interruptor diz isso antes).
  const ligarMesmo = (ligado: boolean) => {
    setMesmo(ligado);
    if (!ligado || cargaERirIguais(g)) return;
    const x = g.series[0];
    let novas = percentual ? percentuaisEmTodas(series, g, x.carga?.percentualMin ?? null, x.carga?.percentualMax ?? null, papel) : series;
    novas = x.esforco?.rpe != null ? rpeEmTodas(novas, g, x.esforco.rpe) : rirEmTodas(novas, g, x.esforco?.rir ?? null);
    aoMudar(novas);
  };
  const mudarPercentuais = (j: number, min: number | null, max: number | null) =>
    aoMudar(todas ? percentuaisEmTodas(series, g, min, max, papel) : percentuaisNoGrupo(series, g, j, min, max, config));
  const mudarRir = (i: number, rir: number | null) => aoMudar(todas ? rirEmTodas(series, g, rir) : alterarRirDaSerie(series, i, rir));
  const mudarRpe = (i: number, valor: number | null) => aoMudar(todas ? rpeEmTodas(series, g, valor)
    : series.map((x, k) => (k === i ? { ...x, esforco: valor == null ? null : { rir: null, rpe: valor } } : x)));
  const textoDaCarga = (x: Serie): string => {
    if (modo === 'CARGA_FIXA') return x.carga?.valorKg != null ? `${kgParaTela(x.carga.valorKg, unidade)?.toLocaleString('pt-BR')} ${unidade}` : '—';
    return escolha.opcoes.find((o) => o.valor === modo)?.rotulo ?? '—';
  };
  const ws = `% da ${nomeDaSerieDeTrabalho(config)}`;
  const numero = { width: escalar(LARGURA_DO_PERCENTUAL, fatorTexto) };
  const celula = {
    serie: { width: escalar(LARGURA_DA_SERIE, fatorTexto) },
    carga: emLinha ? { width: 2 * escalar(LARGURA_DO_PERCENTUAL, fatorTexto) + escalar(120, fatorTexto) } : estilos.flexivelDuplo,
    esforco: emLinha ? { width: escalar(LARGURA_DO_RIR, fatorTexto) } : estilos.esforcoEmpilhado,
  } satisfies Record<string, StyleProp<ViewStyle>>;
  const nomeDoEsforco = rpe ? 'RPE' : 'RIR';
  // Carga obrigatória ainda vazia: aviso âmbar "Falta a carga." (guia premium págs. 4 e 9), não o erro vermelho do valor inválido.
  const kgPendente = !!erros['carga.valorKg'] && cargaPendente(s, 'carga.valorKg');
  const medir = (e: LayoutChangeEvent) => setLargura(e.nativeEvent.layout.width);
  const linhas = todas ? [0] : g.series.map((_, j) => j);
  return <View style={estilos.bloco} onLayout={medir}>
    {semCarga ? null : <Escolha<ModoDeCarga> descricao="Forma de carga" compacta opcoes={escolha.opcoes} valor={escolha.marcado}
      aoMudar={(m) => { if (m !== escolha.marcado) aoMudar(alterarGrupo(series, g, { modo: modoAoEscolher(papel, m) }, config)); }} />}
    <ErroDoCampo mensagem={erros['carga.modo'] ?? erros.carga} />
    {varias ? <Interruptor rotulo="Mesmo valor para todas" valor={todas} aoMudar={ligarMesmo}
      ajuda={!todas && !cargaERirIguais(g) ? 'Ligar copia a Série 1 para as outras.' : undefined} /> : null}
    {/* Cabeçalho das colunas, uma vez; cada campo tem o nome inteiro para o leitor de tela ("Série 2 · Mínimo (%)"). */}
    {emLinha ? <View style={estilos.linha} aria-hidden>
      <Texto variante="rotulo" style={celula.serie}>Série</Texto>
      {semCarga ? null : <Texto variante="rotulo" style={celula.carga}>{percentual ? 'Carga (mín. a máx.)' : 'Carga'}</Texto>}
      <Texto variante="rotulo" style={celula.esforco}>{nomeDoEsforco}</Texto>
    </View> : null}
    {linhas.map((j) => {
      const x = g.series[j];
      const i = g.inicio + j;
      const n = j + 1;
      const nome = todas ? 'Todas as séries' : `Série ${n}`;
      const curto = todas ? 'Todas' : `Série ${n}`;
      const e = porSerie[i]?.erros ?? {};
      const esforco = <View style={celula.esforco}>
        {rpe ? <CampoNumerico rotulo={`${nome} · RPE`} rotuloOculto={emLinha} erroSemTexto valor={x.esforco?.rpe ?? null} erro={e['esforco.rpe']} aoMudar={(v) => mudarRpe(i, v)} />
          : <EscolhaDoRir rotulo={`${nome} · RIR`} valor={x.esforco?.rir ?? null} aoMudar={(rir) => mudarRir(i, rir)} />}
      </View>;
      const minPendente = !!e['carga.percentualMin'] && cargaPendente(x, 'carga.percentualMin');
      const mensagens = [...new Set([minPendente ? null : e['carga.percentualMin'], e['carga.percentualMax'], rpe ? e['esforco.rpe'] : e['esforco.rir']].filter(Boolean))];
      const carga = semCarga ? null : percentual ? <View style={[estilos.linha, celula.carga]}>
        <View style={numero}><CampoNumerico rotulo={`${nome} · Mínimo`} rotuloAcessivel={`${nome} · Mínimo (%)`} rotuloOculto erroSemTexto
          valor={x.carga?.percentualMin ?? null} erro={minPendente ? null : e['carga.percentualMin']} aoMudar={(min) => mudarPercentuais(j, min, x.carga?.percentualMax ?? null)} /></View>
        <Texto variante="suave" aria-hidden>a</Texto>
        <View style={numero}><CampoNumerico rotulo={`${nome} · Máximo`} rotuloAcessivel={`${nome} · Máximo (%)`} rotuloOculto erroSemTexto
          valor={x.carga?.percentualMax ?? null} erro={e['carga.percentualMax']} aoMudar={(max) => mudarPercentuais(j, x.carga?.percentualMin ?? null, max)} /></View>
        <Texto variante="suave" aria-hidden numberOfLines={1} style={estilos.unidade}>{ws}</Texto>
      </View>
        // Os kg são do grupo (kg diferentes separam as séries em grupos, `agrupamento`): o campo fica na primeira linha.
        : modo === 'CARGA_FIXA' && j === 0 ? <View style={celula.carga}>
          <CampoDaCargaFixa rotulo={`Carga (${unidade})`} rotuloOculto valor={s.carga?.valorKg} erro={kgPendente ? null : erros['carga.valorKg']}
            aoMudar={(valorKg) => aoMudar(alterarGrupo(series, g, { carga: { modo: 'CARGA_FIXA', valorKg } }, config))} />
        </View>
          : <Texto numerico cor={cores.texto} style={[celula.carga, estilos.textoDaCarga]}>{textoDaCarga(x)}</Texto>;
      return <View key={x.uid} style={[estilos.serie, emLinha ? null : [estilos.serieEmpilhada, { borderTopColor: cores.divisor }]]}>
        {emLinha ? null : <Texto variante="rotulo" cor={cores.texto}>{nome}</Texto>}
        <View style={estilos.linha}>
          {emLinha ? <Texto variante="rotulo" cor={cores.texto} style={celula.serie}>{curto}</Texto> : null}
          {carga}
          {emLinha ? esforco : null}
        </View>
        {emLinha ? null : esforco}
        {mensagens.map((m) => <ErroDoCampo key={m} mensagem={m} />)}
        {minPendente ? <AvisoDoCampo mensagem={`${FALTA_A_CARGA}.`} /> : null}
        {j === 0 && modo === 'CARGA_FIXA' && kgPendente ? <AvisoDoCampo mensagem={`${FALTA_A_CARGA}.`} /> : null}
        <AvisoDoCampo mensagem={porSerie[i]?.avisos['esforco.rir']} />
      </View>;
    })}
    {rpe ? <Texto variante="pequeno">RPE de 1 a 10, de meio em meio (ex.: 8 ou 8,5).</Texto> : null}
    {podeRpe ? <BotaoDeTexto Icone={Repeat} texto={rpe ? 'Prescrever por RIR' : 'Prescrever por RPE'}
      rotuloAcessivel={rpe ? 'Prescrever por RIR (apaga o RPE destas séries)' : 'Prescrever por RPE (apaga o RIR destas séries)'} aoTocar={trocarEsforco} /> : null}
    <AvisoDoCampo mensagem={avisos['carga.modo']} />
  </View>;
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(1) },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  faixa: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5), alignItems: 'flex-start' },
  campoDaFaixa: { minWidth: 130, flexGrow: 1, flexBasis: 130, maxWidth: 220 },
  serie: { gap: espaco(0.5) },
  // No celular a série ganha o nome em cima e um fio fino separa uma da outra.
  serieEmpilhada: { borderTopWidth: 1, paddingTop: espaco(1) },
  flexivelDuplo: { flex: 2, minWidth: 0 },
  esforcoEmpilhado: { alignSelf: 'stretch' },
  textoDaCarga: { paddingVertical: espaco(1) },
  unidade: { flexShrink: 1 },
  // Na linha da série a lista do RIR tem a altura das caixas de número.
  rir: { minHeight: 44 },
});
