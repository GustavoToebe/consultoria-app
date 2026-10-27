import { RotateCcw, Timer } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Configuracao, EtapaRegistrada } from '../api/tipos';
import { textoPausa } from '../dominio/agrupamento';
import { sugestaoSobreReferencia, type SerieCalculada } from '../dominio/cargas';
import { rotuloDescanso } from '../dominio/descanso';
import { aplicarAcao, etapasDaSerie, ligaPausaInterna, proximaPendente, resumoDaExecucao, textoDaReferenciaCongelada, todasComSituacao, type AcaoNaEtapa, type EtapaPrevista } from '../dominio/etapas';
import { numeroParaTela } from '../dominio/formatos';
import { estruturaDaSerie } from '../dominio/resumoDaSerie';
import type { RegistroLocal } from '../offline/repositorioLocal';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { BotaoMarcar } from '../ui/BotaoMarcar';
import { CampoNumericoGrande } from '../ui/Campos';
import { Texto } from '../ui/Texto';
import type { DadosSerie } from './ExercicioAluno';
import { SeloComExplicacao } from './SeloComExplicacao';
import { selosDaSerie } from './serieDoAluno';

/**
 * Pausas entre etapas já ligadas nesta sessão do app (série + dia + posição). Desfazer e marcar de novo a mesma etapa
 * não liga o cronômetro outra vez; ao reabrir o app a lista começa vazia, e o domínio só liga na primeira marcação.
 */
const pausasLigadas = new Set<string>();

interface Props {
  calculada: SerieCalculada;
  numero: number;
  data: string;
  semCarga: boolean;
  metodologia?: Configuracao;
  /** Passo do arredondamento (sugestão sobre a referência congelada). */
  arredondamentoKg: number;
  /** O descanso da série vale (falso no grupo cujo descanso é depois da volta). */
  descansoNaSerie: boolean;
  registro: RegistroLocal | undefined;
  aoRegistrar: (d: DadosSerie) => void;
  aoIniciarPausa?: (segundos: number, rotulo?: string) => void;
}

