import { useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';

import { execucoesDoAluno } from '../api/rotas';
import { hojeIso, somarDias } from '../dominio/formatos';
import { agruparPorGrupo } from '../dominio/progresso';
import { opcoesDeProgresso } from '../dominio/relatorio';
import { LIMITE_PROGRESSO } from '../dominio/selecaoMultipla';
import { espaco } from '../tema/tokens';
import { useAviso } from '../ui/Aviso';
import { Botao } from '../ui/Botao';
import { Campo } from '../ui/Campo';
import { Cartao } from '../ui/Cartao';
import { Escolha } from '../ui/Escolha';
import { Vazio } from '../ui/Estados';
import { Folha } from '../ui/Folha';
import { SelecaoMultipla } from '../ui/SelecaoMultipla';
import { Texto } from '../ui/Texto';
import { useCarregar } from '../ui/useCarregar';
import { ProgressoDoExercicio } from './ProgressoDoExercicio';
import { normalizar } from './treino/FolhaBiblioteca';

/** Largura do cartão a partir da qual os blocos ficam em duas colunas (abaixo disso o gráfico fica apertado). */
const LARGURA_DUAS_COLUNAS = 760;

/** A API aceita até 366 dias por consulta; os exercícios listados são os registrados no último ano. */
const DIAS_DA_LISTA = 364;

/**
 * Progresso por exercício na ficha do aluno (fora das pastas): os exercícios se escolhem numa folha (busca, grupo
 * muscular e caixas de seleção, até `LIMITE_PROGRESSO` de uma vez); cada marcado vira um bloco com o histórico
 * completo do aluno, de todas as pastas. Com o cartão largo (a partir de 760 px, medido nele e não na janela) os blocos ficam em duas colunas.
 */
export function CartaoProgresso({ alunoId }: { alunoId: string }) {
  const { avisar } = useAviso();
  const [larguraDoCartao, setLarguraDoCartao] = useState(0);
  const duasColunas = larguraDoCartao >= LARGURA_DUAS_COLUNAS;
  const aoMedir = (e: LayoutChangeEvent) => setLarguraDoCartao(e.nativeEvent.layout.width);
  const hoje = hojeIso();
  const de = somarDias(hoje, -DIAS_DA_LISTA);
  const { dados: dias } = useCarregar(`exec-progresso:${alunoId}:${de}:${hoje}`, () => execucoesDoAluno(alunoId, de, hoje));
  const [grupo, setGrupo] = useState('todos');
  const [busca, setBusca] = useState('');
  const [escolhendo, setEscolhendo] = useState(false);
  // `null` = nada mexido ainda: começa só com o primeiro exercício marcado.
  const [escolhidos, setEscolhidos] = useState<ReadonlySet<string> | null>(null);
  const { grupos, exercicios: todos } = opcoesDeProgresso(dias ?? [], null);
  const termo = normalizar(busca.trim());
  const visiveis = todos.filter((o) => (grupo === 'todos' || o.grupo === grupo) && (!termo || normalizar(o.rotulo).includes(termo)));
  const marcados = escolhidos ?? new Set(todos.slice(0, 1).map((o) => o.valor));
  const mostrados = todos.filter((o) => marcados.has(o.valor));
  const tirar = (valor: string) => {
    const novo = new Set(marcados);
    novo.delete(valor);
    setEscolhidos(novo);
  };
  if (!dias || grupos.length === 0) return null;

  const bloco = (o: (typeof mostrados)[number]) => (
    <ProgressoDoExercicio key={o.valor} alunoId={alunoId} exercicioId={o.valor} nome={o.rotulo} grupo={o.grupo} aoTirar={() => tirar(o.valor)} />
  );
  return (
    <>
    <View onLayout={aoMedir}>
    <Cartao
      titulo="Progresso por exercício"
      descricao="Histórico completo de cada exercício, somando todas as pastas."
      recolhivel
      recolhido
      acoes={<Botao rotulo={`Escolher exercícios (${mostrados.length})`} tipo="secundario" aoTocar={() => setEscolhendo(true)} />}>
      {mostrados.length === 0 ? <Vazio titulo="Nenhum exercício marcado" texto="Escolha os exercícios que quer comparar." acao={{ rotulo: 'Escolher exercícios', aoTocar: () => setEscolhendo(true) }} /> : null}
      {duasColunas ? (
        <View style={estilos.colunas}>
          <View style={estilos.coluna}>{mostrados.filter((_, i) => i % 2 === 0).map(bloco)}</View>
          <View style={estilos.coluna}>{mostrados.filter((_, i) => i % 2 === 1).map(bloco)}</View>
        </View>
      ) : (
        <View style={estilos.coluna}>{mostrados.map(bloco)}</View>
      )}
    </Cartao>
    </View>
    <Folha
      visivel={escolhendo}
      titulo="Escolher exercícios"
      aoFechar={() => setEscolhendo(false)}
      rodape={<Botao rotulo="Concluir" cheio aoTocar={() => setEscolhendo(false)} />}>
      <Campo rotulo="Buscar exercício" valor={busca} aoMudar={setBusca} />
      {grupos.length > 1 ? <Escolha descricao="Grupo muscular" opcoes={[{ valor: 'todos', rotulo: 'Todos' }, ...grupos.map((g) => ({ valor: g, rotulo: g }))]} valor={grupo} aoMudar={setGrupo} /> : null}
      {visiveis.length === 0 ? <Texto variante="suave">Nenhum exercício encontrado.</Texto> : null}
      {visiveis.length > 0 ? (
        <SelecaoMultipla
          rotulo="Exercícios"
          opcoes={visiveis.map(({ valor, rotulo }) => ({ valor, rotulo }))}
          grupos={grupo === 'todos' ? agruparPorGrupo(visiveis).map((g) => ({
            titulo: g.grupo,
            resumo: `${g.opcoes.length} ${g.opcoes.length === 1 ? 'exercício' : 'exercícios'}`,
            opcoes: g.opcoes.map(({ valor, rotulo }) => ({ valor, rotulo })),
          })) : undefined}
          marcados={marcados}
          aoMudar={setEscolhidos}
          limite={LIMITE_PROGRESSO}
          aoPassarDoLimite={() => avisar(`Dá para comparar até ${LIMITE_PROGRESSO} exercícios de uma vez. Desmarque algum para incluir outro.`, 'perigo')}
        />
      ) : null}
    </Folha>
    </>
  );
}

const estilos = StyleSheet.create({
  colunas: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(3) },
  coluna: { flex: 1, gap: espaco(3) },
});
