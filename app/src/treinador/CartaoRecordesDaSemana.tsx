import { router } from 'expo-router';
import { Medal } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { recordesDaSemana, recordesDaSemanaDoAluno } from '../api/rotas';
import { dataRelativa } from '../dominio/datasRelativas';
import { textoDaSerieComRecorde, textoDoTotalDeRecordes } from '../dominio/retornoDoTreinador';
import { useTema } from '../tema/TemaProvider';
import { espaco } from '../tema/tokens';
import { Cartao } from '../ui/Cartao';
import { Esqueleto } from '../ui/Esqueleto';
import { MensagemErro } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { LinhaDaLista, ListaDeLinhas } from '../ui/LinhaDaLista';
import { Texto } from '../ui/Texto';
import { useCarregar } from '../ui/useCarregar';

/** Linhas no Início (o resto fica no total). */
const NO_INICIO = 5;

/**
 * "Recordes da semana" (Engajamento 0.5, P3): séries simples dos últimos 7 dias que bateram recorde pessoal, pela mesma
 * regra do aluno, calculadas no servidor. No Início (`meus` segue o filtro Todos/Meus; some sem recorde, como os
 * contadores) cada linha abre a ficha; na ficha (`alunoId`), as do aluno. Quem renderiza confere `REGISTRO_LER` e a
 * chave do retorno.
 */
export function CartaoRecordesDaSemana(p: { alunoId: string; meus?: never; style?: object } | { alunoId?: never; meus: boolean; style?: object }) {
  const { cores } = useTema();
  const doAluno = !!p.alunoId;
  const { dados, erro, recarregar } = useCarregar(doAluno ? `recordes-semana:${p.alunoId}` : `recordes-semana:${p.meus ? 'meus' : 'todos'}`,
    () => (doAluno ? recordesDaSemanaDoAluno(p.alunoId!) : recordesDaSemana(!!p.meus)));
  if (!doAluno && (!dados || dados.total === 0) && !erro) return null;
  const series = doAluno ? (dados?.series ?? []) : (dados?.series ?? []).slice(0, NO_INICIO);
  const medalha = <View style={estilos.medalha}><Medal size={20} color={cores.sucesso} /></View>;
  return (
    <Cartao titulo="Recordes da semana" descricao={dados ? textoDoTotalDeRecordes(dados.total) : 'Últimos 7 dias.'} style={p.style}>
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {dados === undefined && !erro ? <Esqueleto /> : null}
      {dados && dados.total === 0 ? <Texto variante="suave">Nenhum recorde nos últimos 7 dias.</Texto> : null}
      {series.length ? (
        <ListaDeLinhas>
          {series.map((s, i) =>
            doAluno ? (
              <LinhaDaLista key={`${s.data}:${s.exercicioId}:${i}`} titulo={textoDaSerieComRecorde(s)} metadados={dataRelativa(s.data)} inicio={medalha} />
            ) : (
              <LinhaDaLista key={`${s.alunoId}:${s.data}:${s.exercicioId}:${i}`} titulo={s.alunoNome} descricao={textoDaSerieComRecorde(s)}
                metadados={dataRelativa(s.data)} inicio={medalha} href={`/treinador/alunos/${s.alunoId}`}
                aoAbrir={() => router.push(`/treinador/alunos/${s.alunoId}`)}
                rotulo={`Abrir ${s.alunoNome}: ${textoDaSerieComRecorde(s)}, ${dataRelativa(s.data)}`} />
            ),
          )}
        </ListaDeLinhas>
      ) : null}
      {!doAluno && dados && dados.total > series.length ? (
        <Texto variante="pequeno">E mais {dados.total - series.length}. Veja cada aluno na ficha.</Texto>
      ) : null}
    </Cartao>
  );
}

const estilos = StyleSheet.create({ medalha: { width: 28, alignItems: 'center', justifyContent: 'center', gap: espaco(0.5) } });
