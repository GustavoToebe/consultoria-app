import { HistoricoAtualizacoes } from '../../aluno/atualizacao/HistoricoAtualizacoes';
import { nomeDaSerieNoHistorico } from '../../aluno/serieDoAluno';
import { FileDown } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ErroApi } from '../../api/cliente';
import { historicoAluno, pastasDoAluno } from '../../api/rotas';
import type { ExercicioPlano, Sessao } from '../../api/tipos';
import { normalizarTreino } from '../../dominio/editorTreino';
import { dataParaTela } from '../../dominio/formatos';
import { hojeEmBrasilia } from '../../dominio/financeiro';
import { CONFIGURACAO_PADRAO } from '../../dominio/metodologiaPadrao';
import {
  DIAS_DO_HISTORICO,
  fraseDoHistorico,
  intervaloDoPeriodo,
  letrasDasDivisoes,
  opcoesDePeriodo,
  pastaAnterior,
  periodoValido,
  rotuloDoPeriodo,
  type PeriodoDoHistorico,
} from '../../dominio/historicoDoAluno';
import { cargasPorDivisao, nomeDaDivisao, periodoMisturaVersoes, TEXTO_PERIODO_MISTURA_VERSOES, textoDoHistoricoVazio, textoSerie } from '../../dominio/relatorio';
import { useAluno } from '../../offline/AlunoProvider';
import type { RegistroLocal } from '../../offline/repositorioLocal';
import { imprimir } from '../../pdf/imprimir';
import { logoComoDataUri } from '../../pdf/logo';
import { documentoCargas } from '../../pdf/pdfCargas';
import { fontes } from '../../tema/tokens';
import { CargasPorDivisao } from '../../treinador/CargasPorDivisao';
import { CartaoAvaliacaoFisica } from '../../treinador/CartaoAvaliacaoFisica';
import { CartaoPeso } from '../../treinador/CartaoPeso';
import { CartaoProgresso } from '../../treinador/CartaoProgresso';
import { VISOES, type VisaoRegistros } from '../../treinador/CartaoRegistros';
import { HistoricoPorSemana } from '../../treinador/HistoricoPorSemana';
import { Escolha } from '../../ui/Escolha';
import { Abas } from '../../ui/Abas';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { NoPlano } from '../../ui/NoPlano';
import { CartaoFotos } from '../../fotos/CartaoFotos';
import { Cabecalho } from '../../ui/Cabecalho';
import { Cartao } from '../../ui/Cartao';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';

/**
 * Histórico: o que ainda está só no aparelho, os treinos registrados no período escolhido (a pasta em uso, a anterior ou
 * os últimos 30 dias; Frente G, D15), o progresso por exercício, o peso (lista e gráfico) e a avaliação física. Cada
 * cartão diz na faixa o período que mostra.
 */
