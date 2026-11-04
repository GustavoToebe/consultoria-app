import { StyleSheet, View } from 'react-native';

import type { DiaDeTreino } from '../api/tipos';
import { dataParaTela } from '../dominio/formatos';
import {
  corDaLetra,
  LETRAS_DA_SEMANA,
  letraDaDivisaoNoHistorico,
  partesDaData,
  semanasDoHistorico,
  tituloDaSemana,
  treinosDaSemana,
} from '../dominio/historicoDoAluno';
import { partesDaDivisao, textoDoVolume, textoSerie, volumeDoExercicio } from '../dominio/relatorio';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes, LINHA_DA_FAIXA, RAIO } from '../tema/tokens';
import { EntradaEmCascata, usePrimeiraLista } from '../ui/EntradaEmCascata';
import { Texto } from '../ui/Texto';
import { useUnidadeDeCarga } from '../ui/unidadeDeCargaEmUso';
import { BlocoDaDivisao } from './BlocoDaDivisao';

type SessaoDoDia = DiaDeTreino['sessoes'][number];

interface Props {
  dias: DiaDeTreino[];
  /** Nome da divisão da sessão (o mesmo das "Cargas por divisão"), para dar a mesma letra e a mesma cor. */
  nomeDaSessao: (s: SessaoDoDia) => string;
  letras: ReadonlyMap<string, string>;
  /** Datas do período buscado (obrigatório): os dias da semana cortada que ficam fora dele aparecem neutros e não contam. */
  periodo: { de: string; ate: string };
  /** O dia de hoje (Brasília, D4): o que vem depois dele e ainda é do período "ainda não chegou" (D9). */
  hoje: string;
}

interface MarcaDoDia {
  data: string;
  foraDoPeriodo: boolean;
  aindaNaoChegou: boolean;
  /** Uma por sessão do dia (D3): a grade mostra todas. */
  sessoes: { letra: string | null; nome: string }[];
}

/**
 * "Por dia" em semana → dia (Frente G, D15, C45): o cabeçalho da semana com os sete dias marcados (a letra da divisão
 * no dia treinado) e, embaixo, um cartão por dia treinado, a data à esquerda e a divisão no cabeçalho, com o que foi
 * registrado em cada exercício. As séries ficam em texto (sem a cor por tipo); a cor é só da divisão.
 */
export function HistoricoPorSemana({ dias, nomeDaSessao, letras, periodo, hoje }: Props) {
  const semanas = semanasDoHistorico(dias, periodo, hoje);
  const animar = usePrimeiraLista(semanas.length > 0, semanas.map((s) => s.inicio).join('|'));
  const letraDe = (s: SessaoDoDia) => letraDaDivisaoNoHistorico(letras, nomeDaSessao(s));
  return (
    <View style={estilos.lista}>
      {semanas.map((semana, i) => (
        <EntradaEmCascata key={semana.inicio} indice={i} animar={animar} style={estilos.semana}>
          <CabecalhoDaSemana titulo={tituloDaSemana(semana)} resumo={treinosDaSemana(semana)} marcas={semana.marcas.map((m) => ({ data: m.data, foraDoPeriodo: m.foraDoPeriodo, aindaNaoChegou: m.aindaNaoChegou, sessoes: (m.dia?.sessoes ?? []).map((x) => ({ letra: letraDe(x), nome: nomeDaSessao(x) })) }))} />
          {semana.dias.map((dia) => (
            <View key={dia.data} style={estilos.dia}>
              <DataDoDia data={dia.data} />
              <View style={estilos.sessoes}>
                {dia.sessoes.map((s) => (
                  <SessaoNoDia key={`${s.planoVersaoId}:${s.sessaoUid}`} sessao={s} nome={nomeDaSessao(s)} letra={letraDe(s)} />
                ))}
              </View>
            </View>
          ))}
        </EntradaEmCascata>
      ))}
    </View>
  );
}

