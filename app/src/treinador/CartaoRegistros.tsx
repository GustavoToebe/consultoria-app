import { EntradaEmCascata, usePrimeiraLista } from '../ui/EntradaEmCascata';
import { FileDown } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { execucoesDoAluno, progressoDoAluno } from '../api/rotas';
import type { DiaDeTreino, SerieFeita } from '../api/tipos';
import { dataParaTela, hojeIso, numeroParaTela, somarDias } from '../dominio/formatos';
import { cargasPorDivisao, filtrarPorSessoes } from '../dominio/relatorio';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../tema/tokens';
import { Abas } from '../ui/Abas';
import { useAviso } from '../ui/Aviso';
import { Botao } from '../ui/Botao';
import { Cartao } from '../ui/Cartao';
import { Escolha } from '../ui/Escolha';
import { Esqueleto } from '../ui/Esqueleto';
import { MensagemErro, Vazio } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { Texto } from '../ui/Texto';
import { useCarregar } from '../ui/useCarregar';
import { CargasPorDivisao } from './CargasPorDivisao';
import { gerarPdfDeCargas, sessoesPorUid, treinosDoAluno } from './gerarPdf';

/** "WS 32 kg × 5"; o que o aluno não informou aparece como "—" (nunca presumido). */
export function textoSerie(s: SerieFeita): string {
  const carga = s.unidade === 'nenhuma' ? '' : `${numeroParaTela(s.carga)} kg × `;
  return `${s.tipo} ${carga}${s.repeticoes ?? '—'}`;
}

export const PERIODOS = [
  { valor: '14', rotulo: '14 dias' },
  { valor: '30', rotulo: '30 dias' },
  { valor: '60', rotulo: '60 dias' },
];

export type VisaoRegistros = 'divisao' | 'dia';
export const VISOES: { valor: VisaoRegistros; rotulo: string }[] = [
  { valor: 'divisao', rotulo: 'Por divisão' },
  { valor: 'dia', rotulo: 'Por dia' },
];

/**
 * Registros do aluno no período: por divisão do plano (carga de trabalho de cada dia, como o relatório em PDF) ou
 * por dia, e o progresso por exercício.
 */
