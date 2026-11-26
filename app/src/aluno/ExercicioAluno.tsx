import { Trophy } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import type { AnteriorDoExercicio, Configuracao, DemonstracaoDoAluno, EtapaRegistrada, ExercicioPlano, OrigemDaReferencia, Serie, UltimaCarga } from '../api/tipos';
import { cargaIlegivel as cargaDeFormaDesconhecida } from '../dominio/modoDeCarga';
import { calcularCargasDoExercicio, cargaQueContaComoReferencia, ehSerieDeTrabalho, passoDaCarga, usaCargaDeTrabalho } from '../dominio/cargas';
import { contagemDoExercicio } from '../dominio/semana';
import { etapasDaSerie } from '../dominio/etapas';
import { textosDeExecucao } from '../dominio/execucaoDoExercicio';
import { aplicarRascunho, type MudancaDoRascunho, type RascunhoDaSerie, type RascunhosDeSerie } from '../dominio/rascunhoDaSerie';
import type { Recorde } from '../dominio/recordesPessoais';
import { repeticaoDaAnterior } from '../dominio/repetirSerie';
import { anteriorDaSerie, textoDoAnterior } from '../dominio/seriesAnteriores';
import { cabecalhoDoExercicio, indiceDaSerieAtiva, melhorWsDeHoje, recordeDaWs, textoDasSeriesFeitas, textoDoRecordeDaWs } from '../dominio/telaDoExercicio';
import { acompanharPendente, digitarPendente, type ValorPendente } from '../dominio/valorPendente';
import { videoValido } from '../dominio/video';
import type { RegistroLocal } from '../offline/repositorioLocal';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes, LARGURA_FORMULARIO, RAIO } from '../tema/tokens';
import { useUnidadeDeCarga } from '../ui/unidadeDeCargaEmUso';
import { useAviso } from '../ui/Aviso';
import { Botao } from '../ui/Botao';
import { DemonstracaoDoExercicio } from '../ui/DemonstracaoDoExercicio';
import { Folha } from '../ui/Folha';
import { PrincipalComApoio } from '../ui/PrincipalComApoio';
import { ProvedorDaPrevia } from '../ui/emPrevia';
import { fundoPintado, superficiePintada } from '../ui/superficiePintada';
import { Texto } from '../ui/Texto';
import { BlocoDaCargaDeTrabalho } from './BlocoDaCargaDeTrabalho';
import { CartaoSerieComEtapas } from './CartaoSerieComEtapas';
import { LARGURA_DA_COLUNA_DO_EXERCICIO, LARGURA_DAS_SERIES, TOPO_DA_COLUNA_DO_EXERCICIO } from './exercicio/colunasDoExercicio';
import { VideoDoExercicio } from './exercicio/VideoDoExercicio';
import { CartaoSerieDeCardio } from './CartaoSerieDeCardio';
import { ESTREITO } from './PartesDaSerie';
import { LinhaDaSerie } from './LinhaDaSerie';
import { ehExercicioDeCardio, selosDaSerie } from './serieDoAluno';

export interface DadosSerie {
  carga: number | null;
  repeticoes: number | null;
  concluida: boolean;
  /** Só nas séries com etapas (Cluster, Rest-pause): a lista inteira, trocada a cada gravação. */
  etapas?: EtapaRegistrada[] | null;
  referenciaCarga?: number | null;
  referenciaOrigem?: OrigemDaReferencia | null;
}

