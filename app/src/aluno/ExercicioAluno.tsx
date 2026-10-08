import { Check, ChevronDown, ChevronUp, PlayCircle } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import type { ExercicioPlano, UltimaCarga } from '../api/tipos';
import { calcularCargasDoExercicio, usaCargaDeTrabalho, type SerieCalculada } from '../dominio/cargas';
import { dataParaTela, numeroParaTela } from '../dominio/formatos';
import { MODALIDADES } from '../treinador/treino/FolhaBiblioteca';
import type { RegistroLocal } from '../offline/repositorioLocal';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../tema/tokens';
import { useAviso } from '../ui/Aviso';
import { Botao } from '../ui/Botao';
import { CampoNumerico } from '../ui/Campos';
import { Selo } from '../ui/Selo';
import { Texto } from '../ui/Texto';

export interface DadosSerie {
  carga: number | null;
  repeticoes: number | null;
  concluida: boolean;
}

interface Props {
  exercicio: ExercicioPlano;
  posicao: number;
  aberto: boolean;
  aoAbrir: () => void;
  /** Carga de trabalho do dia que o aluno digitou (ou `null`). */
  cargaDoDia: number | null;
  /** Última carga de trabalho registrada (servidor ou aparelho) para sugerir a base. */
  ultima: UltimaCarga | null;
  registroDe: (serieUid: string) => RegistroLocal | undefined;
  config: { arredondamentoKg: number; tipoTrabalho: string };
  aoMudarCargaDoDia: (carga: number | null) => void;
  aoRegistrar: (serieUid: string, dados: DadosSerie) => void;
}

