import { ChevronDown, ChevronUp, PlayCircle, Repeat, Timer } from 'lucide-react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, View, type TextInput } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import type { AnteriorDoExercicio, Configuracao, DemonstracaoDoAluno, EtapaRegistrada, ExercicioPlano, OrigemDaReferencia, Serie, UltimaCarga } from '../api/tipos';
import { cargaIlegivel as cargaDeFormaDesconhecida } from '../dominio/modoDeCarga';
import { ajustarCarga, calcularCargasDoExercicio, cargaQueContaComoReferencia, ehSerieDeTrabalho, passoDaCarga, seriesSeguintesDependemDesta, textoDaOrigem, usaCargaDeTrabalho, type SerieCalculada } from '../dominio/cargas';
import { avisoDeRepeticoes } from '../dominio/avisoDeRepeticoes';
import { avisoDeSerieSemCarga, textoDoNumeroInvalido } from '../dominio/avisoDaSerie';
import { papelDe } from '../dominio/metodologia';
import { dicaDeCarga, TEXTO_PRIMEIRA_VEZ } from '../dominio/dicaDeCarga';
import { contagemDoExercicio } from '../dominio/semana';
import { aplicarEscolhaDoPainel, decidirCheck, type EscolhaDoPainel } from '../dominio/painelDoCheck';
import { etapasDaSerie } from '../dominio/etapas';
import { textosDeExecucao } from '../dominio/execucaoDoExercicio';
import { dataCurta, dataParaTela } from '../dominio/formatos';
import { textoDaCarga } from '../dominio/unidadeDeCarga';
import { textoDoRecorde, type Recorde } from '../dominio/recordesPessoais';
import { acompanharPendente, digitarPendente, valorExibido, type ValorPendente } from '../dominio/valorPendente';
import { repeticaoDaAnterior } from '../dominio/repetirSerie';
import { anteriorDaSerie, textoDaUltimaVez, textoDoAnterior } from '../dominio/seriesAnteriores';
import { videoValido } from '../dominio/video';
import type { RegistroLocal } from '../offline/repositorioLocal';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../tema/tokens';
import { AjusteDeCarga, BotaoDePasso } from '../ui/AjusteDeCarga';
import { CampoDeCarga } from '../ui/CampoDeCarga';
import { useUnidadeDeCarga } from '../ui/unidadeDeCargaEmUso';
import { useAviso } from '../ui/Aviso';
import { Botao } from '../ui/Botao';
import { BotaoMarcar } from '../ui/BotaoMarcar';
import { CampoNumericoGrande } from '../ui/Campos';
import { Cartao } from '../ui/Cartao';
import { DemonstracaoDoExercicio } from '../ui/DemonstracaoDoExercicio';
import { IconeBotao } from '../ui/IconeBotao';
import { ProvedorDaPrevia } from '../ui/emPrevia';
import { sobre } from '../ui/sobre';
import { Texto } from '../ui/Texto';
import { useMovimentoReduzido } from '../ui/useMovimentoReduzido';
import { CartaoSerieComEtapas } from './CartaoSerieComEtapas';
import { CartaoSerieDeCardio } from './CartaoSerieDeCardio';
import { PainelDoCheck } from './PainelDoCheck';
import { RotuloDoIcone } from './RotuloDoIcone';
import { barraDoTipo, CabecalhoDaSerie, DicaDoCampo, LinhaDoUltimoRegistro, MetaAoLado, RotuloDeHoje } from './PartesDaSerie';
import { ehExercicioDeCardio, partesDaMeta, selosDaSerie, textosDaSerie } from './serieDoAluno';

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
  /** Última carga de trabalho registrada (servidor ou aparelho) para sugerir a base. */
  ultima: UltimaCarga | null;
  registroDe: (serieUid: string) => RegistroLocal | undefined;
  config: { arredondamentoKg: number; tipoTrabalho: string; metodologia?: Configuracao };
  aoMudarCargaDoDia: (carga: number | null) => void;
  aoRegistrar: (serieUid: string, dados: DadosSerie) => void;
  /** Botão de descanso (ícone) na linha do "Como fazer", ao lado do vídeo. */
  acaoDescanso?: ReactNode;
  /** Inicia o cronômetro com a pausa da técnica (cluster, rest pause); sem ele, o botão não aparece. `rotulo` vai na barra; `origem` liga o cronômetro à etapa. */
  aoIniciarPausa?: (segundos: number, rotulo?: string, opcoes?: { origem?: string; automatica?: boolean }) => void;
  /** Encerra a pausa que nasceu da etapa desfeita (só a dela). */
  aoCancelarPausa?: (origem: string) => void;
  /** Versão do plano, série e data da série (identidade da execução da pausa entre etapas). */
  chaveDaExecucao: (serieUid: string) => string;
  /** Imagem ou GIF do exercício (própria ou do catálogo); nulo = nada para mostrar. */
  demonstracao?: DemonstracaoDoAluno | null;
  /**
   * O descanso por série vale (padrão). Falso nos membros de superset, tri-set, giant set, circuito e
   * agonista-antagonista: o descanso é o do grupo, depois da volta, e não aparece na série.
   */
  descansoNaSerie?: boolean;
  /** Recordes pessoais de cada série nesta data (`serieUid` → recordes; Engajamento 0.2): a medalha no lugar do número. */
  recordes?: Record<string, Recorde[]>;
  /** A última vez do exercício (coluna "Anterior", Engajamento 0.3); nulo = nunca feito ou chave desligada (sem a linha). */
  ultimaVez?: AnteriorDoExercicio | null;
  /**
   * "Ver como o aluno" (C34), só leitura: os botões de marcar e registrar ficam desabilitados e nada é gravado nem lido do
   * aparelho (as ações viram nada, não há registro, pausa nem demonstração). Quem monta a prévia não precisa passar mais nada.
   */
  previa?: boolean;
}

