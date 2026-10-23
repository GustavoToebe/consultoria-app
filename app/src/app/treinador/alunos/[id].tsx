import { useSessao } from '../../../sessao/SessaoProvider';
import { Permitido } from '../../../ui/Permitido';
import { useLocalSearchParams } from 'expo-router';
import { Ellipsis, Pencil, UserCheck, UserMinus } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { aluno as buscarAluno, alterarAluno, alterarSituacaoAluno, consultoria as buscarConsultoria, escolherQuestionarioDoAluno } from '../../../api/rotas';
import { enderecoParaLeitura, NOTA_TELEFONE_SEM_ACESSO } from '../../../dominio/cadastroDoAluno';
import { cicloDoAluno, textoDoCiclo } from '../../../dominio/periodo';
import type { AlunoDetalhe } from '../../../api/tipos';
import { espaco, LARGURA_LISTA } from '../../../tema/tokens';
import { CartaoAcesso } from '../../../treinador/CartaoAcesso';
import { CartaoEvolucaoRespostas } from '../../../treinador/CartaoEvolucaoRespostas';
import { CartaoFrequencia, useAcompanhamentoDoAluno } from '../../../treinador/CartaoFrequencia';
import { CartaoMobilidade } from '../../../treinador/CartaoMobilidade';
import { FolhaDeAcoes } from '../../../treinador/FolhaDeAcoes';
import { ResumoDoAluno } from '../../../treinador/ResumoDoAluno';
import { CartaoPeso } from '../../../treinador/CartaoPeso';
import { CartaoFotos } from '../../../fotos/CartaoFotos';
import { CartaoProgresso } from '../../../treinador/CartaoProgresso';
import { CartaoLesoes } from '../../../treinador/CartaoLesoes';
import { CartaoPastas, useRenovarPasta } from '../../../treinador/CartaoPastas';
import { CartaoAnamnese } from '../../../treinador/anamnese/CartaoAnamnese';
import { CartaoPlanoContratado } from '../../../treinador/financeiro/CartaoPlanoContratado';
import { FormAluno } from '../../../treinador/FormAluno';
import { AcoesDePrivacidade } from '../../../treinador/privacidade/AcoesDePrivacidade';
import { ResponsavelAluno } from '../../../treinador/equipe/ResponsavelAluno';
import { SeletorDeQuestionario } from '../../../treinador/questionarios/SeletorDeQuestionario';
import { useAviso } from '../../../ui/Aviso';
import { Botao } from '../../../ui/Botao';
import { Cabecalho } from '../../../ui/Cabecalho';
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
 * Ficha do aluno, na ordem do uso diário: no cartão de cima o resumo com o próximo passo e os dados do aluno (com
 * "Editar" ali mesmo, e o acesso ao app nessa mesma área); depois pastas (planos e atualização do período),
 * frequência, progresso, peso, evolução das respostas e lesões; anamnese vem no fim. Ações raras (inativar, exportar,
 * anonimizar) ficam no menu ⋯ do cabeçalho.
 */
