import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ErroApi } from '../api/cliente';
import type { AvaliacaoFisica, CampoDaMedida } from '../api/avaliacaoFisicaTipos';
import type { Marca } from '../api/tipos';
import { avaliacoesFisicasDoAluno, consultoria, excluirAvaliacaoFisica, minhasAvaliacoesFisicas, pesosAluno, pesosDoAluno } from '../api/rotas';
import { COMPARAR_MINIMO, medidaEscolhida, opcoesDeMedida, podeBaixarComparativo } from '../dominio/avaliacaoFisica';
import { dataParaTela } from '../dominio/formatos';
import { periodoDesdeOPrimeiro } from '../dominio/historicoDoAluno';
import { imprimir } from '../pdf/imprimir';
import { logoComoDataUri } from '../pdf/logo';
import { documentoAvaliacaoFisica } from '../pdf/pdfAvaliacaoFisica';
import { useSessao } from '../sessao/SessaoProvider';
import { espaco } from '../tema/tokens';
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
import { FolhaComparar } from './avaliacao/CompararAvaliacoes';
import { EvolucaoDaMedida } from './avaliacao/EvolucaoDaMedida';
import { FolhaAvaliacao } from './avaliacao/FolhaAvaliacao';
import { HistoricoDeAvaliacoes } from './avaliacao/HistoricoDeAvaliacoes';

type Props =
  /**
   * Ficha do aluno (equipe): lista, nova, editar, excluir, comparar e baixar o comparativo. `aoRegistrarPeso` avisa quem
   * monta a ficha que um peso foi registrado pela folha da avaliação (o cartão Peso da mesma tela precisa recarregar).
   * `geracaoPeso` (sobe quando outro lugar da tela grava peso) e `metaDoPeso` (a meta do cadastro) entram na chave dos
   * pesos: mudou, os pesos e a cor da meta vêm de novo, sem remontar o cartão (a folha aberta e o que foi digitado ficam).
   */
  | { alunoId: string; alunoNome: string; anonimizado?: boolean; aoRegistrarPeso?: () => void; geracaoPeso?: number; metaDoPeso?: string | null }
  /**
   * Histórico do próprio aluno: só leitura, a mesma comparação e o PDF dela (com a marca da sessão). `online` vem do
   * `AlunoProvider` (que a ficha do treinador não tem): sem internet o botão do PDF não aparece.
   */
  | { alunoId?: undefined; alunoNome?: undefined; anonimizado?: undefined; aoRegistrarPeso?: undefined; geracaoPeso?: undefined; metaDoPeso?: undefined; online?: boolean };

/**
 * Avaliação física (circunferências em cm por data; dado sensível, só na tela). A equipe registra; o aluno só lê. Em cima
 * a "Evolução por medida" (resumo, gráfico e datas de uma medida, ou direito × esquerdo); embaixo o histórico em tabela,
 * com a variação desde a anterior e o "Comparar" de duas datas (com o PDF). A única cor é a da meta do peso do aluno
 * (`metaDoPeso` do registro de peso), no peso, na cintura, no abdômen e no quadril; sem registro de peso, tudo neutro. Sem
 * soma nem interpretação. Regras em `dominio/avaliacaoFisica` e `dominio/comparacaoDeAvaliacoes`. No Histórico do aluno
 * (28/11) não há o bloco "Histórico" (repetia a tabela das datas): a observação vira o ⓘ na linha da tabela da Evolução e
 * o "Comparar" fica nas ações do cartão.
 */