export function CartaoRegistros({ aluno }: { aluno: { id: string; nome: string } }) {
  const { avisar } = useAviso();
  const [dias, setDias] = useState('14');
  const [visao, setVisao] = useState<VisaoRegistros>('divisao');
  const [gerando, setGerando] = useState(false);
  const hoje = hojeIso();
  const de = somarDias(hoje, -(Number(dias) - 1));
  const { dados, erro, carregando, recarregar } = useCarregar(`exec:${aluno.id}:${de}`, () =>
    execucoesDoAluno(aluno.id, de, hoje),
  );
  const animar = usePrimeiraLista(!!dados, de);
  const treinos = useCarregar(`treinos:${aluno.id}`, () => treinosDoAluno(aluno.id));
  const [planoId, setPlanoId] = useState('todos');
  const planos = treinos.dados ?? [];
  const planoEscolhido = planos.find((t) => t.plano.id === planoId);
  const filtrados = dados ? filtrarPorSessoes(dados, planoEscolhido ? new Set(planoEscolhido.sessoes.map((s) => s.uid)) : null) : null;
  const divisoes = filtrados ? cargasPorDivisao(filtrados, sessoesPorUid(planos)) : [];
  const opcoesPlano = [{ valor: 'todos', rotulo: 'Todos os planos' }, ...planos.map((t) => ({ valor: t.plano.id, rotulo: t.plano.titulo }))];

  const pdf = () => {
    setGerando(true);
    gerarPdfDeCargas(aluno, de, hoje, divisoes)
      .catch((e: unknown) => avisar(textoDoErro(e), 'perigo'))
      .finally(() => setGerando(false));
  };

  return (
    <>
      <Cartao
        titulo="Registros e cargas"
        recolhivel
        acoes={
          divisoes.length ? <Botao rotulo="PDF das cargas" tipo="secundario" Icone={FileDown} carregando={gerando} aoTocar={pdf} /> : null
        }>
        <View style={estilos.filtros}>
          <Escolha descricao="Período" opcoes={PERIODOS} valor={dias} aoMudar={setDias} />
          {planos.length > 1 ? <Escolha descricao="Plano" opcoes={opcoesPlano} valor={planoId} aoMudar={setPlanoId} /> : null}
        </View>
        <Abas abas={VISOES} ativa={visao} aoMudar={setVisao} />
        {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
        {!dados && carregando ? <Esqueleto /> : null}
        {dados && filtrados && filtrados.length === 0 ? (
          <Vazio titulo="Sem registros no período" texto="Os treinos registrados aparecem aqui. O aluno pode ter treinado sem registrar." />
        ) : null}
        {dados && visao === 'divisao' ? <CargasPorDivisao divisoes={divisoes} /> : null}
        {filtrados && visao === 'dia'
          ? [...filtrados].sort((a, b) => b.data.localeCompare(a.data)).map((d, i) => <EntradaEmCascata key={d.data} indice={i} animar={animar}><DiaRegistros dia={d} /></EntradaEmCascata>)
          : null}
      </Cartao>
      {filtrados && filtrados.length > 0 ? <CartaoProgresso alunoId={aluno.id} dias={filtrados} /> : null}
    </>
  );
}

export function DiaRegistros({ dia }: { dia: DiaDeTreino }) {
  const { cores } = useTema();
  return (
    <View style={[estilos.dia, { borderColor: cores.borda }]}>
      <Texto numerico style={estilos.dataDia}>{dataParaTela(dia.data)}</Texto>
      {dia.sessoes.map((s) => (
        <View key={`${s.planoVersaoId}:${s.sessaoUid}`} style={estilos.sessao}>
          <Texto numerico variante="secao">{s.sessao}</Texto>
          {s.exercicios.map((e) => (
            <View key={e.exercicioUid} style={estilos.exercicio}>
              <Texto numerico style={estilos.nomeExercicio}>{e.nome}</Texto>
              <Texto numerico variante="suave">{e.series.map(textoSerie).join(' · ')}</Texto>
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
    <Cartao titulo="Progresso por exercício" recolhivel recolhido>
      <Escolha descricao="Exercício" opcoes={opcoes} valor={atual} aoMudar={setEscolhido} />
      {erro ? <MensagemErro texto={textoDoErro(erro)} /> : null}
      {carregando && !dados ? <Esqueleto /> : null}
      {dados?.length ? (
        <View style={[estilos.tabela, { borderColor: cores.borda }]}>
          <View style={[estilos.linhaTabela, { backgroundColor: cores.superficie2 }]}>
            <Texto numerico variante="pequeno" style={estilos.col}>Data</Texto>
            <Texto numerico variante="pequeno" style={estilos.col}>Maior carga de trabalho</Texto>
            <Texto numerico variante="pequeno" style={estilos.col}>Repetições</Texto>
          </View>
          {[...dados].reverse().map((p) => (
            <View key={p.data} style={[estilos.linhaTabela, { borderColor: cores.borda }]}>
              <Texto numerico style={estilos.col}>{dataParaTela(p.data)}</Texto>
              <Texto numerico style={estilos.col}>{p.maiorCargaTrabalho === null ? '—' : `${numeroParaTela(p.maiorCargaTrabalho)} kg`}</Texto>
              <Texto numerico style={estilos.col}>{p.repeticoes ?? '—'}</Texto>
            </View>
          ))}
        </View>
      ) : null}
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  filtros: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5) },
  dia: { borderTopWidth: 1, paddingTop: espaco(1), gap: espaco(1) },
  dataDia: { fontFamily: fontes.semi },
  sessao: { gap: espaco(0.75) },
  exercicio: { gap: 2 },
  nomeExercicio: { fontFamily: fontes.semi, fontSize: 14 },
  tabela: { borderWidth: 1, borderRadius: RAIO, overflow: 'hidden' },
  linhaTabela: { flexDirection: 'row', paddingHorizontal: espaco(1.5), paddingVertical: espaco(1), borderTopWidth: StyleSheet.hairlineWidth },
  col: { flex: 1 },
});
