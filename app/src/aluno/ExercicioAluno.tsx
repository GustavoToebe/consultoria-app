import { Cartao } from '../ui/Cartao';
import { PlayCircle } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import type { ExercicioPlano, UltimaCarga } from '../api/tipos';
import { calcularCargasDoExercicio, usaCargaDeTrabalho, type SerieCalculada } from '../dominio/cargas';
import { dataCurta, dataParaTela, numeroParaTela } from '../dominio/formatos';
import { videoValido } from '../dominio/video';
import type { RegistroLocal } from '../offline/repositorioLocal';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../tema/tokens';
import { useAviso } from '../ui/Aviso';
import { Botao } from '../ui/Botao';
import { BotaoMarcar } from '../ui/BotaoMarcar';
import { useMovimentoReduzido } from '../ui/useMovimentoReduzido';
import { CampoNumericoGrande } from '../ui/Campos';
import { Texto } from '../ui/Texto';

export interface DadosSerie {
  carga: number | null;
  repeticoes: number | null;
  concluida: boolean;
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
  config: { arredondamentoKg: number; tipoTrabalho: string };
  aoMudarCargaDoDia: (carga: number | null) => void;
  aoRegistrar: (serieUid: string, dados: DadosSerie) => void;
  /** Ao lado do botão de vídeo, cada um com metade da largura (o descanso). */
  acaoAoLadoDoVideo?: ReactNode;
}

/**
 * Exercício na tela do aluno: observação do treinador, vídeo, carga de trabalho do dia e um cartão por série com a
 * meta, a carga sugerida (editável) e as repetições vazias até o aluno digitar. O ✓ grava no aparelho na hora.
 */
export function ExercicioAluno(p: Props) {
  const { cores } = useTema();
  const { avisar } = useAviso();
  const e = p.exercicio;
  const base = p.cargaDoDia ?? p.ultima?.carga ?? null;
  const cargasDoDia: Record<string, number | null> = {};
  for (const s of e.series) cargasDoDia[s.uid] = p.registroDe(s.uid)?.carga ?? null;
  const calculadas = calcularCargasDoExercicio(e, base, cargasDoDia, p.config);
  const feitas = e.series.filter((s) => p.registroDe(s.uid)?.concluida).length;

  const abrirVideo = () => {
    if (!e.videoUrl || !videoValido(e.videoUrl)) return;
    // Abre fora do app (navegador ou app do YouTube), sem token nem cookie.
    Linking.openURL(e.videoUrl).catch(() => avisar('Não foi possível abrir o vídeo.', 'perigo'));
  };

  return (
    <View style={estilos.exercicio}>
      {e.observacao ? (
        <Cartao style={{ borderColor: cores.atencao }}>
          <Texto numerico variante="suave" style={estilos.obsTexto}>{e.observacao}</Texto>
        </Cartao>
      ) : null}
      {!e.progressao ? <Texto numerico style={estilos.destaque}>Foco em controle, não em carga.</Texto> : null}
      {videoValido(e.videoUrl) || p.acaoAoLadoDoVideo ? (
        <View style={estilos.acoesRapidas}>
          {videoValido(e.videoUrl) ? (
            <View style={estilos.metade}>
              <Botao rotulo="Vídeo" tipo="secundario" Icone={PlayCircle} cheio aoTocar={abrirVideo} />
            </View>
          ) : null}
          {p.acaoAoLadoDoVideo ? <View style={estilos.metade}>{p.acaoAoLadoDoVideo}</View> : null}
        </View>
      ) : null}
      {usaCargaDeTrabalho(e) ? (
        <Cartao>
          <CampoNumericoGrande
            rotulo={`Carga de trabalho (${p.config.tipoTrabalho}) · ${dataCurta(p.data)}`}
            sufixo="kg"
            destaque
            valor={base}
            aoMudar={p.aoMudarCargaDoDia}
          />
          <Texto numerico variante="pequeno">
            {p.ultima?.carga != null
              ? `Última vez: ${numeroParaTela(p.ultima.carga)} kg × ${p.ultima.repeticoes ?? '—'} em ${dataParaTela(p.ultima.data)}`
              : 'Sem registro anterior: digite a carga que vai usar.'}
          </Texto>
        </Cartao>
      ) : null}
      <View style={estilos.tituloSeries}>
        <Texto numerico variante="secao">Séries do plano</Texto>
        <Texto numerico variante="pequeno">
          {feitas} de {e.series.length} feitas
        </Texto>
      </View>
      {calculadas.map((c, i) => (
        <CartaoSerie
          key={c.serie.uid}
          calculada={c}
          indice={i}
          semCarga={e.unidade === 'nenhuma'}
          registro={p.registroDe(c.serie.uid)}
          ultimaDoExercicio={feitas === e.series.length - 1}
          aoRegistrar={(d) => p.aoRegistrar(c.serie.uid, d)}
        />
      ))}
    </View>
  );
}