/**
 * Exercício na sessão do aluno: meta de cada série, sugestão de carga (editável) e repetições vazias até o aluno
 * digitar. O ✓ grava no aparelho na hora. O plano não é editável aqui.
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
    if (!e.videoUrl) return;
    // Abre fora do app (navegador ou app do YouTube), sem token nem cookie.
    Linking.openURL(e.videoUrl).catch(() => avisar('Não foi possível abrir o vídeo.', 'perigo'));
  };

  return (
    <View style={[estilos.cartao, { borderColor: feitas === e.series.length && feitas ? cores.sucesso : cores.borda, backgroundColor: cores.superficie }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${p.aberto ? 'Fechar' : 'Abrir'} ${e.nome}`}
        accessibilityState={{ expanded: p.aberto }}
        onPress={p.aoAbrir}
        style={estilos.topo}>
        <View style={estilos.titulo}>
          <Texto style={estilos.nome}>
            {p.posicao + 1}. {e.nome}
          </Texto>
          <View style={estilos.selos}>
            <Selo texto={`${feitas}/${e.series.length} séries`} tipo={feitas === e.series.length && feitas ? 'sucesso' : feitas ? 'atencao' : 'neutro'} />
            {e.modalidade ? <Texto variante="pequeno">{MODALIDADES[e.modalidade] ?? e.modalidade}</Texto> : null}
          </View>
        </View>
        {p.aberto ? <ChevronUp size={20} color={cores.textoSuave} /> : <ChevronDown size={20} color={cores.textoSuave} />}
      </Pressable>
      {p.aberto ? (
        <View style={estilos.corpo}>
          {e.observacao ? <Texto variante="suave">{e.observacao}</Texto> : null}
          {!e.progressao ? <Texto style={estilos.destaque}>Foco em controle, não em carga.</Texto> : null}
          {e.videoUrl ? <Botao rotulo="Vídeo" tipo="secundario" Icone={PlayCircle} aoTocar={abrirVideo} /> : null}
          {usaCargaDeTrabalho(e) ? (
            <View style={estilos.base}>
              <CampoNumerico
                rotulo={`Carga de trabalho de hoje (${p.config.tipoTrabalho})`}
                sufixo="kg"
                valor={base}
                aoMudar={p.aoMudarCargaDoDia}
                ajuda={
                  p.ultima?.carga != null
                    ? `Última vez: ${numeroParaTela(p.ultima.carga)} kg × ${p.ultima.repeticoes ?? '—'} em ${dataParaTela(p.ultima.data)}`
                    : 'Sem registro anterior: digite a carga que vai usar.'
                }
              />
            </View>
          ) : null}
          {calculadas.map((c, i) => (
            <LinhaSerie
              key={c.serie.uid}
              calculada={c}
              indice={i}
              semCarga={e.unidade === 'nenhuma'}
              registro={p.registroDe(c.serie.uid)}
              aoRegistrar={(d) => p.aoRegistrar(c.serie.uid, d)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function LinhaSerie({
  calculada,
  indice,
  semCarga,
  registro,
  aoRegistrar,
}: {
  calculada: SerieCalculada;
  indice: number;
  semCarga: boolean;
  registro: RegistroLocal | undefined;
  aoRegistrar: (d: DadosSerie) => void;
}) {
  const { cores } = useTema();
  // Antes de gravar, a carga acompanha a sugestão até o aluno mexer; as repetições começam vazias.
  const [cargaDigitada, setCargaDigitada] = useState<number | null | undefined>(undefined);
  const [repsDigitadas, setRepsDigitadas] = useState<number | null>(null);
  const carga = registro ? registro.carga : cargaDigitada !== undefined ? cargaDigitada : calculada.sugestao;
  const reps = registro ? registro.repeticoes : repsDigitadas;
  const feita = !!registro?.concluida;
  const s = calculada.serie;

  const mudar = (parcial: Partial<DadosSerie>) => {
    if (registro) {
      aoRegistrar({ carga, repeticoes: reps, concluida: feita, ...parcial });
    } else {
      if ('carga' in parcial) setCargaDigitada(parcial.carga ?? null);
      if ('repeticoes' in parcial) setRepsDigitadas(parcial.repeticoes ?? null);
    }
  };

  return (
    <View style={[estilos.serie, { borderColor: feita ? cores.sucesso : cores.borda, backgroundColor: cores.superficie2 }]}>
      <View style={estilos.cabecaSerie}>
        <Texto style={estilos.nomeSerie}>
          {indice + 1}. {s.tipo}
        </Texto>
        <Texto variante="pequeno" style={estilos.meta}>
          {calculada.meta}
        </Texto>
      </View>
      <View style={estilos.campos}>
        {semCarga ? null : (
          <View style={estilos.campo}>
            <CampoNumerico rotulo="Carga" sufixo="kg" valor={carga} aoMudar={(v) => mudar({ carga: v })} />
          </View>
        )}
        <View style={estilos.campo}>
          <CampoNumerico rotulo="Reps" inteiro valor={reps} aoMudar={(v) => mudar({ repeticoes: v })} />
        </View>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel={`Série ${indice + 1} ${s.tipo} feita`}
          accessibilityState={{ checked: feita }}
          onPress={() => aoRegistrar({ carga: semCarga ? null : carga, repeticoes: reps, concluida: !feita })}
          style={({ pressed }) => [
            estilos.check,
            { borderColor: feita ? cores.sucesso : cores.borda, backgroundColor: feita ? cores.sucesso : 'transparent', opacity: pressed ? 0.7 : 1 },
          ]}>
          <Check size={24} color={feita ? '#FFFFFF' : cores.textoSuave} strokeWidth={3} />
        </Pressable>
      </View>
      {registro?.situacao === 'FALHOU' ? <Texto variante="pequeno" cor={cores.perigo}>Não enviado: {registro.motivo}</Texto> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  cartao: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), gap: espaco(1) },
  topo: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), minHeight: ALVO_TOQUE },
  titulo: { flex: 1, gap: espaco(0.5) },
  nome: { fontFamily: fontes.semi, fontSize: 16 },
  selos: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: espaco(1) },
  corpo: { gap: espaco(1.25) },
  destaque: { fontFamily: fontes.semi },
  base: { maxWidth: 320 },
  serie: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.25), gap: espaco(1) },
  cabecaSerie: { gap: 2 },
  nomeSerie: { fontFamily: fontes.semi },
  meta: { flexShrink: 1 },
  campos: { flexDirection: 'row', alignItems: 'flex-end', gap: espaco(1) },
  campo: { flex: 1, maxWidth: 140 },
  check: {
    width: 52,
    height: ALVO_TOQUE,
    borderWidth: 2,
    borderRadius: RAIO,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
