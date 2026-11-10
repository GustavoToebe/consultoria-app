import { useSessao } from '../../../sessao/SessaoProvider';
import { Permitido } from '../../../ui/Permitido';
import { router, useLocalSearchParams } from 'expo-router';
import { Ellipsis, Pencil, UserCheck, UserMinus } from 'lucide-react-native';
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { aluno as buscarAluno, alterarAluno, alterarSituacaoAluno, consultoria as buscarConsultoria, escolherQuestionarioDoAluno } from '../../../api/rotas';
import { enderecoParaLeitura, NOTA_TELEFONE_SEM_ACESSO } from '../../../dominio/cadastroDoAluno';
import { rotuloDoSexo } from '../../../dominio/sexo';
import { textoDaMeta } from '../../../dominio/metaDoPesoNaFicha';
import { cicloDoAluno, textoDoCiclo } from '../../../dominio/periodo';
import { ABAS_DA_FICHA, abaDaUrl, abaParaEditar, abaParaPasta, abasVisiveis, blocosDaAba, type AbaDaFicha, type BlocoDaFicha } from '../../../dominio/fichaDoAluno';
import type { AlunoDetalhe } from '../../../api/tipos';
import { espaco, LARGURA_LISTA } from '../../../tema/tokens';
import { AtividadeRecente } from '../../../treinador/AtividadeRecente';
import { CartaoAcesso } from '../../../treinador/CartaoAcesso';
import { CartaoEvolucaoRespostas } from '../../../treinador/CartaoEvolucaoRespostas';
import { CartaoFrequencia, useAcompanhamentoDoAluno } from '../../../treinador/CartaoFrequencia';
import { CartaoAgua } from '../../../treinador/CartaoAgua';
import { CartaoMobilidade } from '../../../treinador/CartaoMobilidade';
import { CartaoRecordesDaSemana } from '../../../treinador/CartaoRecordesDaSemana';
import { CartaoTreinosConcluidos } from '../../../treinador/CartaoTreinosConcluidos';
import { FolhaDeAcoes } from '../../../treinador/FolhaDeAcoes';
import { PesoELesoesNoResumo } from '../../../treinador/PesoELesoesNoResumo';
import { ResumoDoAluno } from '../../../treinador/ResumoDoAluno';
import { CartaoPeso } from '../../../treinador/CartaoPeso';
import { CartaoAvaliacaoFisica } from '../../../treinador/CartaoAvaliacaoFisica';
import { CartaoFotos } from '../../../fotos/CartaoFotos';
import { CartaoProgresso } from '../../../treinador/CartaoProgresso';
import { CartaoLesoes } from '../../../treinador/CartaoLesoes';
import { CartaoPastas, useRenovarPasta } from '../../../treinador/CartaoPastas';
import { CartaoAnamnese } from '../../../treinador/anamnese/CartaoAnamnese';
import { LinhaDoCicloNaFicha } from '../../../treinador/ciclo/CicloNaFicha';
import { CartaoPlanoContratado } from '../../../treinador/financeiro/CartaoPlanoContratado';
import { FormAluno } from '../../../treinador/FormAluno';
import { AcoesDePrivacidade } from '../../../treinador/privacidade/AcoesDePrivacidade';
import { ResponsavelAluno } from '../../../treinador/equipe/ResponsavelAluno';
import { SeletorDeQuestionario } from '../../../treinador/questionarios/SeletorDeQuestionario';
import { Abas } from '../../../ui/Abas';
import { useAviso } from '../../../ui/Aviso';
import { useSaidaGuardada } from '../../../ui/GuardaDeSaida';
import { Botao } from '../../../ui/Botao';
import { Cabecalho } from '../../../ui/Cabecalho';
import { Cartao } from '../../../ui/Cartao';
import { CampoLeitura } from '../../../ui/CampoLeitura';
import { Esqueleto } from '../../../ui/Esqueleto';
import { IconeBotao } from '../../../ui/IconeBotao';
import { MensagemErro } from '../../../ui/Estados';
import { textoDoErro } from '../../../ui/erros';
import { useAvisoDoPlano } from '../../../ui/useAvisoDoPlano';
import { PainelConfirmacao } from '../../../ui/PainelConfirmacao';
import { Tela } from '../../../ui/Tela';
import { Texto } from '../../../ui/Texto';
import { useCarregar } from '../../../ui/useCarregar';

