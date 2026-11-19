import { useSessao } from '../../../sessao/SessaoProvider';
import { router, useLocalSearchParams } from 'expo-router';
import { Camera, UserCheck, UserMinus } from 'lucide-react-native';
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { BackHandler, Platform, StyleSheet, View } from 'react-native';

import { aluno as buscarAluno, alterarSituacaoAluno, consultoria as buscarConsultoria } from '../../../api/rotas';
import { cicloDoAluno } from '../../../dominio/periodo';
import { ABAS_DA_FICHA, abaDaUrl, abaParaEditar, abaParaPasta, abasVisiveis, blocosDaAba, mostraMobilidade, type AbaDaFicha, type BlocoDaFicha } from '../../../dominio/fichaDoAluno';
import type { AlunoDetalhe } from '../../../api/tipos';
import { espaco, LARGURA_LISTA } from '../../../tema/tokens';
import { CabecalhoDaFicha } from '../../../treinador/CabecalhoDaFicha';
import { CartaoAcesso } from '../../../treinador/CartaoAcesso';
import { CartaoEvolucaoRespostas } from '../../../treinador/CartaoEvolucaoRespostas';
import { CartaoFrequencia, useAcompanhamentoDoAluno } from '../../../treinador/CartaoFrequencia';
import { CartaoAgua } from '../../../treinador/CartaoAgua';
import { CartaoRecordesDaSemana } from '../../../treinador/CartaoRecordesDaSemana';
import { AvisoDoInativar } from '../../../treinador/financeiro/AvisoDoInativar';
import { CartaoTreinosConcluidos } from '../../../treinador/CartaoTreinosConcluidos';
import { CartaoTrocasDeExercicio } from '../../../treinador/CartaoTrocasDeExercicio';
import { FolhaDeAcoes } from '../../../treinador/FolhaDeAcoes';
import { FotoDePerfilEditavel } from '../../../treinador/FotoDePerfilEditavel';
import { ResumoDoAluno } from '../../../treinador/ResumoDoAluno';
import { CartaoPeso } from '../../../treinador/CartaoPeso';
import { CartaoAvaliacaoFisica } from '../../../treinador/CartaoAvaliacaoFisica';
import { CartaoFotos } from '../../../fotos/CartaoFotos';
import { CartaoProgresso } from '../../../treinador/CartaoProgresso';
import { CartaoLesoes } from '../../../treinador/CartaoLesoes';
import { CartaoPastas, useRenovarPasta } from '../../../treinador/CartaoPastas';
import { CartaoAnamnese } from '../../../treinador/anamnese/CartaoAnamnese';
import { CartaoPlanoContratado } from '../../../treinador/financeiro/CartaoPlanoContratado';
import { DadosDoAluno } from '../../../treinador/DadosDoAluno';
import { AcoesDePrivacidade } from '../../../treinador/privacidade/AcoesDePrivacidade';
import { Abas } from '../../../ui/Abas';
import { useAviso } from '../../../ui/Aviso';
import { useSaidaGuardada } from '../../../ui/GuardaDeSaida';
import { Cartao } from '../../../ui/Cartao';
import { Esqueleto } from '../../../ui/Esqueleto';
import { MensagemErro } from '../../../ui/Estados';
import { textoDoErro } from '../../../ui/erros';
import { depoisDeFecharAsFolhas, usePassoNoHistorico } from '../../../ui/historicoDasFolhas';
import { useAvisoDoPlano } from '../../../ui/useAvisoDoPlano';
import { PainelConfirmacao } from '../../../ui/PainelConfirmacao';
import { Tela } from '../../../ui/Tela';
import { useCarregar } from '../../../ui/useCarregar';

/**
 * Ficha do aluno em cinco abas (`?aba=resumo|planos|acompanhamento|evolucao|ficha`; regra pura em `dominio/fichaDoAluno`):
 * o cabeçalho é o da ficha (`CabecalhoDaFicha`, 18/11: foto, nome, datas, situação e ⋯); o Resumo (`ResumoDoAluno`) traz só o que decide a
 * próxima ação, numa coluna; os blocos das outras abas e a condição de cada um vêm de `blocosDaAba`, e aba sem bloco
 * permitido não aparece. Cada bloco busca e trata o próprio erro, então um que falha não derruba os outros.
 * `?secao=acesso` (o "Abrir acesso ao app" do Resumo) rola até o bloco Acesso ao app da aba Ficha e sai do endereço;
 * `?secao=trocas` (as trocas do Início) faz o mesmo com o cartão das trocas, na aba Acompanhamento.
 * Ações raras (inativar, exportar, anonimizar) ficam no menu ⋯ do cabeçalho, fora das abas.
 */