export default function HistoricoAluno() {
  const { registros, pacote, escolhida, falhas, tentarDeNovo, online } = useAluno();
  const { avisar } = useAviso();
  const [visao, setVisao] = useState<VisaoRegistros>('divisao');
  const [gerando, setGerando] = useState(false);
  // `null` = o padrão: a pasta em uso, se tem período; senão os últimos 30 dias.
  const [escolhido, setEscolhido] = useState<PeriodoDoHistorico | null>(null);
  const hoje = hojeEmBrasilia(); // D4: o dia de Brasília, não o do fuso do aparelho
  // Plano em uso (o escolhido para consulta ou o vigente), como no seletor de plano. A pasta anterior é a de antes dela
  // na lista do aluno; as datas vão para a mesma rota de sempre. A busca espera a lista de pastas para não consultar duas vezes.
  const pastas = useCarregar(`pastas-aluno:${pacote?.pacote.geradoEm ?? ''}`, () => pastasDoAluno());
  const pasta = escolhida?.pasta ?? pastas.dados?.find((p) => p.atual) ?? null;
  const anterior = pastaAnterior(pastas.dados ?? [], pasta);
  const periodo = periodoValido(escolhido, pasta, anterior);
  const opcoesDoPeriodo = opcoesDePeriodo(pasta, anterior);
  const { de, ate } = intervaloDoPeriodo(periodo, hoje, pasta, anterior);
  const aguardandoPastas = pastas.carregando && !pastas.dados;
  const historico = useCarregar(aguardandoPastas ? null : `hist:${de}:${ate}`, () => historicoAluno(de, ate));
  const naoEnviados = registros.filter((r) => r.situacao !== 'ENVIADO' && r.concluida);

  // Nomes vêm do plano salvo (o registro guarda só os uids).
  const nomes = new Map<string, { sessao: Sessao; exercicio: ExercicioPlano }>();
  const treinoEmUso = escolhida ? escolhida.planos.treino : pacote?.pacote.treino;
  // O tipo da série é um código: o nome sai da metodologia copiada na versão do treino.
  const metodologia = treinoEmUso?.conteudo.metodologia?.configuracao ?? CONFIGURACAO_PADRAO;
  if (treinoEmUso) {
    for (const s of normalizarTreino(treinoEmUso.conteudo).sessoes) {
      for (const e of s.exercicios) nomes.set(e.uid, { sessao: s, exercicio: e });
    }
  }
  const semConexao = historico.erro instanceof ErroApi && historico.erro.semConexao;
  const sessoes = new Map<string, Sessao>();
  for (const { sessao } of nomes.values()) sessoes.set(sessao.uid, sessao);
  const divisoes = historico.dados ? cargasPorDivisao(historico.dados, sessoes) : [];
  const nomeDaSessao = (s: { sessaoUid: string; sessao: string }) => nomeDaDivisao(s, sessoes);
  // A mesma letra e a mesma cor da divisão nas duas visões (D13): primeiro a ordem das cargas, depois o que só a semana tem.
  const letras = letrasDasDivisoes([...divisoes.map((d) => d.nome), ...(historico.dados ?? []).flatMap((d) => d.sessoes.map(nomeDaSessao))]);
  const vazio = textoDoHistoricoVazio({ temRegistros: false, graficosLigados: true, papel: 'ALUNO' });

  const pdf = () => {
    if (!pacote) return;
    const marca = pacote.pacote.marca;
    setGerando(true);
    logoComoDataUri(marca)
      .then((logoDataUri) =>
        imprimir(
          documentoCargas({
            marca,
            logoDataUri,
            aluno: pacote.pacote.aluno.nome,
            de,
            ate,
            divisoes,
            rodapePdf: null,
            emitidoEm: new Date(),
          }),
        ),
      )
      .catch((e: unknown) => avisar(textoDoErro(e), 'perigo'))
      .finally(() => setGerando(false));
  };

  return (
    <Tela bordas={['top']} largura={720}>
      <Cabecalho titulo="Histórico" />
      <CartaoFotos />
      <HistoricoAtualizacoes />
      {naoEnviados.length ? (
        <Cartao titulo="Ainda não enviados">
          <Texto numerico variante="suave">Salvos neste aparelho. Vão para o seu treinador quando houver internet.</Texto>
          {agrupar(naoEnviados).map(([chave, lista]) => {
            const info = nomes.get(lista[0].exercicioUid);
            return (
              <View key={chave} style={estilos.linha}>
                <Texto numerico style={estilos.forte}>
                  {dataParaTela(lista[0].data)} · {info?.exercicio.nome ?? 'Exercício de outra versão do plano'}
                </Texto>
                <Texto numerico variante="suave">
                  {lista
                    .map((r) => {
                      const serie = info?.exercicio.series.find((s) => s.uid === r.serieUid);
                      if (serie?.cardio) return 'Cardio feito';
                      return textoSerie({ ...r, tipo: nomeDaSerieNoHistorico(serie, metodologia), unidade: info?.exercicio.unidade ?? 'kg' });
                    })
                    .join(' · ')}
                </Texto>
              </View>
            );
          })}
          {falhas.length ? <Botao rotulo="Tentar enviar de novo" tipo="secundario" cheio aoTocar={() => void tentarDeNovo()} /> : null}
        </Cartao>
      ) : null}

      <Cartao
        titulo="Registros e cargas"
        periodo={rotuloDoPeriodo(periodo, de, ate)}
        acoes={divisoes.length ? <NoPlano funcionalidade="PDF"><Botao rotulo="PDF" tipo="secundario" Icone={FileDown} carregando={gerando} aoTocar={pdf} /></NoPlano> : null}>
        {opcoesDoPeriodo.length > 1 ? <Escolha rotulo="Período" opcoes={opcoesDoPeriodo} valor={periodo} aoMudar={setEscolhido} /> : null}
        <Abas abas={VISOES} ativa={visao} aoMudar={setVisao} />
        {historico.dados && historico.dados.length ? <Texto numerico variante="pequeno">{fraseDoHistorico(visao, de, ate)}</Texto> : null}
        {semConexao ? <Texto numerico variante="suave">Sem conexão: o histórico do servidor aparece quando voltar a internet.</Texto> : null}
        {historico.erro && !semConexao ? <MensagemErro texto={textoDoErro(historico.erro)} erro={historico.erro} tentarDeNovo={historico.recarregar} /> : null}
        {!historico.dados && historico.carregando ? <Esqueleto /> : null}
        {historico.dados && historico.dados.length === 0 ? (
          // B6: o motivo do vazio sai do domínio (o mesmo texto da ficha do treinador).
          <>
            <Vazio titulo={vazio ?? 'Sem registros'} texto={periodo === 'ULTIMOS_30' ? 'Os treinos que você registrar aparecem aqui.' : 'Os treinos que você registrar neste plano aparecem aqui.'} />
            {periodo !== 'ULTIMOS_30' ? <Botao rotulo={`Ver os últimos ${DIAS_DO_HISTORICO} dias`} tipo="secundario" aoTocar={() => setEscolhido('ULTIMOS_30')} /> : null}
          </>
        ) : null}
        {historico.dados && periodoMisturaVersoes(historico.dados) ? <Texto numerico variante="pequeno">{TEXTO_PERIODO_MISTURA_VERSOES}</Texto> : null}
        {historico.dados && visao === 'divisao' ? <CargasPorDivisao divisoes={divisoes} letras={letras} /> : null}
        {historico.dados && visao === 'dia' ? <HistoricoPorSemana dias={historico.dados} nomeDaSessao={nomeDaSessao} letras={letras} periodo={{ de, ate }} /> : null}
      </Cartao>

      <CartaoProgresso />

      {/* O mesmo cartão da ficha, só leitura (lista e gráfico); o peso não fica guardado no aparelho. */}
      <CartaoPeso />

      <CartaoAvaliacaoFisica online={online} />
    </Tela>
  );
}

function agrupar(lista: RegistroLocal[]): [string, RegistroLocal[]][] {
  const grupos = new Map<string, RegistroLocal[]>();
  for (const r of [...lista].sort((a, b) => b.data.localeCompare(a.data))) {
    const chave = `${r.data}|${r.exercicioUid}`;
    grupos.set(chave, [...(grupos.get(chave) ?? []), r]);
  }
  return [...grupos];
}

const estilos = StyleSheet.create({
  linha: { gap: 2 },
  forte: { fontFamily: fontes.semi },
});