/**
 * Ficha do aluno em cinco abas (`?aba=resumo|planos|acompanhamento|evolucao|ficha`; regra pura em `dominio/fichaDoAluno`):
 * o Resumo traz só o que decide a próxima ação (próximo passo, pasta vigente, atualização, indicadores, último peso,
 * aviso das lesões e a atividade recente); os blocos das outras abas e a condição de cada um vêm de `blocosDaAba`, e aba
 * sem bloco permitido não aparece. Cada bloco busca e trata o próprio erro, então um que falha não derruba os outros.
 * Ações raras (inativar, exportar, anonimizar) ficam no menu ⋯ do cabeçalho, fora das abas.
 */
export default function FichaAluno() {
  const { id, pastaId, editar, aba: abaPedida } = useLocalSearchParams<{ id: string; pastaId?: string; editar?: string; aba?: string }>();
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
  // `setParams` e não `push`: o push remonta a ficha (busca tudo de novo). Com o cadastro aberto e alterado, a troca pergunta
  // antes (a aba Ficha desmonta o formulário). Sair de Planos esquece a pasta pedida, senão a Folha reabriria ao voltar.
  const setAba = (valor: AbaDaFicha) => {
    if (valor === aba) return;
    confirmar(() => {
      if (aba === 'planos') setPedidoDePasta((p) => ({ id: undefined, vez: p.vez }));
      router.setParams({ aba: valor });
    });
  };
  const temMenu = !!aluno && ((pode('ALUNO_ALTERAR') && !aluno.anonimizado) || pode('ALUNO_EXPORTAR') || (pode('ALUNO_ANONIMIZAR') && !aluno.ativo && !aluno.anonimizado));

  const bloco = (b: BlocoDaFicha, a: AlunoDetalhe): ReactNode => {
    switch (b) {
      case 'pastas':
        return <CartaoPastas key={`${a.id}:${pedidoDePasta.vez}`} pastaInicialId={pedidoDePasta.id} alunoId={a.id} alunoNome={a.nome} diasAtualizacao={cicloDoAluno(a.diasAtualizacao, padrao)}
          geracao={geracaoPastas} aoMudar={mudouPastas} aoGravarPeso={() => setGeracaoPeso((g) => g + 1)} />;
      case 'frequencia': return <CartaoFrequencia acompanhamento={acompanhamento} />;
      case 'mobilidade': return acompanhamento.erro ? null : <CartaoMobilidade alunoId={a.id} acompanhamento={acompanhamento} />;
      case 'agua': return <CartaoAgua alunoId={a.id} comDieta={pode('DIETA_LER')} />;
      // Retorno ao aluno (Engajamento 0.5): treinos concluídos com o "Visto" e os recordes da semana.
      case 'treinosConcluidos': return <CartaoTreinosConcluidos alunoId={a.id} />;
      case 'recordesDaSemana': return <CartaoRecordesDaSemana alunoId={a.id} />;
      case 'evolucaoDasRespostas': return <CartaoEvolucaoRespostas alunoId={a.id} />;
      case 'progresso': return <CartaoProgresso alunoId={a.id} />;
      // A meta na chave: salvar outra meta na ficha busca o peso de novo, e as cores vêm da meta de cada item.
      case 'peso': return <CartaoPeso key={`${geracaoPeso}:${a.metaDoPeso ?? ''}`} alunoId={a.id} />;
      case 'avaliacaoFisica': return <CartaoAvaliacaoFisica alunoId={a.id} alunoNome={a.nome} anonimizado={a.anonimizado} />;
      case 'fotos': return <CartaoFotos alunoId={a.id} autorizadoEm={a.usoDeImagemAutorizadoEm} aoRecarregar={recarregar} />;
      case 'dadosDoAluno': return <Cartao><DadosDoAluno aluno={a} padrao={padrao} aoAlterar={definir} /></Cartao>;
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
        // No PC, Resumo e Atividade recente lado a lado; no celular, um embaixo do outro.
        <View style={estilos.colunas}>
          <View style={estilos.colunaResumo}>
            <ResumoDoAluno aluno={a} acompanhamento={acompanhamento} aoRenovar={renovacao.pedir} aoAnonimizado={recarregar}>
              {pode('ALUNO_SENSIVEL_LER') ? <PesoELesoesNoResumo alunoId={a.id} aoVerLesoes={() => setAba('ficha')} /> : null}
            </ResumoDoAluno>
          </View>
          <View style={estilos.colunaAtividade}>
            <AtividadeRecente alunoId={a.id} aoAbrirPasta={(p) => router.setParams({ pastaId: p })} />
          </View>
        </View>
      );
    }
    const lista = blocosDaAba(aba, contexto);
    const contagens = lista.filter((b) => CONTAGENS.includes(b));
    return (
      <>
        {/* Frequência, Mobilidade e Água são o mesmo tipo de contagem: lado a lado no PC, uma embaixo da outra no celular. */}
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
      <Cabecalho titulo={aluno?.nome ?? 'Aluno'} trilha={[{ rotulo: 'Alunos', href: '/treinador/alunos' }, { rotulo: aluno?.nome ?? 'Aluno' }]} voltar="/treinador/alunos"
        acoes={temMenu ? <IconeBotao Icone={Ellipsis} moldura rotulo="Mais ações do aluno" aoTocar={() => setMenu(true)} /> : undefined} />
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar}
        acao={{ rotulo: 'Voltar à lista', aoTocar: () => router.navigate('/treinador/alunos') }} /> : null}
      {!aluno && carregando ? <Esqueleto /> : null}
      {aluno ? (
        <>
          <Abas abas={ABAS_DA_FICHA.filter((a) => visiveis.includes(a.valor))} ativa={aba} aoMudar={setAba} ativacao="manual" />
          {conteudoDaAba(aluno)}
          {renovacao.painel}
          {menu ? (
            <FolhaDeAcoes titulo={aluno.nome} aoFechar={() => setMenu(false)} acoes={[
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
const CONTAGENS: readonly BlocoDaFicha[] = ['frequencia', 'mobilidade', 'agua'];

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
      aoCancelar={aoFechar}
    />
  );
}

/**
 * Dados do aluno, no cartão de cima da aba Ficha do aluno: só leitura em grade (Cadastro, Dados pessoais e Acompanhamento,
 * as mesmas seções do formulário) até "Editar", que abre o formulário ali mesmo. A foto de perfil se troca no próprio
 * círculo do topo do mesmo cartão (`FotoDePerfilEditavel`). O acesso ao app fica nessa mesma
 * área, numa linha (situação, e-mail de acesso e senha). O questionário de atualização também se troca no modo de
 * edição (fora dele é um campo de leitura, como os outros).
 * `?editar=1` (o lápis da lista de alunos) abre já editando, para quem pode editar, e sai do endereço na hora, como o
 * `?novo=1` do Planejamento: o voltar do navegador não tem passo sobrando.
 */
function DadosDoAluno({ aluno, padrao, aoAlterar }: { aluno: AlunoDetalhe; padrao: number | null; aoAlterar: (a: AlunoDetalhe) => void }) {
  const { pode } = useSessao();
  const { avisar } = useAviso();
  // "Cancelar" com algum campo mudado pergunta "Descartar alterações?" (não é sair da ficha). Sem alteração, fecha na hora.
  const { pendente } = useSaidaGuardada();
  const [editando, setEditando] = useState(false);
  const [descartar, setDescartar] = useState(false);
  const { editar } = useLocalSearchParams<{ editar?: string }>();
  const podeEditar = !aluno.anonimizado && pode('ALUNO_ALTERAR');
  useEffect(() => {
    if (editar !== '1') return;
    let vivo = true;
    void Promise.resolve().then(() => { if (!vivo) return; if (podeEditar) setEditando(true); router.setParams({ editar: undefined, aba: 'ficha' }); });
    return () => { vivo = false; };
  }, [editar, podeEditar]);
  return (
    <View style={estilos.dados}>
      <View style={estilos.tituloDados}>
        <Texto variante="bloco" nivel={2} style={estilos.titulo}>Dados do aluno</Texto>
        {editando || !podeEditar ? null : <Botao rotulo="Editar" tipo="secundario" Icone={Pencil} aoTocar={() => setEditando(true)} />}
      </View>
      {editando ? (
        <FormAluno
          inicial={aluno}
          diasPadrao={padrao}
          rotuloSalvar="Salvar"
          aoCancelar={() => { if (pendente()) setDescartar(true); else setEditando(false); }}
          // O questionário fica na seção Acompanhamento, mas grava na hora (não espera o Salvar), como antes.
          noAcompanhamento={<SeletorDeQuestionario rotulo="Questionário de atualização" valor={aluno.questionarioId} rotuloDoNulo="Padrão da consultoria" podeAlterar={pode('ALUNO_ALTERAR')}
            aoEscolher={async (questionarioId) => { aoAlterar(await escolherQuestionarioDoAluno(aluno.id, questionarioId)); avisar('Questionário trocado.', 'sucesso'); }} />}
          aoSalvar={async (dados) => {
            const a = await alterarAluno(aluno.id, dados);
            aoAlterar(a);
            setEditando(false);
            avisar('Dados salvos.', 'sucesso');
          }}
        />
      ) : (
        // As mesmas três seções do formulário de edição, para o que se lê estar onde se edita; no celular, uma embaixo da outra.
        <View style={estilos.grade}>
          <View style={estilos.colunaDados}>
            <Texto variante="secao">Cadastro</Texto>
            <CampoLeitura rotulo="E-mail" valor={aluno.email} />
            <CampoLeitura rotulo="Sexo" valor={rotuloDoSexo(aluno.sexo)} />
            <CampoLeitura rotulo="Telefone" valor={aluno.telefone} />
            {!aluno.temAcesso && !aluno.anonimizado ? <Texto variante="pequeno">{NOTA_TELEFONE_SEM_ACESSO}</Texto> : null}
            <Permitido codigo="ALUNO_SENSIVEL_LER"><CampoLeitura rotulo="Objetivo" valor={aluno.objetivo} /></Permitido>
          </View>
          <Permitido codigo="ALUNO_SENSIVEL_LER">
            <View style={estilos.colunaDados}>
              <Texto variante="secao">Dados pessoais</Texto>
              <CampoLeitura rotulo="CPF" valor={aluno.cpf} />
              <CampoLeitura rotulo="Endereço" valor={enderecoParaLeitura(aluno.endereco)} />
            </View>
          </Permitido>
          <View style={estilos.colunaDados}>
            <Texto variante="secao">Acompanhamento</Texto>
            <ResponsavelAluno id={aluno.responsavelId} />
            <CampoLeitura rotulo="Nova atualização a cada" valor={textoDoCiclo(aluno.diasAtualizacao, padrao)} numerico />
            <SeletorDeQuestionario rotulo="Questionário de atualização" valor={aluno.questionarioId} rotuloDoNulo="Padrão da consultoria" podeAlterar={false}
              aoEscolher={async () => {}} />
            <Permitido codigo="ALUNO_SENSIVEL_LER"><CampoLeitura rotulo="Meta do peso" valor={textoDaMeta(aluno.metaDoPeso)} /></Permitido>
            <Permitido codigo="ALUNO_SENSIVEL_LER"><CampoLeitura rotulo="Observações" valor={aluno.observacoes} /></Permitido>
            <LinhaDoCicloNaFicha alunoId={aluno.id} />
          </View>
        </View>
      )}
      <PainelConfirmacao
        visivel={descartar}
        titulo="Descartar alterações?"
        mensagem="Há alterações que ainda não foram salvas. Se descartar agora, elas serão perdidas."
        rotuloConfirmar="Descartar"
        rotuloCancelar="Continuar editando"
        perigo
        aoConfirmar={() => { setDescartar(false); setEditando(false); }}
        aoCancelar={() => setDescartar(false)}
      />
      <CartaoAcesso aluno={aluno} aoAlterar={aoAlterar} />
    </View>
  );
}

const estilos = StyleSheet.create({
  dados: { gap: espaco(1.5) },
  tituloDados: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: espaco(1) },
  titulo: { flexShrink: 1 },
  grade: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espaco(3), rowGap: espaco(2) },
  colunaDados: { flexBasis: 260, flexGrow: 1, flexShrink: 1, minWidth: 0, gap: espaco(1.5) },
  contagens: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(3) },
  colunas: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(3), alignItems: 'flex-start' },
  colunaResumo: { flexGrow: 3, flexShrink: 1, flexBasis: 520, minWidth: 0 },
  colunaAtividade: { flexGrow: 2, flexShrink: 1, flexBasis: 360, minWidth: 0 },
  contagem: { flexGrow: 1, flexShrink: 1, flexBasis: 420, minWidth: 0 },
});
