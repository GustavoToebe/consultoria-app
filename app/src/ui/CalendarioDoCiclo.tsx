import { Pressable, StyleSheet, View } from 'react-native';

import type { DiaDeCicloApi, RegistroDeCicloApi } from '../api/tipos';
import {
  faseNaData, menstruacaoPrevista, ROTULO_DA_FASE, type ConfigDoCiclo, type FaseDoCiclo,
} from '../dominio/cicloMenstrual';
import { somarDias } from '../dominio/formatos';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, textoSobre } from '../tema/tokens';
import { corDaFase } from './FaixaDoCiclo';
import { Texto } from './Texto';

const SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export function rotuloDoMes(iso: string): string {
  const [ano, mes] = iso.split('-').map(Number);
  return `${MESES[mes - 1]} de ${ano}`;
}

export function mesSeguinte(iso: string, passo: number): string {
  const [ano, mes] = iso.split('-').map(Number);
  const data = new Date(Date.UTC(ano, mes - 1 + passo, 1));
  return data.toISOString().slice(0, 10);
}

function celulas(mes: string): (string | null)[] {
  const [ano, m] = mes.split('-').map(Number);
  const folga = (new Date(Date.UTC(ano, m - 1, 1)).getUTCDay() + 6) % 7;
  const ultimo = new Date(Date.UTC(ano, m, 0)).getUTCDate();
  const dias = Array.from({ length: ultimo }, (_, i) => `${mes.slice(0, 8)}${String(i + 1).padStart(2, '0')}`);
  return [...Array.from({ length: folga }, () => null), ...dias];
}

function menstruacaoRegistrada(registros: readonly RegistroDeCicloApi[], hoje: string): Set<string> {
  const dias = new Set<string>();
  for (const r of registros) {
    const fim = r.fim ?? (r.inicio <= hoje ? hoje : r.inicio);
    for (let dia = r.inicio; dia <= fim; dia = somarDias(dia, 1)) dias.add(dia);
  }
  return dias;
}

function temMarca(dia: DiaDeCicloApi | undefined): boolean {
  return !!dia && !!(dia.fluxo || dia.colica || dia.observacao || (dia.sintomas && dia.sintomas.length > 0));
}

/**
 * Mês do ciclo: menstruação registrada em tom próprio, previsto com contorno tracejado, fases estimadas e ponto
 * no dia que tem sintoma. A legenda é texto. O toque devolve a data.
 */
export function CalendarioDoCiclo({ mes, registros, dias, config, aoTocarDia }: {
  mes: string;
  registros: readonly RegistroDeCicloApi[];
  dias: readonly DiaDeCicloApi[];
  config: ConfigDoCiclo;
  aoTocarDia: (data: string) => void;
}) {
  const { cores } = useTema();
  const registrados = menstruacaoRegistrada(registros, config.hoje);
  const prevista = menstruacaoPrevista(registros, config);
  const previstos = new Set<string>();
  if (prevista) {
    const fim = prevista.fim ?? prevista.inicio;
    for (let dia = prevista.inicio; dia <= fim; dia = somarDias(dia, 1)) previstos.add(dia);
  }
  const porData = new Map(dias.map((d) => [d.data, d]));
  const fasesVistas = new Set<FaseDoCiclo>();
  return (
    <View style={estilos.bloco}>
      <View style={estilos.grade}>
        {SEMANA.map((d) => <Texto key={d} variante="pequeno" style={estilos.cabeca}>{d}</Texto>)}
        {celulas(mes).map((data, i) => {
          if (!data) return <View key={`v${i}`} style={estilos.celula} />;
          const leitura = faseNaData(registros, config, data);
          if (leitura.fase) fasesVistas.add(leitura.fase);
          const registrada = registrados.has(data);
          const previsto = !registrada && previstos.has(data);
          const fase = leitura.fase;
          const fundo = registrada || (fase && !previsto) ? corDaFase(cores, registrada ? 'MENSTRUAL' : fase!) : cores.superficie2;
          const letra = registrada || (fase && !previsto) ? textoSobre(fundo) : cores.texto;
          return (
            <Pressable key={data} accessibilityRole="button" accessibilityLabel={`${data.slice(8)} de ${rotuloDoMes(mes)}`}
              onPress={() => aoTocarDia(data)}
              style={[estilos.celula, {
                backgroundColor: previsto ? cores.superficie : fundo,
                borderColor: previsto ? cores.textoSuave : 'transparent',
                borderStyle: previsto ? 'dashed' : 'solid',
                borderWidth: previsto ? 1 : 0,
              }]}>
              <Texto numerico style={{ color: previsto ? cores.texto : letra }}>{Number(data.slice(8))}</Texto>
              {temMarca(porData.get(data)) ? <View style={[estilos.ponto, { backgroundColor: cores.texto }]} /> : null}
            </Pressable>
          );
        })}
      </View>
      <View style={estilos.legenda}>
        <Item cor={cores.fase1} texto="Menstruação registrada" />
        <Item cor={cores.superficie} borda texto="Menstruação prevista" />
        {[...fasesVistas].filter((f) => f !== 'MENSTRUAL').map((f) => <Item key={f} cor={corDaFase(cores, f)} texto={`${ROTULO_DA_FASE[f]} (estimativa)`} />)}
        <Item cor={cores.texto} ponto texto="Dia com sintoma" />
      </View>
    </View>
  );
}

function Item({ cor, texto, borda, ponto }: { cor: string; texto: string; borda?: boolean; ponto?: boolean }) {
  const { cores } = useTema();
  return (
    <View style={estilos.item}>
      <View style={[ponto ? estilos.pontoLegenda : estilos.amostra, { backgroundColor: cor, borderColor: cores.textoSuave, borderWidth: borda ? 1 : 0, borderStyle: borda ? 'dashed' : 'solid' }]} />
      <Texto variante="pequeno">{texto}</Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(1) },
  grade: { flexDirection: 'row', flexWrap: 'wrap' },
  cabeca: { width: `${100 / 7}%`, textAlign: 'center' },
  celula: { width: `${100 / 7}%`, minHeight: ALVO_TOQUE, alignItems: 'center', justifyContent: 'center' },
  ponto: { width: 6, height: 6, borderRadius: 3, position: 'absolute', bottom: 4 },
  legenda: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5) },
  item: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5) },
  amostra: { width: 12, height: 12, borderRadius: 2 },
  pontoLegenda: { width: 6, height: 6, borderRadius: 3 },
});
