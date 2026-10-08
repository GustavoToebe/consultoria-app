import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { execucoesDoAluno, progressoDoAluno } from '../api/rotas';
import type { DiaDeTreino, SerieFeita } from '../api/tipos';
import { dataParaTela, hojeIso, numeroParaTela, somarDias } from '../dominio/formatos';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../tema/tokens';
import { Cartao } from '../ui/Cartao';
import { Escolha } from '../ui/Escolha';
import { Carregando, MensagemErro } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { Texto } from '../ui/Texto';
import { useCarregar } from '../ui/useCarregar';

const DIAS = 14;

/** "WS 32 kg × 5"; o que o aluno não informou aparece como "—" (nunca presumido). */
export function textoSerie(s: SerieFeita): string {
  const carga = s.unidade === 'nenhuma' ? '' : `${numeroParaTela(s.carga)} kg × `;
  return `${s.tipo} ${carga}${s.repeticoes ?? '—'}`;
}

/** Registros dos últimos 14 dias agrupados por data, sessão e exercício, e o progresso por exercício. */
export function CartaoRegistros({ alunoId }: { alunoId: string }) {
  const hoje = hojeIso();
  const de = somarDias(hoje, -(DIAS - 1));
  const { dados, erro, carregando, recarregar } = useCarregar(`exec:${alunoId}:${de}`, () =>
    execucoesDoAluno(alunoId, de, hoje),
  );
  return (
    <>
      <Cartao titulo={`Registros dos últimos ${DIAS} dias`}>
        {erro ? <MensagemErro texto={textoDoErro(erro)} tentarDeNovo={recarregar} /> : null}
        {!dados && carregando ? <Carregando /> : null}
        {dados && dados.length === 0 ? (
          <Texto variante="suave">Nenhum registro no período. O aluno pode ter treinado sem registrar.</Texto>
        ) : null}
        {[...(dados ?? [])].sort((a, b) => b.data.localeCompare(a.data)).map((d) => <Dia key={d.data} dia={d} />)}
      </Cartao>
      {dados && dados.length > 0 ? <CartaoProgresso alunoId={alunoId} dias={dados} /> : null}
    </>
  );
}

function Dia({ dia }: { dia: DiaDeTreino }) {
  const { cores } = useTema();
  return (
    <View style={[estilos.dia, { borderColor: cores.borda }]}>
      <Texto style={estilos.dataDia}>{dataParaTela(dia.data)}</Texto>
      {dia.sessoes.map((s) => (
        <View key={`${s.planoVersaoId}:${s.sessaoUid}`} style={estilos.sessao}>
          <Texto variante="secao">{s.sessao}</Texto>
          {s.exercicios.map((e) => (
            <View key={e.exercicioUid} style={estilos.exercicio}>
              <Texto style={estilos.nomeExercicio}>{e.nome}</Texto>
              <Texto variante="suave">{e.series.map(textoSerie).join(' · ')}</Texto>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function CartaoProgresso({ alunoId, dias }: { alunoId: string; dias: DiaDeTreino[] }) {
  const { cores } = useTema();
  const exercicios = new Map<string, string>();
  for (const d of dias) {
    for (const s of d.sessoes) {
      for (const e of s.exercicios) {
        if (e.exercicioId && e.series.some((x) => x.trabalho)) exercicios.set(e.exercicioId, e.nome);
      }
    }
  }
  const opcoes = [...exercicios].map(([valor, rotulo]) => ({ valor, rotulo }));
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const atual = escolhido ?? opcoes[0]?.valor ?? null;
  const { dados, erro, carregando } = useCarregar(atual ? `prog:${alunoId}:${atual}` : null, () =>
    progressoDoAluno(alunoId, atual as string),
  );
  if (opcoes.length === 0) return null;
  return (
    <Cartao titulo="Progresso por exercício">
      <Escolha descricao="Exercício" opcoes={opcoes} valor={atual} aoMudar={setEscolhido} />
      {erro ? <MensagemErro texto={textoDoErro(erro)} /> : null}
      {carregando && !dados ? <Carregando /> : null}
      {dados?.length ? (
        <View style={[estilos.tabela, { borderColor: cores.borda }]}>
          <View style={[estilos.linhaTabela, { backgroundColor: cores.superficie2 }]}>
            <Texto variante="pequeno" style={estilos.col}>Data</Texto>
            <Texto variante="pequeno" style={estilos.col}>Maior carga de trabalho</Texto>
            <Texto variante="pequeno" style={estilos.col}>Repetições</Texto>
          </View>
          {[...dados].reverse().map((p) => (
            <View key={p.data} style={[estilos.linhaTabela, { borderColor: cores.borda }]}>
              <Texto style={estilos.col}>{dataParaTela(p.data)}</Texto>
              <Texto style={estilos.col}>{p.maiorCargaTrabalho === null ? '—' : `${numeroParaTela(p.maiorCargaTrabalho)} kg`}</Texto>
              <Texto style={estilos.col}>{p.repeticoes ?? '—'}</Texto>
            </View>
          ))}
        </View>
      ) : null}
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  dia: { borderTopWidth: 1, paddingTop: espaco(1), gap: espaco(1) },
  dataDia: { fontFamily: fontes.semi },
  sessao: { gap: espaco(0.75) },
  exercicio: { gap: 2 },
  nomeExercicio: { fontFamily: fontes.semi, fontSize: 14 },
  tabela: { borderWidth: 1, borderRadius: RAIO, overflow: 'hidden' },
  linhaTabela: { flexDirection: 'row', paddingHorizontal: espaco(1.5), paddingVertical: espaco(1), borderTopWidth: StyleSheet.hairlineWidth },
  col: { flex: 1 },
});
