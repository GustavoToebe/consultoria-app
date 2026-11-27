import { HistoricoAtualizacoes } from '../../aluno/atualizacao/HistoricoAtualizacoes';
import { nomeDaSerieNoHistorico } from '../../aluno/serieDoAluno';
import { router, useLocalSearchParams } from 'expo-router';
import { FileDown } from 'lucide-react-native';
import { Fragment, type ReactNode, useState } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ErroApi } from '../../api/cliente';
import { historicoAluno, pastasDoAluno } from '../../api/rotas';
import type { ExercicioPlano, Sessao } from '../../api/tipos';
import {
  abaDoHistorico,
  ABAS_DO_HISTORICO,
  ARRANJO_DA_ABA,
  historicoEmAbas,
  NO_TOPO_DE_TODA_ABA,
  ORDEM_NUMA_COLUNA,
  PESO_NO_CORPO,
  type AbaDoHistorico,
  type BlocoDoHistorico,
} from '../../dominio/abasDoHistorico';
import { MAXIMO_DE_COLUNAS_DO_CORPO, pesoDaDivisao, pesoDaSemana } from '../../dominio/colunasDoHistorico';
import { normalizarTreino } from '../../dominio/editorTreino';
import { dataParaTela } from '../../dominio/formatos';
import { hojeEmBrasilia } from '../../dominio/financeiro';
import { chipsDoPeriodoDoHistorico } from '../../dominio/filtrosDosCartoes';
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
  semanasDoHistorico,
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
import { BarraDeFiltros, GrupoDoPainel } from '../../ui/BarraDeFiltros';
import { Botao } from '../../ui/Botao';
import { NoPlano } from '../../ui/NoPlano';
import { PrincipalComApoio } from '../../ui/PrincipalComApoio';
import { CartaoFotos } from '../../fotos/CartaoFotos';
import { Cabecalho } from '../../ui/Cabecalho';
import { Cartao } from '../../ui/Cartao';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Texto } from '../../ui/Texto';
import { TelaDoAluno } from '../../aluno/TelaDoAluno';
import { ColunasDoHistorico } from '../../aluno/historico/ColunasDoHistorico';
import { useUnidadeDeCarga } from '../../ui/unidadeDeCargaEmUso';
import { useCarregar } from '../../ui/useCarregar';

/**
 * Histórico: o que ainda está só no aparelho, os treinos registrados no período escolhido (a pasta em uso, a anterior ou
 * os últimos 30 dias; Frente G, D15), o progresso por exercício, o peso (lista e gráfico) e a avaliação física. Cada
 * cartão diz na faixa o período que mostra. O período dos Registros fica no painel "Filtros de registros" (`ui/BarraDeFiltros`):
 * é obrigatório (D5 de `docs/planos/filtros-laterais.md`), então o padrão não conta nem vira etiqueta e "Limpar filtros"
 * volta a ele. Estado local da tela, como antes.
 *
 * Na web com o menu lateral (`docs/planos/aluno-web-layout.md`, seção 7) os cartões se dividem em abas no topo, Treinos,
 * Corpo e Atualizações, cada uma com o seu arranjo (`dominio/abasDoHistorico`); a aba mora no endereço (`?aba=`) e trocar é
 * um passo do histórico do navegador (o voltar a desfaz). No celular, a coluna única de sempre. Contêiner do treinador
 * (27/11): divisões, semanas e linhas das Atualizações em 1, 2 e 3 colunas nas faixas normal, larga e ultralarga; os
 * cartões do Corpo em 1 e 2 (`dominio/colunasDoHistorico`).
 */