interface Props {
  exercicio: ExercicioPlano;
  /** Data do registro (ISO). */
  data: string;
  /** Carga de trabalho do dia que o aluno digitou (ou `null`). */
  cargaDoDia: number | null;
  /** Última carga de trabalho registrada antes desta data (servidor ou aparelho): base das sugestões e do recorde. */
  ultima: UltimaCarga | null;
  registroDe: (serieUid: string) => RegistroLocal | undefined;
  config: { arredondamentoKg: number; tipoTrabalho: string; metodologia?: Configuracao };
  aoMudarCargaDoDia: (carga: number | null) => void;
  aoRegistrar: (serieUid: string, dados: DadosSerie) => void;
  /**
   * O digitado antes do ✓, guardado no aparelho a cada mudança (`useSessaoDoDia.rascunhoDe`/`salvarRascunho`). Sem eles
   * (prévia do treinador, testes) fica só na memória da tela.
   */
  rascunhoDe?: (serieUid: string) => Pick<RascunhoDaSerie, 'carga' | 'repeticoes'> | null;
  salvarRascunho?: (serieUid: string, mudanca: MudancaDoRascunho | null) => void;
  /** Botão "Descanso 1:30" da linha de ações (`DescansoManual`); some na prévia. */
  acaoDescanso?: ReactNode;
  /** Atalho para o histórico no cabeçalho das séries; some na prévia. */
  acaoHistorico?: ReactNode;
  /** Inicia o cronômetro com a pausa da técnica (cluster, rest pause); sem ele, o botão não aparece. `rotulo` vai na barra; `origem` liga o cronômetro à etapa. */
  aoIniciarPausa?: (segundos: number, rotulo?: string, opcoes?: { origem?: string; automatica?: boolean }) => void;
  /** Encerra a pausa que nasceu da etapa desfeita (só a dela). */
  aoCancelarPausa?: (origem: string) => void;
  /** Versão do plano, série e data da série (identidade da execução da pausa entre etapas). */
  chaveDaExecucao: (serieUid: string) => string;
  /** Imagem ou GIF do exercício (própria ou do catálogo), dentro do "Como fazer"; nulo = nada para mostrar. */
  demonstracao?: DemonstracaoDoAluno | null;
  /**
   * O descanso por série vale (padrão). Falso nos membros de superset, tri-set, giant set, circuito e
   * agonista-antagonista: o descanso é o do grupo, depois da volta, e não aparece na série.
   */
  descansoNaSerie?: boolean;
  /** Recordes pessoais de cada série nesta data (`serieUid` → recordes; Engajamento 0.2): a medalha ao lado do número. */
  recordes?: Record<string, Recorde[]>;
  /** A última vez do exercício (Engajamento 0.3): a linha "Último registro" de cada série; nulo = nunca feito ou chave desligada. */
  ultimaVez?: AnteriorDoExercicio | null;
  /**
   * "Ver como o aluno" (C34), só leitura: os botões de marcar e registrar ficam desabilitados e nada é gravado nem lido do
   * aparelho (as ações viram nada, não há registro, rascunho no aparelho, pausa nem demonstração).
   */
  previa?: boolean;
  /**
   * Web larga (`docs/planos/aluno-web-layout.md`, seção 4), decidida pela rota: o exercício numa coluna de apoio à esquerda,
   * fixa ao rolar (`topo` da rota, meta com o Histórico e as seções Descanso, Vídeo embutido e "Como fazer" aberto), e a
   * carga de trabalho com as séries numa coluna só à direita, até 720, com o `fim` da rota embaixo. Sem ele (celular,
   * prévia do treinador), o desenho de sempre.
   */
  emColunas?: {
    topo: ReactNode;
    fim: ReactNode;
    /** Altura das barras da rota fora da rolagem (topo e rodapé), medida: a coluna do exercício não passa da área que rola. */
    alturaForaDaRolagem: number;
  };
}

const SEM_EFEITO = () => undefined;

/**
 * Na prévia as ações viram nada, o aparelho não é lido (`registroDe` sempre vazio, rascunho só na memória) e a
 * demonstração, que busca a imagem pela rota do aluno, não aparece. Um lugar só, para a garantia não depender de quem
 * monta a tela. Sem `rascunhoDe`/`salvarRascunho` (prévia, testes) o digitado fica num mapa da própria tela.
 */
