import { Repeat, Timer } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Configuracao, Serie } from '../api/tipos';
import { avisoDeSerieSemCarga, textoDoNumeroInvalido } from '../dominio/avisoDaSerie';
import { avisoDeRepeticoes } from '../dominio/avisoDeRepeticoes';
import { ehSerieDeTrabalho, seriesSeguintesDependemDesta, type SerieCalculada } from '../dominio/cargas';
import { checkHabilitado, marcarSerie, valoresDaSerie, type EntradaDaMarcacao } from '../dominio/marcarSerie';
import { papelDe } from '../dominio/metodologia';
import type { MudancaDoRascunho, RascunhoDaSerie } from '../dominio/rascunhoDaSerie';
import type { Recorde } from '../dominio/recordesPessoais';
import type { repeticaoDaAnterior } from '../dominio/repetirSerie';
import { metaDaLinhaDaSerie } from '../dominio/telaDoExercicio';
import { numeroDaCarga, textoDaCarga } from '../dominio/unidadeDeCarga';
import { acompanharPendente, digitarPendente, valorExibido, type ValorPendente } from '../dominio/valorPendente';
import type { RegistroLocal } from '../offline/repositorioLocal';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes } from '../tema/tokens';
import { StepperDeCarga } from '../ui/AjusteDeCarga';
import { Botao } from '../ui/Botao';
import { CampoNumericoGrande } from '../ui/Campos';
import { Texto } from '../ui/Texto';
import { useUnidadeDeCarga } from '../ui/unidadeDeCargaEmUso';
import { CartaoDaSerie } from './CartaoDaSerie';
import type { DadosSerie } from './ExercicioAluno';
import { MarcarSerie } from './MarcarSerie';
import { CabecalhoDaSerie, LinhaDoUltimoRegistro } from './PartesDaSerie';
import { selosDaSerie, textosDaSerie } from './serieDoAluno';

/**
 * Uma série na tela do exercício (redesenho de 25/11): cabeçalho com "Série N", o selo do tipo na cor dele e a meta à
 * direita; embaixo, `[− | kg | +] [reps] [✓]`, todos com 52 px. A carga sugerida fica apagada dentro do campo, com a
 * legenda "sugerido", e só vira valor com o ✓ (`dominio/marcarSerie`). Antes do ✓ o digitado vai para o rascunho do
 * aparelho (`salvarRascunho`); com registro (feita ou desmarcada), cada mudança regrava o registro, como sempre.
 * O cartão fica pintado na cor do tipo, com a faixa reta à esquerda (`CartaoDaSerie`, 25/11): a ativa (a primeira não
 * feita) ganha a borda de ação por cima, a pendente fica mais apagada e a feita continua na cor do tipo, com "90 kg × 7",
 * "Editar", o selo "Feita" e o ✓ verde.
 */