const SEM_EFEITO = () => undefined;

/**
 * Na prévia as ações viram nada, o aparelho não é lido (`registroDe` sempre vazio) e a demonstração, que busca a imagem pela
 * rota do aluno, não aparece. Um lugar só, para a garantia não depender de quem monta a tela.
 */
export function ExercicioAluno(props: Props) {
  const p: Props = props.previa
    ? { ...props, registroDe: SEM_EFEITO, aoMudarCargaDoDia: SEM_EFEITO, aoRegistrar: SEM_EFEITO, aoIniciarPausa: undefined, aoCancelarPausa: undefined, acaoDescanso: undefined, demonstracao: null }
    : props;
  return (
    <ProvedorDaPrevia value={!!props.previa}>
      <CorpoDoExercicio {...p} />
    </ProvedorDaPrevia>
  );
}

/**
 * Exercício na tela do aluno, enxuto para a academia (revisão de 19/10: em 390/360 a primeira série ficava abaixo da
 * dobra). Uma linha com "Como fazer" (observação, cadência, isometria; fechado mostra só o começo da observação), vídeo e
 * descanso como ícones; a carga de trabalho do dia em uma linha `[−] campo [+]`; e um cartão por série com a meta, o
 * descanso e a técnica da própria série. Os −/+ do peso aparecem só na próxima série a fazer. O ✓ grava no aparelho.
 */