export function ExercicioAluno(props: Props) {
  const [naMemoria, setNaMemoria] = useState<RascunhosDeSerie>({});
  const memoria = {
    rascunhoDe: (uid: string) => naMemoria[uid] ?? null,
    salvarRascunho: (uid: string, m: MudancaDoRascunho | null) => setNaMemoria((antes) => aplicarRascunho(antes, uid, m, '')),
  };
  const p: Props = props.previa
    ? { ...props, ...memoria, registroDe: SEM_EFEITO, aoMudarCargaDoDia: props.aoMudarCargaDoDia ?? SEM_EFEITO, aoRegistrar: SEM_EFEITO, aoIniciarPausa: undefined, aoCancelarPausa: undefined, acaoDescanso: undefined, acaoHistorico: undefined, demonstracao: null }
    : props.rascunhoDe && props.salvarRascunho ? props : { ...props, ...memoria };
  return (
    <ProvedorDaPrevia value={!!props.previa}>
      <CorpoDoExercicio {...p} />
    </ProvedorDaPrevia>
  );
}

/**
 * Exercício na tela do aluno (redesenho de 25/11, "Treino na academia"): a linha "Peso livre · 3 séries · meta da WS: 6 a 8
 * reps", três botões de mesma altura (Vídeo, Como fazer, Descanso), o bloco da carga de trabalho de hoje (só com séries em % da WS),
 * o cabeçalho "Séries 0 de 3 feitas" com o Histórico e uma linha por série. Com todas feitas e a WS de hoje acima da
 * anterior, o aviso de recorde. O nome do exercício (o h1) e a barra de baixo são da rota. Com `emColunas` (web larga), as
 * mesmas peças em duas colunas (`ui/PrincipalComApoio`).
 */
