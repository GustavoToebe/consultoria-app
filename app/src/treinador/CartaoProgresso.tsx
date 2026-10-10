import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { execucoesDoAluno, progressoDoAluno } from '../api/rotas';
import { dataParaTela, hojeIso, numeroParaTela, somarDias } from '../dominio/formatos';
import { opcoesDeProgresso } from '../dominio/relatorio';
import { useTema } from '../tema/TemaProvider';
import { espaco, RAIO } from '../tema/tokens';
import { Cartao } from '../ui/Cartao';
import { Escolha } from '../ui/Escolha';
import { Esqueleto } from '../ui/Esqueleto';
import { MensagemErro, Vazio } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { SelecaoMultipla } from '../ui/SelecaoMultipla';
import { Texto } from '../ui/Texto';
import { useCarregar } from '../ui/useCarregar';

/** A API aceita até 366 dias por consulta; os exercícios listados são os registrados no último ano. */
const DIAS_DA_LISTA = 364;

/**
 * Progresso por exercício na ficha do aluno (fora das pastas): escolhe o grupo muscular e marca quantos exercícios
 * quiser; cada um mostra o histórico completo do aluno, de todas as pastas.
 */
export function CartaoProgresso({ alunoId }: { alunoId: string }) {
  const hoje = hojeIso();
  const de = somarDias(hoje, -DIAS_DA_LISTA);
  const { dados: dias } = useCarregar(`exec-progresso:${alunoId}:${de}:${hoje}`, () => execucoesDoAluno(alunoId, de, hoje));
  const [grupo, setGrupo] = useState('todos');
  // `null` = nada mexido ainda: começa só com o primeiro exercício marcado.
  const [escolhidos, setEscolhidos] = useState<ReadonlySet<string> | null>(null);
  const { grupos, exercicios: opcoes } = opcoesDeProgresso(dias ?? [], grupo === 'todos' ? null : grupo);
  const marcados = escolhidos ?? new Set(opcoes.slice(0, 1).map((o) => o.valor));
  const mostrados = opcoes.filter((o) => marcados.has(o.valor));
  if (!dias || grupos.length === 0) return null;
  return (
    <Cartao titulo="Progresso por exercício" descricao="Histórico completo de cada exercício, somando todas as pastas." recolhivel recolhido>
      {grupos.length > 1 ? <Escolha descricao="Grupo muscular" opcoes={[{ valor: 'todos', rotulo: 'Todos' }, ...grupos.map((g) => ({ valor: g, rotulo: g }))]} valor={grupo} aoMudar={setGrupo} /> : null}
      <SelecaoMultipla rotulo="Exercícios" opcoes={opcoes.map(({ valor, rotulo }) => ({ valor, rotulo }))} marcados={marcados} aoMudar={setEscolhidos} />
      {mostrados.length === 0 ? <Vazio titulo="Nenhum exercício marcado" texto="Marque os exercícios que quer comparar." /> : null}
      {mostrados.map((o) => <ProgressoDoExercicio key={o.valor} alunoId={alunoId} exercicioId={o.valor} nome={o.rotulo} />)}
    </Cartao>
  );
}

function ProgressoDoExercicio({ alunoId, exercicioId, nome }: { alunoId: string; exercicioId: string; nome: string }) {
  const { cores } = useTema();
  const { dados, erro, carregando } = useCarregar(`prog:${alunoId}:${exercicioId}`, () => progressoDoAluno(alunoId, exercicioId));
  return (
    <View style={estilos.progresso}>
      <Texto variante="rotulo">{nome}</Texto>
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
    </View>
  );
}

const estilos = StyleSheet.create({
  progresso: { gap: espaco(0.75) },
  tabela: { borderWidth: 1, borderRadius: RAIO, overflow: 'hidden' },
  linhaTabela: { flexDirection: 'row', paddingHorizontal: espaco(1.5), paddingVertical: espaco(1), borderTopWidth: StyleSheet.hairlineWidth },
  col: { flex: 1 },
});