export default function FichaAluno() {
  const { id, pastaId } = useLocalSearchParams<{ id: string; pastaId?: string }>();
  const { pode, pagamentosHabilitados } = useSessao();
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
  const temMenu = !!aluno && ((pode('ALUNO_ALTERAR') && !aluno.anonimizado) || pode('ALUNO_EXPORTAR') || (pode('ALUNO_ANONIMIZAR') && !aluno.ativo && !aluno.anonimizado));

  return (
    <Tela bordas={['top']} largura={LARGURA_LISTA}>
      <Cabecalho titulo={aluno?.nome ?? 'Aluno'} trilha={[{ rotulo: 'Alunos', href: '/treinador/alunos' }, { rotulo: aluno?.nome ?? 'Aluno' }]} voltar="/treinador/alunos"
        acoes={temMenu ? <IconeBotao Icone={Ellipsis} rotulo="Mais ações do aluno" aoTocar={() => setMenu(true)} /> : undefined} />
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {!aluno && carregando ? <Esqueleto /> : null}
      {aluno ? (
        <>
          <ResumoDoAluno aluno={aluno} acompanhamento={acompanhamento} aoRenovar={renovacao.pedir}>
            <DadosDoAluno aluno={aluno} padrao={padrao} aoAlterar={definir} />
          </ResumoDoAluno>
          <CartaoPastas key={`${aluno.id}:${pastaId??''}`} pastaInicialId={pastaId} alunoId={aluno.id} alunoNome={aluno.nome} diasAtualizacao={cicloDoAluno(aluno.diasAtualizacao, padrao)}
            geracao={geracaoPastas} aoMudar={mudouPastas} aoGravarPeso={() => setGeracaoPeso((g) => g + 1)} />
          {/* Frequência e Mobilidade são o mesmo tipo de contagem (semana e pasta): lado a lado no PC, uma embaixo da outra no celular. */}
          {pode('REGISTRO_LER') ? (
            <View style={estilos.contagens}>
              <View style={estilos.contagem}><CartaoFrequencia acompanhamento={acompanhamento} /></View>
              {pode('TREINO_LER') && !acompanhamento.erro ? <View style={estilos.contagem}><CartaoMobilidade alunoId={aluno.id} acompanhamento={acompanhamento} /></View> : null}
            </View>
          ) : null}
          <Permitido codigo="REGISTRO_LER"><CartaoProgresso alunoId={aluno.id} /></Permitido>
          <Permitido codigo="ALUNO_SENSIVEL_LER"><CartaoPeso key={geracaoPeso} alunoId={aluno.id} /></Permitido>
          {pode('ATUALIZACAO_LER') && pode('ALUNO_SENSIVEL_LER') ? (
            <CartaoFotos alunoId={aluno.id} autorizadoEm={aluno.usoDeImagemAutorizadoEm} aoRecarregar={recarregar} />
          ) : null}
          {pode('ATUALIZACAO_LER') && pode('ALUNO_SENSIVEL_LER') ? <CartaoEvolucaoRespostas alunoId={aluno.id} /> : null}
          <Permitido codigo="ALUNO_SENSIVEL_LER"><CartaoLesoes alunoId={aluno.id} /></Permitido>
          {pode('ANAMNESE_LER') && pode('ALUNO_SENSIVEL_LER') ? <CartaoAnamnese alunoId={aluno.id} anonimizado={aluno.anonimizado}
            aoMudarCadastro={() => { recarregar(); setGeracaoPeso((g) => g + 1); }} /> : null}
          {pagamentosHabilitados && pode('FINANCEIRO_LER') ? <CartaoPlanoContratado alunoId={aluno.id} ativo={aluno.ativo} anonimizado={aluno.anonimizado} /> : null}
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
 * Dados do aluno, dentro do cartão de cima da ficha: só leitura em grade (Cadastro, Dados pessoais e Acompanhamento,
 * as mesmas seções do formulário) até "Editar", que abre o formulário ali mesmo. O acesso ao app fica nessa mesma
 * área, numa linha (situação, e-mail de acesso e senha). O questionário de atualização também se troca no modo de
 * edição (fora dele é um campo de leitura, como os outros).
 */
function DadosDoAluno({ aluno, padrao, aoAlterar }: { aluno: AlunoDetalhe; padrao: number | null; aoAlterar: (a: AlunoDetalhe) => void }) {
  const { pode } = useSessao();
  const { avisar } = useAviso();
  const [editando, setEditando] = useState(false);
  return (
    <View style={estilos.dados}>
      <View style={estilos.tituloDados}>
        <Texto variante="bloco" nivel={2} style={estilos.titulo}>Dados do aluno</Texto>
        {editando || aluno.anonimizado || !pode('ALUNO_ALTERAR') ? null : <Botao rotulo="Editar" tipo="secundario" Icone={Pencil} aoTocar={() => setEditando(true)} />}
      </View>
      {editando ? (
        <FormAluno
          inicial={aluno}
          diasPadrao={padrao}
          rotuloSalvar="Salvar"
          aoCancelar={() => setEditando(false)}
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
            <Permitido codigo="ALUNO_SENSIVEL_LER"><CampoLeitura rotulo="Observações" valor={aluno.observacoes} /></Permitido>
          </View>
        </View>
      )}
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
  contagem: { flexGrow: 1, flexShrink: 1, flexBasis: 420, minWidth: 0 },
});
