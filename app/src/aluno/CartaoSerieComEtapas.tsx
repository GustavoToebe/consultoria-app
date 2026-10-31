import { RotateCcw, Timer } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Configuracao, EtapaRegistrada, Serie } from '../api/tipos';
import { textoPausa } from '../dominio/agrupamento';
import { modoComReferenciaExterna, sugestaoSobreReferencia, textoDaOrigem, type SerieCalculada } from '../dominio/cargas';
import { rotuloDescanso } from '../dominio/descanso';
import {
  aplicarAcao, etapasDaSerie, origemDaPausa, pausaDaAcao, proximaPendente, resumoDaExecucao, sugestaoDaEtapa, textoDaCargaDaEtapa, textoDaReferenciaCongelada,
  todasComSituacao, type AcaoNaEtapa, type EtapaPrevista,
} from '../dominio/etapas';
import { numeroParaTela } from '../dominio/formatos';
import { nomeDaSerieDeTrabalho } from '../dominio/metodologia';
import { estruturaDaSerie } from '../dominio/resumoDaSerie';
import { temEtapaEmPercentual } from '../dominio/validacaoDeSerie';
import { acompanharPendente, digitarPendente, valorExibido, type ValorPendente } from '../dominio/valorPendente';
import type { RegistroLocal } from '../offline/repositorioLocal';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { BotaoMarcar } from '../ui/BotaoMarcar';
import { CampoNumericoGrande } from '../ui/Campos';
import { Texto } from '../ui/Texto';
import type { DadosSerie } from './ExercicioAluno';
import { CabecalhoDaSerie, LinhaDaSugestao, LinhaDoUltimoRegistro, MetaDaSerie, RotuloDeHoje } from './PartesDaSerie';
import { selosDaSerie } from './serieDoAluno';