function CorpoDoExercicio(p: Props) {
  const unidade = useUnidadeDeCarga();
  const { avisar } = useAviso();
  const { cores, variante } = useTema();
  const e = p.exercicio;
  const [comoFazerAberto, abrirComoFazer] = useState(false);
  const base = p.cargaDoDia ?? p.ultima?.carga ?? null;
  // A base digitada chega gravada depois (B1, 30/10): a caixa mostra o que foi digitado até lá; a conta usa a gravada.
  // A caixa só mostra o que o aluno digitou (D1, 02/11): a última carga fica apagada dentro dela, como sugestão.
  const [pendenteDaBase, setPendenteDaBase] = useState<ValorPendente<number | null> | undefined>(undefined);
  const baseAcompanhada = acompanharPendente(pendenteDaBase, p.cargaDoDia);
  if (baseAcompanhada !== pendenteDaBase) setPendenteDaBase(baseAcompanhada);
  const baseNaCaixa = baseAcompanhada ? baseAcompanhada.valor : p.cargaDoDia;
  const mudarBase = (v: number | null) => {
    setPendenteDaBase(digitarPendente(baseAcompanhada, v, p.cargaDoDia));
    p.aoMudarCargaDoDia(v);
  };
  const cargasDoDia: Record<string, number | null> = {};
  // Só a carga de série feita (ou com etapa feita) serve de referência: desmarcar tira da conta (31/10).
  for (const s of e.series) cargasDoDia[s.uid] = cargaQueContaComoReferencia(p.registroDe(s.uid));
  const temCargaManual = (baseNaCaixa ?? p.cargaDoDia) != null;
  const calculadas = calcularCargasDoExercicio(e, baseNaCaixa ?? base, cargasDoDia, {
    ...p.config, ultima: p.ultima, cargaManual: temCargaManual, unidade,
  });
  const progressaoDeHoje = !temCargaManual ? calculadas.find((c) => c.progressao === 'SUBIR_CARGA') : undefined;
  const feita = (uid: string) => !!p.registroDe(uid)?.concluida;
  // `feitas` (todas as séries) só decide a vibração do último ✓; o contador na tela é `contagem` (D6).
  const feitas = e.series.filter((s) => feita(s.uid)).length;
  const contagem = contagemDoExercicio(e, feita, p.config.metodologia);
  const ativa = indiceDaSerieAtiva(e.series, feita);
  const passo = passoDaCarga(e, p.config.arredondamentoKg);
  const semCarga = e.unidade === 'nenhuma';
  const cardio = ehExercicioDeCardio(e);
  // Forma de carga que o app não conhece: sem campo de peso, sem sugestão, carga "—" (`dominio/modoDeCarga`).
  const cargaIlegivel = (s: Serie) => !semCarga && !cardio && cargaDeFormaDesconhecida(s.carga);
  const video = videoValido(e.videoUrl);
  const comoFazer = [...(!e.progressao ? ['Foco em controle, não em carga.'] : []), ...textosDeExecucao(e)];
  const temComoFazer = !!e.observacao || comoFazer.length > 0 || !!p.demonstracao;
  const ultima = cardio ? null : (p.ultimaVez ?? null);
  const anterior = (i: number) => (ultima ? textoDoAnterior(anteriorDaSerie(ultima, e, i), semCarga || cargaIlegivel(e.series[i]), unidade) : null);
  const serieDeTrabalho = e.series.find(ehSerieDeTrabalho);
  // Recorde = bater a WS anterior (`recordeDaWs`), só com o exercício inteiro feito.
  const recorde = ativa === -1 && !cardio ? recordeDaWs(melhorWsDeHoje(e, p.registroDe), p.ultima) : null;
  const textoDoRecorde = recorde ? textoDoRecordeDaWs(recorde, p.config.tipoTrabalho, unidade) : null;
  const pintadoDoRecorde = superficiePintada(cores.atencao, cores.superficie, variante, cores);

  const abrirVideo = () => {
    if (!e.videoUrl || !videoValido(e.videoUrl)) return;
    // Abre fora do app (navegador ou app do YouTube), sem token nem cookie.
    Linking.openURL(e.videoUrl).catch(() => avisar('Não foi possível abrir o vídeo.', 'perigo'));
  };
  const abrirFora = (url: string) => { Linking.openURL(url).catch(() => avisar('Não foi possível abrir o vídeo.', 'perigo')); };
  const acoes: { chave: string; peca: ReactNode }[] = [];
  if (video) acoes.push({ chave: 'video', peca: <Botao rotulo="Vídeo" rotuloAcessivel={`Vídeo de ${e.nome}`} tipo="secundario" cheio style={ESTREITO} aoTocar={abrirVideo} /> });
  if (temComoFazer) acoes.push({ chave: 'como', peca: <Botao rotulo="Como fazer" rotuloAcessivel={`Como fazer ${e.nome}`} tipo="secundario" cheio style={ESTREITO} aoTocar={() => abrirComoFazer(true)} /> });
  if (p.acaoDescanso) acoes.push({ chave: 'descanso', peca: p.acaoDescanso });

  const meta = <Texto variante="suave">{cabecalhoDoExercicio(e, p.config.tipoTrabalho, p.config.metodologia)}</Texto>;
  const conteudoDoComoFazer = (
    <View style={estilos.comoFazer}>
      {p.demonstracao ? (
        <DemonstracaoDoExercicio exercicioId={e.exercicioId} nome={e.nome} imagens={p.demonstracao.imagens}
          imagemPropriaEm={p.demonstracao.imagemPropriaEm} papel="ALUNO" largura={240} altura={180} ampliavel />
      ) : null}
      {e.observacao ? <Texto numerico style={estilos.observacao}>{e.observacao}</Texto> : null}
      {comoFazer.map((t) => <Texto key={t} numerico>{t}</Texto>)}
    </View>
  );
  const blocoDaCarga = usaCargaDeTrabalho(e) ? (
    <BlocoDaCargaDeTrabalho
      tipoTrabalho={p.config.tipoTrabalho}
      corDoTipo={serieDeTrabalho ? selosDaSerie(serieDeTrabalho, p.config.metodologia).tipo?.cor ?? null : null}
      valorKg={baseNaCaixa}
      passo={passo}
      ultima={p.ultima}
      progressaoKg={progressaoDeHoje ? p.config.arredondamentoKg : null}
      aoMudarKg={mudarBase}
    />
  ) : null;
  const tituloDasSeries = (historico: ReactNode) => (
    <View style={estilos.tituloSeries}>
      <Texto variante="bloco" nivel={2} numerico>{contagem.total > 0 ? textoDasSeriesFeitas(contagem) : 'Séries'}</Texto>
      {historico}
    </View>
  );
  const cartoes = calculadas.map((c, i) =>
    cardio ? (
      <CartaoSerieDeCardio
        key={c.serie.uid}
        serie={c.serie}
        numero={i + 1}
        feita={feita(c.serie.uid)}
        ativa={i === ativa}
        ultimaDoExercicio={feitas === e.series.length - 1}
        aoMarcar={(concluida) => p.aoRegistrar(c.serie.uid, { carga: null, repeticoes: null, concluida })}
      />
    ) : etapasDaSerie(c.serie) ? (
      <CartaoSerieComEtapas
        key={c.serie.uid}
        calculada={c}
        numero={i + 1}
        data={p.data}
        semCarga={semCarga || cargaIlegivel(c.serie)}
        cargaIlegivel={cargaIlegivel(c.serie)}
        metodologia={p.config.metodologia}
        tipoTrabalho={p.config.tipoTrabalho}
        arredondamentoKg={p.config.arredondamentoKg}
        descansoNaSerie={p.descansoNaSerie ?? true}
        baseDaUltimaVez={!temCargaManual && p.ultima?.carga != null}
        registro={p.registroDe(c.serie.uid)}
        execucao={p.chaveDaExecucao(c.serie.uid)}
        anterior={anterior(i)}
        ativa={i === ativa}
        aoRegistrar={(d) => p.aoRegistrar(c.serie.uid, d)}
        aoIniciarPausa={p.aoIniciarPausa}
        aoCancelarPausa={p.aoCancelarPausa}
      />
    ) : (
      <LinhaDaSerie
        key={c.serie.uid}
        calculada={c}
        indice={i}
        semCarga={semCarga}
        cargaIlegivel={cargaIlegivel(c.serie)}
        tipoTrabalho={p.config.tipoTrabalho}
        metodologia={p.config.metodologia}
        seriesDoExercicio={e.series}
        descansoNaSerie={p.descansoNaSerie ?? true}
        passo={passo}
        ativa={i === ativa}
        registro={p.registroDe(c.serie.uid)}
        rascunho={p.rascunhoDe?.(c.serie.uid) ?? null}
        salvarRascunho={(m) => p.salvarRascunho?.(c.serie.uid, m)}
        repetir={i > 0 ? repeticaoDaAnterior(e.series[i - 1], c.serie, p.registroDe(e.series[i - 1]!.uid), semCarga || cargaIlegivel(c.serie), unidade) : null}
        ultimaDoExercicio={feitas === e.series.length - 1}
        recordes={p.recordes?.[c.serie.uid] ?? null}
        anterior={anterior(i)}
        arredondamentoKg={p.config.arredondamentoKg}
        aoRegistrar={(d) => p.aoRegistrar(c.serie.uid, d)}
        aoIniciarPausa={p.aoIniciarPausa}
      />
    ),
  );
  const avisoDeRecorde = recorde && textoDoRecorde ? (
    <View accessible accessibilityRole="summary" accessibilityLabel={`${textoDoRecorde.titulo}: ${textoDoRecorde.detalhe}`}
      style={[estilos.recorde, fundoPintado(pintadoDoRecorde), { borderColor: pintadoDoRecorde.borda }]}>
      <Trophy size={24} color={cores.atencao} />
      <View style={estilos.recordeTextos}>
        <Texto style={estilos.recordeTitulo} cor={pintadoDoRecorde.texto}>{textoDoRecorde.titulo}</Texto>
        <Texto numerico cor={cores.texto}>{textoDoRecorde.detalhe}</Texto>
      </View>
    </View>
  ) : null;

  if (p.emColunas) {
    // Coluna do exercício (orientações de 26/11, 1.4): Descanso, Vídeo e Como fazer viram seções com título, empilhadas, sem
    // parecer abas; o vídeo toca embutido (o YouTube só monta depois do toque, "Abrir no YouTube" continua) e o "Como fazer"
    // fica aberto. O Descanso vem primeiro: é o que se toca a cada série e não pode cair fora da vista numa janela baixa.
    const secao = (titulo: string, conteudo: ReactNode) => (
      <View style={estilos.secao}>
        <Texto variante="bloco" nivel={2}>{titulo}</Texto>
        {conteudo}
      </View>
    );
    return (
      <PrincipalComApoio
        apoioAEsquerda
        larguraDoApoio={LARGURA_DA_COLUNA_DO_EXERCICIO}
        topoDoApoio={TOPO_DA_COLUNA_DO_EXERCICIO}
        alturaForaDaRolagem={p.emColunas.alturaForaDaRolagem}
        rotuloDoApoio="Sobre o exercício"
        testID="coluna-das-series"
        apoio={
          <>
            {p.emColunas.topo}
            <View style={estilos.tituloSeries}>
              <View style={estilos.meta}>{meta}</View>
              {p.acaoHistorico}
            </View>
            {p.acaoDescanso ? secao('Descanso', p.acaoDescanso) : null}
            {video && e.videoUrl ? secao('Vídeo', <VideoDoExercicio videoUrl={e.videoUrl} nome={e.nome} aoAbrirFora={abrirFora} />) : null}
            {temComoFazer ? secao('Como fazer', conteudoDoComoFazer) : null}
          </>
        }
        principal={
          <View style={estilos.colunaDasSeries}>
            <View style={estilos.exercicio}>
              {blocoDaCarga ? <View style={estilos.carga}>{blocoDaCarga}</View> : null}
              {tituloDasSeries(null)}
              <View style={estilos.series}>{cartoes}</View>
              {avisoDeRecorde}
            </View>
            {p.emColunas.fim}
          </View>
        }
      />
    );
  }

  return (
    <View style={estilos.exercicio}>
      {meta}
      {acoes.length ? (
        <View style={estilos.acoes}>
          {acoes.map((a) => <View key={a.chave} style={estilos.acao}>{a.peca}</View>)}
        </View>
      ) : null}
      <Folha visivel={comoFazerAberto} titulo="Como fazer" aoFechar={() => abrirComoFazer(false)}>
        {conteudoDoComoFazer}
      </Folha>
      {blocoDaCarga}
      {tituloDasSeries(p.acaoHistorico)}
      {/* Uma coluna só, na ordem (1, 2, 3...), também no tablet e na prévia: duas colunas liam 1-2 / 3-4. */}
      <View style={estilos.series}>{cartoes}</View>
      {avisoDeRecorde}
    </View>
  );
}

const estilos = StyleSheet.create({
  exercicio: { gap: espaco(2) },
  acoes: { flexDirection: 'row', gap: espaco(1), maxWidth: 560 },
  // Mesma altura e mesmo desenho; a largura parte do texto e divide a sobra, para "Descanso 1:30" caber numa linha em 390 px.
  acao: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0 },
  comoFazer: { gap: espaco(1.5) },
  observacao: { fontStyle: 'italic' },
  series: { gap: espaco(1.5) },
  secao: { gap: espaco(1.5) },
  meta: { flexShrink: 1, minWidth: 0 },
  // Web larga: as séries até 720 e a carga de trabalho, que é um campo e não uma faixa, até a largura de formulário.
  colunaDasSeries: { width: '100%', maxWidth: LARGURA_DAS_SERIES, gap: espaco(3) },
  carga: { maxWidth: LARGURA_FORMULARIO },
  tituloSeries: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: espaco(1) },
  recorde: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5), borderWidth: 1, borderRadius: RAIO, padding: espaco(2) },
  recordeTextos: { flex: 1, minWidth: 0, gap: 2 },
  recordeTitulo: { fontFamily: fontes.semi, fontSize: 16 },
});
