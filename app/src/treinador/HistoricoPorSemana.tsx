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
import { BlocoDaDivisao } from './BlocoDaDivisao';

type SessaoDoDia = DiaDeTreino['sessoes'][number];

interface Props {
  dias: DiaDeTreino[];
  /** Nome da divisão da sessão (o mesmo das "Cargas por divisão"), para dar a mesma letra e a mesma cor. */
  nomeDaSessao: (s: SessaoDoDia) => string;
  letras: ReadonlyMap<string, string>;
}

/**
 * "Por dia" em semana → dia (Frente G, D15, C45): o cabeçalho da semana com os sete dias marcados (a letra da divisão
 * no dia treinado) e, embaixo, um cartão por dia treinado, a data à esquerda e a divisão no cabeçalho, com o que foi
 * registrado em cada exercício. As séries ficam em texto (sem a cor por tipo); a cor é só da divisão.
 */
export function HistoricoPorSemana({ dias, nomeDaSessao, letras }: Props) {
  const semanas = semanasDoHistorico(dias);
  const animar = usePrimeiraLista(semanas.length > 0, semanas.map((s) => s.inicio).join('|'));
  const letraDe = (s: SessaoDoDia) => letraDaDivisaoNoHistorico(letras, nomeDaSessao(s));
  return (
    <View style={estilos.lista}>
      {semanas.map((semana, i) => (
        <EntradaEmCascata key={semana.inicio} indice={i} animar={animar} style={estilos.semana}>
          <CabecalhoDaSemana titulo={tituloDaSemana(semana)} resumo={treinosDaSemana(semana)} marcas={semana.marcas.map((m) => (m.dia ? { data: m.data, letra: letraDe(m.dia.sessoes[0]), nome: nomeDaSessao(m.dia.sessoes[0]) } : null))} />
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

function CabecalhoDaSemana({ titulo, resumo, marcas }: { titulo: string; resumo: string; marcas: ({ data: string; letra: string | null; nome: string } | null)[] }) {
  const { cores, identificacao } = useTema();
  const treinados = marcas.flatMap((m) => (m ? [`${partesDaData(m.data).nomeDoDia}, ${m.nome}`] : []));
  return (
    <View style={[estilos.cabecalhoDaSemana, { borderBottomColor: cores.bordaCampo }]}>
      <View style={estilos.textosDaSemana}>
        <Texto variante="subtitulo" numerico nivel={3}>{titulo}</Texto>
        <Texto variante="suave">{resumo}</Texto>
      </View>
      <View style={estilos.marcas} accessible accessibilityLabel={`Dias com treino: ${treinados.join('; ') || 'nenhum'}`}>
        {marcas.map((m, i) => {
          const cor = m?.letra ? identificacao[corDaLetra(m.letra)] : null;
          return (
            <View
              key={i}
              style={[
                estilos.marca,
                m
                  ? { borderWidth: 2, borderColor: cor?.cor ?? cores.texto, backgroundColor: cor?.fundo ?? cores.superficie3 }
                  : { borderWidth: 1, borderColor: cores.borda, backgroundColor: cores.superficie },
              ]}>
              <Texto cor={m ? (cor?.cor ?? cores.texto) : cores.textoSuave} style={estilos.textoDaMarca}>
                {m ? (m.letra ?? '•') : LETRAS_DA_SEMANA[i]}
              </Texto>
            </View>
          );
        })}
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
  const { dia, titulo } = partesDaDivisao(nome);
  const n = sessao.exercicios.length;
  return (
    <BlocoDaDivisao letra={letra} titulo={titulo} dia={dia} resumo={`${n} ${n === 1 ? 'exercício' : 'exercícios'}`}>
      {sessao.exercicios.map((e, i) => {
        const volume = textoDoVolume(volumeDoExercicio(e.series));
        return (
          <View key={e.exercicioUid} style={[estilos.exercicio, i > 0 ? { borderTopWidth: 1, borderTopColor: cores.borda } : null]}>
            <Texto numerico style={estilos.nomeDoExercicio}>{e.nome}</Texto>
            <Texto numerico variante="suave">{e.series.map(textoSerie).join(' · ')}</Texto>
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
  marcas: { flexDirection: 'row', gap: 4 },
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