interface Props {
  calculada: SerieCalculada;
  numero: number;
  data: string;
  semCarga: boolean;
  metodologia?: Configuracao;
  /** Nome da série de trabalho da configuração ("WS") e as séries do exercício: só para a frase de onde saiu a carga. */
  tipoTrabalho?: string;
  seriesDoExercicio?: readonly Serie[];
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
 * Série com etapas (Cluster, Rest-pause): continua uma série só, com as etapas dentro dela (docs/series-etapas.md). Cada
 * etapa tem a meta, as repetições feitas, a carga e o ✓; "Não fiz" marca a etapa como não realizada. Toda mudança grava
 * no aparelho na hora (execução parcial salva), com o total e a carga calculados como no servidor; o descanso da série só
 * começa em "Concluir série"; a pausa entre etapas começa a cada marcação de uma etapa que não é a última e acaba ao desfazer
 * essa etapa (só a pausa dela). Editar, recarregar ou sincronizar não a reinicia.
 */
export function CartaoSerieComEtapas(p: Props) {
  const { cores } = useTema();
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
  // Com etapa em %, a referência aparece antes da primeira etapa também (a de agora), para o aluno saber a base da conta.
  const referenciaCongelada = registro?.referenciaCarga != null
    ? textoDaReferenciaCongelada(registro.referenciaCarga, registro.referenciaOrigem)
    : comPercentual ? textoDaReferenciaCongelada(p.calculada.referencia?.valor, p.calculada.referencia?.origem) : null;
  const semDetalhe = !!registro && !registro.etapas && (registro.repeticoes != null || registro.carga != null || registro.concluida);
  // De onde saiu a carga sugerida (A9). Com a referência já congelada na primeira etapa, a linha dela já diz a origem.
  const origem = p.semCarga || registro?.referenciaCarga != null ? null : textoDaOrigem(p.calculada, { tipoTrabalho: p.tipoTrabalho, metodologia: p.metodologia, series: p.seriesDoExercicio });

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
    <View style={[estilos.serie, { borderColor: feita ? cores.sucesso : cores.borda, backgroundColor: feita ? `${cores.sucesso}29` : cores.superficie2 }]}>
      <CabecalhoDaSerie numero={p.numero} tipo={selos.tipo} tecnica={selos.tecnica} naoRegistrada={!feita && etapas.length === 0 && !semDetalhe} />
      <MetaDaSerie texto={estruturaDaSerie(s, p.metodologia)} />
      {p.anterior != null ? <LinhaDoUltimoRegistro texto={p.anterior} numero={p.numero} /> : null}
      {!p.semCarga && !comPercentual && sugestaoDaSerie != null && !feita ? <LinhaDaSugestao sugestao={sugestaoDaSerie} origem={origem} /> : null}
      {!p.semCarga && referenciaCongelada ? <Texto numerico variante="pequeno">{referenciaCongelada}</Texto> : null}
      {semDetalhe ? <Texto numerico variante="pequeno">Registro sem detalhe por {cluster ? 'bloco' : 'etapa'}: {registro!.repeticoes ?? '—'} reps{registro!.carga != null ? ` · ${numeroParaTela(registro!.carga)} kg` : ''}.</Texto> : null}
      <RotuloDeHoje />

      {previstas.map((prevista, i) => (
        <LinhaDaEtapa key={prevista.posicao} prevista={prevista} numeroDaSerie={p.numero} registrada={etapas.find((e) => e.posicao === prevista.posicao)}
          atual={atual === prevista.posicao && !feita} sugestao={sugestaoDe(prevista)} semCarga={p.semCarga} agir={agir}
          cargaPrevista={p.semCarga ? null : textoDaCargaDaEtapa(prevista.carga, ws)}
          pausaDepois={i < quantas - 1 && temPausa ? `${rotuloDaPausa}: ${textoPausa(s.tecnica!)}` : null}
          aoIniciarPausa={pausa !== null && p.aoIniciarPausa ? () => p.aoIniciarPausa!(pausa, rotuloDaPausa, { origem: origemDaPausa(p.execucao, prevista.posicao) }) : undefined} />
      ))}

      <Texto numerico variante="pequeno" cor={cores.texto}>{resumoDaExecucao(etapas, quantas, cluster ? 'blocos' : 'etapas')}</Texto>
      {etapas.length > 0 && !feita ? <Texto variante="pequeno">Execução parcial salva. Conclua quando terminar ou marque o que não fez.</Texto> : null}
      {feita ? (
        <View style={estilos.linhaAcoes}>
          <Texto variante="pequeno" cor={cores.sucesso}>Série concluída.</Texto>
          <Botao rotulo="Reabrir" rotuloAcessivel={`Reabrir a série ${p.numero}`} tipo="fantasma" Icone={RotateCcw} aoTocar={() => agir({ tipo: 'REABRIR' })} />
        </View>
      ) : (
        <Botao rotulo="Concluir série" rotuloAcessivel={`Concluir a série ${p.numero}`} tipo={todasComSituacao(etapas, quantas) ? 'primario' : 'secundario'}
          desabilitado={!todasComSituacao(etapas, quantas)} motivo={`Marque cada ${cluster ? 'bloco' : 'etapa'} como feito ou não feito.`}
          aoTocar={() => agir({ tipo: 'CONCLUIR' })} />
      )}
      {p.descansoNaSerie && s.descansoSegundos != null && s.descansoSegundos > 0 ? <Texto variante="pequeno">Descanso depois da série: {rotuloDescanso(s.descansoSegundos)}</Texto> : null}
      {registro?.situacao === 'FALHOU' ? <Texto numerico variante="pequeno" cor={cores.perigo}>Não enviado: {registro.motivo}</Texto> : null}
    </View>
  );
}

