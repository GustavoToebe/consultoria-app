import { ArrowDown, ArrowUp, CircleAlert, CircleCheck, Minus, Plus, Smartphone, Trash2, TriangleAlert, type LucideIcon } from 'lucide-react-native';
import { type ReactNode, useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import type { Configuracao, Serie } from '../../api/tipos';
import { agrupar, descreverGrupo, tituloDoGrupoDeSeries, type GrupoDeSeries } from '../../dominio/agrupamento';
import { blocosValidos } from '../../dominio/blocos';
import { adicionarSerie, alterarEsforcoDaSerie, alterarGrupo, alterarPercentuais, DESCANSO_MAXIMO_SEGUNDOS, LIMITE_SERIES, moverGrupo, mudarQuantidade, novoExercicio, removerGrupo, tecnicaVazia, type AlteracaoDeGrupo } from '../../dominio/editorTreino';
import { explicacaoDoCatalogo } from '../../dominio/catalogoMetodologia';
import { grupoComSerie, uidDaAbaAposMudar } from '../../dominio/inspetorDoTreino';
import { assinaturaDoEsforco, marcaConfere, origemAposConteudo, origemAoTrocarTipo, podeRestPauseNaUltima, restPauseNestaSerie, textoDaContagemDeSeries, textoDaRevisaoDoEsforco, type MarcaDeOrigem } from '../../dominio/exemplosDePrescricao';
import { codigoTrabalho, esforcoInicial, explicacaoDaTecnica, explicacaoDoTipo, mostraRpe, nomeDaSerieDeTrabalho, nomeDoTipo, papelDe, padraoDaTecnica, tecnicaDescritiva, tipoPorCodigo } from '../../dominio/metodologia';
import { CONFIGURACAO_PADRAO } from '../../dominio/metodologiaPadrao';
import { previaDoGrupo, ROTULO_DA_OBSERVACAO_DA_SERIE } from '../../dominio/resumoDaSerie';
import { validarExercicio } from '../../dominio/validacaoDoTreino';
import { useTema } from '../../tema/TemaProvider';
import { BORDA_ITEM, espaco, fontes, RAIO, tingido } from '../../tema/tokens';
import { Abas } from '../../ui/Abas';
import { Botao } from '../../ui/Botao';
import { CabecalhoDeGrupo } from '../../ui/CabecalhoDeGrupo';
import { Campo } from '../../ui/Campo';
import { CampoNumerico } from '../../ui/Campos';
import { Escolha } from '../../ui/Escolha';
import { EscolhaEmFolha, OPCOES_PARA_BUSCAR } from '../../ui/EscolhaEmFolha';
import { EscolhaSuspensa } from '../../ui/EscolhaSuspensa';
import { escalar } from '../../dominio/preferencias';
import { IconeBotao } from '../../ui/IconeBotao';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Selo, type TipoSelo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { useUnidadeDeCarga } from '../../ui/unidadeDeCargaEmUso';
import { BotaoDeAbrir } from './BotaoDeAbrir';
import { AvisoDoCampo, CampoDaCargaFixa, CampoSozinho, CamposDaTecnica, CamposDasRepeticoes, CamposDoCardio, CamposDoEsforco, ErroDoCampo, EscolhaDeCarga, FaixaDeCarga, ReferenciaDaCarga, RirDaSerie, useCamposLadoALado } from './CamposDaPrescricao';
import { colunasDaPrescricao, linhasDaPrescricao, MINIMO_DA_CAIXA, type CaixaDaPrescricao } from './colunasDaPrescricao';
import {
  type EscolhaDeTecnica,
  opcoesDeReferencia,
  opcoesDeTecnica,
  opcoesDeTipo,
  referenciaDaCarga,
  problemasDoExercicioSemSeries,
  problemasDoGrupoDeSeries,
  problemasPorSerie,
  rotulosDaFaixa,
  secoesDaSerie,
  subProblemas,
} from './opcoesDoEditor';

interface Props {
  series: Serie[];
  config: Configuracao | null;
  modalidade: string | null;
  aoMudar: (series: Serie[]) => void;
  /**
   * Aba aberta controlada por quem usa (o editor de treino guarda uma por exercício, para o "ir ao primeiro" abrir a série
   * com problema): uid de uma série qualquer do grupo; nulo ou desconhecido = o primeiro grupo. Sem `aoAbrirGrupo`, o
   * componente guarda a aba sozinho (receita de séries do Planejamento).
   */
  grupoAbertoUid?: string | null;
  aoAbrirGrupo?: (serieUid: string | null) => void;
  /** Exercício sem carga (elástico, peso corporal): a prévia não fala de carga. */
  semCarga?: boolean;
  /**
   * Séries de um exercício com carga, fora do cardio: só aí a carga fixa em kg é oferecida. Falso na receita de séries,
   * que não é de um exercício (a mesma regra da metodologia).
   */
  exercicioComCarga?: boolean;
  /** `false` no grupo cujo descanso é depois da volta: a leitura não repete o descanso da série. */
  descansoPorSerie?: boolean;
  /** Número e nome do exercício: a faixa curta no topo do grupo aberto diz de qual exercício são as séries. */
  numeroDoExercicio?: number;
  nomeDoExercicio?: string;
}

/**
 * Séries do exercício: uma aba por grupo ("Série 2 · Trabalho"), o "+ Nova série" tracejado no fim da faixa e, embaixo, o
 * cartão do grupo da aba aberta. O cartão do grupo tem seções nesta ordem: tipo e técnica, estrutura (séries completas,
 * repetições e os campos da técnica), carga, esforço, descanso, observação desta série e "Para o aluno" no fim. Séries
 * iguais e seguidas formam um grupo e se editam juntas; o percentual de cada série é próprio. Cada campo mostra o erro e o
 * aviso da validação (a mesma da publicação) e a prévia diz como o aluno vai ler. Exercício de cardio só tem a prescrição de
 * cardio.
 */
export function EditorSeries({ series, config, modalidade, aoMudar: aoMudarFora, grupoAbertoUid, aoAbrirGrupo, semCarga = false, exercicioComCarga = false, descansoPorSerie = true, numeroDoExercicio, nomeDoExercicio }: Props) {
  const { cores } = useTema();
  const cfg = config ?? CONFIGURACAO_PADRAO;
  const cardio = modalidade === 'CARDIO';
  const grupos = agrupar(series);
  // Lado a lado pela largura desta coluna, não da janela: no inspetor de 1280 a janela é larga e a coluna não.
  const janelaLarga = useCamposLadoALado();
  const [largura, setLargura] = useState<number | null>(ultimaLargura);
  const largo = janelaLarga && (largura === null || largura >= LARGURA_LADO_A_LADO);
  const medir = (e: LayoutChangeEvent) => { ultimaLargura = e.nativeEvent.layout.width; setLargura(ultimaLargura); };
  const [painel, setPainel] = useState(false);
  const [tipoNovo, setTipoNovo] = useState<string | null>(null);
  const [tecnicaNova, setTecnicaNova] = useState<EscolhaDeTecnica>('NENHUMA');
  // Uma aba por grupo; quem controla é o editor de treino (D8) quando passa `aoAbrirGrupo`, mesmo antes do primeiro toque.
  const [abertoInterno, setAbertoInterno] = useState<string | null>(null);
  const controlado = aoAbrirGrupo !== undefined;

  const guardado = controlado ? grupoAbertoUid ?? null : abertoInterno;
  const grupoAberto = grupoComSerie(series, guardado);
  const uidAberto = grupoAberto?.series[0].uid ?? null;
  // Compara com o guardado, não com o exibido: nulo (ou a 2ª série do grupo) precisa virar o uid certo ao mover ou tirar séries.
  const definirAberto = (uid: string | null) => {
    if (uid === guardado) return;
    if (aoAbrirGrupo) aoAbrirGrupo(uid);
    else setAbertoInterno(uid);
  };
  /** Toda mudança nas séries passa por aqui: a aba aberta segue o grupo (ou passa ao vizinho, se ele sumiu). */
  const aoMudar = (novas: Serie[], abrir?: string | null) => {
    aoMudarFora(novas);
    definirAberto(abrir !== undefined ? abrir : uidDaAbaAposMudar(series, novas, uidAberto));
  };
  /**
   * Esforço e tipo que a metodologia preencheu nesta abertura, por uid. Não vai para o JSON. Substituição externa
   * apaga a marca; voltar ao mesmo número não a recria.
   */
  const [origemDoEsforco, setOrigemDoEsforco] = useState<ReadonlyMap<string, MarcaDeOrigem>>(() => new Map());
  const origemVigente = origemAposConteudo(origemDoEsforco, series);
  if (origemVigente !== origemDoEsforco) setOrigemDoEsforco(origemVigente);
  const cheio = series.length >= LIMITE_SERIES;
  const tipos = opcoesDeTipo(cfg, series);
  const validacao = useMemo(() => {
    const r = validarExercicio({ ...novoExercicio(), nome: 'Exercício', modalidade, series }, cfg);
    return {
      porSerieErros: problemasPorSerie(r.erros, r.avisos, series.length),
      daLista: problemasDoExercicioSemSeries(r.erros),
      avisosDaLista: problemasDoExercicioSemSeries(r.avisos),
    };
  }, [series, cfg, modalidade]);
  /** Série nova (e receita) abre a aba nova, a do último grupo (D12). */
  const doUltimo = (novas: Serie[]) => agrupar(novas).at(-1)?.series[0].uid ?? null;
  const aindaDoTipo = (s: Serie) => marcaConfere(origemVigente.get(s.uid), s);
  const gravarOrigem = (itens: readonly Serie[], ligar: boolean) => setOrigemDoEsforco((atual) => {
    const n = new Map(origemAposConteudo(atual, series));
    for (const s of itens) {
      if (ligar && (s.esforco?.rir != null || s.esforco?.rpe != null)) n.set(s.uid, { assinatura: assinaturaDoEsforco(s.esforco), tipo: s.tipo ?? null });
      else n.delete(s.uid);
    }
    return n;
  });
  const marcarNovasDoTipo = (antes: readonly Serie[], depois: readonly Serie[]) => {
    const conhecidas = new Set(antes.map((s) => s.uid));
    gravarOrigem(depois.filter((s) => !conhecidas.has(s.uid) && tipoPorCodigo(cfg, s.tipo)), true);
  };
  const adicionar = () => {
    const novas = adicionarSerie(series, cfg, tipoNovo ?? undefined, tecnicaNova === 'NENHUMA' ? null : tecnicaNova, modalidade);
    const conhecidas = new Set(series.map((s) => s.uid));
    const criadas = novas.filter((s) => !conhecidas.has(s.uid));
    const ultimo = grupos.at(-1);
    const mesmoGrupo = !!ultimo && criadas.length > 0
      && (ultimo.series[0].tipo ?? null) === (criadas[0].tipo ?? null)
      && (ultimo.series[0].tecnica?.tipo ?? null) === (criadas[0].tecnica?.tipo ?? null);
    if (mesmoGrupo) gravarOrigem(criadas, ultimo.series.every(aindaDoTipo));
    else marcarNovasDoTipo(series, novas);
    aoMudar(novas, doUltimo(novas));
    setPainel(false);
  };
  const adicionarCardio = () => {
    const novas = adicionarSerie(series, cfg, undefined, null, modalidade);
    aoMudar(novas, doUltimo(novas));
  };
  const abrirPainel = () => {
    if (!painel) { setTipoNovo(codigoTrabalho(cfg) ?? tipos[0]?.valor ?? null); setTecnicaNova('NENHUMA'); }
    setPainel(!painel);
  };
  const motivoCheio = cheio ? `O exercício já tem ${LIMITE_SERIES} séries, o máximo.` : undefined;
  const alterar = (g: GrupoDeSeries, m: AlteracaoDeGrupo) => {
    const novas = alterarGrupo(series, g, m, cfg, modalidade);
    const uids = new Set(g.series.map((s) => s.uid));
    const tocadas = novas.filter((s) => uids.has(s.uid));
    if (m.esforco !== undefined) gravarOrigem(tocadas, false);
    else if (m.tipo !== undefined && m.tipo !== (g.series[0].tipo ?? null)) {
      const tipo = tipoPorCodigo(cfg, m.tipo);
      const marcas = origemAoTrocarTipo(tocadas, tipo ? esforcoInicial(tipo, modalidade) : null);
      setOrigemDoEsforco((atual) => {
        const n = new Map(origemAposConteudo(atual, novas));
        for (const s of tocadas) n.delete(s.uid);
        if (marcas) for (const [uid, marca] of marcas) n.set(uid, marca);
        return n;
      });
    }
    aoMudar(novas);
  };
  /** RIR de uma série só (índice na lista do exercício): o grupo continua um só, e a marca de "veio do padrão" sai dela. */
  const rirDaSerie = (indice: number, valor: number) => {
    const alvo = series[indice];
    if (alvo) gravarOrigem([alvo], false);
    aoMudar(alterarEsforcoDaSerie(series, indice, valor));
  };
  const quantidade = (g: GrupoDeSeries, n: number) => {
    const novas = mudarQuantidade(series, g, n, cfg);
    const conhecidas = new Set(series.map((s) => s.uid));
    gravarOrigem(novas.filter((s) => !conhecidas.has(s.uid)), g.series.every(aindaDoTipo));
    aoMudar(novas);
  };
  const iAberto = grupoAberto ? grupos.findIndex((g) => g.series[0].uid === uidAberto) : -1;
  const g = iAberto >= 0 ? grupos[iAberto] : null;
  const rotuloDaNova = cardio ? 'Novo cardio' : 'Nova série';
  const aoNova = cardio ? adicionarCardio : abrirPainel;
  const nova = <Botao rotulo={rotuloDaNova} tipo="secundario" Icone={Plus} desabilitado={cheio} motivo={motivoCheio} aoTocar={aoNova} />;
  return <View style={estilos.lista} onLayout={medir}>
    {grupos.length > 0 ? <Abas variante="invertida" fundo={cores.superficie} ativa={uidAberto ?? grupos[0].series[0].uid} aoMudar={definirAberto}
      abas={grupos.map((x, i) => ({
        valor: x.series[0].uid,
        rotulo: `Série ${i + 1}${cardio ? '' : ` · ${tipos.find((t) => t.valor === x.series[0].tipo)?.rotulo ?? nomeDoTipo(cfg, x.series[0].tipo)}`}`,
        detalhe: detalheDaAba(x),
        problema: problemaDaAba(nivelDoGrupo(validacao.porSerieErros, x)),
      }))}
      // Cheio, o botão sai da faixa: desabilitado ele perdia o tracejado e o motivo ficava escondido dentro da rolagem.
      depois={cheio ? undefined : <Botao rotulo={rotuloDaNova} tipo="secundario" Icone={Plus} style={estilos.tracejado} aoTocar={aoNova} />} />
      : <View style={estilos.vazio}>
        <Texto variante="suave">Nenhuma série ainda.</Texto>
        <LinhaDeAcoes>{nova}</LinhaDeAcoes>
      </View>}
    {grupos.length > 0 && cheio ? <LinhaDeAcoes>{nova}</LinhaDeAcoes> : null}
    <ErroDoCampo mensagem={validacao.daLista.series} />
    <AvisoDoCampo mensagem={validacao.avisosDaLista.series} />
    {/* Bloco próprio, para não se confundir com os campos do grupo aberto; o "Nova série" da faixa abre e fecha. */}
    {painel && !cardio ? <View style={[estilos.painel, { borderColor: cores.borda, backgroundColor: cores.superficie2 }]}>
      <Texto variante="bloco">Nova série</Texto>
      <Tipos rotulo="Tipo da série" opcoes={tipos} valor={tipoNovo} aoMudar={setTipoNovo} />
      <Texto variante="pequeno">O tipo diz para que a série serve. A técnica diz como executar.</Texto>
      <Tecnicas rotulo="Técnica" opcoes={opcoesDeTecnica(cfg)} valor={tecnicaNova} aoMudar={setTecnicaNova} />
      <LinhaDeAcoes>
        <Botao rotulo="Adicionar série" tipo="secundario" Icone={Plus} aoTocar={adicionar} desabilitado={cheio || !tipoNovo} motivo={motivoCheio ?? (!tipoNovo ? 'Escolha o tipo da série.' : undefined)} />
        <Botao rotulo="Cancelar" tipo="fantasma" aoTocar={() => setPainel(false)} />
      </LinhaDeAcoes>
    </View> : null}
    {g ? <EditorGrupo key={g.series[0].uid} largo={largo} largura={largura} grupo={g} series={series} config={cfg} cardio={cardio} semCarga={semCarga} exercicioComCarga={exercicioComCarga} descansoPorSerie={descansoPorSerie}
      tipos={tipos} podeMais={!cheio} primeiro={iAberto === 0} ultimo={iAberto === grupos.length - 1} numero={iAberto + 1}
      exercicio={numeroDoExercicio != null ? `Exercício ${numeroDoExercicio} · ${nomeDoExercicio?.trim() || 'sem nome'}` : null}
      porSerie={validacao.porSerieErros}
      esforcoVeioDoPadrao={g.series.length > 0 && g.series.every(aindaDoTipo)}
      aoMover={(d) => aoMudar(moverGrupo(series, iAberto, d))}
      aoAlterar={(m) => alterar(g, m)}
      aoQuantidade={(n) => quantidade(g, n)}
      aoRestPauseNaUltima={() => aoMudar(restPauseNestaSerie(series, g, cfg))}
      aoPercentuais={(j, min, max) => aoMudar(alterarPercentuais(series, g.inicio + j, min, max))}
      aoRir={(j, valor) => rirDaSerie(g.inicio + j, valor)}
      aoRemover={() => aoMudar(removerGrupo(series, g))} /> : null}
    <Texto variante="pequeno">{textoDaContagemDeSeries(series.length)}</Texto>
  </View>;
}

/** "3 séries": quantas séries completas o grupo tem, quando são mais de uma (o tipo já está no rótulo da aba). */
function detalheDaAba(g: GrupoDeSeries): string | undefined {
  return g.series.length > 1 ? `${g.series.length} séries` : undefined;
}

function problemaDaAba(nivel: Nivel): 'perigo' | 'atencao' | undefined {
  return nivel === 'sucesso' ? undefined : nivel;
}

/** Nível do grupo pela validação (a mesma da publicação): erro em qualquer série do grupo, aviso, ou pronta. */
function nivelDoGrupo(porSerie: ReturnType<typeof problemasPorSerie>, g: GrupoDeSeries): Nivel {
  for (let i = g.inicio; i < g.inicio + g.series.length; i++) if (Object.keys(porSerie[i]?.erros ?? {}).length > 0) return 'perigo';
  return Object.keys(problemasDoGrupoDeSeries(porSerie, g.inicio, g.series.length).avisos).length > 0 ? 'atencao' : 'sucesso';
}

/** Os tipos como chips pelo NOME (código só quando o tipo não está na metodologia); muitos tipos viram busca em folha. */
function Tipos({ rotulo, opcoes, valor, aoMudar }: {
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
function Tecnicas({ rotulo, opcoes, valor, aoMudar }: {
  rotulo: string; opcoes: ReturnType<typeof opcoesDeTecnica>; valor: EscolhaDeTecnica; aoMudar: (v: EscolhaDeTecnica) => void;
}) {
  const fora = opcoes.find((o) => o.valor === valor)?.detalhe;
  // Lista suspensa com busca (como o RIR): os chips das técnicas viravam duas ou três linhas no inspetor.
  return <>
    <EscolhaSuspensa<EscolhaDeTecnica> rotulo={rotulo} opcoes={opcoes} valor={valor} aoMudar={aoMudar} style={estilos.suspensa} />
    {fora ? <Texto variante="pequeno">{fora}</Texto> : null}
  </>;
}

/**
 * A partir desta largura da coluna das séries, Tipo e Técnica ficam lado a lado e o "Mover grupo" tem texto: 1440 e 1024
 * cabem; o inspetor de 1280 (uns 560 px) empilha. Repetições, Carga, Esforço e Descanso seguem `colunasDaPrescricao`.
 */
const LARGURA_LADO_A_LADO = 640;
/**
 * Última largura medida: o cartão do exercício remonta ao trocar de exercício, e todos têm a mesma largura (sem piscar).
 * shortcut: na 1ª montagem ainda não há medida e vale a janela (`useCamposLadoALado`), um quadro só; se piscar, medir mais acima.
 */
let ultimaLargura: number | null = null;

/** Cluster em carga de trabalho: a ajuda da carga numa linha só (no lugar da padrão e da frase sobre a série anterior). */
const AJUDA_DA_CARGA_DO_CLUSTER = 'A sugestão e os percentuais saem da carga que o aluno informa para o dia, não da série anterior.';

/**
 * Uma seção do cartão do grupo: título de seção (h3, 12 px em caixa alta, abaixo do título do grupo, que é `bloco`)
 * numa caixinha própria. O espaço entre as caixinhas é o do corpo do cartão.
 */
function Secao({ titulo, children, style }: { titulo: string; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { cores } = useTema();
  // PC: cada seção é uma caixinha (`superficie2` com borda fina) dentro da série aberta (protótipo de 30/10). Celular: só
  // o título com um fio em cima, para não virar o 3º nível de moldura (exercício > grupo de séries > seção) em 390 px.
  const caixa = useCamposLadoALado();
  return <View style={[estilos.secao, caixa ? [estilos.poco, { backgroundColor: cores.superficie2, borderColor: cores.divisor }] : [estilos.plana, { borderTopColor: cores.divisor }], style]}>
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
  /** Campos curtos lado a lado e "Mover grupo" com texto: a coluna das séries é larga (`LARGURA_LADO_A_LADO`). */
  largo: boolean;
  /** Largura medida da coluna das séries (nula antes da 1ª medida): decide quantas caixas da prescrição vão por linha. */
  largura: number | null;
  grupo: GrupoDeSeries; series: Serie[]; config: Configuracao; cardio: boolean; semCarga: boolean; exercicioComCarga: boolean; descansoPorSerie: boolean;
  tipos: { valor: string; rotulo: string; foraDaMetodologia: boolean }[]; podeMais: boolean; primeiro: boolean; ultimo: boolean; numero: number;
  /** "Exercício 2 · Supino reto", na faixa curta do topo do grupo aberto; nulo sem ela. */
  exercicio: string | null;
  porSerie: ReturnType<typeof problemasPorSerie>;
  esforcoVeioDoPadrao: boolean; aoMover: (d: -1 | 1) => void; aoAlterar: (m: AlteracaoDeGrupo) => void;
  aoQuantidade: (n: number) => void; aoRestPauseNaUltima: () => void; aoPercentuais: (i: number, min: number | null, max: number | null) => void;
  /** RIR de uma série do grupo (`i` = posição dentro do grupo). */
  aoRir: (i: number, valor: number) => void; aoRemover: () => void;
}

function EditorGrupo({ largo, largura, grupo: g, series, config, cardio, semCarga, exercicioComCarga, descansoPorSerie, tipos, podeMais, primeiro, ultimo, numero, exercicio, porSerie, esforcoVeioDoPadrao, aoMover, aoAlterar, aoQuantidade, aoRestPauseNaUltima, aoPercentuais, aoRir, aoRemover }: PropsDoGrupo) {
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
  const naLinha = (c: CaixaDaPrescricao): StyleProp<ViewStyle> => colunas > 1 ? { flexGrow: 1, flexShrink: 1, flexBasis: escalar(MINIMO_DA_CAIXA[c], fatorTexto), minWidth: 0 } : null;
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
    repeticoes: <Secao key="repeticoes" titulo="Repetições" style={naLinha('repeticoes')}>
      <CamposDasRepeticoes valor={s} erros={erros} rotuloVisivel={false} semRepeticoes="Sem repetições: o aluno lê a série por tempo."
        aoMudar={(r) => aoAlterar({ repsMin: r.repsMin, repsMax: r.repsMax, amrap: r.amrap })} />
    </Secao>,
    carga: <Secao key="carga" titulo="Carga" style={naLinha('carga')}>
      <EscolhaDeCarga carga={s.carga} config={config} papel={papelDe(config, s.tipo)} aoMudarModo={(m) => aoAlterar({ modo: m })} erro={erros['carga.modo'] ?? erros.carga} rotuloVisivel={false}
        ajuda={cluster && modo === 'CARGA_TRABALHO' && !semCarga ? AJUDA_DA_CARGA_DO_CLUSTER : undefined} exercicioComCarga={exercicioComCarga} />
      {/* Os kg são do grupo: kg diferentes já separam as séries em grupos (`agrupamento`). */}
      {modo === 'CARGA_FIXA' ? <CampoDaCargaFixa valor={s.carga?.valorKg} aoMudar={(valorKg) => aoAlterar({ carga: { modo: 'CARGA_FIXA', valorKg } })} erro={erros['carga.valorKg']} /> : null}
      {cargaPorSerieEmbaixo ? null : cargaPorSerie}
      <AvisoDoCampo mensagem={avisos['carga.modo']} />
    </Secao>,
    esforco: <Secao key="esforco" titulo="Esforço" style={naLinha('esforco')}>
      <CamposDoEsforco esforco={s.esforco} aoMudar={(esforco) => aoAlterar({ esforco })} erros={subProblemas(erros, 'esforco')} rotulo="Esforço percebido" rotuloVisivel={false}
        semRpe={!mostraRpe(config, s.tipo, s.esforco)} variasSeries={g.series.length > 1} rirDeCadaSerie={rirDeCadaSerie} />
      {/* Sem percentual não há linha por série na carga: o RIR de cada série fica aqui, lado a lado no PC. */}
      {rirPorSerie && !comPercentual ? <View style={estilos.rires}>{g.series.map((_, j) => rirDa(j))}</View> : null}
      {cluster ? <Texto variante="pequeno">{textoDaRevisaoDoEsforco(esforcoVeioDoPadrao, nomeDoTipo(config, s.tipo))}</Texto> : null}
      <AvisoDoCampo mensagem={avisos['esforco.rir']} />
    </Secao>,
    descanso: <Secao key="descanso" titulo="Descanso" style={naLinha('descanso')}>
      <CampoSozinho>
        <CampoNumerico rotulo="Descanso depois da série" inteiro sufixo="s" valor={s.descansoSegundos} aoMudar={(descansoSegundos) => aoAlterar({ descansoSegundos })}
          erro={erros.descansoSegundos ?? (s.descansoSegundos != null && s.descansoSegundos > DESCANSO_MAXIMO_SEGUNDOS ? `De 0 a ${DESCANSO_MAXIMO_SEGUNDOS} s.` : null)} />
      </CampoSozinho>
    </Secao>,
  };
  return <View style={[estilos.grupo, { borderWidth: bordas.item, borderColor: borda, backgroundColor: cores.superficie }]}>
    {/* "Editando: Série 2" com o tipo como o treinador lê ("Trabalho · WS") e os números ("3x3 - FS 50% · 70% · 85% da WS"). */}
    <CabecalhoDeGrupo titulo={`Editando: Série ${numero}`} resumo={`${tituloDoGrupoDeSeries(g, config)} · ${descreverGrupo(g, config, series, { unidade })}`} selo={SELO_DO_NIVEL[nivel]} linha="fina"
      inicio={<NumeroDaSerie numero={numero} aberto />} acoes={<>
      <BotaoDeMover alvo="grupo" direcao={-1} comTexto={largo} desabilitado={primeiro} aoTocar={() => aoMover(-1)} />
      <BotaoDeMover alvo="grupo" direcao={1} comTexto={largo} desabilitado={ultimo} aoTocar={() => aoMover(1)} />
      <IconeBotao moldura Icone={Trash2} rotulo="Remover este grupo de séries" cor={cores.perigo} aoTocar={aoRemover} />
    </>} />
    <View style={[estilos.corpo, { padding: recuo }]}>
      {/* Faixa curta, sem fixar no topo: com o grupo aberto e longo, o nome do exercício some da tela (reunião de 30/10). */}
      {exercicio ? <View style={[estilos.doExercicio, { borderLeftColor: cores.bordaCampo }]}>
        <Texto variante="pequeno" cor={cores.texto}>{exercicio}</Texto>
      </View> : null}
      {secoes.tipo ? <Secao titulo="Tipo e técnica">
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

      <Secao titulo={cardio ? 'Quantidade' : 'Estrutura'}>
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

      {linhasDaPrescricao(caixas, colunas).map((linha) => linha.length > 1
        ? <View key={linha.join('-')} style={estilos.lado}>{linha.map((c) => caixa[c])}</View>
        : caixa[linha[0]])}
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
 * informado: carga e de onde ela sai, esforço, descanso e a observação desta série. A leitura longa da técnica fica com o aluno.
 */
function PreviaDoAluno({ grupo: g, series, config, semCarga, descansoPorSerie, nivel }: { grupo: GrupoDeSeries; series: Serie[]; config: Configuracao; semCarga: boolean; descansoPorSerie: boolean; nivel: Nivel }) {
  const { cores } = useTema();
  const unidade = useUnidadeDeCarga();
  const previa = previaDoGrupo(g, series, config, { semCarga, descansoPorSerie, unidade, referencia: semCarga ? null : referenciaDaCarga(series, g.inicio, config) });
  const tecnica = g.series[0].tecnica;
  // Cluster sem blocos válidos: o resumo diria só "complete os blocos"; a frase inteira fica no lugar dele.
  const incompleto = tecnica?.tipo === 'CLUSTER' && !blocosValidos(tecnica.blocos);
  // Fundo leve na cor do estado (verde pronta, âmbar com aviso, vermelho com erro), opaco como o do selo.
  const cor = cores[nivel];
  return <View style={[estilos.previa, { borderColor: cor, backgroundColor: tingido(cor, cores.superficie) }]} accessibilityLabel="Para o aluno">
    <View style={estilos.tituloDaPrevia}>
      <View style={estilos.comIcone}>
        <Smartphone size={18} color={cores.texto} />
        <Texto variante="secao" nivel={3} cor={cores.texto}>Para o aluno</Texto>
      </View>
      <Selo texto={TEXTO_DA_PREVIA[nivel]} tipo={nivel} Icone={SELO_DO_NIVEL[nivel].Icone} />
    </View>
    {incompleto
      ? <Texto>Complete os blocos para visualizar a prescrição.</Texto>
      : <Texto numerico cor={cores.texto}>{previa.resumo}</Texto>}
    {previa.linhas.map((linha) => <Texto key={linha} numerico variante="suave">{linha}</Texto>)}
  </View>;
}

type Nivel = 'sucesso' | 'atencao' | 'perigo';

/** Selo do grupo de séries pela validação (a mesma da publicação): pronta, com aviso ou com erro. */
const SELO_DO_NIVEL: Record<Nivel, { texto: string; tipo: TipoSelo; Icone: LucideIcon }> = {
  sucesso: { texto: 'Pronta', tipo: 'sucesso', Icone: CircleCheck },
  atencao: { texto: 'Atenção', tipo: 'atencao', Icone: TriangleAlert },
  perigo: { texto: 'Corrigir', tipo: 'perigo', Icone: CircleAlert },
};
const TEXTO_DA_PREVIA: Record<Nivel, string> = { sucesso: 'Série pronta', atencao: 'Pode publicar, com aviso', perigo: 'Não dá para publicar' };

/**
 * Mover o exercício ou o grupo de séries. Os dois ficam um dentro do outro e tinham o mesmo ícone: o nome acessível diz
 * qual ("Mover grupo de séries para cima") e, com espaço (no exercício a partir de 768 px de janela; no grupo de séries pela
 * largura da coluna, `LARGURA_LADO_A_LADO`), o botão também diz na tela ("↑ Mover grupo", "↑ Mover
 * exercício"; reunião de 30/10, com o "Mover" desde 31/10 para quem não percebe a seta). No celular, só o ícone com moldura, para a linha de ações caber em 390 px.
 */
export function BotaoDeMover({ alvo, direcao, comTexto, desabilitado, aoTocar }: {
  alvo: 'exercicio' | 'grupo'; direcao: -1 | 1; comTexto: boolean; desabilitado: boolean; aoTocar: () => void;
}) {
  const nome = alvo === 'exercicio' ? 'exercício' : 'grupo de séries';
  const rotulo = `Mover ${nome} para ${direcao < 0 ? 'cima' : 'baixo'}`;
  const Icone = direcao < 0 ? ArrowUp : ArrowDown;
  if (!comTexto) return <IconeBotao moldura Icone={Icone} rotulo={rotulo} desabilitado={desabilitado} aoTocar={aoTocar} />;
  return <Botao rotulo={alvo === 'exercicio' ? 'Mover exercício' : 'Mover grupo'} rotuloAcessivel={rotulo} tipo="secundario" Icone={Icone} desabilitado={desabilitado} aoTocar={aoTocar} />;
}

/** Número da série no começo da faixa: claro nas fechadas, invertido (escuro) na aberta. */
function NumeroDaSerie({ numero, aberto }: { numero: number; aberto: boolean }) {
  const { cores } = useTema();
  return <View style={[estilos.caixaDoNumero, aberto ? { backgroundColor: cores.texto, borderColor: cores.texto } : { backgroundColor: cores.superficie, borderColor: cores.bordaCampo }]}
    accessibilityLabel={`Série ${numero}`}>
    <Texto numerico style={[estilos.textoDoNumero, { color: aberto ? cores.fundo : cores.texto }]}>{numero}</Texto>
  </View>;
}

const estilos = StyleSheet.create({
  lista: { gap: espaco(1.5) },
  painel: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), gap: espaco(1.5) },
  // A faixa do cabeçalho fica rente às bordas; o corpo tem o próprio recuo.
  grupo: { borderWidth: BORDA_ITEM, borderRadius: RAIO, overflow: 'hidden' },
  corpo: { gap: espaco(1.5) },
  secao: { gap: espaco(1.5) },
  poco: { borderWidth: 1, borderRadius: RAIO, paddingHorizontal: espaco(1.75), paddingVertical: espaco(1.5) },
  plana: { borderTopWidth: 1, paddingTop: espaco(1.5) },
  // Esforço e Descanso lado a lado no PC; empilhados no celular.
  lado: { flexDirection: 'row', gap: espaco(1.5), alignItems: 'stretch' },
  empilhado: { gap: espaco(1.5) },
  ladoMaior: { flex: 3, minWidth: 0 },
  ladoMenor: { flex: 2, minWidth: 0 },
  caixaDoNumero: { width: 28, height: 28, borderRadius: 6, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  textoDoNumero: { fontFamily: fontes.negrito, fontSize: 13, lineHeight: 16 },
  tituloDaPrevia: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1), flexWrap: 'wrap' },
  juntos: { gap: espaco(0.5) },
  bloco: { gap: espaco(1) },
  rires: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5), alignItems: 'flex-start' },
  explicacao: { borderLeftWidth: 2, paddingLeft: espaco(1.5), paddingVertical: espaco(0.5) },
  comIcone: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.75) },
  vazio: { gap: espaco(1) },
  // "+ Nova série" no fim da faixa das abas: tracejado, para ler como "lugar de mais uma" e não como outra aba.
  tracejado: { borderStyle: 'dashed', marginLeft: espaco(1), alignSelf: 'center' },
  previa: { borderWidth: 1, borderRadius: RAIO, padding: espaco(2), gap: espaco(0.75) },
  contador: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  numero: { fontFamily: fontes.negrito, fontSize: 18, lineHeight: 24, minWidth: 24, textAlign: 'center' },
  doExercicio: { borderLeftWidth: 3, paddingLeft: espaco(1), paddingVertical: 2 },
  suspensa: { maxWidth: 320 },
});