function CabecalhoDaSemana({ titulo, resumo, marcas }: { titulo: string; resumo: string; marcas: MarcaDoDia[] }) {
  const { cores, identificacao } = useTema();
  const treinados = marcas.filter((m) => m.sessoes.length).map((m) => `${partesDaData(m.data).nomeDoDia}, ${m.sessoes.map((x) => (x.letra ? `${x.nome} (${x.letra})` : x.nome)).join(' e ')}`);
  const fora = marcas.filter((m) => m.foraDoPeriodo);
  const futuros = marcas.filter((m) => m.aindaNaoChegou);
  const nomes = (lista: MarcaDoDia[]) => lista.map((m) => partesDaData(m.data).nomeDoDia).join(', ');
  const rotulo = `Dias com treino: ${treinados.join('; ') || 'nenhum'}${fora.length ? `. Fora do período: ${nomes(fora)}` : ''}${futuros.length ? `. Ainda não chegou: ${nomes(futuros)}` : ''}`;
  return (
    <View style={[estilos.cabecalhoDaSemana, { borderBottomColor: cores.bordaCampo }]}>
      <View style={estilos.textosDaSemana}>
        <Texto variante="subtitulo" numerico nivel={3}>{titulo}</Texto>
        <Texto variante="suave">{resumo}</Texto>
        {fora.length ? <Texto variante="pequeno">Fora do período: {fora.map((m) => partesDaData(m.data).sigla).join(', ')}</Texto> : null}
      </View>
      <View style={estilos.marcas} accessible accessibilityLabel={rotulo}>
        {marcas.map((m, i) => (
          <View key={i} style={estilos.diaDaGrade}>
            {m.sessoes.length ? (
              m.sessoes.map((x, j) => {
                const cor = x.letra ? identificacao[corDaLetra(x.letra)] : null;
                return (
                  <View key={j} style={[estilos.marca, { borderWidth: 2, borderColor: cor?.cor ?? cores.texto, backgroundColor: cor?.fundo ?? cores.superficie3 }]}>
                    <Texto cor={cor?.cor ?? cores.texto} style={estilos.textoDaMarca}>{x.letra ?? '•'}</Texto>
                  </View>
                );
              })
            ) : (
              <View style={[estilos.marca, { borderWidth: 1, borderColor: cores.borda, backgroundColor: m.foraDoPeriodo || m.aindaNaoChegou ? 'transparent' : cores.superficie }, m.foraDoPeriodo ? estilos.foraDoPeriodo : null]}>
                <Texto cor={cores.textoSuave} style={estilos.textoDaMarca}>{LETRAS_DA_SEMANA[i]}</Texto>
              </View>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

function DataDoDia({ data }: { data: string }) {
  const { cores, bordas } = useTema();
  const p = partesDaData(data);
  return (
    <View
      accessible
      accessibilityLabel={`${p.nomeDoDia}, ${dataParaTela(data)}`}
      style={[estilos.data, { borderWidth: bordas.bloco, borderColor: cores.borda, backgroundColor: cores.superficie }]}>
      <Texto variante="pequeno" style={estilos.sigla}>{p.sigla}</Texto>
      <Texto numerico style={estilos.numeroDoDia}>{p.dia}</Texto>
      <Texto variante="pequeno">{p.mes}</Texto>
    </View>
  );
}

function SessaoNoDia({ sessao, nome, letra }: { sessao: SessaoDoDia; nome: string; letra: string | null }) {
  const { cores } = useTema();
  const unidade = useUnidadeDeCarga();
  const { dia, titulo } = partesDaDivisao(nome);
  const n = sessao.exercicios.length;
  return (
    <BlocoDaDivisao letra={letra} titulo={titulo} dia={dia} resumo={`${n} ${n === 1 ? 'exercício' : 'exercícios'}`}>
      {sessao.exercicios.map((e, i) => {
        const volume = textoDoVolume(volumeDoExercicio(e.series), unidade);
        return (
          <View key={e.exercicioUid} style={[estilos.exercicio, i > 0 ? { borderTopWidth: 1, borderTopColor: cores.borda } : null]}>
            <Texto numerico style={estilos.nomeDoExercicio}>{e.nome}</Texto>
            <Texto numerico variante="suave">{e.series.map((s) => textoSerie(s, unidade)).join(' · ')}</Texto>
            {volume ? <Texto numerico variante="pequeno">{volume}</Texto> : null}
          </View>
        );
      })}
    </BlocoDaDivisao>
  );
}

const estilos = StyleSheet.create({
  lista: { gap: espaco(3) },
  semana: { gap: espaco(1.25) },
  cabecalhoDaSemana: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1.25), paddingBottom: espaco(1), borderBottomWidth: LINHA_DA_FAIXA - 1 },
  textosDaSemana: { flexGrow: 1, flexBasis: 160, gap: 1 },
  marcas: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  diaDaGrade: { gap: 4 },
  foraDoPeriodo: { borderStyle: 'dashed' },
  marca: { width: 26, height: 26, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  textoDaMarca: { fontFamily: fontes.negrito, fontSize: 12, lineHeight: 15 },
  dia: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(1.25) },
  data: { width: 56, flexShrink: 0, borderRadius: RAIO, alignItems: 'center', justifyContent: 'center', paddingVertical: espaco(0.75) },
  sigla: { fontFamily: fontes.semi, letterSpacing: 0.6 },
  numeroDoDia: { fontFamily: fontes.negrito, fontSize: 20, lineHeight: 24 },
  sessoes: { flex: 1, minWidth: 0, gap: espaco(1) },
  exercicio: { gap: 2, paddingHorizontal: espaco(0.5), paddingTop: espaco(0.75) },
  nomeDoExercicio: { fontFamily: fontes.semi, fontSize: 14 },
});
