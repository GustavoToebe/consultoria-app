import { ArrowDown, ArrowUp, CircleAlert, CircleCheck, Minus, Plus, Smartphone, Trash2, TriangleAlert, type LucideIcon } from 'lucide-react-native';
import { type ReactNode, useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import type { Configuracao, PapelDaSerie, Serie, TipoDeTecnica } from '../../api/tipos';
import { agrupar, tituloDoGrupoDeSeries, type GrupoDeSeries } from '../../dominio/agrupamento';
import { blocosIguais, blocosValidos, resumoDosBlocos, textoDeBlocos } from '../../dominio/blocos';
import { adicionarSerie, alterarGrupo, DESCANSO_MAXIMO_SEGUNDOS, LIMITE_SERIES, moverGrupo, mudarQuantidade, novoExercicio, removerGrupo, tecnicaVazia, type AlteracaoDeGrupo } from '../../dominio/editorTreino';
import { explicacaoDoCatalogo } from '../../dominio/catalogoMetodologia';
import { grupoComSerie, uidDaAbaAposMudar } from '../../dominio/inspetorDoTreino';
import { podeRestPauseNaUltima, restPauseNestaSerie, textoDaContagemDeSeries } from '../../dominio/exemplosDePrescricao';
import { codigoTrabalho, explicacaoDaTecnica, explicacaoDoTipo, nomeDaSerieDeTrabalho, nomeDoTipo, padraoDaTecnica, tecnicaDescritiva, tecnicaNaMetodologia } from '../../dominio/metodologia';
import { CONFIGURACAO_PADRAO } from '../../dominio/metodologiaPadrao';
import { escalar } from '../../dominio/preferencias';
import { ROTULO_DA_OBSERVACAO_DA_SERIE } from '../../dominio/resumoDaSerie';
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
import { IconeBotao } from '../../ui/IconeBotao';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Selo, type TipoSelo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { useUnidadeDeCarga } from '../../ui/unidadeDeCargaEmUso';
import { BotaoDeAbrir } from './BotaoDeAbrir';
import { AvisoDoCampo, CamposDaTecnica, CamposDasRepeticoes, CamposDoCardio, CargaERirDaSerie, ErroDoCampo, useCamposLadoALado } from './CamposDaPrescricao';
import { textoParaOAluno } from './cargaDaSerie';
import { type EscolhaDeTecnica, opcoesDeTecnica, opcoesDeTipo, problemasDoExercicioSemSeries, problemasDoGrupoDeSeries, problemasPorSerie, secoesDaSerie, subProblemas } from './opcoesDoEditor';

interface Props {
  series: Serie[];
  config: Configuracao | null;
  /** Exercício de cardio: só a prescrição de cardio, sem tipo, técnica, carga nem RIR. */
  cardio: boolean;
  aoMudar: (series: Serie[]) => void;
  /**
   * Aba aberta controlada por quem usa (o editor de treino guarda uma por exercício, para o "ir ao primeiro" abrir a série
   * com problema): uid de uma série qualquer do grupo; nulo ou desconhecido = o primeiro grupo. Sem `aoAbrirGrupo`, o
   * componente guarda a aba sozinho (receita de séries do Planejamento).
   */
  grupoAbertoUid?: string | null;
  aoAbrirGrupo?: (serieUid: string | null) => void;
  /** Exercício sem carga (elástico, peso corporal): a faixa da carga fica só com o RIR. */
  semCarga?: boolean;
  /** `false` no grupo cujo descanso é depois da volta. Hoje só repassado: a leitura "Para o aluno" não fala de descanso. */
  descansoPorSerie?: boolean;
  /** Número e nome do exercício: a faixa curta no topo do grupo aberto diz de qual exercício são as séries. */
  numeroDoExercicio?: number;
  nomeDoExercicio?: string;
}

/** A ordem dos botões de 1 clique do "+ Nova série" (FS, WS, Back off, Aquecimento), pelo papel do tipo. */
const ORDEM_DOS_PAPEIS: PapelDaSerie[] = ['PREPARACAO', 'TRABALHO', 'POS_TRABALHO', 'AQUECIMENTO', 'OUTRO'];
/** As técnicas que ganham botão próprio: criam uma série de trabalho já com a técnica. */
const TECNICAS_DE_1_CLIQUE: TipoDeTecnica[] = ['REST_PAUSE', 'CLUSTER', 'DROP_SET'];

/**
 * Séries do exercício: uma aba por grupo ("Série 2 · WS"), o "+ Nova série" tracejado no fim da faixa (que mostra os botões
 * de 1 clique, "+ FS", "+ WS", "+ Rest pause"...) e, embaixo, o grupo da aba aberta em três faixas: tipo e técnica;
 * estrutura (séries, repetições e descanso numa linha que quebra); carga e RIR, uma linha por série. No rodapé, a observação
 * desta série e "Para o aluno". Séries iguais e seguidas formam um grupo e se editam juntas; o % e o RIR de cada série são
 * próprios. Cada campo mostra o erro e o aviso da validação (a mesma da publicação).
 */
export function EditorSeries({ series, config, cardio, aoMudar: aoMudarFora, grupoAbertoUid, aoAbrirGrupo, semCarga = false, numeroDoExercicio, nomeDoExercicio }: Props) {
  const { cores } = useTema();
  const cfg = config ?? CONFIGURACAO_PADRAO;
  const modalidade = cardio ? 'CARDIO' : null;
  const grupos = agrupar(series);
  // Lado a lado pela largura desta coluna, não da janela: no inspetor de 1280 a janela é larga e a coluna não.
  const janelaLarga = useCamposLadoALado();
  const [largura, setLargura] = useState<number | null>(ultimaLargura);
  const largo = janelaLarga && (largura === null || largura >= LARGURA_LADO_A_LADO);
  const medir = (e: LayoutChangeEvent) => { ultimaLargura = e.nativeEvent.layout.width; setLargura(ultimaLargura); };
  const [novaAberta, setNovaAberta] = useState(false);
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
  const adicionar = (tipo: string | undefined, tecnica: TipoDeTecnica | null) => {
    const novas = adicionarSerie(series, cfg, tipo, tecnica, modalidade);
    aoMudar(novas, doUltimo(novas));
    setNovaAberta(false);
  };
  const motivoCheio = cheio ? `O exercício já tem ${LIMITE_SERIES} séries, o máximo.` : undefined;
  const alterar = (g: GrupoDeSeries, m: AlteracaoDeGrupo) => aoMudar(alterarGrupo(series, g, m, cfg));
  const iAberto = grupoAberto ? grupos.findIndex((g) => g.series[0].uid === uidAberto) : -1;
  const g = iAberto >= 0 ? grupos[iAberto] : null;
  const rotuloDaNova = cardio ? 'Novo cardio' : 'Nova série';
  // Cardio não tem tipo: "Novo cardio" já adiciona. Na musculação, "Nova série" mostra os botões de 1 clique.
  const aoNova = cardio ? () => adicionar(undefined, null) : () => setNovaAberta(!novaAberta);
  const nova = <Botao rotulo={rotuloDaNova} tipo="secundario" Icone={Plus} desabilitado={cheio} motivo={motivoCheio} aoTocar={aoNova} />;
  const botoesDaNova = cardio || cheio ? null : <BotoesDeNovaSerie config={cfg} aoAdicionar={adicionar} />;
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
        {botoesDaNova ?? <LinhaDeAcoes>{nova}</LinhaDeAcoes>}
      </View>}
    {grupos.length > 0 && cheio ? <LinhaDeAcoes>{nova}</LinhaDeAcoes> : null}
    {grupos.length > 0 && novaAberta ? botoesDaNova : null}
    <ErroDoCampo mensagem={validacao.daLista.series} />
    <AvisoDoCampo mensagem={validacao.avisosDaLista.series} />
    {g ? <EditorGrupo key={g.series[0].uid} largo={largo} grupo={g} series={series} config={cfg} cardio={cardio} semCarga={semCarga}
      tipos={tipos} podeMais={!cheio} primeiro={iAberto === 0} ultimo={iAberto === grupos.length - 1} numero={iAberto + 1}
      exercicio={numeroDoExercicio != null ? `Exercício ${numeroDoExercicio} · ${nomeDoExercicio?.trim() || 'sem nome'}` : null}
      porSerie={validacao.porSerieErros}
      aoMover={(d) => aoMudar(moverGrupo(series, iAberto, d))}
      aoAlterar={(m) => alterar(g, m)}
      aoMudarSeries={(novas) => aoMudar(novas)}
      aoQuantidade={(n) => aoMudar(mudarQuantidade(series, g, n, cfg))}
      aoRestPauseNaUltima={() => aoMudar(restPauseNestaSerie(series, g, cfg))}
      aoRemover={() => aoMudar(removerGrupo(series, g))} /> : null}
    <Texto variante="pequeno">{textoDaContagemDeSeries(series.length)}</Texto>
  </View>;
}