export default function HistoricoAluno() {
  const { registros, pacote, escolhida, falhas, tentarDeNovo, online } = useAluno();
  const emAbas = historicoEmAbas(Platform.OS === 'web', useWindowDimensions().width);
  const aba = abaDoHistorico(useLocalSearchParams<{ aba?: string }>().aba);
  // Aba de tela no endereço (regra de Voltar do AGENTS.md): trocar é `router.push`, então o voltar desfaz a troca.
  const setAba = (valor: AbaDoHistorico) => { if (valor !== aba) router.push({ pathname: '/aluno/historico', params: { aba: valor } }); };
  const { avisar } = useAviso();
  const unidadeDeCarga = useUnidadeDeCarga();
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
            unidade: unidadeDeCarga,
          }),
        ),
      )
      .catch((e: unknown) => avisar(textoDoErro(e), 'perigo'))
      .finally(() => setGerando(false));
  };

  const ainda = naoEnviados.length ? (
    <Cartao titulo="Ainda não enviados">
      <Texto variante="suave">Salvos neste aparelho. Vão para o seu treinador quando houver internet.</Texto>
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
                  return textoSerie({ ...r, tipo: nomeDaSerieNoHistorico(serie, metodologia), unidade: info?.exercicio.unidade ?? 'kg' }, unidadeDeCarga);
                })
                .join(' · ')}
            </Texto>
          </View>
        );
      })}
      {falhas.length ? <Botao rotulo="Tentar enviar de novo" tipo="secundario" cheio aoTocar={() => void tentarDeNovo()} /> : null}
    </Cartao>
  ) : null;
  const cartaoDeRegistros = (
    <Cartao
      titulo="Registros e cargas"
      periodo={rotuloDoPeriodo(periodo, de, ate)}
      acoes={divisoes.length ? <NoPlano funcionalidade="PDF"><Botao rotulo="PDF" tipo="secundario" Icone={FileDown} carregando={gerando} aoTocar={pdf} /></NoPlano> : null}>
      {opcoesDoPeriodo.length > 1 ? (
        <BarraDeFiltros<PeriodoDoHistorico | null> valor={escolhido} limpo={null} aoAplicar={setEscolhido}
          chips={chipsDoPeriodoDoHistorico(periodo, opcoesDoPeriodo)} aoTirar={() => setEscolhido(null)}
          painelLateral={{ titulo: 'Filtros de registros' }}
          seletores={(f, mudar) => (
            <GrupoDoPainel titulo="Datas" primeiro>
              <Escolha rotulo="Período" opcoes={opcoesDoPeriodo} valor={periodoValido(f, pasta, anterior)} aoMudar={mudar} />
            </GrupoDoPainel>
          )} />
      ) : null}
      <Abas abas={VISOES} ativa={visao} aoMudar={setVisao} />
      {historico.dados && historico.dados.length ? <Texto numerico variante="pequeno">{fraseDoHistorico(visao, de, ate)}</Texto> : null}
      {semConexao ? <Texto variante="suave">Sem conexão: o histórico do servidor aparece quando voltar a internet.</Texto> : null}
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
      {/* Faixas larga e ultralarga: cada divisão (ou semana) é um bloco das colunas; a letra vem da tela, igual nas duas visões. */}
      {historico.dados && visao === 'divisao' ? (
        <ColunasDoHistorico umaColuna={<CargasPorDivisao divisoes={divisoes} letras={letras} nascemAbertas />}
          pecas={divisoes.map((d) => ({ chave: d.chave, peso: pesoDaDivisao(d), conteudo: <CargasPorDivisao divisoes={[d]} letras={letras} nascemAbertas /> }))} />
      ) : null}
      {historico.dados && visao === 'dia' ? (
        <ColunasDoHistorico umaColuna={<HistoricoPorSemana dias={historico.dados} nomeDaSessao={nomeDaSessao} letras={letras} periodo={{ de, ate }} hoje={hoje} />}
          pecas={semanasDoHistorico(historico.dados, { de, ate }, hoje).map((s) => ({
            chave: s.inicio, peso: pesoDaSemana(s),
            conteudo: <HistoricoPorSemana dias={s.dias} nomeDaSessao={nomeDaSessao} letras={letras} periodo={{ de, ate }} hoje={hoje} />,
          }))} />
      ) : null}
    </Cartao>
  );
  // O mesmo cartão da ficha, só leitura (lista e gráfico); o peso não fica guardado no aparelho. Só o que a aba mostra é
  // montado (e busca os dados); os registros e o período são da tela e sobrevivem à troca de aba.
  const blocos: Record<BlocoDoHistorico, ReactNode> = {
    ainda,
    registros: cartaoDeRegistros,
    progresso: <CartaoProgresso />,
    peso: <CartaoPeso />,
    avaliacao: <CartaoAvaliacaoFisica online={online} />,
    fotos: <CartaoFotos />,
    atualizacoes: <HistoricoAtualizacoes />,
  };
  const mostrar = (lista: readonly BlocoDoHistorico[]) => lista.map((b) => <Fragment key={b}>{blocos[b]}</Fragment>);
  const arranjo = ARRANJO_DA_ABA[aba];

  return (
    <TelaDoAluno bordas={['top']}>
      <Cabecalho titulo="Histórico" />
      {emAbas ? (
        <>
          {/* Ativação manual: cada troca monta os cartões da aba e busca os dados; a seta só move o foco. */}
          <Abas abas={[...ABAS_DO_HISTORICO]} ativa={aba} aoMudar={setAba} ativacao="manual" />
          {mostrar(NO_TOPO_DE_TODA_ABA)}
          {arranjo.emColunas ? (
            <ColunasDoHistorico umaColuna={mostrar(arranjo.principal)} maximo={MAXIMO_DE_COLUNAS_DO_CORPO}
              pecas={arranjo.principal.map((b) => ({ chave: b, peso: PESO_NO_CORPO[b] ?? 1, conteudo: blocos[b] }))} />
          ) : (
            <PrincipalComApoio
              principal={mostrar(arranjo.principal)}
              apoio={arranjo.apoio.length ? mostrar(arranjo.apoio) : null}
              rotuloDoApoio={arranjo.rotuloDoApoio ?? ''}
            />
          )}
        </>
      ) : (
        mostrar(ORDEM_NUMA_COLUNA)
      )}
    </TelaDoAluno>
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