function CorpoDoExercicio(p: Props) {
  const { cores } = useTema();
  const unidade = useUnidadeDeCarga();
  const { avisar } = useAviso();
  const e = p.exercicio;
  const [comoFazerAberto, abrirComoFazer] = useState(false);
  const base = p.cargaDoDia ?? p.ultima?.carga ?? null;
  // A base digitada chega gravada depois (B1, 30/10): a caixa mostra o que foi digitado até lá. A conta das séries continua
  // usando só a base gravada (`base`), como antes. A caixa só mostra o que o aluno digitou (D1, 02/11): a última vez é
  // dica, nunca valor escrito no campo; sem nada digitado, as sugestões das séries continuam saindo dela.
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
  const calculadas = calcularCargasDoExercicio(e, base, cargasDoDia, p.config);
  // `feitas` (todas as séries) só decide a vibração do último ✓ (`ultimaDoExercicio`); o contador na tela é `contagem`.
  const feitas = e.series.filter((s) => p.registroDe(s.uid)?.concluida).length;
  // "x de y feitas": a mesma conta da faixa e do "Bom trabalho" (D6, `contagemDoExercicio`); sem série contada, não aparece.
  const contagem = contagemDoExercicio(e, (uid) => !!p.registroDe(uid)?.concluida, p.config.metodologia);
  const proximaAFazer = e.series.findIndex((s) => !p.registroDe(s.uid)?.concluida);
  const passo = passoDaCarga(e, p.config.arredondamentoKg);
  const semCarga = e.unidade === 'nenhuma';
  const cardio = ehExercicioDeCardio(e);
  // Série cuja forma de carga o app não conhece (treinador usou algo mais novo): sem campo de peso, sem sugestão, carga "—".
  // O ✓ e as repetições seguem valendo (regra e texto em `dominio/modoDeCarga`).
  const cargaIlegivel = (s: Serie) => !semCarga && !cardio && cargaDeFormaDesconhecida(s.carga);
  const video = videoValido(e.videoUrl);
  const comoFazer = [
    ...(!e.progressao ? ['Foco em controle, não em carga.'] : []),
    ...textosDeExecucao(e),
  ];
  const temComoFazer = !!e.observacao || comoFazer.length > 0;
  const ultima = cardio ? null : (p.ultimaVez ?? null);
  /** "60 kg × 8" da mesma série da última vez; `null` = sem a linha (nunca feito). */
  const anterior = (i: number) => (ultima ? textoDoAnterior(anteriorDaSerie(ultima, e, i), semCarga || cargaIlegivel(e.series[i]), unidade) : null);

  const abrirVideo = () => {
    if (!e.videoUrl || !videoValido(e.videoUrl)) return;
    // Abre fora do app (navegador ou app do YouTube), sem token nem cookie.
    Linking.openURL(e.videoUrl).catch(() => avisar('Não foi possível abrir o vídeo.', 'perigo'));
  };

  return (
    <View style={estilos.exercicio}>
      {p.demonstracao ? (
        <DemonstracaoDoExercicio exercicioId={e.exercicioId} nome={e.nome} imagens={p.demonstracao.imagens}
          imagemPropriaEm={p.demonstracao.imagemPropriaEm} papel="ALUNO" largura={240} altura={180} ampliavel />
      ) : null}
      {temComoFazer || video || p.acaoDescanso ? (
        <View style={estilos.linhaComoFazer}>
          {temComoFazer ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: comoFazerAberto }}
              accessibilityLabel={comoFazerAberto ? 'Fechar como fazer' : 'Abrir como fazer'}
              onPress={() => abrirComoFazer((a) => !a)}
              style={(estado) => [estilos.comoFazer, { backgroundColor: sobre(estado) ? cores.superficie3 : 'transparent' }]}>
              <View style={estilos.comoFazerTextos}>
                <Texto style={estilos.comoFazerTitulo}>Como fazer</Texto>
                {!comoFazerAberto && e.observacao ? (
                  <Texto variante="pequeno" numberOfLines={1}>{e.observacao}</Texto>
                ) : null}
              </View>
              {comoFazerAberto ? <ChevronUp size={20} color={cores.texto} /> : <ChevronDown size={20} color={cores.texto} />}
            </Pressable>
          ) : (
            <View style={estilos.espaco} />
          )}
          {video ? <RotuloDoIcone texto="Vídeo"><IconeBotao Icone={PlayCircle} rotulo={`Ver vídeo de ${e.nome}`} aoTocar={abrirVideo} /></RotuloDoIcone> : null}
          {p.acaoDescanso}
        </View>
      ) : null}
      {comoFazerAberto && temComoFazer ? (
        <Cartao>
          {e.observacao ? <Texto numerico style={estilos.observacao}>{e.observacao}</Texto> : null}
          {comoFazer.map((t) => (
            <Texto key={t} numerico>{t}</Texto>
          ))}
        </Cartao>
      ) : null}
      {usaCargaDeTrabalho(e) ? (
        <Cartao>
          <Texto variante="rotulo">Carga de trabalho ({p.config.tipoTrabalho}) · {dataCurta(p.data)}</Texto>
          <View style={estilos.linhaPasso}>
            {passo !== null ? (
              <BotaoDePasso sentido={-1} passo={passo} rotulo="carga de trabalho" aoAjustar={(s) => mudarBase(ajustarCarga(baseNaCaixa, base, passo, s, unidade))} />
            ) : null}
            <CampoDeCarga
              rotulo="Carga de trabalho do dia"
              rotuloOculto
              valorKg={baseNaCaixa}
              aoMudarKg={mudarBase}
            />
            {passo !== null ? (
              <BotaoDePasso sentido={1} passo={passo} rotulo="carga de trabalho" aoAjustar={(s) => mudarBase(ajustarCarga(baseNaCaixa, base, passo, s, unidade))} />
            ) : null}
          </View>
          <Texto numerico variante="pequeno">
            {p.ultima?.carga != null
              ? `Última vez: ${textoDaCarga(p.ultima.carga, unidade)} × ${p.ultima.repeticoes ?? '—'} em ${dataParaTela(p.ultima.data)}.`
              : 'Sem registro anterior.'}
          </Texto>
          <Texto numerico variante="pequeno">
            {`É o ponto de partida do dia${p.cargaDoDia == null && p.ultima?.carga != null ? '; sem nada aqui, as sugestões saem da última vez' : ''}. Depois que você registrar a ${p.config.tipoTrabalho} nesta sessão (marcando a série como feita), as séries em "% da ${p.config.tipoTrabalho}" passam a sair dela.`}
          </Texto>
        </Cartao>
      ) : null}
      <View style={estilos.tituloSeries}>
        <Texto variante="bloco">Séries</Texto>
        {contagem.total > 0 ? (
          <Texto numerico variante="pequeno">
            {contagem.feitas} de {contagem.total} feitas
          </Texto>
        ) : null}
      </View>
      {textoDaUltimaVez(ultima) ? <Texto numerico variante="pequeno">{textoDaUltimaVez(ultima)}</Texto> : null}
      {calculadas.map((c, i) =>
        cardio ? (
          <CartaoSerieDeCardio
            key={c.serie.uid}
            serie={c.serie}
            numero={i + 1}
            feita={!!p.registroDe(c.serie.uid)?.concluida}
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
            baseDaUltimaVez={p.cargaDoDia == null && p.ultima?.carga != null}
            registro={p.registroDe(c.serie.uid)}
            execucao={p.chaveDaExecucao(c.serie.uid)}
            anterior={anterior(i)}
            aoRegistrar={(d) => p.aoRegistrar(c.serie.uid, d)}
            aoIniciarPausa={p.aoIniciarPausa}
            aoCancelarPausa={p.aoCancelarPausa}
          />
        ) : (
          <CartaoSerie
            key={c.serie.uid}
            calculada={c}
            indice={i}
            semCarga={semCarga}
            cargaIlegivel={cargaIlegivel(c.serie)}
            tipoTrabalho={p.config.tipoTrabalho}
            metodologia={p.config.metodologia}
            seriesDoExercicio={e.series}
            descansoNaSerie={p.descansoNaSerie ?? true}
            passo={i === proximaAFazer ? passo : null}
            ativa={i === proximaAFazer}
            registro={p.registroDe(c.serie.uid)}
            repetir={i > 0 ? repeticaoDaAnterior(e.series[i - 1], c.serie, p.registroDe(e.series[i - 1]!.uid), semCarga || cargaIlegivel(c.serie), unidade) : null}
            ultimaDoExercicio={feitas === e.series.length - 1}
            recordes={p.recordes?.[c.serie.uid] ?? null}
            anterior={anterior(i)}
            ultimaCarga={p.ultima}
            baseDaUltimaVez={p.cargaDoDia == null && p.ultima?.carga != null}
            aoRegistrar={(d) => p.aoRegistrar(c.serie.uid, d)}
            aoIniciarPausa={p.aoIniciarPausa}
          />
        ),
      )}
    </View>
  );
}