export function LinhaDaSerie({
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
  rascunho,
  salvarRascunho,
  repetir,
  aoRegistrar,
  ultimaDoExercicio,
  aoIniciarPausa,
  recordes,
  anterior,
  arredondamentoKg,
}: {
  calculada: SerieCalculada;
  indice: number;
  semCarga: boolean;
  /** Forma de carga mais nova que o app: sem campo de peso; o texto "atualize o app" vem na técnica/meta. */
  cargaIlegivel: boolean;
  tipoTrabalho: string;
  metodologia?: Configuracao;
  seriesDoExercicio: readonly Serie[];
  descansoNaSerie: boolean;
  /** Passo do −/+ (`passoDaCarga`); `null` = sem botões. */
  passo: number | null;
  /** A primeira série não feita: borda na cor de ação. */
  ativa: boolean;
  registro: RegistroLocal | undefined;
  /** O digitado antes do ✓ (só vale sem registro). */
  rascunho: Pick<RascunhoDaSerie, 'carga' | 'repeticoes'> | null;
  salvarRascunho: (mudanca: MudancaDoRascunho | null) => void;
  repetir: ReturnType<typeof repeticaoDaAnterior>;
  aoRegistrar: (d: DadosSerie) => void;
  ultimaDoExercicio: boolean;
  aoIniciarPausa?: (segundos: number) => void;
  recordes: Recorde[] | null;
  /** O que foi feito nesta série da última vez ("60 kg × 8" ou "—"); nulo = sem a linha (chave do retorno desligada). */
  anterior: string | null;
  arredondamentoKg: number;
}) {
  const { cores } = useTema();
  const unidade = useUnidadeDeCarga();
  const [cargaInvalida, setCargaInvalida] = useState(false);
  const [repsInvalidas, setRepsInvalidas] = useState(false);
  const invalido = cargaInvalida || repsInvalidas;
  const [editando, setEditando] = useState(false);
  // Série com registro: o número digitado só volta gravado depois (B1, 30/10); até lá a caixa mostra o digitado.
  const [pendenteDaCarga, setPendenteDaCarga] = useState<ValorPendente<number | null | undefined> | undefined>(undefined);
  const [pendenteDasReps, setPendenteDasReps] = useState<ValorPendente<number | null | undefined> | undefined>(undefined);
  const cargaAcompanhada = acompanharPendente(pendenteDaCarga, registro?.carga);
  const repsAcompanhadas = acompanharPendente(pendenteDasReps, registro?.repeticoes);
  if (cargaAcompanhada !== pendenteDaCarga) setPendenteDaCarga(cargaAcompanhada);
  if (repsAcompanhadas !== pendenteDasReps) setPendenteDasReps(repsAcompanhadas);

  const semCampoDePeso = semCarga || cargaIlegivel;
  const carga = semCampoDePeso ? null : registro ? (valorExibido(cargaAcompanhada, registro.carga) ?? null) : (rascunho?.carga ?? null);
  const reps = registro ? (valorExibido(repsAcompanhadas, registro.repeticoes) ?? null) : (rascunho?.repeticoes ?? null);
  const feita = !!registro?.concluida;
  // Editar abre os campos; marcar ou desmarcar fecha (a série desmarcada já mostra os campos de novo).
  if (editando && !feita) setEditando(false);
  const s = calculada.serie;
  const numero = indice + 1;
  const textos = textosDaSerie(s, { tipoTrabalho, semCarga, metodologia, descansoPorSerie: descansoNaSerie, unidade });
  const selos = selosDaSerie(s, metodologia);
  const meta = metaDaLinhaDaSerie(s);
  const pausa = s.tecnica?.pausaSegundos != null && s.tecnica.pausaSegundos > 0 ? s.tecnica.pausaSegundos : null;

  const entrada: EntradaDaMarcacao = { feita, carga, repeticoes: reps, sugestaoKg: semCampoDePeso ? null : calculada.sugestao, sugestaoReps: calculada.sugestaoReps, semCampoDePeso, invalido };
  const valores = valoresDaSerie(entrada);
  const pronta = checkHabilitado(entrada);
  const motivo = feita || pronta || invalido ? null : !semCampoDePeso && valores.carga === null ? 'digite a carga' : 'digite as repetições';

  const mudar = (parcial: MudancaDoRascunho) => {
    if (registro) {
      if ('carga' in parcial) setPendenteDaCarga(digitarPendente(cargaAcompanhada, parcial.carga ?? null, registro.carga));
      if ('repeticoes' in parcial) setPendenteDasReps(digitarPendente(repsAcompanhadas, parcial.repeticoes ?? null, registro.repeticoes));
      // Vai o que a caixa mostra nos dois campos (o outro pode ter uma tecla ainda não gravada).
      aoRegistrar({ carga, repeticoes: reps, concluida: feita, ...parcial });
    } else {
      salvarRascunho(parcial);
    }
  };
  const marcar = () => {
    const gravar = marcarSerie(entrada);
    if (gravar) aoRegistrar(gravar);
  };

  const avisoDasReps = avisoDeRepeticoes(s, reps, metodologia, arredondamentoKg, unidade);
  const semCargaNaSerie = avisoDeSerieSemCarga({ feita, carga, semCampoDePeso, ehTrabalho: ehSerieDeTrabalho(s) || papelDe(metodologia, s.tipo) === 'TRABALHO' });
  // N15: a carga digitada só conta para as seguintes com o ✓; o aviso só aparece enquanto há carga digitada e sem registro.
  const avisoDoMarcar = !semCampoDePeso && !registro && rascunho?.carga != null && seriesSeguintesDependemDesta(seriesDoExercicio, indice);
  const resumida = feita && !editando;
  const resumo = semCampoDePeso ? `${reps ?? '—'} reps` : `${carga != null ? textoDaCarga(carga, unidade) : '—'} × ${reps ?? '—'}`;

  const cabecalho = (
    <View style={estilos.cabecalho}>
      <View style={estilos.cabecalhoEsq}>
        <CabecalhoDaSerie numero={numero} tipo={selos.tipo} tecnica={selos.tecnica} recordes={recordes} registro={feita ? 'FEITA' : null} agora={feita} />
      </View>
      {!resumida && meta ? <Texto numerico style={estilos.meta} cor={cores.texto}>{meta}</Texto> : null}
    </View>
  );

  return (
    <CartaoDaSerie testID={`serie-${s.uid}`} corDoTipo={selos.tipo?.cor ?? null} estado={feita ? 'FEITA' : ativa ? 'ATIVA' : 'PENDENTE'}>
      {cabecalho}
      {resumida ? (
        <View style={estilos.linhaFeita}>
          <Texto numerico style={estilos.resumo} cor={cores.texto} accessibilityLabel={`Série ${numero} feita: ${resumo}`}>{resumo}</Texto>
          <Botao rotulo="Editar" rotuloAcessivel={`Editar série ${numero}`} tipo="secundario" tamanho="pequeno" aoTocar={() => setEditando(true)} />
          <MarcarSerie estado="FEITA" numero={numero} ultimaDoExercicio={ultimaDoExercicio} aoTocar={marcar} />
        </View>
      ) : (
        <>
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
          <View style={estilos.linhaDosCampos}>
            {semCampoDePeso ? (
              <View style={estilos.semPeso}>
                <Texto variante="pequeno">{cargaIlegivel ? 'Carga: atualize o app para ver' : 'Sem carga'}</Texto>
              </View>
            ) : (
              <View style={estilos.peso}>
                <StepperDeCarga
                  estreito
                  valorKg={carga}
                  sugestaoKg={calculada.sugestao}
                  passo={passo}
                  rotulo={`carga da série ${numero}`}
                  rotuloDoCampo={`Carga da série ${numero}`}
                  aoMudarKg={(v) => mudar({ carga: v })}
                  aoValidade={(v) => setCargaInvalida(!v)}
                  placeholder={valores.cargaEhSugestao ? numeroDaCarga(calculada.sugestao, unidade) : undefined}
                  ajuda={valores.cargaEhSugestao ? 'sugerido' : undefined}
                />
              </View>
            )}
            <View style={estilos.reps}>
              <CampoNumericoGrande
                rotulo="Reps"
                rotuloOculto
                rotuloAcessivel={`Repetições da série ${numero}`}
                inteiro
                valor={reps}
                aoMudar={(v) => mudar({ repeticoes: v })}
                aoValidade={(v) => setRepsInvalidas(!v)}
                placeholder={valores.repeticoesEhSugestao ? String(calculada.sugestaoReps) : '—'}
                ajuda={valores.repeticoesEhSugestao ? 'sugerido' : 'reps'}
              />
            </View>
            <MarcarSerie estado={feita ? 'FEITA' : pronta ? 'PRONTA' : 'INCOMPLETA'} numero={numero} ultimaDoExercicio={ultimaDoExercicio} motivo={motivo} aoTocar={marcar} />
          </View>
          {anterior != null ? <LinhaDoUltimoRegistro texto={anterior} numero={numero} /> : null}
          {ativa && motivo ? <Texto variante="pequeno">{motivo === 'digite a carga' ? 'Digite a carga para marcar a série.' : 'Digite as repetições para marcar a série.'}</Texto> : null}
          {invalido ? <Texto variante="pequeno" cor={cores.perigo} accessibilityLiveRegion="polite">{textoDoNumeroInvalido(cargaInvalida, repsInvalidas)}</Texto> : null}
          {avisoDoMarcar ? <Texto numerico variante="pequeno">As séries seguintes só usam este peso depois que você marcar a série como feita.</Texto> : null}
          {repetir && !feita ? (
            <Botao rotulo={repetir.rotulo} rotuloAcessivel={`${repetir.rotulo} da série ${indice} e marcar a série ${numero} como feita`} tipo="fantasma" Icone={Repeat}
              aoTocar={() => aoRegistrar({ carga: repetir.carga, repeticoes: repetir.repeticoes, concluida: true })} />
          ) : null}
        </>
      )}
      {semCargaNaSerie ? <Texto variante="pequeno" cor={cores.texto} accessibilityLiveRegion="polite">{semCargaNaSerie}</Texto> : null}
      {avisoDasReps ? <Texto numerico variante="pequeno" cor={cores.texto} accessibilityLiveRegion="polite">{avisoDasReps}</Texto> : null}
      {registro?.situacao === 'FALHOU' ? <Texto numerico variante="pequeno" cor={cores.perigo}>Não enviado: {registro.motivo}</Texto> : null}
    </CartaoDaSerie>
  );
}

const estilos = StyleSheet.create({
  cabecalho: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: espaco(1), rowGap: espaco(0.5) },
  cabecalhoEsq: { flexShrink: 1, minWidth: 0 },
  meta: { marginLeft: 'auto', fontFamily: fontes.semi, fontSize: 14, lineHeight: 20, textAlign: 'right' },
  linhaFeita: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  resumo: { flex: 1, minWidth: 0, fontFamily: fontes.negrito, fontSize: 20, lineHeight: 26 },
  tecnica: { gap: espaco(1), alignItems: 'flex-start' },
  tecnicaTexto: { fontFamily: fontes.semi },
  // As três caixas no topo: a legenda "sugerido" embaixo de uma não desalinha as outras.
  linhaDosCampos: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(1) },
  peso: { flex: 1, minWidth: 0 },
  semPeso: { flex: 1, minWidth: 0, minHeight: 52, justifyContent: 'center' },
  reps: { width: 64 },
});