/**
 * Os botões de 1 clique: um por tipo da metodologia (na ordem FS, WS, Back off, Aquecimento) e, se a metodologia tem a
 * técnica e há tipo de trabalho, "Rest pause", "Cluster" e "Drop-set", que já criam a série de trabalho com ela.
 */
function BotoesDeNovaSerie({ config, aoAdicionar }: { config: Configuracao; aoAdicionar: (tipo: string | undefined, tecnica: TipoDeTecnica | null) => void }) {
  const ws = codigoTrabalho(config);
  const porTipo = ORDEM_DOS_PAPEIS.flatMap((papel) => config.tipos.filter((t) => t.papel === papel && t.codigo.trim()));
  const tecnicas = ws ? opcoesDeTecnica(config).filter((o): o is { valor: TipoDeTecnica; rotulo: string } =>
    o.valor !== 'NENHUMA' && TECNICAS_DE_1_CLIQUE.includes(o.valor) && tecnicaNaMetodologia(config, o.valor)) : [];
  return <View style={estilos.juntos} role="group" aria-label="Adicionar série">
    <Texto variante="rotulo">Adicionar</Texto>
    <LinhaDeAcoes>
      {porTipo.map((t) => <Botao key={t.codigo} rotulo={nomeDoTipo(config, t.codigo)} rotuloAcessivel={`Adicionar ${nomeDoTipo(config, t.codigo)}`} tipo="secundario" Icone={Plus}
        aoTocar={() => aoAdicionar(t.codigo, null)} />)}
      {tecnicas.map((o) => <Botao key={o.valor} rotulo={o.rotulo} rotuloAcessivel={`Adicionar ${nomeDoTipo(config, ws)} com ${o.rotulo}`} tipo="secundario" Icone={Plus}
        aoTocar={() => aoAdicionar(ws ?? undefined, o.valor)} />)}
    </LinhaDeAcoes>
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
 * cabem; o inspetor de 1280 (uns 560 px) empilha.
 */
const LARGURA_LADO_A_LADO = 640;
/**
 * Última largura medida: o cartão do exercício remonta ao trocar de exercício, e todos têm a mesma largura (sem piscar).
 * shortcut: na 1ª montagem ainda não há medida e vale a janela (`useCamposLadoALado`), um quadro só; se piscar, medir mais acima.
 */
let ultimaLargura: number | null = null;

/**
 * Largura da caixa do descanso: cabe "3600" e o "s" no tamanho de texto padrão; cresce com o texto da pessoa. Em 90 (não 112)
 * para a linha Séries × Repetições × Descanso seguir numa linha só em 1280 e 1440 com as caixas mín/máx proporcionais ao sufixo
 * (84 cortava o "3600"). shortcut: folga de ~2 px em 1280/1440; se faltar, a linha quebra e o descanso desce, sem cortar nada.
 */
const LARGURA_DO_DESCANSO = 90;

/**
 * Uma faixa do grupo aberto: título de seção (h3) e, da segunda em diante, um fio em cima. Sem caixa: três faixas planas no
 * lugar das sete caixinhas de antes (o grupo de séries já é a moldura).
 */
function Faixa({ titulo, primeira = false, children }: { titulo?: string; primeira?: boolean; children: ReactNode }) {
  const { cores } = useTema();
  return <View style={[estilos.faixa, primeira ? null : [estilos.comFio, { borderTopColor: cores.divisor }]]}>
    {titulo ? <Texto variante="secao" nivel={3} cor={cores.texto}>{titulo}</Texto> : null}
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
  /** Tipo e Técnica lado a lado e "Mover grupo" com texto: a coluna das séries é larga (`LARGURA_LADO_A_LADO`). */
  largo: boolean;
  grupo: GrupoDeSeries; series: Serie[]; config: Configuracao; cardio: boolean; semCarga: boolean;
  tipos: { valor: string; rotulo: string; foraDaMetodologia: boolean }[]; podeMais: boolean; primeiro: boolean; ultimo: boolean; numero: number;
  /** "Exercício 2 · Supino reto", na faixa curta do topo do grupo aberto; nulo sem ela. */
  exercicio: string | null;
  porSerie: ReturnType<typeof problemasPorSerie>;
  aoMover: (d: -1 | 1) => void; aoAlterar: (m: AlteracaoDeGrupo) => void; aoMudarSeries: (novas: Serie[]) => void;
  aoQuantidade: (n: number) => void; aoRestPauseNaUltima: () => void; aoRemover: () => void;
}

function EditorGrupo({ largo, grupo: g, series, config, cardio, semCarga, tipos, podeMais, primeiro, ultimo, numero, exercicio, porSerie, aoMover, aoAlterar, aoMudarSeries, aoQuantidade, aoRestPauseNaUltima, aoRemover }: PropsDoGrupo) {
  const { cores, bordas, fatorTexto } = useTema();
  const unidade = useUnidadeDeCarga();
  // Explicações do tipo e da técnica começam recolhidas; o "O que é?" abre.
  const [explicarTipo, setExplicarTipo] = useState(false);
  const [explicarTecnica, setExplicarTecnica] = useState(false);
  const s = g.series[0];
  const secoes = secoesDaSerie(cardio ? 'CARDIO' : null);
  const cluster = s.tecnica?.tipo === 'CLUSTER';
  const { erros, avisos } = problemasDoGrupoDeSeries(porSerie, g.inicio, g.series.length);
  const nivel = nivelDoGrupo(porSerie, g);
  const explicacao = explicacaoDoTipo(config, s.tipo);
  const tecnicaTexto = s.tecnica ? (explicacaoDaTecnica(config, s.tecnica.tipo) || (tecnicaDescritiva(s.tecnica.tipo) ? explicacaoDoCatalogo(s.tecnica.tipo) : null)) : null;
  const descritiva = tecnicaDescritiva(s.tecnica?.tipo);
  const aoTecnica = (v: EscolhaDeTecnica) => aoAlterar({ tecnica: v === 'NENHUMA' ? null : tecnicaVazia(v, padraoDaTecnica(config, v)) });
  const nomeTipo = tipos.find((t) => t.valor === s.tipo)?.rotulo ?? nomeDoTipo(config, s.tipo);
  const opcoesTecnica = opcoesDeTecnica(config, s.tecnica?.tipo);
  const nomeTecnica = s.tecnica ? opcoesTecnica.find((o) => o.valor === s.tecnica?.tipo)?.rotulo ?? null : null;
  const recuo = espaco(largo ? 2.5 : 2);
  const borda = nivel === 'perigo' ? cores.perigo : cores.bordaCampo;
  const erroDoDescanso = erros.descansoSegundos ?? (s.descansoSegundos != null && s.descansoSegundos > DESCANSO_MAXIMO_SEGUNDOS ? `Descanso: de 0 a ${DESCANSO_MAXIMO_SEGUNDOS} s.` : null);
  const resumoDoCluster = cluster ? resumoDosBlocos(s.tecnica?.blocos) : null;
  const blocos = s.tecnica?.blocos ?? null;
  const textoDoCluster = resumoDoCluster
    ? `${blocosIguais(blocos) ? `${resumoDoCluster.blocos} blocos × ${blocos![0]} reps` : `Blocos ${textoDeBlocos(blocos)}`} = ${resumoDoCluster.repeticoes} reps`
    : 'Complete os blocos';
  return <View style={[estilos.grupo, { borderWidth: bordas.item, borderColor: borda, backgroundColor: cores.superficie }]}>
    {/* "Editando: Série 2" com o tipo como o treinador lê ("Trabalho · WS"). */}
    <CabecalhoDeGrupo titulo={`Editando: Série ${numero}`} resumo={tituloDoGrupoDeSeries(g, config)} selo={SELO_DO_NIVEL[nivel]} linha="fina"
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

      {/* Faixa 1: para que a série serve (tipo) e como executar (técnica). */}
      {secoes.tipo ? <Faixa titulo="Tipo e técnica" primeira>
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
      </Faixa> : null}

      {/* Faixa 2: séries × repetições × descanso numa linha que quebra; os campos da técnica embaixo, na largura toda. */}
      <Faixa titulo={cardio ? 'Quantidade' : 'Estrutura'} primeira={!secoes.tipo}>
        <View style={estilos.estrutura}>
          <View style={estilos.juntos}>
            <Texto variante="rotulo">Séries</Texto>
            <View style={estilos.contador}>
              <IconeBotao moldura Icone={Minus} rotulo="Uma série completa a menos" desabilitado={g.series.length <= 1} aoTocar={() => aoQuantidade(g.series.length - 1)} />
              <Texto numerico style={estilos.numero} accessibilityLabel={`${g.series.length} séries completas`}>{g.series.length}</Texto>
              <IconeBotao moldura Icone={Plus} rotulo="Uma série completa a mais" desabilitado={!podeMais} aoTocar={() => aoQuantidade(g.series.length + 1)} />
            </View>
          </View>
          {secoes.prescricao && !cluster ? <CamposDasRepeticoes compacta valor={s} erros={erros} semRepeticoes="Sem repetições: o aluno lê a série por tempo."
            aoMudar={(r) => aoAlterar({ repsMin: r.repsMin, repsMax: r.repsMax, amrap: r.amrap })} /> : null}
          {secoes.prescricao && cluster ? <View style={estilos.juntos}>
            <Texto variante="rotulo">Repetições</Texto>
            <Texto numerico cor={cores.texto} style={estilos.resumoDoCluster}>{textoDoCluster}</Texto>
          </View> : null}
          {secoes.prescricao ? <View style={{ width: escalar(LARGURA_DO_DESCANSO, fatorTexto) }}>
            <CampoNumerico rotulo="Descanso" rotuloAcessivel="Descanso depois da série, em segundos" inteiro sufixo="s" sufixoNaCaixa valor={s.descansoSegundos}
              aoMudar={(descansoSegundos) => aoAlterar({ descansoSegundos })} erroSemTexto
              erro={erroDoDescanso} />
          </View> : null}
        </View>
        <ErroDoCampo mensagem={erroDoDescanso} />
        {secoes.tecnica && s.tecnica && !descritiva
          ? <CamposDaTecnica tecnica={s.tecnica} erros={subProblemas(erros, 'tecnica')} semCarga={semCarga} ws={nomeDaSerieDeTrabalho(config)} aoMudar={(tecnica) => aoAlterar({ tecnica })} />
          : null}
        {secoes.prescricao && cluster ? <ErroDoCampo mensagem={erros.repsMin} /> : null}
        {secoes.cardio ? <CamposDoCardio cardio={s.cardio} aoMudar={(c) => aoAlterar({ cardio: c })} erros={{ ...subProblemas(erros, 'cardio'), ...(erros.cardio ? { cardio: erros.cardio } : {}) }} /> : null}
      </Faixa>

      {/* Faixa 3: a carga pelo papel e, sempre visível, uma linha por série com o % (ou kg) e o RIR dela. */}
      {secoes.carga ? <Faixa titulo={semCarga ? 'RIR' : 'Carga e RIR'}>
        <CargaERirDaSerie grupo={g} series={series} config={config} porSerie={porSerie} semCarga={semCarga} aoMudar={aoMudarSeries} />
      </Faixa> : null}

      {/* Rodapé: a observação desta série (uma linha) e como o aluno vai ler. */}
      <Faixa>
        {secoes.alvoExtra ? <Campo rotulo={`${ROTULO_DA_OBSERVACAO_DA_SERIE} (opcional)`} valor={s.alvoExtra ?? ''} maxLength={120} aoMudar={(alvoExtra) => aoAlterar({ alvoExtra })}
          erro={erros.alvoExtra} /> : null}
        <ParaOAluno grupo={g} config={config} cardio={cardio} nivel={nivel} texto={cardio ? null : cluster && !blocosValidos(blocos) ? null : textoParaOAluno(g, config, unidade)} />
      </Faixa>
    </View>
  </View>;
}

/**
 * "Para o aluno: 3×3 a 5 · FS · 50% · 70% · 85% a 90% da WS", numa faixa compacta com o selo da série (pronta, com aviso,
 * com erro). Cluster sem blocos válidos pede para completar; o cardio usa o resumo do grupo.
 */
function ParaOAluno({ grupo: g, config, cardio, nivel, texto }: { grupo: GrupoDeSeries; config: Configuracao; cardio: boolean; nivel: Nivel; texto: string | null }) {
  const { cores } = useTema();
  const unidade = useUnidadeDeCarga();
  const leitura = texto ?? (cardio ? textoParaOAluno(g, config, unidade) : 'Complete os blocos para visualizar a prescrição.');
  const cor = cores[nivel];
  return <View style={[estilos.previa, { borderColor: cor, backgroundColor: tingido(cor, cores.superficie) }]}>
    <View style={estilos.textoDaPrevia}>
      <Smartphone size={16} color={cores.texto} />
      <Texto numerico cor={cores.texto} style={estilos.flexivel}>
        <Texto variante="rotulo" cor={cores.texto}>Para o aluno: </Texto>{leitura}
      </Texto>
    </View>
    <Selo texto={TEXTO_DA_PREVIA[nivel]} tipo={nivel} Icone={SELO_DO_NIVEL[nivel].Icone} />
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
  // A faixa do cabeçalho fica rente às bordas; o corpo tem o próprio recuo.
  grupo: { borderWidth: BORDA_ITEM, borderRadius: RAIO, overflow: 'hidden' },
  corpo: { gap: espaco(2.5) },
  faixa: { gap: espaco(1.5) },
  comFio: { borderTopWidth: 1, paddingTop: espaco(2.5) },
  lado: { flexDirection: 'row', gap: espaco(1.5), alignItems: 'flex-start' },
  empilhado: { gap: espaco(1.5) },
  ladoMaior: { flex: 3, minWidth: 0 },
  ladoMenor: { flex: 2, minWidth: 0 },
  // Séries, repetições e descanso: lado a lado enquanto couberem; no celular a linha quebra.
  estrutura: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', columnGap: espaco(3), rowGap: espaco(1.5) },
  caixaDoNumero: { width: 28, height: 28, borderRadius: 6, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  textoDoNumero: { fontFamily: fontes.negrito, fontSize: 13, lineHeight: 16 },
  juntos: { gap: espaco(0.5) },
  explicacao: { borderLeftWidth: 2, paddingLeft: espaco(1.5), paddingVertical: espaco(0.5) },
  vazio: { gap: espaco(1) },
  // "+ Nova série" no fim da faixa das abas: tracejado, para ler como "lugar de mais uma" e não como outra aba.
  tracejado: { borderStyle: 'dashed', marginLeft: espaco(1), alignSelf: 'center' },
  previa: { borderWidth: 1, borderRadius: RAIO, paddingHorizontal: espaco(1.5), paddingVertical: espaco(1), gap: espaco(1), flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' },
  textoDaPrevia: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.75), flexGrow: 1, flexShrink: 1, flexBasis: 240 },
  flexivel: { flex: 1, minWidth: 0 },
  contador: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  numero: { fontFamily: fontes.negrito, fontSize: 18, lineHeight: 24, minWidth: 24, textAlign: 'center' },
  resumoDoCluster: { minHeight: 44, textAlignVertical: 'center', paddingTop: espaco(1.25) },
  doExercicio: { borderLeftWidth: 3, paddingLeft: espaco(1), paddingVertical: 2 },
  suspensa: { maxWidth: 320 },
});