function CartaoSerie({
  calculada,
  indice,
  semCarga,
  cargaIlegivel,
  tipoTrabalho,
  metodologia,
  seriesDoExercicio,
  descansoNaSerie,
  passo,
  ativa,
  registro,
  repetir,
  aoRegistrar,
  ultimaDoExercicio,
  aoIniciarPausa,
  recordes,
  anterior,
  ultimaCarga,
  baseDaUltimaVez,
}: {
  calculada: SerieCalculada;
  indice: number;
  semCarga: boolean;
  /** A forma de carga da série é mais nova que o app: sem campo de peso nem sugestão; o texto "atualize o app" vai na meta. */
  cargaIlegivel: boolean;
  tipoTrabalho: string;
  metodologia?: Configuracao;
  /** As séries do exercício: dão o nome da série de referência do back off. */
  seriesDoExercicio: readonly Serie[];
  /** Mostra o "Descanso X" da série (falso nos membros de grupo cujo descanso é o do grupo). */
  descansoNaSerie: boolean;
  /** Passo dos botões + e − do peso; `null` esconde os botões (só a próxima série a fazer os mostra). */
  passo: number | null;
  /** É a próxima série a fazer: mostra o aviso de que as seguintes dependem desta. */
  ativa: boolean;
  registro: RegistroLocal | undefined;
  /** "Repetir 40 kg × 6": só quando a anterior tem a mesma prescrição e algo registrado (`repeticaoDaAnterior`). */
  repetir: ReturnType<typeof repeticaoDaAnterior>;
  aoRegistrar: (d: DadosSerie) => void;
  ultimaDoExercicio: boolean;
  aoIniciarPausa?: (segundos: number) => void;
  /** Recordes pessoais desta série na data (vazio ou nulo = nenhum). */
  recordes: Recorde[] | null;
  /** O que foi feito nesta série da última vez ("60 kg × 8" ou "—"); nulo = sem a linha (chave do retorno desligada). */
  anterior: string | null;
  /**
   * Última carga de trabalho do exercício (`pacote.ultimasCargas` + aparelho; independe da chave do retorno, D7): é o
   * "Última vez" da dica nas séries de trabalho. Nula = o exercício nunca teve carga de trabalho registrada.
   */
  ultimaCarga: UltimaCarga | null;
  /** Sem base do dia gravada, a conta parte da última carga: a origem da dica diz "da última vez", não "da base do dia". */
  baseDaUltimaVez: boolean;
}) {
  const { cores, identificacao } = useTema();
  const unidade = useUnidadeDeCarga();
  // Antes de gravar, os dois campos começam vazios (D1 e D3, 02/11): a sugestão é só dica ao lado, nunca valor no campo.
  const [cargaDigitada, setCargaDigitada] = useState<number | null>(null);
  const [repsDigitadas, setRepsDigitadas] = useState<number | null>(null);
  // Texto que não é número ("abc") deixava marcar a série com o valor nulo: o ✓ fica travado até corrigir.
  const [cargaInvalida, setCargaInvalida] = useState(false);
  const [repsInvalidas, setRepsInvalidas] = useState(false);
  const invalido = cargaInvalida || repsInvalidas;
  // Painel do ✓ (D2): aberto com a sugestão que ele pergunta; fecha ao escolher, ao digitar a carga ou com a série feita.
  const [painel, setPainel] = useState<number | null>(null);
  const campoDaCarga = useRef<TextInput>(null);
  // Largura da área "Hoje": abaixo de LARGURA_UMA_LINHA a meta e o peso ficam numa linha e as repetições e o ✓ na de baixo.
  const [largura, setLargura] = useState<number | null>(null);
  // Série já gravada: o número digitado só volta gravado depois (B1, 30/10). Até lá a caixa mostra o digitado, senão ela
  // voltava ao antigo e a tecla seguinte somava a ele ("5", "0" gravava 420). Some quando a gravação chega ou o registro muda por fora.
  // `undefined` no gravado = sem registro (o pendente cai); `null` = campo vazio gravado.
  const [pendenteDaCarga, setPendenteDaCarga] = useState<ValorPendente<number | null | undefined> | undefined>(undefined);
  const [pendenteDasReps, setPendenteDasReps] = useState<ValorPendente<number | null | undefined> | undefined>(undefined);
  const cargaAcompanhada = acompanharPendente(pendenteDaCarga, registro?.carga);
  const repsAcompanhadas = acompanharPendente(pendenteDasReps, registro?.repeticoes);
  if (cargaAcompanhada !== pendenteDaCarga) setPendenteDaCarga(cargaAcompanhada);
  if (repsAcompanhadas !== pendenteDasReps) setPendenteDasReps(repsAcompanhadas);
  const carga = cargaIlegivel ? null : registro ? (valorExibido(cargaAcompanhada, registro.carga) ?? null) : cargaDigitada;
  // Sem campo de peso: exercício sem carga ou série de forma de carga desconhecida (a meta continua mostrando o texto da carga).
  const semCampoDePeso = semCarga || cargaIlegivel;
  const reps = registro ? (valorExibido(repsAcompanhadas, registro.repeticoes) ?? null) : repsDigitadas;
  const feita = !!registro?.concluida;
  const reduzido = useMovimentoReduzido();
  const progresso = useSharedValue(feita ? 1 : 0);
  useEffect(() => {
    progresso.set(reduzido ? (feita ? 1 : 0) : withTiming(feita ? 1 : 0, { duration: feita ? 200 : 150 }));
  }, [feita, reduzido, progresso]);
  // O cartão fica na superfície (Frente G, D10): a cor do tipo é só a barra e o selo; o verde da série feita é status.
  const fundo = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(progresso.get(), [0, 1], [cores.superficie, `${cores.sucesso}29`]) }));
  const s = calculada.serie;
  const numero = indice + 1;
  const textos = textosDaSerie(s, { tipoTrabalho, semCarga, metodologia, descansoPorSerie: descansoNaSerie, unidade });
  const meta = partesDaMeta(textos.valorDaMeta);
  const selos = selosDaSerie(s, metodologia);
  const barra = barraDoTipo(selos.tipo?.cor ? identificacao[selos.tipo.cor].cor : null);
  const pausa = s.tecnica?.pausaSegundos != null && s.tecnica.pausaSegundos > 0 ? s.tecnica.pausaSegundos : null;

  // Dica ao lado do campo (D1): "Sugestão: 60 kg · Última vez: 60 kg × 7". A "Última vez" é a da carga de trabalho do
  // exercício (D7), então só entra nas séries de trabalho; nas outras a dica fica com a sugestão. "Primeira vez" só quando o
  // exercício nunca teve carga registrada.
  // Com a caixa da base vazia (D1), "da base do dia" não diria a verdade: a conta partiu da última carga.
  const origem = semCampoDePeso || calculada.sugestao == null ? null : textoDaOrigem(calculada, { tipoTrabalho, metodologia, baseDaUltimaVez });
  const dicaDoDominio = dicaDeCarga({ sugestaoKg: calculada.sugestao, ultima: ehSerieDeTrabalho(s) ? ultimaCarga : null, semCampoDePeso, unidade });
  const dica = feita ? null : (dicaDoDominio === TEXTO_PRIMEIRA_VEZ && ultimaCarga ? null : dicaDoDominio);
  // A carga só entra na conta das séries seguintes com o ✓ (regra de sempre, N15): a dica diz isso enquanto não foi marcada.
  const avisoDoMarcar = !semCampoDePeso && !registro && (ativa || cargaDigitada !== null) && seriesSeguintesDependemDesta(seriesDoExercicio, indice);

  // D11: só texto, nunca um valor em kg.
  const avisoDasReps = avisoDeRepeticoes(s, reps, metodologia);

  const decisao = decidirCheck({ feita, carga: semCampoDePeso ? null : carga, repeticoes: reps, sugestaoKg: calculada.sugestao, semCampoDePeso });
  // N6: série marcada sem kg num exercício com carga não entra no progresso; o aviso fica junto da série.
  const semCargaNaSerie = avisoDeSerieSemCarga({ feita, carga, semCampoDePeso, ehTrabalho: ehSerieDeTrabalho(s) || papelDe(metodologia, s.tipo) === 'TRABALHO' });
  const painelAberto = painel !== null && !feita;
  // O painel não sobrevive à série marcada por outro caminho (como o "Repetir"): zera na hora, sem efeito.
  if (feita && painel !== null) setPainel(null);

  const mudar = (parcial: Partial<DadosSerie>) => {
    if ('carga' in parcial) setPainel(null);
    if (registro) {
      if ('carga' in parcial) setPendenteDaCarga(digitarPendente(cargaAcompanhada, parcial.carga ?? null, registro.carga));
      if ('repeticoes' in parcial) setPendenteDasReps(digitarPendente(repsAcompanhadas, parcial.repeticoes ?? null, registro.repeticoes));
      // Vai o que a caixa mostra nos dois campos (o outro pode ter uma tecla ainda não gravada).
      aoRegistrar({ carga, repeticoes: reps, concluida: feita, ...parcial });
    } else {
      if ('carga' in parcial) setCargaDigitada(parcial.carga ?? null);
      if ('repeticoes' in parcial) setRepsDigitadas(parcial.repeticoes ?? null);
    }
  };

  // ✓: com a carga vazia e sugestão, abre o painel na tela; senão grava o que está nos campos (inclusive desmarcar).
  const marcar = () => {
    if (decisao.acao === 'PAINEL') {
      setPainel(decisao.sugestaoKg);
      return;
    }
    setPainel(null);
    aoRegistrar(decisao.gravar);
  };

  const escolher = (escolha: EscolhaDoPainel) => {
    if (painel === null) return;
    const r = aplicarEscolhaDoPainel(escolha, painel, reps);
    setPainel(null);
    if (r.gravar) aoRegistrar(r.gravar);
    else campoDaCarga.current?.focus();
  };

  const umaLinha = largura === null || largura >= LARGURA_UMA_LINHA;
  const metaAoLado = (
    <View style={umaLinha ? estilos.metaNaLinha : estilos.metaEmCima}>
      <MetaAoLado repeticoes={meta.repeticoes} resto={meta.resto} descanso={textos.descanso} numero={numero} />
    </View>
  );
  const campoDoPeso = semCampoDePeso ? null : (
    <CampoDeCarga
      ref={campoDaCarga}
      rotulo="Peso"
      rotuloOculto
      rotuloAcessivel={`Peso da série ${numero}`}
      valorKg={carga}
      aoMudarKg={(v) => mudar({ carga: v })}
      aoValidade={(v) => setCargaInvalida(!v)}
    />
  );
  const repsEMarcar = (
    <>
      <CampoNumericoGrande
        rotulo="Reps"
        rotuloOculto
        rotuloAcessivel={`Repetições da série ${numero}`}
        sufixo="reps"
        inteiro
        valor={reps}
        aoMudar={(v) => mudar({ repeticoes: v })}
        aoValidade={(v) => setRepsInvalidas(!v)}
      />
      <BotaoMarcar
        feito={feita}
        ultimaDoExercicio={ultimaDoExercicio}
        desabilitado={invalido}
        semVibrar={decisao.acao === 'PAINEL'}
        rotulo={invalido ? `Série ${numero} feita: corrija o número antes de marcar` : `Série ${numero} feita`}
        aoTocar={marcar}
      />
    </>
  );

  return (
    <Animated.View testID={`serie-${s.uid}`} style={[estilos.serie, { borderColor: feita ? cores.sucesso : cores.borda }, barra, fundo]}>
      <CabecalhoDaSerie numero={numero} tipo={selos.tipo} tecnica={selos.tecnica} recordes={recordes} registro={feita ? 'FEITA' : null} />
      {textos.alvoExtra ? <Texto numerico variante="pequeno">Observação desta série: {textos.alvoExtra}</Texto> : null}
      {textos.amrap ? <Texto numerico variante="pequeno">AMRAP: faça o máximo de repetições que conseguir e anote quantas fez.</Texto> : null}
      {textos.tecnica ? (
        <View style={estilos.tecnica}>
          <Texto numerico style={estilos.tecnicaTexto}>{textos.tecnica}</Texto>
          {pausa !== null && aoIniciarPausa ? (
            <Botao rotulo={`Pausa de ${pausa} s`} rotuloAcessivel={`Iniciar pausa de ${pausa} segundos da série ${numero}`} tipo="secundario" Icone={Timer} aoTocar={() => aoIniciarPausa(pausa)} />
          ) : null}
        </View>
      ) : null}
      {anterior != null ? <LinhaDoUltimoRegistro texto={anterior} numero={numero} /> : null}
      {recordes?.length ? (
        <Texto numerico variante="pequeno" cor={cores.sucesso} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {recordes.map((r) => textoDoRecorde(r, unidade)).join(' · ')}
        </Texto>
      ) : null}
      <RotuloDeHoje />
      {/* D5: a meta de repetições, grande, ao lado do campo de carga. Largo: meta, peso, reps e ✓ numa linha; estreito,
          meta e peso em cima e reps e ✓ embaixo (para os números nos campos continuarem legíveis). */}
      <View style={estilos.hoje} onLayout={(ev) => setLargura(ev.nativeEvent.layout.width)}>
        {umaLinha ? (
          <View style={estilos.linhaDosCampos}>
            {metaAoLado}
            {campoDoPeso}
            {repsEMarcar}
          </View>
        ) : (
          <>
            <View style={estilos.linhaDosCampos}>
              {metaAoLado}
              {campoDoPeso}
            </View>
            <View style={estilos.linhaDosCampos}>{repsEMarcar}</View>
          </>
        )}
      </View>
      {invalido ? <Texto variante="pequeno" cor={cores.perigo} accessibilityLiveRegion="polite">{textoDoNumeroInvalido(cargaInvalida, repsInvalidas)}</Texto> : null}
      {semCargaNaSerie ? <Texto variante="pequeno" cor={cores.texto} accessibilityLiveRegion="polite">{semCargaNaSerie}</Texto> : null}
      {dica ? <DicaDoCampo dica={dica} origem={origem} numero={numero} /> : null}
      {avisoDasReps ? <Texto numerico variante="pequeno" cor={cores.texto} accessibilityLiveRegion="polite">{avisoDasReps}</Texto> : null}
      {painelAberto ? <PainelDoCheck sugestaoKg={painel} numero={numero} aoEscolher={escolher} /> : null}
      {avisoDoMarcar ? <Texto numerico variante="pequeno">As séries seguintes só usam este peso depois que você marcar a série como feita.</Texto> : null}
      {!semCampoDePeso && passo !== null ? (
        <AjusteDeCarga passo={passo} rotulo={`peso da série ${numero}`}
          aoAjustar={(sentido) => mudar({ carga: ajustarCarga(carga, calculada.sugestao, passo, sentido, unidade) })} />
      ) : null}
      {repetir && !feita ? (
        <Botao rotulo={repetir.rotulo} rotuloAcessivel={`${repetir.rotulo} da série ${indice} e marcar a série ${numero} como feita`} tipo="fantasma" Icone={Repeat}
          aoTocar={() => aoRegistrar({ carga: repetir.carga, repeticoes: repetir.repeticoes, concluida: true })} />
      ) : null}
      {registro?.situacao === 'FALHOU' ? <Texto numerico variante="pequeno" cor={cores.perigo}>Não enviado: {registro.motivo}</Texto> : null}
    </Animated.View>
  );
}

