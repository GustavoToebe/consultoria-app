import { EntradaEmCascata, usePrimeiraLista } from '../ui/EntradaEmCascata';
import { FileDown } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { execucoesDoAluno } from '../api/rotas';
import type { DiaDeTreino, PastaResumo, SerieFeita } from '../api/tipos';
import { dataParaTela, hojeIso, numeroParaTela } from '../dominio/formatos';
import { cargasPorDivisao, filtrarPorSessoes, intervaloDeRegistros } from '../dominio/relatorio';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes } from '../tema/tokens';
import { Abas } from '../ui/Abas';
import { useAviso } from '../ui/Aviso';
import { Botao } from '../ui/Botao';
import { CabecalhoDeGrupo } from '../ui/CabecalhoDeGrupo';
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
export function CartaoRegistros({ aluno, pasta }: { aluno: { id: string; nome: string }; pasta?: PastaResumo }) {
  const { avisar } = useAviso();
  const [dias, setDias] = useState('14');
  const [visao, setVisao] = useState<VisaoRegistros>('divisao');
  const [gerando, setGerando] = useState(false);
  // Dentro da pasta, o período é o dela (sem os filtros de 14/30/60 dias) e só entram os treinos dela.
  const daPasta = !!pasta?.inicio && !!pasta.fim;
  const { de, ate } = intervaloDeRegistros(hojeIso(), Number(dias), pasta);
  const { dados, erro, carregando, recarregar } = useCarregar(`exec:${aluno.id}:${de}:${ate}`, () =>
    execucoesDoAluno(aluno.id, de, ate),
  );
  const animar = usePrimeiraLista(!!dados, de);
  const treinos = useCarregar(`treinos:${aluno.id}`, () => treinosDoAluno(aluno.id));
  const [planoId, setPlanoId] = useState('todos');
  const planos = (treinos.dados ?? []).filter((t) => !daPasta || t.plano.pastaId === pasta?.id);
  const planoEscolhido = planos.find((t) => t.plano.id === planoId);
  const filtrados = dados ? filtrarPorSessoes(dados, planoEscolhido ? new Set(planoEscolhido.sessoes.map((s) => s.uid)) : null) : null;
  const divisoes = filtrados ? cargasPorDivisao(filtrados, sessoesPorUid(planos)) : [];
  const opcoesPlano = [{ valor: 'todos', rotulo: 'Todos os planos' }, ...planos.map((t) => ({ valor: t.plano.id, rotulo: t.plano.titulo }))];

  const pdf = () => {
    setGerando(true);
    gerarPdfDeCargas(aluno, de, ate, divisoes)
      .catch((e: unknown) => avisar(textoDoErro(e), 'perigo'))
      .finally(() => setGerando(false));
  };

  return (
      <Cartao
        titulo="Registros e cargas"
        recolhivel
        acoes={
          divisoes.length ? <Botao rotulo="PDF das cargas" tipo="secundario" Icone={FileDown} carregando={gerando} aoTocar={pdf} /> : null
        }>
        <View style={estilos.filtros}>
          {daPasta ? <Texto numerico variante="suave">Período da pasta: {dataParaTela(de)} a {dataParaTela(ate)}</Texto>
            : <Escolha descricao="Período" opcoes={PERIODOS} valor={dias} aoMudar={setDias} />}
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
  );
}

export function DiaRegistros({ dia }: { dia: DiaDeTreino }) {
  const { cores } = useTema();
  const [aberto, setAberto] = useState(true);
  return (
    <Cartao cabecalho={<CabecalhoDeGrupo titulo={dataParaTela(dia.data)} resumo={`${dia.sessoes.length} ${dia.sessoes.length === 1 ? 'sessão' : 'sessões'}`} aberto={aberto} aoAlternar={() => setAberto((a) => !a)} />}>
      {!aberto ? null : dia.sessoes.map((s) => (
        <View key={`${s.planoVersaoId}:${s.sessaoUid}`} style={[estilos.sessao, { backgroundColor: cores.superficie2, borderColor: cores.borda }]}>
          <Texto numerico variante="secao">{s.sessao}</Texto>
          {s.exercicios.map((e) => (
            <View key={e.exercicioUid} style={estilos.exercicio}>
              <Texto numerico style={estilos.nomeExercicio}>{e.nome}</Texto>
              <Texto numerico variante="suave">{e.series.map(textoSerie).join(' · ')}</Texto>
            </View>
          ))}
        </View>
      ))}
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  filtros: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5) },
  dia: { borderTopWidth: 1, paddingTop: espaco(1), gap: espaco(1) },
  dataDia: { fontFamily: fontes.semi },
  sessao: { gap: espaco(0.75), borderWidth: 1, borderRadius: 8, padding: espaco(1.5) },
  exercicio: { gap: 2 },
  nomeExercicio: { fontFamily: fontes.semi, fontSize: 14 },
  col: { flex: 1 },
  progresso: { gap: espaco(0.75) },
});
