import { ChevronDown, ChevronUp, PlayCircle, Repeat, Timer } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import type { AnteriorDoExercicio, Configuracao, DemonstracaoDoAluno, EtapaRegistrada, ExercicioPlano, OrigemDaReferencia, Serie, UltimaCarga } from '../api/tipos';
import { ajustarCarga, calcularCargasDoExercicio, cargaQueContaComoReferencia, passoDaCarga, seriesSeguintesDependemDesta, textoDaOrigem, usaCargaDeTrabalho, type SerieCalculada } from '../dominio/cargas';
import { etapasDaSerie } from '../dominio/etapas';
import { textosDeExecucao } from '../dominio/execucaoDoExercicio';
import { dataCurta, dataParaTela, numeroParaTela } from '../dominio/formatos';
import { textoDoRecorde, type Recorde } from '../dominio/recordesPessoais';
import { acompanharPendente, digitarPendente, valorExibido, type ValorPendente } from '../dominio/valorPendente';
import { repeticaoDaAnterior } from '../dominio/repetirSerie';
import { anteriorDaSerie, textoDaUltimaVez, textoDoAnterior } from '../dominio/seriesAnteriores';
import { videoValido } from '../dominio/video';
import type { RegistroLocal } from '../offline/repositorioLocal';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../tema/tokens';
import { AjusteDeCarga, BotaoDePasso } from '../ui/AjusteDeCarga';
import { useAviso } from '../ui/Aviso';
import { Botao } from '../ui/Botao';
import { BotaoMarcar } from '../ui/BotaoMarcar';
import { CampoNumericoGrande } from '../ui/Campos';
import { Cartao } from '../ui/Cartao';
import { DemonstracaoDoExercicio } from '../ui/DemonstracaoDoExercicio';
import { IconeBotao } from '../ui/IconeBotao';
import { sobre } from '../ui/sobre';
import { Texto } from '../ui/Texto';
import { useMovimentoReduzido } from '../ui/useMovimentoReduzido';
import { CartaoSerieComEtapas } from './CartaoSerieComEtapas';
import { CartaoSerieDeCardio } from './CartaoSerieDeCardio';
import { CabecalhoDaSerie, LinhaDaSugestao, LinhaDoUltimoRegistro, MetaDaSerie, RotuloDeHoje } from './PartesDaSerie';
import { dicaDaCarga, ehExercicioDeCardio, selosDaSerie, textosDaSerie } from './serieDoAluno';

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
}

/**
 * Exercício na tela do aluno, enxuto para a academia (revisão de 19/10: em 390/360 a primeira série ficava abaixo da
 * dobra). Uma linha com "Como fazer" (observação, cadência, isometria; fechado mostra só o começo da observação), vídeo e
 * descanso como ícones; a carga de trabalho do dia em uma linha `[−] campo [+]`; e um cartão por série com a meta, o
 * descanso e a técnica da própria série. Os −/+ do peso aparecem só na próxima série a fazer. O ✓ grava no aparelho.
 */