/** Abaixo desta largura da área "Hoje" (celular de 390 px) a meta e o peso ficam numa linha e as reps e o ✓ na outra. */
const LARGURA_UMA_LINHA = 440;

const estilos = StyleSheet.create({
  exercicio: { gap: espaco(1.5) },
  linhaComoFazer: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5) },
  comoFazer: { flex: 1, minWidth: 0, minHeight: ALVO_TOQUE, flexDirection: 'row', alignItems: 'center', gap: espaco(1), borderRadius: RAIO, paddingHorizontal: espaco(0.5) },
  comoFazerTextos: { flex: 1, minWidth: 0 },
  comoFazerTitulo: { fontFamily: fontes.semi },
  espaco: { flex: 1 },
  observacao: { fontStyle: 'italic' },
  linhaPasso: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), maxWidth: 360 },
  tituloSeries: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: espaco(0.5), gap: espaco(1) },
  serie: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), gap: espaco(1) },
  tecnica: { gap: espaco(1), alignItems: 'flex-start' },
  tecnicaTexto: { fontFamily: fontes.semi },
  hoje: { gap: espaco(1), maxWidth: 560 },
  linhaDosCampos: { flexDirection: 'row', alignItems: 'stretch', gap: espaco(1) },
  metaNaLinha: { flexGrow: 1.3, flexShrink: 1, flexBasis: 0, minWidth: 0 },
  metaEmCima: { flex: 1, minWidth: 0 },
});
