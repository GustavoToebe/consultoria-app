import { RotateCcw, Timer } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';

import type { Configuracao, EtapaRegistrada, Serie } from '../api/tipos';
import { textoPausa } from '../dominio/agrupamento';
import { modoComReferenciaExterna, sugestaoSobreReferencia, textoDaOrigem, type SerieCalculada } from '../dominio/cargas';
import { rotuloDescanso } from '../dominio/descanso';
import {
  aplicarAcao, etapasDaSerie, faltaParaConcluir, feitoAteAgora, origemDaPausa, pausaDaAcao, proximaPendente, sugestaoDaEtapa, textoDaCargaDaEtapa,
  seloDaSerieComEtapas, textoDaReferenciaCongelada, todasComSituacao, type AcaoNaEtapa, type EtapaPrevista,
} from '../dominio/etapas';
import { textoDoNumeroInvalido } from '../dominio/avisoDaSerie';
import { textoDaCarga } from '../dominio/unidadeDeCarga';
import { TEXTO_CARGA_ILEGIVEL } from '../dominio/modoDeCarga';
import { nomeDaSerieDeTrabalho } from '../dominio/metodologia';
import { aplicarEscolhaDoPainel, type EscolhaDoPainel } from '../dominio/painelDoCheck';
import { decidirCheckDaEtapa, dicaDaEtapa, pesoDoCampo, pesoJaDado, primeiroCheckFeito } from '../dominio/pesoDasEtapas';
import { estruturaDaSerie } from '../dominio/resumoDaSerie';
import { temEtapaEmPercentual } from '../dominio/validacaoDeSerie';
import { acompanharPendente, digitarPendente, valorExibido, type ValorPendente } from '../dominio/valorPendente';
import type { RegistroLocal } from '../offline/repositorioLocal';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { BotaoMarcar } from '../ui/BotaoMarcar';
import { useEmPrevia } from '../ui/emPrevia';
import { CampoNumericoGrande } from '../ui/Campos';
import { CampoDeCarga } from '../ui/CampoDeCarga';
import { useUnidadeDeCarga } from '../ui/unidadeDeCargaEmUso';
import { Texto } from '../ui/Texto';
import type { DadosSerie } from './ExercicioAluno';
import { PainelDoCheck } from './PainelDoCheck';
import { barraDoTipo, CabecalhoDaSerie, DicaDoCampo, LinhaDoUltimoRegistro, MetaDaSerie, RotuloDeHoje } from './PartesDaSerie';
import { selosDaSerie } from './serieDoAluno';

interface Props {
  calculada: SerieCalculada;
  numero: number;
  data: string;
  /** Sem campo de peso: exercício sem carga ou série de forma de carga desconhecida (`cargaIlegivel`). */
  semCarga: boolean;
  /** A forma de carga da série é mais nova que o app: mostra o texto "atualize o app" no lugar da carga. */
  cargaIlegivel?: boolean;
  metodologia?: Configuracao;
  /** Nome da série de trabalho da configuração ("WS") e as séries do exercício: só para a frase de onde saiu a carga. */
  tipoTrabalho?: string;
  seriesDoExercicio?: readonly Serie[];
  /** Sem base do dia gravada a conta parte da última carga: a origem diz "da última vez", não "da base do dia". */
  baseDaUltimaVez?: boolean;
  /** Passo do arredondamento (sugestão sobre a referência congelada). */
  arredondamentoKg: number;
  /** O descanso da série vale (falso no grupo cujo descanso é depois da volta). */
  descansoNaSerie: boolean;
  registro: RegistroLocal | undefined;
  /** Versão do plano, série e data (`versaoId|serieUid|data`): com a posição da etapa, a identidade da pausa dela. */
  execucao: string;
  aoRegistrar: (d: DadosSerie) => void;
  aoIniciarPausa?: (segundos: number, rotulo?: string, opcoes?: { origem?: string; automatica?: boolean }) => void;
  /** Encerra o cronômetro que nasceu da etapa desfeita; o de outra origem segue. */
  aoCancelarPausa?: (origem: string) => void;
  /** O que foi feito nesta série da última vez ("40 kg × 4+4+2" ou "—"); nulo = sem a linha (Engajamento 0.3). */
  anterior?: string | null;
}