function CartaoSerie({
  calculada,
  indice,
  semCarga,
  registro,
  aoRegistrar,
  ultimaDoExercicio,
}: {
  calculada: SerieCalculada;
  indice: number;
  semCarga: boolean;
  registro: RegistroLocal | undefined;
  aoRegistrar: (d: DadosSerie) => void;
  ultimaDoExercicio: boolean;
}) {
  const { cores, marca, sobreMarca } = useTema();
  // Antes de gravar, a carga acompanha a sugestão até o aluno mexer; as repetições começam vazias.
  const [cargaDigitada, setCargaDigitada] = useState<number | null | undefined>(undefined);
  const [repsDigitadas, setRepsDigitadas] = useState<number | null>(null);
  const carga = registro ? registro.carga : cargaDigitada !== undefined ? cargaDigitada : calculada.sugestao;
  const reps = registro ? registro.repeticoes : repsDigitadas;
  const feita = !!registro?.concluida;
  const reduzido = useMovimentoReduzido();
  const progresso = useSharedValue(feita ? 1 : 0);
  useEffect(() => {
    progresso.set(reduzido ? (feita ? 1 : 0) : withTiming(feita ? 1 : 0, { duration: feita ? 200 : 150 }));
  }, [feita, reduzido, progresso]);
  const fundo = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(progresso.get(), [0, 1], [cores.superficie2, `${cores.sucesso}29`]) }));
  const s = calculada.serie;
  const trabalho = s.intensidade?.modo === 'CARGA_TRABALHO';

  const mudar = (parcial: Partial<DadosSerie>) => {
    if (registro) {
      aoRegistrar({ carga, repeticoes: reps, concluida: feita, ...parcial });
    } else {
      if ('carga' in parcial) setCargaDigitada(parcial.carga ?? null);
      if ('repeticoes' in parcial) setRepsDigitadas(parcial.repeticoes ?? null);
    }
  };

  return (
    <Animated.View
      style={[
        estilos.serie,
        { borderColor: feita ? cores.sucesso : cores.borda }, fundo,
      ]}>
      <View style={estilos.cabecaSerie}>
        <View style={[estilos.etiqueta, { backgroundColor: trabalho ? marca : cores.superficie2 }]}>
          <Texto numerico style={[estilos.etiquetaTexto, { color: trabalho ? sobreMarca : cores.textoSuave }]}>
            {trabalho ? s.tipo : `Série ${indice + 1}`}
          </Texto>
        </View>
        <Texto
          style={[estilos.nomeSerie, feita && { textDecorationLine: 'line-through', color: cores.textoSuave }]}>
          {trabalho ? `Série ${indice + 1}` : s.tipo}
        </Texto>
        <Texto numerico variante="pequeno" style={estilos.meta}>
          {calculada.meta}
        </Texto>
      </View>
      <View style={estilos.campos}>
        {semCarga ? null : (
          <CampoNumericoGrande
            rotulo="Peso"
            rotuloAcessivel={`Peso da série ${indice + 1}`}
            sufixo="kg"
            valor={carga}
            aoMudar={(v) => mudar({ carga: v })}
          />
        )}
        <CampoNumericoGrande
          rotulo="Reps"
          rotuloAcessivel={`Repetições da série ${indice + 1}`}
          sufixo="reps"
          inteiro
          valor={reps}
          aoMudar={(v) => mudar({ repeticoes: v })}
        />
        <BotaoMarcar feito={feita} ultimaDoExercicio={ultimaDoExercicio} rotulo={`Série ${indice + 1} ${s.tipo} feita`}
          aoTocar={() => aoRegistrar({ carga: semCarga ? null : carga, repeticoes: reps, concluida: !feita })} />
      </View>
      {!semCarga && !registro && cargaDigitada === undefined && calculada.sugestao !== null ? <Texto numerico variante="pequeno">Peso sugerido pelo plano; mude se usar outro.</Texto> : null}
      {registro?.situacao === 'FALHOU' ? <Texto numerico variante="pequeno" cor={cores.perigo}>Não enviado: {registro.motivo}</Texto> : null}
    </Animated.View>
  );
}

const estilos = StyleSheet.create({
  exercicio: { gap: espaco(1.5) },
  obsTexto: { fontStyle: 'italic' },
  destaque: { fontFamily: fontes.semi },
  acoesRapidas: { flexDirection: 'row', gap: espaco(1) },
  metade: { flex: 1, minWidth: 0 },
  tituloSeries: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: espaco(1), gap: espaco(1) },
  serie: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.75), gap: espaco(1.25) },
  cabecaSerie: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: espaco(1) },
  etiqueta: { borderRadius: 4, paddingHorizontal: espaco(0.75), paddingVertical: 3 },
  etiquetaTexto: { fontFamily: fontes.negrito, fontSize: 12, lineHeight: 16, letterSpacing: 0.4, textTransform: 'uppercase' },
  nomeSerie: { fontFamily: fontes.semi, fontSize: 16, flexShrink: 1 },
  meta: { flexGrow: 1, flexShrink: 1, textAlign: 'right' },
  campos: { flexDirection: 'row', alignItems: 'flex-end', gap: espaco(1), maxWidth: '100%' },
  check: {
    width: 56,
    height: 52,
    borderWidth: 2,
    borderRadius: RAIO,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