function LinhaDaEtapa({ prevista, numeroDaSerie, registrada, atual, sugestao, cargaPrevista, semCarga, agir, pausaDepois, aoIniciarPausa }: {
  prevista: EtapaPrevista;
  numeroDaSerie: number;
  registrada: EtapaRegistrada | undefined;
  /** A próxima etapa a fazer: destaque discreto. */
  atual: boolean;
  sugestao: number | null;
  /** "90% da WS" quando a etapa tem carga própria; `null` = a carga da série. */
  cargaPrevista: string | null;
  semCarga: boolean;
  agir: (acao: AcaoNaEtapa) => void;
  /** Texto da pausa depois desta etapa (não há depois da última). */
  pausaDepois: string | null;
  aoIniciarPausa?: () => void;
}) {
  const { cores } = useTema();
  // Antes de marcar: as repetições começam vazias (a meta não vira realizado); a carga acompanha a sugestão até mexer.
  const [repsDigitadas, setRepsDigitadas] = useState<number | null>(null);
  const [cargaDigitada, setCargaDigitada] = useState<number | null | undefined>(undefined);
  const [repsInvalidas, setRepsInvalidas] = useState(false);
  const [cargaInvalida, setCargaInvalida] = useState(false);
  const invalido = repsInvalidas || cargaInvalida;
  const feita = registrada?.situacao === 'FEITA';
  const naoRealizada = registrada?.situacao === 'NAO_REALIZADA';
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
  const carga = feita ? (valorExibido(cargaAcompanhada, cargaGravada) ?? null) : cargaDigitada !== undefined ? cargaDigitada : sugestao;
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

  return (
    <View style={[estilos.etapa, { borderColor: atual ? cores.bordaCampo : cores.borda, backgroundColor: atual ? cores.superficie3 : 'transparent' }]}>
      <Texto numerico style={estilos.rotuloEtapa}>{prevista.rotulo} · Meta {prevista.meta}{cargaPrevista ? ` · ${cargaPrevista}` : ''}</Texto>
      {!semCarga && cargaPrevista && !feita ? <Texto numerico variante="pequeno">{sugestao != null ? `Carga sugerida: ${numeroParaTela(sugestao)} kg` : 'Carga sugerida: — (informe a carga de trabalho)'}</Texto> : null}
      {naoRealizada ? (
        <View style={estilos.linhaAcoes}>
          <Texto variante="pequeno">Não {feito}.</Texto>
          <Botao rotulo="Desfazer" rotuloAcessivel={`Desfazer: ${nome} não ${feito}`} tipo="fantasma" aoTocar={() => agir({ tipo: 'DESFAZER', posicao })} />
        </View>
      ) : (
        <>
          <View style={estilos.campos}>
            <CampoNumericoGrande rotulo="Reps" rotuloOculto rotuloAcessivel={`Repetições feitas, ${nome}`} sufixo="reps" inteiro valor={reps}
              aoMudar={(v) => { if (feita) editar({ repeticoes: v }); else setRepsDigitadas(v); }}
              aoValidade={(ok) => setRepsInvalidas(!ok)} />
            {semCarga ? null : (
              <CampoNumericoGrande rotulo="Peso" rotuloOculto rotuloAcessivel={`Peso, ${nome}, em quilos`} sufixo="kg" valor={carga}
                aoMudar={(v) => { if (feita) editar({ carga: v }); else setCargaDigitada(v); }}
                aoValidade={(ok) => setCargaInvalida(!ok)} />
            )}
            <BotaoMarcar feito={feita} desabilitado={invalido}
              rotulo={invalido ? `${prevista.rotulo} ${feito}: corrija o número antes de marcar` : `${prevista.rotulo} ${feito}, série ${numeroDaSerie}`}
              aoTocar={() => (feita ? agir({ tipo: 'DESFAZER', posicao }) : agir({ tipo: 'FEITA', posicao, repeticoes: reps, carga: semCarga ? null : carga ?? null }))} />
          </View>
          {invalido ? <Texto variante="pequeno" cor={cores.perigo}>Corrija o número para marcar.</Texto> : null}
          {!feita ? <Botao rotulo="Não fiz" rotuloAcessivel={`Não fiz: ${nome}`} tipo="fantasma" aoTocar={() => agir({ tipo: 'NAO_REALIZADA', posicao })} /> : null}
        </>
      )}
      {pausaDepois ? (
        <View style={estilos.linhaAcoes}>
          <Texto variante="pequeno">{pausaDepois}</Texto>
          {aoIniciarPausa && feita ? <Botao rotulo="Pausa" rotuloAcessivel={`Iniciar a pausa depois de ${nome}`} tipo="fantasma" Icone={Timer} aoTocar={aoIniciarPausa} /> : null}
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  serie: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), gap: espaco(1) },
  etapa: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1), gap: espaco(0.75) },
  rotuloEtapa: { fontFamily: fontes.semi },
  campos: { flexDirection: 'row', alignItems: 'flex-end', gap: espaco(1), maxWidth: 480 },
  linhaAcoes: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: espaco(1) },
});
