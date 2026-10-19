import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { evolucaoRespostasDoAluno } from '../api/rotas';
import type { PontoDeResposta } from '../api/tipos';
import { dataParaTela } from '../dominio/formatos';
import {
  linhasDaLista, mostraGrafico, nomeDaSerie, opcoesDasSeries, pontosDoGrafico, serieEscolhida, textoDoAlcance, textoDoValor,
  unidadeDoGrafico,
} from '../dominio/evolucaoRespostas';
import { useTema } from '../tema/TemaProvider';
import { fontes } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { Cartao } from '../ui/Cartao';
import { Escolha } from '../ui/Escolha';
import { EscolhaEmFolha, OPCOES_PARA_BUSCAR } from '../ui/EscolhaEmFolha';
import { Esqueleto } from '../ui/Esqueleto';
import { MensagemErro } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { GraficoLinha } from '../ui/GraficoLinha';
import { Tabela } from '../ui/Tabela';
import { Texto } from '../ui/Texto';
import { useCarregar } from '../ui/useCarregar';

/** Datas mostradas antes de "Ver todas". */
const DATAS_RECENTES = 6;

/**
 * Evolução das respostas numéricas (NOTA e NUMERO) das atualizações enviadas: uma pergunta por vez, gráfico com 2
 * pontos ou mais (se a preferência de gráficos estiver ligada) e a lista das datas. Respostas são dado sensível: só na
 * tela. Nada é calculado além do que o aluno respondeu; pergunta sem resposta não aparece.
 */
export function CartaoEvolucaoRespostas({ alunoId }: { alunoId: string }) {
  const { preferencias } = useTema();
  const { dados, erro, carregando, recarregar } = useCarregar(`evolucao-respostas:${alunoId}`, () => evolucaoRespostasDoAluno(alunoId));
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [todas, setTodas] = useState(false);
  const series = dados?.series ?? [];
  const serie = serieEscolhida(series, escolhida);
  const opcoes = opcoesDasSeries(series);
  const escolher = (id: string) => { setEscolhida(id); setTodas(false); };
  const linhas = serie ? linhasDaLista(serie, todas ? null : DATAS_RECENTES) : [];

  return (
    <Cartao titulo="Evolução das respostas" descricao="Notas e números respondidos nas atualizações, pergunta por pergunta.">
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {!dados && carregando ? <Esqueleto /> : null}
      {dados && !serie ? <Texto variante="suave">Nenhuma resposta numérica ainda.</Texto> : null}
      {dados && serie ? <Texto variante="pequeno">{textoDoAlcance(dados)}</Texto> : null}
      {serie && series.length > OPCOES_PARA_BUSCAR ? (
        <EscolhaEmFolha rotulo="Pergunta" valor={serie.perguntaId} opcoes={opcoes} aoMudar={escolher} titulo="Escolher a pergunta" />
      ) : null}
      {serie && series.length > 1 && series.length <= OPCOES_PARA_BUSCAR ? (
        <Escolha rotulo="Pergunta" opcoes={opcoes} valor={serie.perguntaId} aoMudar={escolher} />
      ) : null}
      {serie ? (
        <>
          <Texto variante="bloco">{serie.rotulo.trim() || nomeDaSerie(serie)}</Texto>
          {mostraGrafico(serie, preferencias.graficos) ? (
            <GraficoLinha
              pontos={pontosDoGrafico(serie)}
              unidade={unidadeDoGrafico(serie)}
              descricao={`Gráfico de ${nomeDaSerie(serie)} com ${serie.pontos.length} respostas`}
            />
          ) : null}
          <Tabela<PontoDeResposta>
            rotulo={`Respostas de ${nomeDaSerie(serie)}`}
            linhas={linhas}
            chave={(p) => p.atualizacaoId}
            colunas={[
              { chave: 'data', titulo: 'Atualização', principal: true, render: (p) => <Texto numerico style={estilos.negrito}>{dataParaTela(p.data)}</Texto> },
              { chave: 'valor', titulo: 'Resposta', alinhar: 'direita', render: (p) => <Texto numerico style={estilos.negrito}>{textoDoValor(serie, p.valor)}</Texto> },
            ]}
          />
          {serie.pontos.length > DATAS_RECENTES ? (
            <Botao rotulo={todas ? 'Mostrar menos' : `Ver todas (${serie.pontos.length})`} tipo="fantasma" aoTocar={() => setTodas((v) => !v)} />
          ) : null}
        </>
      ) : null}
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  negrito: { fontFamily: fontes.negrito },
});