/**
 * Série com etapas (Cluster, Rest-pause): continua uma série só, com as etapas dentro dela (docs/series-etapas.md). Cada
 * etapa tem a meta, as repetições feitas, a carga e o ✓; "Não fiz" marca a etapa como não realizada. Toda mudança grava
 * no aparelho na hora (execução parcial salva), com o total e a carga calculados como no servidor; o descanso da série só
 * começa em "Concluir série", e a pausa entre etapas na primeira vez que uma etapa intermediária é marcada.
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
  // Sugestão de cada etapa sobre a referência congelada na primeira etapa (ou a de agora, antes dela).
  const referencia = registro?.referenciaCarga ?? p.calculada.referencia?.valor ?? null;
  const sugestao = p.semCarga ? null : registro?.referenciaCarga != null ? sugestaoSobreReferencia(s, referencia, p.arredondamentoKg) : p.calculada.sugestao;
  const atual = proximaPendente(etapas, quantas);
  const selos = selosDaSerie(s, p.metodologia);
  const referenciaCongelada = textoDaReferenciaCongelada(registro?.referenciaCarga, registro?.referenciaOrigem);
  const semDetalhe = !!registro && !registro.etapas && (registro.repeticoes != null || registro.carga != null || registro.concluida);

  const agir = (acao: AcaoNaEtapa) => {
    const gravacao = aplicarAcao(registro, acao, quantas, p.calculada.referencia);
    if (!gravacao) return;
    const chave = acao.tipo === 'FEITA' ? `${s.uid}|${p.data}|${acao.posicao}` : '';
    const ligar = ligaPausaInterna(registro, acao, quantas) && !pausasLigadas.has(chave);
    p.aoRegistrar({
      carga: gravacao.carga,
      repeticoes: gravacao.repeticoes,
      concluida: gravacao.concluida,
      etapas: gravacao.etapas,
      referenciaCarga: gravacao.referenciaCarga,
      referenciaOrigem: gravacao.referenciaOrigem,
    });
    if (ligar) {
      pausasLigadas.add(chave);
      if (pausa !== null && p.aoIniciarPausa) p.aoIniciarPausa(pausa, rotuloDaPausa);
    }
  };

  return (
    <View style={[estilos.serie, { borderColor: feita ? cores.sucesso : cores.borda, backgroundColor: feita ? `${cores.sucesso}29` : cores.superficie2 }]}>
      <View style={estilos.cabeca}>
        <Texto style={estilos.nome}>Série {p.numero}</Texto>
        {selos.tipo ? <SeloComExplicacao nome={selos.tipo.nome} explicacao={selos.tipo.explicacao} rotuloAcessivel={`Explicação de ${selos.tipo.nome}, série ${p.numero}`} /> : null}
        {selos.tecnica ? <SeloComExplicacao nome={selos.tecnica.nome} explicacao={selos.tecnica.explicacao} rotuloAcessivel={`Explicação de ${selos.tecnica.nome}, série ${p.numero}`} /> : null}
      </View>
      <Texto numerico variante="pequeno">{estruturaDaSerie(s, p.metodologia)}</Texto>
      {!p.semCarga && sugestao != null ? <Texto numerico variante="pequeno">Carga sugerida: {numeroParaTela(sugestao)} kg</Texto> : null}
      {!p.semCarga && referenciaCongelada ? <Texto numerico variante="pequeno">{referenciaCongelada}</Texto> : null}
      {semDetalhe ? <Texto numerico variante="pequeno">Registro sem detalhe por {cluster ? 'bloco' : 'etapa'}: {registro!.repeticoes ?? '—'} reps{registro!.carga != null ? ` · ${numeroParaTela(registro!.carga)} kg` : ''}.</Texto> : null}

      {previstas.map((prevista, i) => (
        <LinhaDaEtapa key={prevista.posicao} prevista={prevista} numeroDaSerie={p.numero} registrada={etapas.find((e) => e.posicao === prevista.posicao)}
          atual={atual === prevista.posicao && !feita} sugestao={sugestao} semCarga={p.semCarga} agir={agir}
          pausaDepois={i < quantas - 1 && temPausa ? `${rotuloDaPausa}: ${textoPausa(s.tecnica!)}` : null}
          aoIniciarPausa={pausa !== null && p.aoIniciarPausa ? () => p.aoIniciarPausa!(pausa, rotuloDaPausa) : undefined} />
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

function LinhaDaEtapa({ prevista, numeroDaSerie, registrada, atual, sugestao, semCarga, agir, pausaDepois, aoIniciarPausa }: {
  prevista: EtapaPrevista;
  numeroDaSerie: number;
  registrada: EtapaRegistrada | undefined;
  /** A próxima etapa a fazer: destaque discreto. */
  atual: boolean;
  sugestao: number | null;
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
  const reps = feita ? registrada!.repeticoes : repsDigitadas;
  const carga = feita ? registrada!.carga : cargaDigitada !== undefined ? cargaDigitada : sugestao;
  const nome = `${prevista.rotulo.toLowerCase()} da série ${numeroDaSerie}`;
  const posicao = prevista.posicao;

  return (
    <View style={[estilos.etapa, { borderColor: atual ? cores.bordaCampo : cores.borda, backgroundColor: atual ? cores.superficie3 : 'transparent' }]}>
      <Texto numerico style={estilos.rotuloEtapa}>{prevista.rotulo} · Meta {prevista.meta}</Texto>
      {naoRealizada ? (
        <View style={estilos.linhaAcoes}>
          <Texto variante="pequeno">Não realizado.</Texto>
          <Botao rotulo="Desfazer" rotuloAcessivel={`Desfazer: ${nome} não realizado`} tipo="fantasma" aoTocar={() => agir({ tipo: 'DESFAZER', posicao })} />
        </View>
      ) : (
        <>
          <View style={estilos.campos}>
            <CampoNumericoGrande rotulo="Reps" rotuloOculto rotuloAcessivel={`Repetições feitas, ${nome}`} sufixo="reps" inteiro valor={reps}
              aoMudar={(v) => { if (feita) agir({ tipo: 'EDITAR', posicao, repeticoes: v }); else setRepsDigitadas(v); }}
              aoValidade={(ok) => setRepsInvalidas(!ok)} />
            {semCarga ? null : (
              <CampoNumericoGrande rotulo="Peso" rotuloOculto rotuloAcessivel={`Peso, ${nome}, em quilos`} sufixo="kg" valor={carga}
                aoMudar={(v) => { if (feita) agir({ tipo: 'EDITAR', posicao, carga: v }); else setCargaDigitada(v); }}
                aoValidade={(ok) => setCargaInvalida(!ok)} />
            )}
            <BotaoMarcar feito={feita} desabilitado={invalido}
              rotulo={invalido ? `${prevista.rotulo} feito: corrija o número antes de marcar` : `${prevista.rotulo} feito, série ${numeroDaSerie}`}
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
  cabeca: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: espaco(1) },
  nome: { fontFamily: fontes.semi, fontSize: 16 },
  etapa: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1), gap: espaco(0.75) },
  rotuloEtapa: { fontFamily: fontes.semi },
  campos: { flexDirection: 'row', alignItems: 'flex-end', gap: espaco(1), maxWidth: 480 },
  linhaAcoes: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: espaco(1) },
});
