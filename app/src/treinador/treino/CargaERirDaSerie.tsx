import { Repeat } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import type { Carga, Configuracao, ModoDeCarga, Serie } from '../../api/tipos';
import { modoDoGrupo, type GrupoDeSeries } from '../../dominio/agrupamento';
import { alterarGrupo, alterarRirDaSerie } from '../../dominio/editorTreino';
import { mascaraDeNumero } from '../../dominio/formatos';
import { papelDe } from '../../dominio/metodologia';
import { escalar } from '../../dominio/preferencias';
import { CASAS_EM_LIBRA, kgParaTela, nomeDaUnidade, telaParaKg } from '../../dominio/unidadeDeCarga';
import { mensagemDaCargaFixa, type Problemas } from '../../dominio/validacaoDeSerie';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { CampoNumerico } from '../../ui/Campos';
import { Escolha } from '../../ui/Escolha';
import { EscolhaSuspensa } from '../../ui/EscolhaSuspensa';
import { Texto } from '../../ui/Texto';
import { useUnidadeDeCarga } from '../../ui/unidadeDeCargaEmUso';
import { BotaoDeTexto } from './BotaoDeAbrir';
import { AvisoDoCampo, CampoSozinho, ErroDoCampo, useCamposLadoALado } from './CamposBasicos';
import { escolhaDeCargaDoPapel, modoAoEscolher, OPCOES_DO_RIR, percentuaisNoGrupo } from './cargaDaSerie';
import { ajudaDaCarga, problemasDoGrupoDeSeries, rotulosDaFaixa, type ProblemasDaSerie } from './opcoesDoEditor';

/**
 * A carga fixa na unidade de quem edita (kg ou lb, `useUnidadeDeCarga`): decimal com vírgula, até 2 casas em kg e 1 em libra
 * (a máscara não deixa passar a seguinte). `valor` e `aoMudar` falam sempre kg: a conversão é só da borda
 * (`kgParaTela`/`telaParaKg`), então o plano continua guardando kg. O rótulo não repete o nome da opção ("Carga fixa (kg)"),
 * para o leitor de tela não ouvir dois controles com o mesmo nome.
 */
