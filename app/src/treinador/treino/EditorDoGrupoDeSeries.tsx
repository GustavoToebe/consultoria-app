import { ArrowDown, ArrowUp, CircleAlert, CircleCheck, Minus, Plus, Smartphone, Trash2, TriangleAlert, type LucideIcon } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { Configuracao, Serie } from '../../api/tipos';
import { descreverGrupo, tituloDoGrupoDeSeries, type GrupoDeSeries } from '../../dominio/agrupamento';
import { blocosValidos } from '../../dominio/blocos';
import { DESCANSO_MAXIMO_SEGUNDOS, tecnicaVazia, type AlteracaoDeGrupo } from '../../dominio/editorTreino';
import { explicacaoDoCatalogo } from '../../dominio/catalogoMetodologia';
import { podeRestPauseNaUltima, textoDaRevisaoDoEsforco } from '../../dominio/exemplosDePrescricao';
import { explicacaoDaTecnica, explicacaoDoTipo, mostraRpe, nomeDaSerieDeTrabalho, nomeDoTipo, papelDe, padraoDaTecnica, tecnicaDescritiva } from '../../dominio/metodologia';
import { previaDoGrupo, ROTULO_DA_OBSERVACAO_DA_SERIE } from '../../dominio/resumoDaSerie';
import { useTema } from '../../tema/TemaProvider';
import { BORDA_ITEM, espaco, fontes, RAIO, tingido } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { CabecalhoDeGrupo } from '../../ui/CabecalhoDeGrupo';
import { Campo } from '../../ui/Campo';
import { CampoNumerico } from '../../ui/Campos';
import { Divisor } from '../../ui/Divisor';
import { Escolha } from '../../ui/Escolha';
import { EscolhaEmFolha, OPCOES_PARA_BUSCAR } from '../../ui/EscolhaEmFolha';
import { EscolhaSuspensa } from '../../ui/EscolhaSuspensa';
import { IconeBotao } from '../../ui/IconeBotao';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { NumeroInvertido } from '../../ui/NumeroInvertido';
import type { TipoSelo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { useUnidadeDeCarga } from '../../ui/unidadeDeCargaEmUso';
import { BotaoDeAbrir } from './BotaoDeAbrir';
import { AvisoDoCampo, CampoDaCargaFixa, CampoSozinho, CamposDaTecnica, CamposDasRepeticoes, CamposDoCardio, CamposDoEsforco, ErroDoCampo, EscolhaDeCarga, FaixaDeCarga, ReferenciaDaCarga, RirDaSerie } from './CamposDaPrescricao';
import { basesDasColunas, colunasDaPrescricao, linhasDaPrescricao, type CaixaDaPrescricao } from './colunasDaPrescricao';
import { type EscolhaDeTecnica, opcoesDeReferencia, opcoesDeTecnica, problemasDoGrupoDeSeries, problemasPorSerie, referenciaDaCarga, rotulosDaFaixa, secoesDaSerie, subProblemas } from './opcoesDoEditor';

/** Nível do grupo pela validação (a mesma da publicação): erro em qualquer série do grupo, aviso, ou pronta. */
export function nivelDoGrupo(porSerie: ReturnType<typeof problemasPorSerie>, g: GrupoDeSeries): Nivel {
  for (let i = g.inicio; i < g.inicio + g.series.length; i++) if (Object.keys(porSerie[i]?.erros ?? {}).length > 0) return 'perigo';
  return Object.keys(problemasDoGrupoDeSeries(porSerie, g.inicio, g.series.length).avisos).length > 0 ? 'atencao' : 'sucesso';
}

/** Os tipos como chips pelo NOME (código só quando o tipo não está na metodologia); muitos tipos viram busca em folha. */
export function Tipos({ rotulo, opcoes, valor, aoMudar }: {
  rotulo: string; opcoes: { valor: string; rotulo: string; foraDaMetodologia: boolean }[]; valor: string | null; aoMudar: (codigo: string) => void;
}) {
  const aoEscolher = (codigo: string | null) => { if (codigo) aoMudar(codigo); };
  if (opcoes.length > OPCOES_PARA_BUSCAR) {
    return <EscolhaEmFolha rotulo={rotulo} opcoes={opcoes.map((o) => ({ valor: o.valor as string | null, rotulo: o.rotulo, detalhe: o.foraDaMetodologia ? 'Fora da metodologia' : undefined }))}
      valor={valor} aoMudar={aoEscolher} rotuloDoValor="Escolha o tipo" />;
  }
  return <Escolha rotulo={rotulo} opcoes={opcoes.map((o) => ({ valor: o.valor as string | null, rotulo: o.rotulo }))} valor={valor} aoMudar={aoEscolher} />;
}

/** "Nenhuma" e as técnicas da metodologia. Acima de oito, a mesma folha dos tipos; a de fora fica com o detalhe. */
export function Tecnicas({ rotulo, opcoes, valor, aoMudar }: {
  rotulo: string; opcoes: ReturnType<typeof opcoesDeTecnica>; valor: EscolhaDeTecnica; aoMudar: (v: EscolhaDeTecnica) => void;
}) {
  const fora = opcoes.find((o) => o.valor === valor)?.detalhe;
  // Lista suspensa com busca (como o RIR): os chips das técnicas viravam duas ou três linhas no inspetor.
  return <>
    <EscolhaSuspensa<EscolhaDeTecnica> rotulo={rotulo} opcoes={opcoes} valor={valor} aoMudar={aoMudar} style={estilos.suspensa} />
    {fora ? <Texto variante="pequeno">{fora}</Texto> : null}
  </>;
}

/** Cluster em carga de trabalho: a ajuda da carga numa linha só (no lugar da padrão e da frase sobre a série anterior). */
const AJUDA_DA_CARGA_DO_CLUSTER = 'A sugestão e os percentuais saem da carga que o aluno informa para o dia, não da série anterior.';

/**
 * Uma seção da série aberta: o título de seção (h3, 12 px em caixa alta, abaixo do título "Editando", que é `bloco`) com
 * um fio em cima, sem caixa própria. A série aberta já é a 2ª moldura (exercício › série); a seção é o 3º nível e fica
 * em divisor, não em mais uma caixa (§5.1). `primeira` dispensa o fio: a faixa do "Editando" já tem a linha dela.
 */
function Secao({ titulo, primeira, children, style }: { titulo: string; primeira?: boolean; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { cores } = useTema();
  return <View style={[estilos.secao, style]}>
    {primeira ? null : <Divisor />}
    <Texto variante="secao" nivel={3} cor={cores.texto}>{titulo}</Texto>
    {children}
  </View>;
}

/** Explicação recolhida (do tipo ou da técnica): o texto só aparece depois do "O que é?". */
function Explicacao({ texto }: { texto: string }) {
  const { cores } = useTema();
  return <View style={[estilos.explicacao, { borderLeftColor: cores.borda }]}>
    <Texto variante="suave">{texto}</Texto>
  </View>;
}

interface PropsDoGrupo {
  /** Tipo e Técnica lado a lado e o recuo maior: a coluna das séries é larga (`LARGURA_LADO_A_LADO`). */
  largo: boolean;
  /** Largura medida da coluna das séries (nula antes da 1ª medida): decide quantas caixas da prescrição vão por linha. */
  largura: number | null;
  grupo: GrupoDeSeries; series: Serie[]; config: Configuracao; cardio: boolean; semCarga: boolean; exercicioComCarga: boolean; descansoPorSerie: boolean;
  tipos: { valor: string; rotulo: string; foraDaMetodologia: boolean }[]; podeMais: boolean; primeiro: boolean; ultimo: boolean; numero: number;
  porSerie: ReturnType<typeof problemasPorSerie>;
  esforcoVeioDoPadrao: boolean; aoMover: (d: -1 | 1) => void; aoAlterar: (m: AlteracaoDeGrupo) => void;
  aoQuantidade: (n: number) => void; aoRestPauseNaUltima: () => void; aoPercentuais: (i: number, min: number | null, max: number | null) => void;
  /** RIR de uma série do grupo (`i` = posição dentro do grupo). */
  aoRir: (i: number, valor: number) => void; aoRemover: () => void;
}

/**
 * A série aberta (o grupo da aba): "Editando: Série N · tipo" com o resumo, o único selo de situação, subir, descer e
 * remover; embaixo, as seções em ordem e "Para o aluno" no fim.
 */
export function EditorGrupo({ largo, largura, grupo: g, series, config, cardio, semCarga, exercicioComCarga, descansoPorSerie, tipos, podeMais, primeiro, ultimo, numero, porSerie, esforcoVeioDoPadrao, aoMover, aoAlterar, aoQuantidade, aoRestPauseNaUltima, aoPercentuais, aoRir, aoRemover }: PropsDoGrupo) {
  const { cores, bordas, fatorTexto } = useTema();
  const unidade = useUnidadeDeCarga();
  // Explicações do tipo e da técnica começam recolhidas; o "O que é?" abre.
  const [explicarTipo, setExplicarTipo] = useState(false);
  const [explicarTecnica, setExplicarTecnica] = useState(false);
  const s = g.series[0];
  const secoes = secoesDaSerie(cardio ? 'CARDIO' : null);
  const cluster = s.tecnica?.tipo === 'CLUSTER';
  const modo = s.carga?.modo ?? 'NENHUMA';
  const { erros, avisos } = problemasDoGrupoDeSeries(porSerie, g.inicio, g.series.length);
  const nivel = nivelDoGrupo(porSerie, g);
  const explicacao = explicacaoDoTipo(config, s.tipo);
  const tecnicaTexto = s.tecnica ? (explicacaoDaTecnica(config, s.tecnica.tipo) || (tecnicaDescritiva(s.tecnica.tipo) ? explicacaoDoCatalogo(s.tecnica.tipo) : null)) : null;
  const descritiva = tecnicaDescritiva(s.tecnica?.tipo);
  const errosDaTecnica = subProblemas(erros, 'tecnica');
  const aoTecnica = (v: EscolhaDeTecnica) => aoAlterar({ tecnica: v === 'NENHUMA' ? null : tecnicaVazia(v, padraoDaTecnica(config, v)) });
  const referencias = opcoesDeReferencia(series, g.inicio, config);
  const nomeTipo = tipos.find((t) => t.valor === s.tipo)?.rotulo ?? nomeDoTipo(config, s.tipo);
  const opcoesTecnica = opcoesDeTecnica(config, s.tecnica?.tipo);
  const nomeTecnica = s.tecnica ? opcoesTecnica.find((o) => o.valor === s.tecnica?.tipo)?.rotulo ?? null : null;
  const recuo = espaco(largo ? 2.5 : 2);
  const comPercentual = modo === 'PERCENTUAL_WS' || modo === 'ACIMA_DA_ANTERIOR' || modo === 'ABAIXO_DA_REFERENCIA';
  // RIR por série (D2): só em grupo de mais de uma série com RIR (a forma é a mesma no grupo inteiro, `agrupamento`).
  const rirPorSerie = !cardio && g.series.length > 1 && s.esforco?.rir != null;
  const rires = g.series.map((x) => x.esforco?.rir ?? null);
  const rirDeCadaSerie = rirPorSerie && rires.some((v) => v !== rires[0]) ? rires.map((v) => (v === 0 ? 'falha' : v ?? '—')).join(', ') : null;
  const rirDa = (j: number) => {
    const valor = g.series[j].esforco?.rir;
    return valor == null ? null : <RirDaSerie key={`rir-${g.series[j].uid}`} numero={j + 1} valor={valor} aoMudar={(v) => aoRir(j, v)}
      erro={porSerie[g.inicio + j]?.erros['esforco.rir']} />;
  };
  const borda = nivel === 'perigo' ? cores.perigo : cores.bordaCampo;
  // Repetições, Carga, Esforço e Descanso: numa linha só, de duas em duas ou uma por linha, pela largura do corpo do grupo
  // (`colunasDaPrescricao`). Com mais de uma por linha, o percentual de cada série desce para uma linha inteira embaixo.
  const caixas: CaixaDaPrescricao[] = [
    ...(secoes.prescricao && !cluster ? ['repeticoes' as const] : []),
    ...(secoes.carga ? ['carga' as const] : []),
    ...(secoes.esforco ? ['esforco' as const] : []),
    ...(secoes.prescricao ? ['descanso' as const] : []),
  ];
  const colunas = colunasDaPrescricao(largura === null ? null : largura - 2 * bordas.item - 2 * recuo, caixas, fatorTexto);
  const cargaPorSerieEmbaixo = colunas > 1 && comPercentual;
  // A mesma base por coluna em todas as linhas: as caixas ficam alinhadas como numa grade (a linha incompleta ganha um vão).
  const bases = basesDasColunas(caixas, colunas, fatorTexto);
  const celula = (i: number): ViewStyle => ({ flexGrow: 1, flexShrink: 1, flexBasis: bases[i], minWidth: 0 });
  const cargaPorSerie = <>
    {comPercentual ? <View style={estilos.bloco}>
      {/* Uma linha por série: o percentual dela e, com RIR, o RIR dela, lado a lado (reunião de 30/10, D2). */}
      {g.series.map((x, j) => <FaixaDeCarga key={x.uid} carga={x.carga} config={config} prefixo={g.series.length > 1 ? `Série ${j + 1} · ` : ''}
        aoMudar={(min, max) => aoPercentuais(j, min, max)} erros={subProblemas(porSerie[g.inicio + j]?.erros, 'carga')} semAjuda={g.series.length > 1}
        aoLado={rirPorSerie ? rirDa(j) : undefined} />)}
      {g.series.length > 1 && rotulosDaFaixa(modo, config)?.ajuda ? <Texto variante="pequeno">{rotulosDaFaixa(modo, config)?.ajuda}</Texto> : null}
    </View> : null}
    {modo === 'ABAIXO_DA_REFERENCIA' ? <ReferenciaDaCarga opcoes={referencias} valor={s.carga?.referenciaUid} aoMudar={(referenciaUid) => aoAlterar({ carga: { referenciaUid } })} erro={erros['carga.referenciaUid']} /> : null}
  </>;
  const caixa: Record<CaixaDaPrescricao, ReactNode> = {
    repeticoes: <Secao key="repeticoes" titulo="Repetições">
      <CamposDasRepeticoes valor={s} erros={erros} rotuloVisivel={false} semRepeticoes="Sem repetições: o aluno lê a série por tempo."
        aoMudar={(r) => aoAlterar({ repsMin: r.repsMin, repsMax: r.repsMax, amrap: r.amrap })} />
    </Secao>,
    carga: <Secao key="carga" titulo="Carga">
      <EscolhaDeCarga carga={s.carga} config={config} papel={papelDe(config, s.tipo)} aoMudarModo={(m) => aoAlterar({ modo: m })} erro={erros['carga.modo'] ?? erros.carga} rotuloVisivel={false}
        ajuda={cluster && modo === 'CARGA_TRABALHO' && !semCarga ? AJUDA_DA_CARGA_DO_CLUSTER : undefined} exercicioComCarga={exercicioComCarga} />
      {/* Os kg são do grupo: kg diferentes já separam as séries em grupos (`agrupamento`). */}
      {modo === 'CARGA_FIXA' ? <CampoDaCargaFixa valor={s.carga?.valorKg} aoMudar={(valorKg) => aoAlterar({ carga: { modo: 'CARGA_FIXA', valorKg } })} erro={erros['carga.valorKg']} /> : null}
      {cargaPorSerieEmbaixo ? null : cargaPorSerie}
      <AvisoDoCampo mensagem={avisos['carga.modo']} />
    </Secao>,
    esforco: <Secao key="esforco" titulo="Esforço">
      <CamposDoEsforco esforco={s.esforco} aoMudar={(esforco) => aoAlterar({ esforco })} erros={subProblemas(erros, 'esforco')} rotulo="Esforço percebido" rotuloVisivel={false}
        semRpe={!mostraRpe(config, s.tipo, s.esforco)} variasSeries={g.series.length > 1} rirDeCadaSerie={rirDeCadaSerie} />
      {/* Sem percentual não há linha por série na carga: o RIR de cada série fica aqui, lado a lado no PC. */}
      {rirPorSerie && !comPercentual ? <View style={estilos.rires}>{g.series.map((_, j) => rirDa(j))}</View> : null}
      {cluster ? <Texto variante="pequeno">{textoDaRevisaoDoEsforco(esforcoVeioDoPadrao, nomeDoTipo(config, s.tipo))}</Texto> : null}
      <AvisoDoCampo mensagem={avisos['esforco.rir']} />
    </Secao>,
    descanso: <Secao key="descanso" titulo="Descanso">
      <CampoSozinho>
        <CampoNumerico rotulo="Descanso depois da série" inteiro sufixo="s" valor={s.descansoSegundos} aoMudar={(descansoSegundos) => aoAlterar({ descansoSegundos })}
          erro={erros.descansoSegundos ?? (s.descansoSegundos != null && s.descansoSegundos > DESCANSO_MAXIMO_SEGUNDOS ? `De 0 a ${DESCANSO_MAXIMO_SEGUNDOS} s.` : null)} />
      </CampoSozinho>
    </Secao>,
  };
  const titulo = cardio ? `Série ${numero}` : `Série ${numero} · ${tituloDoGrupoDeSeries(g, config)}`;
  return <View style={[estilos.grupo, { borderWidth: bordas.item, borderColor: borda, backgroundColor: cores.superficie }]}>
    {/* "Editando: Série 2 · Trabalho + Rest-pause" e, embaixo, os números ("3x3 - FS 50% · 70% · 85% da WS"). Na coluna estreita as ações descem uma linha, senão o título quebra palavra por palavra. */}
    <CabecalhoDeGrupo titulo={`Editando: ${titulo}`} resumo={descreverGrupo(g, config, series, { unidade })} selo={SELO_DO_NIVEL[nivel]} linha="fina"
      inicio={<NumeroInvertido numero={numero} invertido />} acoesJuntas={largo} acoes={<>
      <IconeBotao moldura Icone={ArrowUp} rotulo={`Subir série ${numero}`} desabilitado={primeiro} aoTocar={() => aoMover(-1)} />
      <IconeBotao moldura Icone={ArrowDown} rotulo={`Descer série ${numero}`} desabilitado={ultimo} aoTocar={() => aoMover(1)} />
      <IconeBotao moldura Icone={Trash2} rotulo={`Remover série ${numero}`} cor={cores.perigo} aoTocar={aoRemover} />
    </>} />
    <View style={[estilos.corpo, { padding: recuo }]}>
      {secoes.tipo ? <Secao titulo="Tipo e técnica" primeira>
        <View style={largo ? estilos.lado : estilos.empilhado}>
        <View style={[estilos.juntos, largo ? estilos.ladoMaior : null]}>
          <Tipos rotulo="Tipo da série" opcoes={tipos} valor={s.tipo} aoMudar={(tipo) => aoAlterar({ tipo })} />
          {explicacao ? <BotaoDeAbrir texto={`O que é o tipo ${nomeTipo}?`} aberto={explicarTipo} aoAlternar={() => setExplicarTipo(!explicarTipo)} /> : null}
          {explicacao && explicarTipo ? <Explicacao texto={explicacao} /> : null}
          <ErroDoCampo mensagem={erros.tipo} />
          <AvisoDoCampo mensagem={avisos.tipo} />
        </View>
        {secoes.tecnica ? <View style={[estilos.juntos, largo ? estilos.ladoMenor : null]}>
          <Tecnicas rotulo="Técnica da série" opcoes={opcoesTecnica} valor={s.tecnica?.tipo ?? 'NENHUMA'} aoMudar={aoTecnica} />
          {tecnicaTexto && nomeTecnica ? <BotaoDeAbrir texto={`O que é ${nomeTecnica}?`} aberto={explicarTecnica} aoAlternar={() => setExplicarTecnica(!explicarTecnica)} /> : null}
          {tecnicaTexto && nomeTecnica && explicarTecnica ? <Explicacao texto={tecnicaTexto} /> : null}
        </View> : null}
        </View>
        {secoes.tecnica && podeRestPauseNaUltima(g, config) ? <LinhaDeAcoes>
          <Botao rotulo="Aplicar Rest-pause só na última série" tipo="secundario" aoTocar={aoRestPauseNaUltima} />
        </LinhaDeAcoes> : null}
      </Secao> : null}

      <Secao titulo={cardio ? 'Quantidade' : 'Estrutura'} primeira={!secoes.tipo}>
        <View>
          <Texto variante="rotulo">Número de séries completas</Texto>
          <View style={estilos.contador}>
            <IconeBotao Icone={Minus} rotulo="Uma série completa a menos" desabilitado={g.series.length <= 1} aoTocar={() => aoQuantidade(g.series.length - 1)} />
            <Texto style={estilos.numero} accessibilityLabel={`${g.series.length} séries completas`}>{g.series.length}</Texto>
            <IconeBotao Icone={Plus} rotulo="Uma série completa a mais" desabilitado={!podeMais} aoTocar={() => aoQuantidade(g.series.length + 1)} />
          </View>
        </View>
        {secoes.tecnica && s.tecnica && !descritiva
          ? <CamposDaTecnica tecnica={s.tecnica} erros={errosDaTecnica} semCarga={semCarga} ws={nomeDaSerieDeTrabalho(config)} aoMudar={(tecnica) => aoAlterar({ tecnica })} />
          : null}
        {secoes.prescricao && cluster ? <ErroDoCampo mensagem={erros.repsMin} /> : null}
      </Secao>

      {colunas > 1
        ? linhasDaPrescricao(caixas, colunas).map((linha) => <View key={linha.join('-')} style={estilos.lado}>
          {bases.map((_, i) => <View key={i} style={celula(i)}>{linha[i] ? caixa[linha[i]] : null}</View>)}
        </View>)
        : caixas.map((c) => caixa[c])}
      {cargaPorSerieEmbaixo ? <Secao titulo="Carga de cada série">{cargaPorSerie}</Secao> : null}

      {secoes.alvoExtra ? <Secao titulo={ROTULO_DA_OBSERVACAO_DA_SERIE}>
        <Campo rotulo="Texto curto para o aluno (opcional)" rotuloAcessivel={`${ROTULO_DA_OBSERVACAO_DA_SERIE} (opcional)`} valor={s.alvoExtra ?? ''} maxLength={120} aoMudar={(alvoExtra) => aoAlterar({ alvoExtra })}
          erro={erros.alvoExtra} />
      </Secao> : null}

      {secoes.cardio ? <Secao titulo="Cardio">
        <CamposDoCardio cardio={s.cardio} aoMudar={(c) => aoAlterar({ cardio: c })} erros={{ ...subProblemas(erros, 'cardio'), ...(erros.cardio ? { cardio: erros.cardio } : {}) }} />
      </Secao> : null}

      <PreviaDoAluno grupo={g} series={series} config={config} semCarga={semCarga} descansoPorSerie={descansoPorSerie} nivel={nivel} />
    </View>
  </View>;
}

/**
 * "Para o aluno": o resultado final em uma linha (quantas séries completas e a estrutura), e embaixo só o que está
 * informado: carga e de onde ela sai, esforço, descanso e a observação desta série. A leitura longa da técnica fica com o
 * aluno. Pronta, é uma seção como as outras; com aviso ou erro, ganha fundo e borda na cor do estado (o selo com o
 * texto fica só no "Editando", em cima).
 */
function PreviaDoAluno({ grupo: g, series, config, semCarga, descansoPorSerie, nivel }: { grupo: GrupoDeSeries; series: Serie[]; config: Configuracao; semCarga: boolean; descansoPorSerie: boolean; nivel: Nivel }) {
  const { cores } = useTema();
  const unidade = useUnidadeDeCarga();
  const previa = previaDoGrupo(g, series, config, { semCarga, descansoPorSerie, unidade, referencia: semCarga ? null : referenciaDaCarga(series, g.inicio, config) });
  const tecnica = g.series[0].tecnica;
  // Cluster sem blocos válidos: o resumo diria só "complete os blocos"; a frase inteira fica no lugar dele.
  const incompleto = tecnica?.tipo === 'CLUSTER' && !blocosValidos(tecnica.blocos);
  const conteudo = <>
    <View style={estilos.comIcone}>
      <Smartphone size={18} color={cores.texto} />
      <Texto variante="secao" nivel={3} cor={cores.texto}>Para o aluno</Texto>
    </View>
    {incompleto
      ? <Texto>Complete os blocos para visualizar a prescrição.</Texto>
      : <Texto numerico cor={cores.texto}>{previa.resumo}</Texto>}
    {previa.linhas.map((linha) => <Texto key={linha} numerico variante="suave">{linha}</Texto>)}
  </>;
  if (nivel === 'sucesso') return <View style={estilos.secao}><Divisor />{conteudo}</View>;
  return <View style={[estilos.previa, { borderColor: cores[nivel], backgroundColor: tingido(cores[nivel], cores.superficie) }]}>{conteudo}</View>;
}

export type Nivel = 'sucesso' | 'atencao' | 'perigo';

/** Selo do grupo de séries pela validação (a mesma da publicação): pronta, com aviso ou com erro. */
export const SELO_DO_NIVEL: Record<Nivel, { texto: string; tipo: TipoSelo; Icone: LucideIcon }> = {
  sucesso: { texto: 'Pronta', tipo: 'sucesso', Icone: CircleCheck },
  atencao: { texto: 'Atenção', tipo: 'atencao', Icone: TriangleAlert },
  perigo: { texto: 'Corrigir', tipo: 'perigo', Icone: CircleAlert },
};

const estilos = StyleSheet.create({
  // A faixa do cabeçalho fica rente às bordas; o corpo tem o próprio recuo.
  grupo: { borderWidth: BORDA_ITEM, borderRadius: RAIO, overflow: 'hidden' },
  corpo: { gap: espaco(1.5) },
  secao: { gap: espaco(1.5) },
  // Esforço e Descanso lado a lado no PC; empilhados no celular.
  lado: { flexDirection: 'row', gap: espaco(1.5), alignItems: 'stretch' },
  empilhado: { gap: espaco(1.5) },
  ladoMaior: { flex: 3, minWidth: 0 },
  ladoMenor: { flex: 2, minWidth: 0 },
  juntos: { gap: espaco(0.5) },
  bloco: { gap: espaco(1) },
  rires: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5), alignItems: 'flex-start' },
  explicacao: { borderLeftWidth: 2, paddingLeft: espaco(1.5), paddingVertical: espaco(0.5) },
  comIcone: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.75) },
  previa: { borderWidth: 1, borderRadius: RAIO, padding: espaco(2), gap: espaco(0.75) },
  contador: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  numero: { fontFamily: fontes.negrito, fontSize: 18, lineHeight: 24, minWidth: 24, textAlign: 'center' },
  suspensa: { maxWidth: 320 },
});
