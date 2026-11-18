import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ErroApi } from '../api/cliente';
import type { AvaliacaoFisica, CampoDaMedida } from '../api/avaliacaoFisicaTipos';
import type { Marca } from '../api/tipos';
import { avaliacoesFisicasDoAluno, consultoria, excluirAvaliacaoFisica, minhasAvaliacoesFisicas } from '../api/rotas';
import { alternarEscolha, medidaEscolhida, opcoesDeMedida, podeBaixarComparativo } from '../dominio/avaliacaoFisica';
import { compararAvaliacoes } from '../dominio/comparacaoDeAvaliacoes';
import { dataParaTela } from '../dominio/formatos';
import { periodoDesdeOPrimeiro } from '../dominio/historicoDoAluno';
import { imprimir } from '../pdf/imprimir';
import { logoComoDataUri } from '../pdf/logo';
import { documentoAvaliacaoFisica } from '../pdf/pdfAvaliacaoFisica';
import { useSessao } from '../sessao/SessaoProvider';
import { useTema } from '../tema/TemaProvider';
import { espaco } from '../tema/tokens';
import { Abas } from '../ui/Abas';
import { useAviso } from '../ui/Aviso';
import { Botao } from '../ui/Botao';
import { Cartao } from '../ui/Cartao';
import { Esqueleto } from '../ui/Esqueleto';
import { MensagemErro } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { PainelConfirmacao } from '../ui/PainelConfirmacao';
import { Texto } from '../ui/Texto';
import { useCarregar } from '../ui/useCarregar';
import { graficoDoPdfDasMarcadas, seriesDaEvolucao } from './avaliacao/apresentacao';
import { ResultadoDaComparacao, SelecaoDoComparar } from './avaliacao/CompararAvaliacoes';
import { EvolucaoDaMedida } from './avaliacao/EvolucaoDaMedida';
import { FolhaAvaliacao } from './avaliacao/FolhaAvaliacao';
import { HistoricoDeAvaliacoes } from './avaliacao/HistoricoDeAvaliacoes';

type Props =
  /** Ficha do aluno (equipe): lista, nova, editar, excluir, comparar e baixar o comparativo. */
  | { alunoId: string; alunoNome: string; anonimizado?: boolean }
  /**
   * Histórico do próprio aluno: só leitura, a mesma comparação e o PDF dela (com a marca da sessão). `online` vem do
   * `AlunoProvider` (que a ficha do treinador não tem): sem internet o botão do PDF não aparece.
   */
  | { alunoId?: undefined; alunoNome?: undefined; anonimizado?: undefined; online?: boolean };

type Aba = 'evolucao' | 'comparar';
const ABAS: { valor: Aba; rotulo: string }[] = [
  { valor: 'evolucao', rotulo: 'Evolução por medida' },
  { valor: 'comparar', rotulo: 'Comparar avaliações' },
];

/**
 * Avaliação física (circunferências em cm por data; dado sensível, só na tela). A equipe registra; o aluno só lê. Duas
 * abas: "Evolução por medida" (resumo, gráfico e datas de uma medida, ou direito × esquerdo) e "Comparar avaliações" (2 a
 * 4 datas, tabela por grupo e o PDF). O histórico compacto fica embaixo nas duas. Só números: sem cor de "bom/ruim", soma,
 * meta nem interpretação. Regras em `dominio/avaliacaoFisica` e `dominio/comparacaoDeAvaliacoes`.
 */