export function CampoDaCargaFixa({ valor, aoMudar, erro, rotulo = 'Peso da carga fixa', emKg = false }: {
  valor: number | null | undefined; aoMudar: (kg: number | null) => void; erro?: string | null; rotulo?: string;
  /** A metodologia fica sempre em kg, qualquer que seja a unidade de quem vê. */
  emKg?: boolean;
}) {
  const preferida = useUnidadeDeCarga();
  const unidade = emKg ? 'kg' : preferida;
  const emLibra = unidade === 'lb';
  // A mensagem da regra (compartilhada com a API) fala do teto em kg; aqui ela sai no número que a pessoa lê.
  const mensagem = emLibra && erro === mensagemDaCargaFixa() ? mensagemDaCargaFixa(unidade) : erro;
  return <CampoSozinho>
    <CampoNumerico rotulo={rotulo} rotuloAcessivel={emLibra ? `${rotulo}, em ${nomeDaUnidade(unidade)}` : undefined} sufixo={unidade}
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

/** O RIR numa lista suspensa: "— (Não prescrito)", "0 (Falha)" e 1 a 10 (onze chips por série não caberiam em 390 px). */
export function EscolhaDoRir({ rotulo, valor, aoMudar, style }: {
  rotulo: string; valor: number | null; aoMudar: (rir: number | null) => void; style?: StyleProp<ViewStyle>;
}) {
  return <EscolhaSuspensa<number | null> rotulo={rotulo} opcoes={OPCOES_DO_RIR} valor={valor} aoMudar={aoMudar} style={[estilos.rir, style]} />;
}

/** A partir desta largura da faixa, "Série i" e o RIR ficam na mesma linha dos campos; abaixo, o nome em cima e o RIR embaixo. */
const LARGURA_EM_LINHA = 440;
const LARGURA_DO_PERCENTUAL = 96;
const LARGURA_DA_SERIE = 64;
const LARGURA_DO_RIR = 150;

/** Cluster em carga de trabalho: a ajuda da carga numa linha só (a base do dia, não a série anterior). */
const AJUDA_DA_CARGA_DO_CLUSTER = 'A sugestão e os percentuais saem da carga que o aluno informa para o dia, não da série anterior.';

/**
 * Faixa 3 do grupo de séries: o seletor binário da carga pelo papel e, sempre visível, uma linha por série com o % (ou a
 * carga fixa, ou "Carga de trabalho") e o RIR dela. O RIR é de cada série (`alterarRirDaSerie`) e não separa o grupo. Na
 * série de trabalho, uma alternância discreta troca o RIR pelo RPE.
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
  const trocarEsforco = () => { setUsarRpe(!rpe); aoMudar(alterarGrupo(series, g, { esforco: null }, config)); };
  const rpeDaSerie = (i: number, valor: number | null) => aoMudar(series.map((x, k) => (k === i ? { ...x, esforco: valor == null ? null : { rir: null, rpe: valor } } : x)));
  const textoDaCarga = (x: Serie): string => {
    if (modo === 'CARGA_FIXA') return x.carga?.valorKg != null ? `${kgParaTela(x.carga.valorKg, unidade)?.toLocaleString('pt-BR')} ${unidade}` : '—';
    return escolha.opcoes.find((o) => o.valor === modo)?.rotulo ?? '—';
  };
  const ajuda = semCarga ? null
    : percentual ? (papel === 'AQUECIMENTO' ? 'Em branco, o aluno não recebe sugestão de carga.' : rotulosDaFaixa('PERCENTUAL_WS', config)?.ajuda)
    : s.tecnica?.tipo === 'CLUSTER' && modo === 'CARGA_TRABALHO' ? AJUDA_DA_CARGA_DO_CLUSTER
    : modo === 'CARGA_FIXA' ? ajudaDaCarga(modo, config, unidade) : null;
  const celula = {
    serie: { width: escalar(LARGURA_DA_SERIE, fatorTexto) },
    numero: emLinha ? { width: escalar(LARGURA_DO_PERCENTUAL, fatorTexto) } : estilos.flexivel,
    texto: emLinha ? { width: 2 * escalar(LARGURA_DO_PERCENTUAL, fatorTexto) + espaco(1) } : estilos.flexivelDuplo,
    esforco: emLinha ? { flexGrow: 1, flexBasis: escalar(LARGURA_DO_RIR, fatorTexto), maxWidth: escalar(220, fatorTexto) } : estilos.esforcoEmpilhado,
  } satisfies Record<string, StyleProp<ViewStyle>>;
  const nomeDoEsforco = rpe ? 'RPE' : 'RIR';
  const medir = (e: LayoutChangeEvent) => setLargura(e.nativeEvent.layout.width);
  return <View style={estilos.bloco} onLayout={medir}>
    {semCarga ? null : <Escolha<ModoDeCarga> descricao="Forma de carga" opcoes={escolha.opcoes} valor={escolha.marcado}
      aoMudar={(m) => { if (m !== escolha.marcado) aoMudar(alterarGrupo(series, g, { modo: modoAoEscolher(papel, m) }, config)); }} />}
    <ErroDoCampo mensagem={erros['carga.modo'] ?? erros.carga} />
    {/* Os kg são do grupo: kg diferentes já separam as séries em grupos (`agrupamento`). */}
    {!semCarga && modo === 'CARGA_FIXA' ? <CampoDaCargaFixa rotulo="Carga" valor={s.carga?.valorKg} erro={erros['carga.valorKg']}
      aoMudar={(valorKg) => aoMudar(alterarGrupo(series, g, { carga: { modo: 'CARGA_FIXA', valorKg } }, config))} /> : null}
    {/* Cabeçalho das colunas, uma vez; cada campo tem o nome inteiro para o leitor de tela ("Série 2 · Mínimo (%)"). */}
    {/* No celular o RIR desce para uma linha só dele (com o próprio rótulo), para o valor caber inteiro. */}
    {emLinha || !semCarga ? <View style={estilos.linha} aria-hidden>
      {emLinha ? <Texto variante="rotulo" style={celula.serie}>Série</Texto> : null}
      {semCarga ? null : percentual ? <>
        <Texto variante="rotulo" style={celula.numero}>Mín (%)</Texto>
        <Texto variante="rotulo" style={celula.numero}>Máx (%)</Texto>
      </> : <Texto variante="rotulo" style={celula.texto}>Carga</Texto>}
      {emLinha ? <Texto variante="rotulo" style={celula.esforco}>{nomeDoEsforco}</Texto> : null}
    </View> : null}
    {g.series.map((x, j) => {
      const i = g.inicio + j;
      const n = j + 1;
      const e = porSerie[i]?.erros ?? {};
      const esforco = <View style={celula.esforco}>
        {rpe ? <CampoNumerico rotulo={`Série ${n} · RPE`} rotuloOculto={emLinha} erroSemTexto valor={x.esforco?.rpe ?? null} erro={e['esforco.rpe']} aoMudar={(v) => rpeDaSerie(i, v)} />
          : <EscolhaDoRir rotulo={`Série ${n} · RIR`} valor={x.esforco?.rir ?? null} aoMudar={(rir) => aoMudar(alterarRirDaSerie(series, i, rir))} />}
      </View>;
      const mensagens = [...new Set([e['carga.percentualMin'], e['carga.percentualMax'], rpe ? e['esforco.rpe'] : e['esforco.rir']].filter(Boolean))];
      return <View key={x.uid} style={[estilos.serie, emLinha ? null : [estilos.serieEmpilhada, { borderTopColor: cores.divisor }]]}>
        {emLinha ? null : <Texto variante="rotulo" cor={cores.texto}>Série {n}</Texto>}
        {emLinha || !semCarga ? <View style={estilos.linha}>
          {emLinha ? <Texto variante="rotulo" cor={cores.texto} style={celula.serie}>Série {n}</Texto> : null}
          {semCarga ? null : percentual ? <>
            <View style={celula.numero}><CampoNumerico rotulo={`Série ${n} · Mínimo`} rotuloAcessivel={`Série ${n} · Mínimo (%)`} rotuloOculto sufixo="%" sufixoNaCaixa erroSemTexto
              valor={x.carga?.percentualMin ?? null} erro={e['carga.percentualMin']} aoMudar={(min) => aoMudar(percentuaisNoGrupo(series, g, j, min, x.carga?.percentualMax ?? null, config))} /></View>
            <View style={celula.numero}><CampoNumerico rotulo={`Série ${n} · Máximo`} rotuloAcessivel={`Série ${n} · Máximo (%)`} rotuloOculto sufixo="%" sufixoNaCaixa erroSemTexto
              valor={x.carga?.percentualMax ?? null} erro={e['carga.percentualMax']} aoMudar={(max) => aoMudar(percentuaisNoGrupo(series, g, j, x.carga?.percentualMin ?? null, max, config))} /></View>
          </> : <Texto numerico cor={cores.texto} style={[celula.texto, estilos.textoDaCarga]}>{textoDaCarga(x)}</Texto>}
          {emLinha ? esforco : null}
        </View> : null}
        {emLinha ? null : esforco}
        {mensagens.map((m) => <ErroDoCampo key={m} mensagem={m} />)}
        <AvisoDoCampo mensagem={porSerie[i]?.avisos['esforco.rir']} />
      </View>;
    })}
    {ajuda ? <Texto variante="pequeno">{ajuda}</Texto> : null}
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
  flexivel: { flex: 1, minWidth: 0 },
  flexivelDuplo: { flex: 2, minWidth: 0 },
  esforcoEmpilhado: { alignSelf: 'stretch' },
  textoDaCarga: { paddingVertical: espaco(1) },
  // Na linha da série a lista do RIR tem a altura das caixas de número.
  rir: { minHeight: 44 },
});