/**
 * Série com etapas (Cluster, Rest-pause) como UM cartão (Frente G, D12): a série continua uma só, com os blocos (ou a etapa
 * inicial e as retomadas) dentro dela, a pausa entre eles, o bloco da vez marcado com "agora" e, no rodapé, "Feito até
 * agora: X de Y reps" e "Concluir série" (docs/series-etapas.md). Cada etapa tem a meta, o peso, as repetições e o ✓; "Não
 * fiz" marca a etapa como não realizada. Toda mudança grava no aparelho na hora (execução parcial salva), com o total e a
 * carga calculados como no servidor; o descanso da série só começa em "Concluir série"; a pausa entre etapas começa a cada
 * marcação de uma etapa que não é a última e acaba ao desfazer essa etapa (só a pausa dela). Editar, recarregar ou
 * sincronizar não a reinicia. O peso de cada etapa nasce vazio com a sugestão ao lado (D17, `dominio/pesoDasEtapas`).
 */
export function CartaoSerieComEtapas(p: Props) {
  const { cores, identificacao } = useTema();
  const unidade = useUnidadeDeCarga();
  const emPrevia = useEmPrevia();
  const s = p.calculada.serie;
  const previstas = etapasDaSerie(s) ?? [];
  const quantas = previstas.length;
  const registro = p.registro;
  const etapas = registro?.etapas ?? [];
  const feita = !!registro?.concluida;
  const cluster = s.tecnica?.tipo === 'CLUSTER';
  const pausa = s.tecnica?.pausaSegundos != null && s.tecnica.pausaSegundos > 0 ? s.tecnica.pausaSegundos : null;
  const temPausa = !!s.tecnica && (s.tecnica.pausaSegundos != null || s.tecnica.pausaRespiracoes != null);
  const rotuloDaPausa = cluster ? 'Pausa entre blocos' : 'Pausa antes da retomada';
  // Sugestão de cada etapa sobre a referência congelada na primeira etapa (ou a de agora, antes dela). A da série segue a
  // congelada só nos modos que partem dela; "acima da anterior" e "abaixo da referência" continuam com a conta do dia.
  const referencia = registro?.referenciaCarga ?? p.calculada.referencia?.valor ?? null;
  const sugestaoDaSerie = p.semCarga ? null
    : registro?.referenciaCarga != null && modoComReferenciaExterna(s) ? sugestaoSobreReferencia(s, referencia, p.arredondamentoKg) : p.calculada.sugestao;
  const sugestaoDe = (prevista: EtapaPrevista) => (p.semCarga ? null : sugestaoDaEtapa(prevista, sugestaoDaSerie, referencia, p.arredondamentoKg));
  const ws = nomeDaSerieDeTrabalho(p.metodologia);
  const comPercentual = temEtapaEmPercentual(s.tecnica);
  const atual = proximaPendente(etapas, quantas);
  const selos = selosDaSerie(s, p.metodologia);
  const barra = barraDoTipo(selos.tipo?.cor ? identificacao[selos.tipo.cor].cor : null);
  // Com etapa em %, a referência aparece antes da primeira etapa também (a de agora), para o aluno saber a base da conta.
  const referenciaCongelada = registro?.referenciaCarga != null
    ? textoDaReferenciaCongelada(registro.referenciaCarga, registro.referenciaOrigem, unidade)
    : comPercentual ? textoDaReferenciaCongelada(p.calculada.referencia?.valor, p.calculada.referencia?.origem, unidade) : null;
  const semDetalhe = !!registro && !registro.etapas && (registro.repeticoes != null || registro.carga != null || registro.concluida);
  // De onde saiu a carga sugerida (A9), ao lado da sugestão da etapa da vez. Com a referência já congelada na primeira
  // etapa, a linha dela já diz a origem.
  const origem = p.semCarga || registro?.referenciaCarga != null ? null : textoDaOrigem(p.calculada, { tipoTrabalho: p.tipoTrabalho, metodologia: p.metodologia, series: p.seriesDoExercicio, baseDaUltimaVez: p.baseDaUltimaVez });
  const falta = feita ? null : faltaParaConcluir(etapas, previstas);
  const nomeDoGrupo = cluster ? `Blocos do Cluster, série ${p.numero}` : `Etapas do Rest-pause, série ${p.numero}`;

  const agir = (acao: AcaoNaEtapa) => {
    const gravacao = aplicarAcao(registro, acao, quantas, p.calculada.referencia);
    if (!gravacao) return;
    const pausaDeAgora = pausaDaAcao(registro, acao, quantas);
    p.aoRegistrar({
      carga: gravacao.carga,
      repeticoes: gravacao.repeticoes,
      concluida: gravacao.concluida,
      etapas: gravacao.etapas,
      referenciaCarga: gravacao.referenciaCarga,
      referenciaOrigem: gravacao.referenciaOrigem,
    });
    if (!pausaDeAgora) return;
    if ('iniciar' in pausaDeAgora) {
      if (pausa !== null) p.aoIniciarPausa?.(pausa, rotuloDaPausa, { origem: origemDaPausa(p.execucao, pausaDeAgora.iniciar), automatica: true });
    } else {
      p.aoCancelarPausa?.(origemDaPausa(p.execucao, pausaDeAgora.cancelar));
    }
  };

  return (
    <View testID={`serie-${s.uid}`}
      style={[estilos.serie, { borderColor: feita ? cores.sucesso : cores.borda, backgroundColor: feita ? `${cores.sucesso}29` : cores.superficie }, barra]}>
      <CabecalhoDaSerie numero={p.numero} tipo={selos.tipo} tecnica={selos.tecnica} registro={seloDaSerieComEtapas(feita, etapas, quantas)} />
      <MetaDaSerie texto={estruturaDaSerie(s, p.metodologia)} />
      {p.cargaIlegivel ? <Texto numerico variante="pequeno">{TEXTO_CARGA_ILEGIVEL}</Texto> : null}
      {p.anterior != null ? <LinhaDoUltimoRegistro texto={p.anterior} numero={p.numero} /> : null}
      {!p.semCarga && referenciaCongelada ? <Texto numerico variante="pequeno">{referenciaCongelada}</Texto> : null}
      {semDetalhe ? <Texto numerico variante="pequeno">Registro sem detalhe por {cluster ? 'bloco' : 'etapa'}: {registro!.repeticoes ?? '—'} reps{registro!.carga != null ? ` · ${textoDaCarga(registro!.carga, unidade)}` : ''}.</Texto> : null}
      <RotuloDeHoje />

      <View role="group" aria-label={nomeDoGrupo} style={[estilos.etapas, { borderColor: cores.borda, backgroundColor: cores.superficie2 }]}>
        {previstas.map((prevista, i) => {
          const anteriorFeita = i > 0 && etapas.some((e) => e.posicao === previstas[i - 1].posicao && e.situacao === 'FEITA');
          const daVez = atual === prevista.posicao && !feita;
          const cargaPrevista = p.semCarga ? null : textoDaCargaDaEtapa(prevista.carga, ws);
          return (
            <View key={prevista.posicao}>
              {i > 0 && temPausa ? (
                <View style={[estilos.pausa, { borderTopColor: cores.bordaCampo }]}>
                  <Timer size={14} color={cores.textoSuave} />
                  <Texto numerico variante="pequeno" style={estilos.textoDaPausa}>{`${rotuloDaPausa}: ${textoPausa(s.tecnica!)}`}</Texto>
                  {pausa !== null && p.aoIniciarPausa && anteriorFeita ? (
                    <Botao rotulo="Pausa" rotuloAcessivel={`Iniciar a pausa depois de ${previstas[i - 1].rotulo.toLowerCase()} da série ${p.numero}`} tipo="fantasma" Icone={Timer}
                      aoTocar={() => p.aoIniciarPausa!(pausa, rotuloDaPausa, { origem: origemDaPausa(p.execucao, previstas[i - 1].posicao) })} />
                  ) : null}
                </View>
              ) : null}
              <LinhaDaEtapa prevista={prevista} numeroDaSerie={p.numero} registrada={etapas.find((e) => e.posicao === prevista.posicao)}
                atual={daVez} comDivisao={i > 0 && !temPausa} sugestao={sugestaoDe(prevista)} semCarga={p.semCarga} agir={agir}
                cargaPrevista={cargaPrevista}
                // A sugestão fica na etapa da vez (com a origem) e nas de carga própria, que têm outra conta (D17).
                mostrarDica={daVez || cargaPrevista !== null}
                origem={daVez && !cargaPrevista ? origem : null}
                pesoDaSerie={pesoJaDado(prevista.posicao, previstas, etapas)}
                painelJaUsado={primeiroCheckFeito(prevista.posicao, previstas, etapas)} />
            </View>
          );
        })}
      </View>

      <View style={estilos.rodape}>
        <Texto numerico style={estilos.feito} cor={cores.texto}>{feitoAteAgora(etapas, previstas, cluster ? 'blocos' : 'etapas', feita)}</Texto>
        {feita ? (
          <Botao rotulo="Reabrir" rotuloAcessivel={`Reabrir a série ${p.numero}`} tipo="fantasma" Icone={RotateCcw} desabilitado={emPrevia} aoTocar={() => agir({ tipo: 'REABRIR' })} />
        ) : (
          <Botao rotulo="Concluir série" rotuloAcessivel={`Concluir a série ${p.numero}`} tipo={todasComSituacao(etapas, quantas) ? 'primario' : 'secundario'}
            // O motivo ("Falta o bloco 3 para concluir.") aparece embaixo do botão desabilitado.
            desabilitado={emPrevia || !todasComSituacao(etapas, quantas)} motivo={falta ?? `Marque cada ${cluster ? 'bloco' : 'etapa'} como feito ou não feito.`}
            aoTocar={() => agir({ tipo: 'CONCLUIR' })} />
        )}
      </View>
      {feita ? <Texto variante="pequeno" cor={cores.sucesso}>Série concluída.</Texto> : null}
      {p.descansoNaSerie && s.descansoSegundos != null && s.descansoSegundos > 0 ? <Texto variante="pequeno">Descanso depois da série: {rotuloDescanso(s.descansoSegundos)}</Texto> : null}
      {registro?.situacao === 'FALHOU' ? <Texto numerico variante="pequeno" cor={cores.perigo}>Não enviado: {registro.motivo}</Texto> : null}
    </View>
  );
}

