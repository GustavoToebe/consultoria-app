import type { Href } from 'expo-router';
import { Fragment, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ExercicioPlano, Configuracao, Sessao, UltimaCarga } from '../api/tipos';
import { colunasDosExercicios, dividirPorPeso } from '../dominio/colunasDoTreinoDoDia';
import { gruposDaSessao } from '../dominio/combinacoes';
import { duasColunasCom } from '../dominio/grade';
import { descansoSoDoGrupo } from '../dominio/textoDoGrupo';
import { useTema } from '../tema/TemaProvider';
import { espaco, RAIO } from '../tema/tokens';
import { EntradaEmCascata } from '../ui/EntradaEmCascata';
import { Grade } from '../ui/Grade';
import { CabecalhoDoGrupo } from './CabecalhoDoGrupo';
import { CartaoExercicioDoDia } from './CartaoExercicioDoDia';

/**
 * Os exercícios do dia em cartões, com os feitos juntos (superset, circuito, pré e pós-exaustão...) numa moldura com o nome
 * da combinação, a ordem, as voltas e o descanso depois do grupo. Só por props: é a lista da tela do dia do aluno e a da
 * prévia do treinador ("Ver como o aluno"), que não têm o mesmo contexto. `emColunas` (só a tela do dia passa, na web larga;
 * a folha da prévia não muda): a lista mede a si mesma e se divide em colunas lidas de cima para baixo (1 a 3, mínimo de 520,
 * `dominio/colunasDoTreinoDoDia`), com cada combinação inteira numa coluna; com uma coluna, os exercícios numa só, na ordem.
 */
export function ExerciciosDoDia({
  sessao,
  metodologia,
  tipoTrabalho,
  contagemDe,
  cargaDoDia,
  ultimaCarga,
  href,
  aoAbrir,
  animar,
  emColunas = false,
}: {
  sessao: Sessao;
  metodologia: Configuracao;
  /** Rótulo da série de trabalho ("WS"). */
  tipoTrabalho: string;
  /** "N/M séries" do exercício (`contagemDoExercicio`); na prévia, tudo por fazer. */
  contagemDe: (e: ExercicioPlano) => { total: number; feitas: number };
  cargaDoDia: (e: ExercicioPlano) => number | null;
  ultimaCarga: (e: ExercicioPlano) => UltimaCarga | null;
  /** Destino do exercício (na web vira `<a href>`); sem ele o cartão só chama `aoAbrir`. */
  href?: (e: ExercicioPlano) => Href;
  aoAbrir: (e: ExercicioPlano) => void;
  animar: boolean;
  emColunas?: boolean;
}) {
  const { cores } = useTema();
  const [largura, setLargura] = useState(0);
  const grupos = gruposDaSessao(sessao, metodologia);
  const pecas: ReactNode[] = grupos.map((g) => {
    // Nos grupos em que o descanso é depois da volta, a série não mostra o descanso dela.
    const descansoNaSerie = !(g.nome && g.grupo && descansoSoDoGrupo(g.grupo));
    const cartoes = g.exercicios.map((e, j) => {
      const i = g.inicio + j;
      return (
        <EntradaEmCascata key={e.uid} indice={i} animar={animar}>
          <CartaoExercicioDoDia
            exercicio={e}
            posicao={i}
            contagem={contagemDe(e)}
            cargaDoDia={cargaDoDia(e)}
            ultima={ultimaCarga(e)}
            tipoTrabalho={tipoTrabalho}
            metodologia={metodologia}
            descansoNaSerie={descansoNaSerie}
            href={href?.(e)}
            aoAbrir={() => aoAbrir(e)}
          />
        </EntradaEmCascata>
      );
    });
    return g.nome ? (
      <View key={`grupo-${g.exercicios[0].uid}`} style={[estilos.grupo, { borderColor: cores.bordaCampo }]}>
        <CabecalhoDoGrupo bloco={g} metodologia={metodologia} />
        {cartoes}
      </View>
    ) : (
      <Fragment key={g.exercicios[0].uid}>{cartoes}</Fragment>
    );
  });
  if (!emColunas) return <Grade gap={espaco(1.5)} colunas={duasColunasCom(360, espaco(1.5))} alinhar="inicio">{pecas}</Grade>;
  // De cima para baixo: a ordem de leitura e a do Tab continuam as de uma coluna só. Antes da medida, uma coluna.
  const colunas = dividirPorPeso(grupos.map((g) => g.exercicios.length), colunasDosExercicios(largura, VAO_ENTRE_COLUNAS));
  return (
    <View style={estilos.colunas} onLayout={(ev) => setLargura(ev.nativeEvent.layout.width)}>
      {colunas.map((indices) => (
        <View key={indices[0]} style={estilos.coluna}>{indices.map((i) => pecas[i])}</View>
      ))}
    </View>
  );
}

const VAO_ENTRE_COLUNAS = espaco(3);

const estilos = StyleSheet.create({
  colunas: { flexDirection: 'row', alignItems: 'flex-start', gap: VAO_ENTRE_COLUNAS },
  coluna: { flex: 1, minWidth: 0, gap: espaco(1.5) },
  // Moldura do bi-set/supersérie com `bordaCampo` (a `borda` de cartão quase sumia no tema escuro).
  grupo: { borderWidth: 1, borderLeftWidth: 4, borderRadius: RAIO, padding: espaco(1.25), gap: espaco(1) },
});