export default function FichaAluno() {
  const { id, pastaId, editar, aba: abaPedida, secao } = useLocalSearchParams<{ id: string; pastaId?: string; editar?: string; aba?: string; secao?: string }>();
  const { pode, pagamentosHabilitados, retornoHabilitado } = useSessao();
  const { confirmar } = useSaidaGuardada();
  const contexto = { pode, pagamentosHabilitados, retornoHabilitado };
  const visiveis = abasVisiveis(contexto);
  // `?editar=1` e `?pastaId=` mandam na aba até saírem do endereço (quem os consome grava a aba junto, para não voltar ao Resumo).
  const aba: AbaDaFicha = abaParaEditar(editar) ?? abaParaPasta(pastaId) ?? abaDaUrl(abaPedida, visiveis);
  const { dados: aluno, erro, carregando, recarregar, definir } = useCarregar(id ?? null, (i) => buscarAluno(i));
  // Ciclo padrão da consultoria (V009). Quem não pode ler a consultoria fica só com o do aluno.
  const padrao = useCarregar('consultoria-ciclo', () => buscarConsultoria().then((c) => c.diasAtualizacaoPadrao ?? null, () => null)).dados ?? null;
  // Finalizar uma pasta ou aplicar uma alteração da anamnese pode gravar peso: o cartão de peso é remontado para buscar de novo.
  const [geracaoPeso, setGeracaoPeso] = useState(0);
  // Mudou alguma pasta (aqui ou pelo resumo): resumo, frequência e lista de pastas buscam de novo.
  const [geracaoPastas, setGeracaoPastas] = useState(0);
  const mudouPastas = () => setGeracaoPastas((g) => g + 1);
  const acompanhamento = useAcompanhamentoDoAluno(id ?? '', geracaoPastas);
  const renovacao = useRenovarPasta(aluno ? cicloDoAluno(aluno.diasAtualizacao, padrao) : null, mudouPastas);
  const [menu, setMenu] = useState(false);
  const [confirmarSituacao, setConfirmarSituacao] = useState(false);
  // `?pastaId=` ("Voltar à pasta", "Abrir pasta" da atualização, a atividade recente) abre a Folha da pasta na aba Planos e
  // sai do endereço na hora, como o `?editar=1`: recarregar a ficha não reabre a Folha e o voltar do navegador não tem
  // passo sobrando (C22). O pedido guarda o id e uma contagem: a Folha abre de novo quando outro pedido chega com a ficha
  // já na tela (o "Voltar à pasta" volta a esta ficha pela pilha em vez de empilhar outra).
  const [pedidoDePasta, setPedidoDePasta] = useState<{ id?: string; vez: number }>({ id: pastaId, vez: 0 });
  const pastaVista = useRef(pastaId);
  useEffect(() => {
    if (!pastaId) { pastaVista.current = undefined; return; }
    const novo = pastaVista.current !== pastaId;
    pastaVista.current = pastaId;
    let vivo = true;
    void Promise.resolve().then(() => {
      if (!vivo) return;
      if (novo) setPedidoDePasta((p) => ({ id: pastaId, vez: p.vez + 1 }));
      router.setParams({ pastaId: undefined, aba: 'planos' });
    });
    return () => { vivo = false; };
  }, [pastaId]);
  // Edição dos Dados do aluno (D3, 18/11): é um passo do histórico, como uma Folha (`usePassoNoHistorico`, só na web). O
  // voltar do navegador, a seta e o voltar do Android saem dela para a leitura, na mesma aba; com alteração pendente, o
  // `confirmar` pergunta "Sair sem salvar?" e, se a pessoa ficar, a entrada volta a ser empilhada.
  const [edicaoPedida, setEditando] = useState(false);
  const podeEditar = !!aluno && !aluno.anonimizado && pode('ALUNO_ALTERAR');
  // Derivado: anonimizado (pelo ⋯) ou sem a permissão, a edição fecha sozinha.
  const editando = edicaoPedida && podeEditar;
  const sairDaEdicao = () => confirmar(() => setEditando(false));
  usePassoNoHistorico(editando, sairDaEdicao);
  useEffect(() => {
    if (!editando || Platform.OS === 'web') return;
    const assinatura = BackHandler.addEventListener('hardwareBackPress', () => { sairDaEdicao(); return true; });
    return () => assinatura.remove();
  });
  // `?editar=1` (o lápis da lista de alunos) abre já editando, para quem pode, e sai do endereço antes de a edição entrar no
  // histórico: a entrada de baixo fica sem o `editar` e o voltar cai na leitura, não reabre a edição.
  const alunoChegou = !!aluno;
  useEffect(() => {
    if (editar !== '1' || !alunoChegou) return;
    let vivo = true;
    void Promise.resolve().then(() => {
      if (!vivo) return;
      router.setParams({ editar: undefined, aba: 'ficha' });
      // Fora do `vivo`: o `setParams` tira o `editar` e o efeito roda de novo antes deste passo.
      if (podeEditar) setTimeout(() => setEditando(true), 0);
    });
    return () => { vivo = false; };
  }, [editar, alunoChegou, podeEditar]);
  // `setParams` e não `push`: o push remonta a ficha (busca tudo de novo). Com o cadastro aberto e alterado, a troca pergunta
  // antes. Sair de Planos esquece a pasta pedida, senão a Folha reabriria ao voltar. Saindo da edição, o endereço só muda
  // depois de a entrada dela sair do histórico (senão a volta desfaria a troca de aba).
  const setAba = (valor: AbaDaFicha) => {
    if (valor === aba) return;
    confirmar(() => {
      if (aba === 'planos') setPedidoDePasta((p) => ({ id: undefined, vez: p.vez }));
      if (!editando) { router.setParams({ aba: valor }); return; }
      setEditando(false);
      depoisDeFecharAsFolhas(() => router.setParams({ aba: valor }));
    });
  };
  const [folhaDaFoto, setFolhaDaFoto] = useState(false);
  const voltar = () => (editando ? sairDaEdicao()
    : confirmar(() => (router.canGoBack() ? router.back() : router.replace('/treinador/alunos'))));
  // "Abrir acesso ao app" do Resumo: a aba Ficha abre já no bloco do acesso (só leva até lá; nada é enviado).
  const acessoRef = useRef<View>(null);
  useEffect(() => {
    if (secao !== 'acesso' || aba !== 'ficha' || !alunoChegou) return;
    // shortcut: só a web rola até o bloco; no celular a aba abre no topo, rolar exige o ScrollView da Tela.
    if (Platform.OS === 'web') (acessoRef.current as unknown as HTMLElement | null)?.scrollIntoView?.({ block: 'start' });
    router.setParams({ secao: undefined });
  }, [secao, aba, alunoChegou]);
  const temMenu = !!aluno &&((pode('ALUNO_ALTERAR') && !aluno.anonimizado) || pode('ALUNO_EXPORTAR') || (pode('ALUNO_ANONIMIZAR') && !aluno.ativo && !aluno.anonimizado));

  const bloco = (b: BlocoDaFicha, a: AlunoDetalhe): ReactNode => {
    switch (b) {
      case 'pastas':
        return <CartaoPastas key={`${a.id}:${pedidoDePasta.vez}`} pastaInicialId={pedidoDePasta.id} alunoId={a.id} alunoNome={a.nome} diasAtualizacao={cicloDoAluno(a.diasAtualizacao, padrao)}
          geracao={geracaoPastas} aoMudar={mudouPastas} aoGravarPeso={() => setGeracaoPeso((g) => g + 1)} acompanhamento={acompanhamento} />;
      case 'frequencia': return <CartaoFrequencia alunoId={a.id} acompanhamento={acompanhamento} comMobilidade={mostraMobilidade(contexto)} />;
      case 'agua': return <CartaoAgua alunoId={a.id} comDieta={pode('DIETA_LER')} />;
      // Retorno ao aluno (Engajamento 0.5): treinos concluídos com o "Visto" e os recordes da semana.
      case 'treinosConcluidos': return <CartaoTreinosConcluidos alunoId={a.id} />;
      case 'recordesDaSemana': return <CartaoRecordesDaSemana alunoId={a.id} />;
      // `?secao=trocas` (a Folha "Trocas para ver" do Início): o cartão rola até ele quando a lista chega e sai do endereço.
      case 'trocasDeExercicio':
        return <CartaoTrocasDeExercicio alunoId={a.id} rolarAte={secao === 'trocas'} aoRolar={() => router.setParams({ secao: undefined })} />;
      case 'evolucaoDasRespostas': return <CartaoEvolucaoRespostas alunoId={a.id} />;
      case 'progresso': return <CartaoProgresso alunoId={a.id} />;
      // A meta na chave: salvar outra meta na ficha busca o peso de novo, e as cores vêm da meta de cada item.
      case 'peso': return <CartaoPeso key={`${geracaoPeso}:${a.metaDoPeso ?? ''}`} alunoId={a.id} />;
      case 'avaliacaoFisica': return <CartaoAvaliacaoFisica alunoId={a.id} alunoNome={a.nome} anonimizado={a.anonimizado} />;
      case 'fotos': return <CartaoFotos alunoId={a.id} autorizadoEm={a.usoDeImagemAutorizadoEm} aoRecarregar={recarregar} />;
      // Sem cartão em volta: as quatro seções são os cartões (dentro de um cartão vai divisor, não outro contorno).
      case 'dadosDoAluno': return <DadosDoAluno aluno={a} padrao={padrao} aoAlterar={definir} editando={editando} aoEditar={setEditando} />;
      // Bloco próprio (guia de 11/11, pág. 34): situação, conta vinculada e as duas formas de dar o acesso.
      case 'acessoAoApp':
        return <View ref={acessoRef} nativeID="acesso-ao-app"><Cartao titulo="Acesso ao app"><CartaoAcesso aluno={a} aoAlterar={definir} /></Cartao></View>;
      case 'planoContratado':
        return <CartaoPlanoContratado alunoId={a.id} ativo={a.ativo} anonimizado={a.anonimizado} alunoNome={a.nome} telefoneAluno={a.telefone} />;
      case 'anamnese':
        return <CartaoAnamnese alunoId={a.id} anonimizado={a.anonimizado} aoMudarCadastro={() => { recarregar(); setGeracaoPeso((g) => g + 1); }} />;
      case 'lesoes': return <CartaoLesoes alunoId={a.id} />;
    }
  };

  const conteudoDaAba = (a: AlunoDetalhe): ReactNode => {
    if (aba === 'resumo') {
      return (
        <ResumoDoAluno aluno={a} acompanhamento={acompanhamento} abas={visiveis} aoRenovar={renovacao.pedir} aoAbrirAba={setAba}
          aoAbrirAcesso={() => confirmar(() => router.setParams({ aba: 'ficha', secao: 'acesso' }))}
          aoAbrirPasta={(p) => router.setParams({ pastaId: p })} />
      );
    }
    const lista = blocosDaAba(aba, contexto);
    const contagens = lista.filter((b) => CONTAGENS.includes(b));
    return (
      <>
        {/* Frequência e mobilidade (um cartão) e Água são o mesmo tipo de contagem: lado a lado no PC, uma embaixo da outra no celular. */}
        {contagens.length > 0 ? (
          <View style={estilos.contagens}>
            {contagens.map((b) => {
              const el = bloco(b, a);
              return el ? <View key={b} style={estilos.contagem}>{el}</View> : null;
            })}
          </View>
        ) : null}
        {lista.filter((b) => !CONTAGENS.includes(b)).map((b) => <Fragment key={b}>{bloco(b, a)}</Fragment>)}
      </>
    );
  };

  return (
    <Tela bordas={['top']} largura={LARGURA_LISTA}>
      <CabecalhoDaFicha aluno={aluno ?? null} aoVoltar={voltar} aoAbrirMenu={temMenu ? () => setMenu(true) : undefined}
        foto={aluno ? (
          <FotoDePerfilEditavel alunoId={aluno.id} alunoNome={aluno.nome} anonimizado={aluno.anonimizado} aoAnonimizado={recarregar}
            folhaAberta={folhaDaFoto} aoMudarFolha={setFolhaDaFoto} />
        ) : undefined}
        abas={aluno ? <Abas abas={ABAS_DA_FICHA.filter((a) => visiveis.includes(a.valor))} ativa={aba} aoMudar={setAba} ativacao="manual" /> : undefined} />
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar}
        acao={{ rotulo: 'Voltar à lista', aoTocar: () => router.navigate('/treinador/alunos') }} /> : null}
      {!aluno && carregando ? <Esqueleto /> : null}
      {aluno ? (
        <>
          {conteudoDaAba(aluno)}
          {renovacao.painel}
          {menu ? (
            <FolhaDeAcoes titulo={aluno.nome} aoFechar={() => setMenu(false)} acoes={[
              // A mesma Folha do círculo da foto (D4): quem usa o toque também acha a troca aqui.
              podeEditar ? {
                rotulo: 'Trocar foto', Icone: Camera,
                aoTocar: () => (Platform.OS === 'web' ? setFolhaDaFoto(true) : setTimeout(() => setFolhaDaFoto(true), 350)),
              } : null,
              pode('ALUNO_ALTERAR') && !aluno.anonimizado ? {
                rotulo: aluno.ativo ? 'Inativar aluno' : 'Reativar aluno',
                detalhe: aluno.ativo ? 'Sai do app na hora; planos e registros ficam guardados.' : 'Volta para a lista de ativos e pode entrar no app.',
                Icone: aluno.ativo ? UserMinus : UserCheck, perigo: aluno.ativo, aoTocar: () => setConfirmarSituacao(true),
              } : null,
            ]}>
              {/* Exportar e anonimizar têm as próprias confirmações, abertas dentro desta folha. */}
              <AcoesDePrivacidade aluno={aluno} aoAnonimizar={(a) => { setMenu(false); definir(a); }} />
            </FolhaDeAcoes>
          ) : null}
          <ConfirmarSituacao aluno={aluno} visivel={confirmarSituacao} aoFechar={() => setConfirmarSituacao(false)} aoAlterar={definir} />
        </>
      ) : null}
    </Tela>
  );
}