export function CartaoAvaliacaoFisica(p: Props) {
  const { cores } = useTema();
  const { pode, marca: marcaDaSessao, usuario } = useSessao();
  const { avisar } = useAviso();
  const daEquipe = p.alunoId !== undefined;
  const { dados, erro, carregando, recarregar } = useCarregar(daEquipe ? `avaliacoes:${p.alunoId}` : 'avaliacoes-aluno',
    () => (daEquipe ? avaliacoesFisicasDoAluno(p.alunoId) : minhasAvaliacoesFisicas()));
  const [editando, setEditando] = useState<AvaliacaoFisica | 'nova' | null>(null);
  const [excluir, setExcluir] = useState<AvaliacaoFisica | null>(null);
  const [erroAcao, setErroAcao] = useState<unknown>(null);
  const [aba, setAba] = useState<Aba>('evolucao');
  const [escolhidas, setEscolhidas] = useState<string[]>([]);
  const [medida, setMedida] = useState<CampoDaMedida | null>(null);
  const [verPar, setVerPar] = useState(true);
  const [incluirGrafico, setIncluirGrafico] = useState(false);
  const [gerando, setGerando] = useState(false);
  const podeGravar = daEquipe && pode('ALUNO_SENSIVEL_ALTERAR') && !p.anonimizado;

  const lista = dados ?? [];
  // Só valem as escolhas que ainda existem (uma avaliação pode ter sido excluída).
  const marcadas = escolhidas.filter((id) => lista.some((a) => a.id === id));
  const comparacao = compararAvaliacoes(lista, marcadas);
  const opcoes = opcoesDeMedida(lista);
  const campo = medidaEscolhida(opcoes, medida);
  const series = campo ? seriesDaEvolucao(lista, campo, verPar) : null;
  const comAbas = lista.length >= 2;
  const abaAtiva: Aba = comAbas ? aba : 'evolucao';
  const semConexao = erro instanceof ErroApi && erro.semConexao;
  // Equipe sem avaliação: o vazio e a explicação numa frase só, na faixa do cartão (sem selo de período nem corpo).
  const vazioDaEquipe = daEquipe && dados?.length === 0;

  const tentarDeNovo = () => {
    setErroAcao(null);
    recarregar();
  };

  // O erro de uma ação some quando a pessoa abre a Folha, tenta de novo ou salva (não fica um erro velho na tela).
  const abrirFolha = (alvo: AvaliacaoFisica | 'nova') => {
    setErroAcao(null);
    setEditando(alvo);
  };

  const confirmarExclusao = () => {
    const alvo = excluir;
    setExcluir(null);
    if (!alvo) return;
    setErroAcao(null);
    excluirAvaliacaoFisica(alvo.id, alvo.versao).then(recarregar, (e: unknown) => {
      setErroAcao(e);
      recarregar();
    });
  };

  // O aluno usa a marca que a sessão já tem (a rota `/consultoria` é da equipe); a equipe a busca como sempre.
  const online = p.alunoId === undefined ? p.online === true : true;
  const mostrarBaixar = comparacao.estado === 'ok' && podeBaixarComparativo({ daEquipe, online, temMarca: marcaDaSessao !== null });

  const baixar = () => {
    if (comparacao.estado !== 'ok' || (!daEquipe && !marcaDaSessao)) return;
    setGerando(true);
    const nome = daEquipe ? p.alunoNome : (usuario?.nome ?? '');
    const marcaDoPdf: Promise<Marca> = daEquipe ? consultoria().then((c) => c.marca) : Promise.resolve(marcaDaSessao as Marca);
    marcaDoPdf
      .then(async (marca) =>
        imprimir(
          documentoAvaliacaoFisica({
            marca,
            logoDataUri: await logoComoDataUri(marca),
            aluno: nome,
            avaliacoes: lista,
            escolhidas: marcadas,
            // Só as datas marcadas (as da tabela do PDF), na medida escolhida.
            grafico: incluirGrafico && campo ? graficoDoPdfDasMarcadas(lista, marcadas, campo, verPar) : undefined,
            emitidoEm: new Date(),
          }),
        ),
      )
      .catch((e: unknown) => avisar(textoDoErro(e), 'perigo'))
      .finally(() => setGerando(false));
  };

  const historico = (
    <HistoricoDeAvaliacoes
      avaliacoes={lista}
      marcar={abaAtiva === 'comparar' ? { marcadas, aoAlternar: (id) => setEscolhidas(alternarEscolha(marcadas, id)) } : undefined}
      podeGravar={podeGravar}
      aoEditar={abrirFolha}
      aoExcluir={setExcluir}
    />
  );

  return (
    <Cartao
      titulo="Avaliação física"
      periodo={dados && !vazioDaEquipe ? periodoDesdeOPrimeiro(dados.map((a) => a.data)) : undefined}
      descricao={vazioDaEquipe ? 'Nenhuma avaliação registrada. Circunferências em centímetros, por data.'
        : daEquipe ? 'Circunferências em centímetros, por data.' : 'Suas medidas registradas pelo seu treinador, em centímetros.'}
      acoes={podeGravar ? <Botao rotulo="Nova avaliação" tipo="acao" Icone={Plus} aoTocar={() => abrirFolha('nova')} /> : null}>
      {erro && !semConexao ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={tentarDeNovo} /> : null}
      {semConexao ? <Texto variante="suave">Sem conexão.</Texto> : null}
      {erroAcao ? <MensagemErro texto={textoDoErro(erroAcao)} /> : null}
      {!dados && carregando ? <Esqueleto cartoes={1} texto="Carregando avaliações" /> : null}
      {!daEquipe && dados && dados.length === 0 ? <Texto variante="suave">Nenhuma avaliação registrada.</Texto> : null}
      {lista.length ? (
        <View style={estilos.corpo}>
          {comAbas ? <Abas abas={ABAS} ativa={abaAtiva} aoMudar={setAba} fundo={cores.superficie} /> : (
            <Texto variante="secao" nivel={3}>Evolução por medida</Texto>
          )}
          {abaAtiva === 'evolucao' && campo && series ? (
            <EvolucaoDaMedida avaliacoes={lista} daEquipe={daEquipe} opcoes={opcoes} campo={campo} aoEscolher={setMedida}
              series={series} verPar={verPar} aoVerPar={setVerPar} />
          ) : null}
          {abaAtiva === 'comparar' ? <SelecaoDoComparar avaliacoes={lista} marcadas={marcadas} aoMudar={setEscolhidas} /> : null}
          {historico}
          {abaAtiva === 'comparar' ? (
            <ResultadoDaComparacao
              avaliacoes={lista}
              comparacao={comparacao}
              mostrarBaixar={mostrarBaixar}
              gerando={gerando}
              aoBaixar={baixar}
              graficoDoPdf={series ? (series.b ? `${series.a.rotulo} e ${series.b.rotulo.toLowerCase()}` : series.nome) : null}
              incluirGrafico={incluirGrafico}
              aoIncluirGrafico={setIncluirGrafico}
            />
          ) : null}
        </View>
      ) : null}
      {editando && daEquipe ? (
        <FolhaAvaliacao
          alunoId={p.alunoId}
          avaliacao={editando === 'nova' ? null : editando}
          aoFechar={() => setEditando(null)}
          aoSalvar={() => {
            setEditando(null);
            setErroAcao(null);
            recarregar();
          }}
          aoConflito={(e) => {
            // Outra pessoa mudou a avaliação: fecha, mostra a mensagem da API e busca a lista de novo (a versão aberta ficou velha).
            setEditando(null);
            setErroAcao(e);
            recarregar();
          }}
        />
      ) : null}
      {/* Sem avaliação não há o que excluir; montado, o painel daria corpo ao cartão vazio (`Cartao` conta os filhos). */}
      {vazioDaEquipe ? null : <PainelConfirmacao
        visivel={excluir !== null}
        titulo="Excluir esta avaliação física?"
        mensagem={excluir ? `Avaliação de ${dataParaTela(excluir.data)}. As medidas saem; o registro de peso continua.` : undefined}
        rotuloConfirmar="Excluir"
        perigo
        aoConfirmar={confirmarExclusao}
        aoCancelar={() => setExcluir(null)}
      />}
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  corpo: { gap: espaco(2) },
});