function LinhaDaEtapa({ prevista, numeroDaSerie, registrada, atual, comDivisao, sugestao, cargaPrevista, semCarga, agir, mostrarDica, origem, pesoDaSerie, painelJaUsado }: {
  prevista: EtapaPrevista;
  numeroDaSerie: number;
  registrada: EtapaRegistrada | undefined;
  /** A próxima etapa a fazer: fundo da superfície, barra à esquerda e "agora". */
  atual: boolean;
  /** Linha fina em cima (entre duas etapas sem a linha da pausa no meio). */
  comDivisao: boolean;
  sugestao: number | null;
  /** "90% da WS" quando a etapa tem carga própria; `null` = a carga da série. */
  cargaPrevista: string | null;
  semCarga: boolean;
  agir: (acao: AcaoNaEtapa) => void;
  /** Mostra a dica "Sugestão: X kg" enquanto o campo de peso está vazio. */
  mostrarDica: boolean;
  /** De onde saiu a sugestão (embaixo da dica). */
  origem: string | null;
  /** O peso que o aluno já deu a esta carga da série (`dominio/pesoDasEtapas`): preenche o campo ainda não mexido. */
  pesoDaSerie: number | null;
  /** O painel "Fez com X kg?" já teve a vez dele nesta série (D17: uma vez por série; `primeiroCheckFeito`). */
  painelJaUsado: boolean;
}) {
  const { cores } = useTema();
  const unidade = useUnidadeDeCarga();
  const emPrevia = useEmPrevia();
  // Antes de marcar: as repetições começam vazias (a meta não vira realizado) e o peso também (D17): a sugestão é só dica.
  // `undefined` = o aluno ainda não mexeu no campo de peso (vale o peso já dado na série); `null` = apagou de propósito.
  const [repsDigitadas, setRepsDigitadas] = useState<number | null>(null);
  const [cargaDigitada, setCargaDigitada] = useState<number | null | undefined>(undefined);
  const [repsInvalidas, setRepsInvalidas] = useState(false);
  const [cargaInvalida, setCargaInvalida] = useState(false);
  // Painel do ✓ (D17): aberto com a sugestão que ele pergunta; fecha ao escolher, ao digitar o peso ou com a etapa feita.
  const [painel, setPainel] = useState<number | null>(null);
  const campoDoPeso = useRef<TextInput>(null);
  const invalido = repsInvalidas || cargaInvalida;
  const feita = registrada?.situacao === 'FEITA';
  const naoRealizada = registrada?.situacao === 'NAO_REALIZADA';
  if ((feita || naoRealizada) && painel !== null) setPainel(null);
  // Etapa já feita: a edição só volta gravada depois (B1, 30/10); a caixa mostra o digitado até lá (`dominio/valorPendente`).
  const [pendenteDasReps, setPendenteDasReps] = useState<ValorPendente<number | null | undefined> | undefined>(undefined);
  const [pendenteDaCarga, setPendenteDaCarga] = useState<ValorPendente<number | null | undefined> | undefined>(undefined);
  const repsGravadas = feita ? registrada!.repeticoes : undefined;
  const cargaGravada = feita ? registrada!.carga : undefined;
  const repsAcompanhadas = acompanharPendente(pendenteDasReps, repsGravadas);
  const cargaAcompanhada = acompanharPendente(pendenteDaCarga, cargaGravada);
  if (repsAcompanhadas !== pendenteDasReps) setPendenteDasReps(repsAcompanhadas);
  if (cargaAcompanhada !== pendenteDaCarga) setPendenteDaCarga(cargaAcompanhada);
  const reps = feita ? (valorExibido(repsAcompanhadas, repsGravadas) ?? null) : repsDigitadas;
  const carga = semCarga ? null : feita ? (valorExibido(cargaAcompanhada, cargaGravada) ?? null) : pesoDoCampo(cargaDigitada, pesoDaSerie);
  // O painel pergunta pelo peso vazio: se o campo ganhou um peso por outro caminho (outra etapa marcada preencheu as
  // vazias), a pergunta já não vale.
  if (painel !== null && carga !== null) setPainel(null);
  const editar = (parcial: { repeticoes?: number | null; carga?: number | null }) => {
    if ('repeticoes' in parcial) setPendenteDasReps(digitarPendente(repsAcompanhadas, parcial.repeticoes ?? null, repsGravadas));
    if ('carga' in parcial) setPendenteDaCarga(digitarPendente(cargaAcompanhada, parcial.carga ?? null, cargaGravada));
    // Vão os dois valores que a caixa mostra: o outro campo pode ter uma tecla ainda não gravada.
    agir({ tipo: 'EDITAR', posicao, repeticoes: reps, ...(semCarga ? {} : { carga }), ...parcial });
  };
  const nome = `${prevista.rotulo.toLowerCase()} da série ${numeroDaSerie}`;
  // "Bloco 1 feito", "Etapa inicial feita", "Retomada feita".
  const feito = prevista.rotulo.startsWith('Bloco') ? 'feito' : 'feita';
  const posicao = prevista.posicao;
  const situacao = feita ? ` · ${feito}` : naoRealizada ? ` · não ${feito}` : atual ? ' · agora' : '';
  const dica = !feita && !naoRealizada && mostrarDica ? dicaDaEtapa({ campoVazio: carga === null, sugestaoKg: sugestao, cargaPropria: cargaPrevista !== null, semCampoDePeso: semCarga, unidade }) : null;

  // ✓: no primeiro da série com o peso vazio e com sugestão, abre o painel na tela; senão marca com o que está nos campos.
  const marcar = () => {
    if (feita) {
      agir({ tipo: 'DESFAZER', posicao });
      return;
    }
    const decisao = decidirCheckDaEtapa({ carga, repeticoes: reps, sugestaoKg: sugestao, semCampoDePeso: semCarga, primeiroCheckFeito: painelJaUsado });
    if (decisao.acao === 'PAINEL') {
      setPainel(decisao.sugestaoKg);
      return;
    }
    setPainel(null);
    agir({ tipo: 'FEITA', posicao, repeticoes: decisao.repeticoes, carga: decisao.carga });
  };
  const abrePainel = !feita && !semCarga && carga === null && sugestao !== null && !painelJaUsado;
  const escolher = (escolha: EscolhaDoPainel) => {
    if (painel === null) return;
    const r = aplicarEscolhaDoPainel(escolha, painel, reps);
    setPainel(null);
    if (r.gravar) agir({ tipo: 'FEITA', posicao, repeticoes: r.gravar.repeticoes, carga: r.gravar.carga });
    else campoDoPeso.current?.focus();
  };

  return (
    <View style={[
      estilos.etapa,
      comDivisao ? { borderTopWidth: 1, borderTopColor: cores.divisor } : null,
      atual ? { backgroundColor: cores.superficie, borderLeftWidth: 3, borderLeftColor: cores.texto, paddingLeft: espaco(1.5) - 3 } : null,
    ]}>
      <View style={estilos.linhaDaEtapa}>
        <View style={estilos.nomeDaEtapa}>
          <Texto style={estilos.rotuloEtapa}>{prevista.rotulo}</Texto>
          <Texto numerico variante="pequeno">{`Meta ${prevista.meta}${cargaPrevista ? ` · ${cargaPrevista}` : ''}${situacao}`}</Texto>
        </View>
        {naoRealizada ? (
          <Botao rotulo="Desfazer" rotuloAcessivel={`Desfazer: ${nome} não ${feito}`} tipo="fantasma" desabilitado={emPrevia} aoTocar={() => agir({ tipo: 'DESFAZER', posicao })} />
        ) : (
          <View style={estilos.campos}>
            {semCarga ? null : (
              <CampoDeCarga ref={campoDoPeso} rotulo="Peso" rotuloOculto rotuloAcessivel={`Peso, ${nome}`} valorKg={carga}
                aoMudarKg={(v) => { setPainel(null); if (feita) editar({ carga: v }); else setCargaDigitada(v); }}
                aoValidade={(ok) => setCargaInvalida(!ok)} />
            )}
            <CampoNumericoGrande rotulo="Reps" rotuloOculto rotuloAcessivel={`Repetições feitas, ${nome}`} sufixo="reps" inteiro valor={reps}
              aoMudar={(v) => { if (feita) editar({ repeticoes: v }); else setRepsDigitadas(v); }}
              aoValidade={(ok) => setRepsInvalidas(!ok)} />
            <BotaoMarcar feito={feita} desabilitado={invalido} semVibrar={abrePainel}
              rotulo={invalido ? `${prevista.rotulo} ${feito}: corrija o número antes de marcar` : `${prevista.rotulo} ${feito}, série ${numeroDaSerie}`}
              aoTocar={marcar} />
          </View>
        )}
      </View>
      {invalido ? <Texto variante="pequeno" cor={cores.perigo} accessibilityLiveRegion="polite">{textoDoNumeroInvalido(cargaInvalida, repsInvalidas)}</Texto> : null}
      {dica ? <DicaDoCampo dica={dica} origem={origem} numero={numeroDaSerie} de={`${prevista.rotulo.startsWith('Bloco') ? 'o' : 'a'} ${nome}`} /> : null}
      {painel !== null ? <PainelDoCheck sugestaoKg={painel} numero={numeroDaSerie} aoEscolher={escolher} /> : null}
      {!feita && !naoRealizada ? <Botao rotulo="Não fiz" rotuloAcessivel={`Não fiz: ${nome}`} tipo="secundario" desabilitado={emPrevia} aoTocar={() => agir({ tipo: 'NAO_REALIZADA', posicao })} /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  serie: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), gap: espaco(1) },
  etapas: { borderWidth: 1, borderRadius: RAIO, overflow: 'hidden' },
  etapa: { paddingVertical: espaco(1.25), paddingHorizontal: espaco(1.5), gap: espaco(0.75) },
  linhaDaEtapa: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1) },
  // Largo: o nome à esquerda e os campos à direita numa linha; estreito (390 px), os campos descem para a linha de baixo.
  nomeDaEtapa: { flexGrow: 1, flexShrink: 1, flexBasis: 140, minWidth: 92, gap: 2 },
  rotuloEtapa: { fontFamily: fontes.semi },
  campos: { flexDirection: 'row', alignItems: 'flex-end', gap: espaco(1), flexGrow: 1, flexShrink: 0, flexBasis: 280, maxWidth: 420 },
  pausa: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: espaco(1), paddingVertical: espaco(0.5), paddingHorizontal: espaco(1.5), borderTopWidth: 1, borderStyle: 'dashed' },
  textoDaPausa: { flexShrink: 1 },
  rodape: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: espaco(1) },
  feito: { fontFamily: fontes.semi, fontSize: 15, lineHeight: 22, flexShrink: 1 },
});