export function ExercicioAluno(p: Props) {
  const { cores } = useTema();
  const { avisar } = useAviso();
  const e = p.exercicio;
  const [comoFazerAberto, abrirComoFazer] = useState(false);
  const base = p.cargaDoDia ?? p.ultima?.carga ?? null;
  // A base digitada chega gravada depois (B1, 30/10): a caixa mostra o que foi digitado até lá. A conta das séries continua
  // usando só a base gravada (`base`), como antes.
  const [pendenteDaBase, setPendenteDaBase] = useState<ValorPendente<number | null> | undefined>(undefined);
  const baseAcompanhada = acompanharPendente(pendenteDaBase, p.cargaDoDia);
  if (baseAcompanhada !== pendenteDaBase) setPendenteDaBase(baseAcompanhada);
  const baseNaCaixa = baseAcompanhada ? baseAcompanhada.valor : base;
  const mudarBase = (v: number | null) => {
    setPendenteDaBase(digitarPendente(baseAcompanhada, v, p.cargaDoDia));
    p.aoMudarCargaDoDia(v);
  };
  const cargasDoDia: Record<string, number | null> = {};
  // Só a carga de série feita (ou com etapa feita) serve de referência: desmarcar tira da conta (31/10).
  for (const s of e.series) cargasDoDia[s.uid] = cargaQueContaComoReferencia(p.registroDe(s.uid));
  const calculadas = calcularCargasDoExercicio(e, base, cargasDoDia, p.config);
  const feitas = e.series.filter((s) => p.registroDe(s.uid)?.concluida).length;
  const proximaAFazer = e.series.findIndex((s) => !p.registroDe(s.uid)?.concluida);
  const passo = passoDaCarga(e, p.config.arredondamentoKg);
  const semCarga = e.unidade === 'nenhuma';
  const cardio = ehExercicioDeCardio(e);
  const video = videoValido(e.videoUrl);
  const comoFazer = [
    ...(!e.progressao ? ['Foco em controle, não em carga.'] : []),
    ...textosDeExecucao(e),
  ];
  const temComoFazer = !!e.observacao || comoFazer.length > 0;
  const ultima = cardio ? null : (p.ultimaVez ?? null);
  /** "60 kg × 8" da mesma série da última vez; `null` = sem a linha (nunca feito). */
  const anterior = (i: number) => (ultima ? textoDoAnterior(anteriorDaSerie(ultima, e, i), semCarga) : null);

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
          {video ? <IconeBotao Icone={PlayCircle} rotulo={`Ver vídeo de ${e.nome}`} aoTocar={abrirVideo} /> : null}
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
              <BotaoDePasso sentido={-1} passo={passo} rotulo="carga de trabalho" aoAjustar={(s) => mudarBase(ajustarCarga(baseNaCaixa, null, passo, s))} />
            ) : null}
            <CampoNumericoGrande
              rotulo="Carga de trabalho do dia"
              rotuloOculto
              sufixo="kg"
              valor={baseNaCaixa}
              aoMudar={mudarBase}
            />
            {passo !== null ? (
              <BotaoDePasso sentido={1} passo={passo} rotulo="carga de trabalho" aoAjustar={(s) => mudarBase(ajustarCarga(baseNaCaixa, null, passo, s))} />
            ) : null}
          </View>
          <Texto numerico variante="pequeno">
            {p.ultima?.carga != null
              ? `Última vez: ${numeroParaTela(p.ultima.carga)} kg × ${p.ultima.repeticoes ?? '—'} em ${dataParaTela(p.ultima.data)}.`
              : 'Sem registro anterior.'}
          </Texto>
          <Texto numerico variante="pequeno">
            {`É o ponto de partida do dia. Depois que você registrar a ${p.config.tipoTrabalho} nesta sessão (com o ✓), as séries em "% da ${p.config.tipoTrabalho}" passam a sair dela.`}
          </Texto>
        </Cartao>
      ) : null}
      <View style={estilos.tituloSeries}>
        <Texto variante="bloco">Séries</Texto>
        <Texto numerico variante="pequeno">
          {feitas} de {e.series.length} feitas
        </Texto>
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
            semCarga={semCarga}
            metodologia={p.config.metodologia}
            tipoTrabalho={p.config.tipoTrabalho}
            seriesDoExercicio={e.series}
            arredondamentoKg={p.config.arredondamentoKg}
            descansoNaSerie={p.descansoNaSerie ?? true}
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
            tipoTrabalho={p.config.tipoTrabalho}
            metodologia={p.config.metodologia}
            seriesDoExercicio={e.series}
            descansoNaSerie={p.descansoNaSerie ?? true}
            passo={i === proximaAFazer ? passo : null}
            ativa={i === proximaAFazer}
            registro={p.registroDe(c.serie.uid)}
            repetir={i > 0 ? repeticaoDaAnterior(e.series[i - 1], c.serie, p.registroDe(e.series[i - 1]!.uid), semCarga) : null}
            ultimaDoExercicio={feitas === e.series.length - 1}
            recordes={p.recordes?.[c.serie.uid] ?? null}
            anterior={anterior(i)}
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
}: {
  calculada: SerieCalculada;
  indice: number;
  semCarga: boolean;
  tipoTrabalho: string;
  metodologia?: Configuracao;
  /** As séries do exercício: dão o nome da série de referência do back off. */
  seriesDoExercicio: readonly Serie[];
  /** Mostra o "Descanso X" da série (falso nos membros de grupo cujo descanso é o do grupo). */
  descansoNaSerie: boolean;
  /** Passo dos botões + e − do peso; `null` esconde os botões (só a próxima série a fazer os mostra). */
  passo: number | null;
  /** É a próxima série a fazer: mostra a dica da carga sugerida. */
  ativa: boolean;
  registro: RegistroLocal | undefined;
  /** "Repetir 40 kg × 6": só quando a anterior tem a mesma prescrição e algo registrado (`repeticaoDaAnterior`). */
  repetir: ReturnType<typeof repeticaoDaAnterior>;
  aoRegistrar: (d: DadosSerie) => void;
  ultimaDoExercicio: boolean;
  aoIniciarPausa?: (segundos: number) => void;
  /** Recordes pessoais desta série na data (vazio ou nulo = nenhum). */
  recordes: Recorde[] | null;
  /** O que foi feito nesta série da última vez ("60 kg × 8" ou "—"); nulo = sem a linha. */
  anterior: string | null;
}) {
  const { cores } = useTema();
  // Antes de gravar, a carga acompanha a sugestão até o aluno mexer; as repetições começam vazias.
  const [cargaDigitada, setCargaDigitada] = useState<number | null | undefined>(undefined);
  const [repsDigitadas, setRepsDigitadas] = useState<number | null>(null);
  // Texto que não é número ("abc") deixava marcar a série com o valor nulo: o ✓ fica travado até corrigir.
  const [cargaInvalida, setCargaInvalida] = useState(false);
  const [repsInvalidas, setRepsInvalidas] = useState(false);
  const invalido = cargaInvalida || repsInvalidas;
  // Série já gravada: o número digitado só volta gravado depois (B1, 30/10). Até lá a caixa mostra o digitado, senão ela
  // voltava ao antigo e a tecla seguinte somava a ele ("5", "0" gravava 420). Some quando a gravação chega ou o registro muda por fora.
  // `undefined` no gravado = sem registro (o pendente cai); `null` = campo vazio gravado.
  const [pendenteDaCarga, setPendenteDaCarga] = useState<ValorPendente<number | null | undefined> | undefined>(undefined);
  const [pendenteDasReps, setPendenteDasReps] = useState<ValorPendente<number | null | undefined> | undefined>(undefined);
  const cargaAcompanhada = acompanharPendente(pendenteDaCarga, registro?.carga);
  const repsAcompanhadas = acompanharPendente(pendenteDasReps, registro?.repeticoes);
  if (cargaAcompanhada !== pendenteDaCarga) setPendenteDaCarga(cargaAcompanhada);
  if (repsAcompanhadas !== pendenteDasReps) setPendenteDasReps(repsAcompanhadas);
  const carga = registro ? (valorExibido(cargaAcompanhada, registro.carga) ?? null) : cargaDigitada !== undefined ? cargaDigitada : calculada.sugestao;
  const reps = registro ? (valorExibido(repsAcompanhadas, registro.repeticoes) ?? null) : repsDigitadas;
  const feita = !!registro?.concluida;
  const reduzido = useMovimentoReduzido();
  const progresso = useSharedValue(feita ? 1 : 0);
  useEffect(() => {
    progresso.set(reduzido ? (feita ? 1 : 0) : withTiming(feita ? 1 : 0, { duration: feita ? 200 : 150 }));
  }, [feita, reduzido, progresso]);
  const fundo = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(progresso.get(), [0, 1], [cores.superficie2, `${cores.sucesso}29`]) }));
  const s = calculada.serie;
  const numero = indice + 1;
  const textos = textosDaSerie(s, { tipoTrabalho, semCarga, metodologia, seriesDoExercicio, descansoPorSerie: descansoNaSerie });
  const selos = selosDaSerie(s, metodologia);
  const pausa = s.tecnica?.pausaSegundos != null && s.tecnica.pausaSegundos > 0 ? s.tecnica.pausaSegundos : null;

  // De onde saiu o peso sugerido (A9): a frase troca o genérico "Peso sugerido pelo plano"; a dica fica para o que falta.
  const origem = semCarga ? null : textoDaOrigem(calculada, { tipoTrabalho, metodologia, series: seriesDoExercicio });
  const mostrarSugestao = !semCarga && !feita && calculada.sugestao != null;
  const dica = ativa && !semCarga && !registro && !(mostrarSugestao && origem)
    ? dicaDaCarga(s, { sugestao: calculada.sugestao, digitou: cargaDigitada !== undefined, tipoTrabalho, metodologia, seriesDoExercicio })
    : null;
  // A carga só entra na conta das séries seguintes com o ✓ (regra de sempre, N15): a dica diz isso enquanto não foi marcada.
  const avisoDoMarcar = !semCarga && !registro && (ativa || cargaDigitada !== undefined) && seriesSeguintesDependemDesta(seriesDoExercicio, indice);

  const mudar = (parcial: Partial<DadosSerie>) => {
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

  return (
    <Animated.View style={[estilos.serie, { borderColor: feita ? cores.sucesso : cores.borda }, fundo]}>
      <CabecalhoDaSerie numero={numero} tipo={selos.tipo} tecnica={selos.tecnica} recordes={recordes} naoRegistrada={!feita} />
      <MetaDaSerie texto={textos.valorDaMeta} complemento={textos.descanso} />
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
          {recordes.map(textoDoRecorde).join(' · ')}
        </Texto>
      ) : null}
      <RotuloDeHoje />
      <View style={estilos.campos}>
        {semCarga ? null : (
          <CampoNumericoGrande
            rotulo="Peso"
            rotuloOculto
            rotuloAcessivel={`Peso da série ${numero}, em quilos`}
            sufixo="kg"
            valor={carga}
            aoMudar={(v) => mudar({ carga: v })}
            aoValidade={(v) => setCargaInvalida(!v)}
          />
        )}
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
          rotulo={invalido ? `Série ${numero} feita: corrija o número antes de marcar` : `Série ${numero} feita`}
          aoTocar={() => aoRegistrar({ carga: semCarga ? null : carga, repeticoes: reps, concluida: !feita })}
        />
      </View>
      {invalido ? <Texto variante="pequeno" cor={cores.perigo}>Corrija o número para marcar a série.</Texto> : null}
      {mostrarSugestao ? <LinhaDaSugestao sugestao={calculada.sugestao!} origem={origem} /> : null}
      {avisoDoMarcar ? <Texto numerico variante="pequeno">As séries seguintes só usam este peso depois que você marcar ✓.</Texto> : null}
      {!semCarga && passo !== null ? (
        <AjusteDeCarga passo={passo} rotulo={`peso da série ${numero}`}
          aoAjustar={(sentido) => mudar({ carga: ajustarCarga(carga, calculada.sugestao, passo, sentido) })} />
      ) : null}
      {repetir && !feita ? (
        <Botao rotulo={repetir.rotulo} rotuloAcessivel={`${repetir.rotulo} da série ${indice} e marcar a série ${numero} como feita`} tipo="fantasma" Icone={Repeat}
          aoTocar={() => aoRegistrar({ carga: repetir.carga, repeticoes: repetir.repeticoes, concluida: true })} />
      ) : null}
      {dica ? <Texto numerico variante="pequeno">{dica}</Texto> : null}
      {registro?.situacao === 'FALHOU' ? <Texto numerico variante="pequeno" cor={cores.perigo}>Não enviado: {registro.motivo}</Texto> : null}
    </Animated.View>
  );
}

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
  campos: { flexDirection: 'row', alignItems: 'flex-end', gap: espaco(1), maxWidth: 480 },
});