export function CartaoAvaliacaoFisica(p: Props) {
  const { pode, marca: marcaDaSessao, usuario } = useSessao();
  const { avisar } = useAviso();
  const daEquipe = p.alunoId !== undefined;
  const { dados, erro, carregando, recarregar } = useCarregar(daEquipe ? `avaliacoes:${p.alunoId}` : 'avaliacoes-aluno',
    () => (daEquipe ? avaliacoesFisicasDoAluno(p.alunoId) : minhasAvaliacoesFisicas()));
  const [editando, setEditando] = useState<AvaliacaoFisica | 'nova' | null>(null);
  const [excluir, setExcluir] = useState<AvaliacaoFisica | null>(null);
  const [erroAcao, setErroAcao] = useState<unknown>(null);
  // Os registros de peso dão o peso da data na folha e a meta efetiva (a cor). Falha aqui é silenciosa: fica neutro e sem a linha do peso.
  // shortcut: segunda busca de /pesos na ficha (o CartaoPeso já busca a mesma lista); trocar por um cache compartilhado se pesar.
  const pesos = useCarregar(daEquipe ? `peso-da-avaliacao:${p.alunoId}:${p.geracaoPeso ?? 0}:${p.metaDoPeso ?? ''}` : 'peso-da-avaliacao-aluno',
    () => (daEquipe ? pesosDoAluno(p.alunoId) : pesosAluno()));
  const meta = pesos.dados?.find((r) => r.metaDoPeso)?.metaDoPeso;
  const [comparando, setComparando] = useState(false);
  const [medida, setMedida] = useState<CampoDaMedida | null>(null);
  const [verPar, setVerPar] = useState(true);
  const [incluirGrafico, setIncluirGrafico] = useState(false);
  const [gerando, setGerando] = useState(false);
  const podeGravar = daEquipe && pode('ALUNO_SENSIVEL_ALTERAR') && !p.anonimizado;
  const poucas = (dados?.length ?? 0) < COMPARAR_MINIMO;

  const lista = dados ?? [];
  const opcoes = opcoesDeMedida(lista);
  const campo = medidaEscolhida(opcoes, medida);
  const series = campo ? seriesDaEvolucao(lista, campo, verPar) : null;
  const semConexao = erro instanceof ErroApi && erro.semConexao;
  // Equipe sem avaliação: o vazio e a explicação numa frase só, na faixa do cartão (sem selo de período nem corpo).
  const vazioDaEquipe = daEquipe && dados?.length === 0;

  const tentarDeNovo = () => {
    setErroAcao(null);
    recarregar();
  };

  // O erro de uma ação some quando a pessoa abre a Folha, tenta de novo ou salva (não fica um erro velho na tela).
  // Os pesos vêm de novo ao abrir: um peso gravado pelo cartão Peso (que não avisa este cartão) ou em outro aparelho
  // apareceria como "Sem registro de peso nesta data" e o "Registrar peso" daria 409.
  const abrirFolha = (alvo: AvaliacaoFisica | 'nova') => {
    setErroAcao(null);
    setEditando(alvo);
    pesos.recarregar();
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
  const mostrarBaixar = podeBaixarComparativo({ daEquipe, online, temMarca: marcaDaSessao !== null });

  const baixar = (marcadas: string[]) => {
    if (!daEquipe && !marcaDaSessao) return;
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
            meta,
            // Só as datas marcadas (as da tabela do PDF), na medida escolhida.
            grafico: incluirGrafico && campo ? graficoDoPdfDasMarcadas(lista, marcadas, campo, verPar) : undefined,
            emitidoEm: new Date(),
          }),
        ),
      )
      .catch((e: unknown) => avisar(textoDoErro(e), 'perigo'))
      .finally(() => setGerando(false));
  };

  return (
    <Cartao
      titulo="Avaliação física"
      periodo={dados && !vazioDaEquipe ? periodoDesdeOPrimeiro(dados.map((a) => a.data)) : undefined}
      descricao={vazioDaEquipe ? 'Nenhuma avaliação registrada. Circunferências em centímetros, por data.'
        : daEquipe ? 'Circunferências em centímetros, por data.' : 'Suas medidas registradas pelo seu treinador, em centímetros.'}
      acoes={podeGravar ? <Botao rotulo="Nova avaliação" tipo="acao" Icone={Plus} aoTocar={() => abrirFolha('nova')} />
        : !daEquipe && lista.length ? (
          <Botao rotulo="Comparar" tipo="secundario" aoTocar={() => setComparando(true)}
            desabilitado={poucas} motivo={poucas ? 'Com duas avaliações dá para comparar.' : undefined} />
        ) : null}>
      {erro && !semConexao ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={tentarDeNovo} /> : null}
      {semConexao ? <Texto variante="suave">Sem conexão.</Texto> : null}
      {erroAcao ? <MensagemErro texto={textoDoErro(erroAcao)} /> : null}
      {!dados && carregando ? <Esqueleto cartoes={1} texto="Carregando avaliações" /> : null}
      {!daEquipe && dados && dados.length === 0 ? <Texto variante="suave">Nenhuma avaliação registrada.</Texto> : null}
      {lista.length ? (
        <View style={estilos.corpo}>
          {daEquipe ? <Texto variante="secao" nivel={3}>Evolução por medida</Texto> : null}
          {campo && series ? (
            <EvolucaoDaMedida avaliacoes={lista} daEquipe={daEquipe} opcoes={opcoes} campo={campo} aoEscolher={setMedida}
              series={series} verPar={verPar} aoVerPar={setVerPar} meta={meta} />
          ) : null}
          {daEquipe ? (
            <HistoricoDeAvaliacoes avaliacoes={lista} meta={meta} podeGravar={podeGravar} aoEditar={abrirFolha} aoExcluir={setExcluir}
              aoComparar={() => setComparando(true)} />
          ) : null}
        </View>
      ) : null}
      {comparando && lista.length ? (
        <FolhaComparar
          avaliacoes={lista}
          meta={meta}
          aoFechar={() => setComparando(false)}
          pdf={mostrarBaixar ? {
            gerando,
            aoBaixar: baixar,
            grafico: series ? (series.b ? `${series.a.rotulo} e ${series.b.rotulo.toLowerCase()}` : series.nome) : null,
            incluirGrafico,
            aoIncluirGrafico: setIncluirGrafico,
          } : null}
        />
      ) : null}
      {editando && daEquipe ? (
        <FolhaAvaliacao
          alunoId={p.alunoId}
          avaliacao={editando === 'nova' ? null : editando}
          avaliacoes={lista}
          // Enquanto a conferência da abertura não volta, nada (o `PesoDaData` não afirma "sem registro" com a lista velha).
          // Na troca de chave (o peso que a própria folha gravou sobe a geração) a lista já é a nova, do `definir`: fica.
          pesos={pesos.erro || (pesos.carregando && !pesos.dadosDeOutraChave) ? null : (pesos.dados ?? null)}
          meta={meta}
          aoPesoRegistrado={(registros) => {
            // O peso entra na lista na hora; as avaliações vêm de novo porque o `pesoKg` delas é do servidor.
            pesos.definir(registros);
            recarregar();
            p.aoRegistrarPeso?.();
          }}
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