/** Contagens da aba Acompanhamento que dividem uma linha. */
const CONTAGENS: readonly BlocoDaFicha[] = ['frequencia', 'agua'];

/** Inativar ou reativar (do menu ⋯ da ficha). Inativar encerra o acesso na hora; nada é apagado. */
function ConfirmarSituacao({ aluno, visivel, aoFechar, aoAlterar }: { aluno: AlunoDetalhe; visivel: boolean; aoFechar: () => void; aoAlterar: (a: AlunoDetalhe) => void }) {
  const { avisar } = useAviso();
  const avisarDoPlano = useAvisoDoPlano();
  const [mudando, setMudando] = useState(false);
  const mudarSituacao = () => {
    setMudando(true);
    alterarSituacaoAluno(aluno.id, !aluno.ativo).then(
      (a) => {
        setMudando(false);
        aoFechar();
        aoAlterar(a);
        avisar(a.ativo ? 'Aluno reativado.' : 'Aluno inativado. O acesso ao app foi encerrado.', 'sucesso');
      },
      (e: unknown) => {
        setMudando(false);
        aoFechar();
        if (!avisarDoPlano(e)) avisar(textoDoErro(e), 'perigo');
      },
    );
  };
  return (
    <PainelConfirmacao
      visivel={visivel}
      titulo={aluno.ativo ? `Inativar ${aluno.nome}?` : `Reativar ${aluno.nome}?`}
      mensagem={
        aluno.ativo
          ? 'O aluno sai do app na hora e não entra mais. Planos e registros ficam guardados; dá para reativar depois.'
          : 'O aluno volta para a lista de ativos e pode entrar no app de novo.'
      }
      rotuloConfirmar={aluno.ativo ? 'Inativar' : 'Reativar'}
      perigo={aluno.ativo}
      carregando={mudando}
      aoConfirmar={mudarSituacao}
      aoCancelar={aoFechar}>
      {visivel && aluno.ativo ? <AvisoDoInativar alunoId={aluno.id} /> : null}
    </PainelConfirmacao>
  );
}

const estilos = StyleSheet.create({
  // No PC as contagens alinham pelo topo (cada uma com a própria altura, sem esticar o vazio); no celular, uma sequência.
  contagens: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(3), alignItems: 'flex-start' },
  contagem: { flexGrow: 1, flexShrink: 1, flexBasis: 420, minWidth: 0 },
});
