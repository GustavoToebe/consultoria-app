import { useSessao } from '../../../sessao/SessaoProvider';
import { Permitido } from '../../../ui/Permitido';
import { useLocalSearchParams } from 'expo-router';
import { Pencil } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { aluno as buscarAluno, alterarAluno, alterarSituacaoAluno, baixarFotoDePerfilDoAluno, consultoria as buscarConsultoria, escolherQuestionarioDoAluno } from '../../../api/rotas';
import { cicloDoAluno, textoDoCiclo } from '../../../dominio/periodo';
import type { AlunoDetalhe } from '../../../api/tipos';
import { FotoDePerfil } from '../../../ui/FotoDePerfil';
import { espaco, LARGURA_LISTA } from '../../../tema/tokens';
import { CartaoAcesso } from '../../../treinador/CartaoAcesso';
import { CartaoEvolucaoRespostas } from '../../../treinador/CartaoEvolucaoRespostas';
import { CartaoFrequencia } from '../../../treinador/CartaoFrequencia';
import { CartaoPeso } from '../../../treinador/CartaoPeso';
import { CartaoProgresso } from '../../../treinador/CartaoProgresso';
import { CartaoLesoes } from '../../../treinador/CartaoLesoes';
import { CartaoPastas } from '../../../treinador/CartaoPastas';
import { CartaoAnamnese } from '../../../treinador/anamnese/CartaoAnamnese';
import { FormAluno } from '../../../treinador/FormAluno';
import { AcoesDePrivacidade } from '../../../treinador/privacidade/AcoesDePrivacidade';
import { ResponsavelAluno } from '../../../treinador/equipe/ResponsavelAluno';
import { SeletorDeQuestionario } from '../../../treinador/questionarios/SeletorDeQuestionario';
import { useAviso } from '../../../ui/Aviso';
import { Botao } from '../../../ui/Botao';
import { Cabecalho } from '../../../ui/Cabecalho';
import { CampoLeitura } from '../../../ui/CampoLeitura';
import { Cartao } from '../../../ui/Cartao';
import { Esqueleto } from '../../../ui/Esqueleto';
import { MensagemErro } from '../../../ui/Estados';
import { textoDoErro } from '../../../ui/erros';
import { useAvisoDoPlano } from '../../../ui/useAvisoDoPlano';
import { PainelConfirmacao } from '../../../ui/PainelConfirmacao';
import { Selo } from '../../../ui/Selo';
import { Tela } from '../../../ui/Tela';
import { Texto } from '../../../ui/Texto';
import { useCarregar } from '../../../ui/useCarregar';

/** Ficha do aluno: cada bloco em um cartão com os próprios botões. */
export default function FichaAluno() {
  const { id, pastaId } = useLocalSearchParams<{ id: string; pastaId?: string }>();
  const { pode } = useSessao();
  const { dados: aluno, erro, carregando, recarregar, definir } = useCarregar(id ?? null, (i) => buscarAluno(i));
  // Ciclo padrão da consultoria (V009). Quem não pode ler a consultoria fica só com o do aluno.
  const padrao = useCarregar('consultoria-ciclo', () => buscarConsultoria().then((c) => c.diasAtualizacaoPadrao ?? null, () => null)).dados ?? null;
  // Finalizar uma pasta ou aplicar uma alteração da anamnese pode gravar peso: o cartão de peso é remontado para buscar de novo.
  const [geracaoPeso, setGeracaoPeso] = useState(0);
  // A partir de 1.100 px: Dados à esquerda; Acesso e Lesões à direita. O resto vem em largura cheia.
  const { width } = useWindowDimensions();
  const duasColunas = width >= 1100;

  return (
    <Tela bordas={['top']} largura={LARGURA_LISTA}>
      <Cabecalho titulo={aluno?.nome ?? 'Aluno'} trilha={[{ rotulo: 'Alunos', href: '/treinador/alunos' }, { rotulo: aluno?.nome ?? 'Aluno' }]} voltar="/treinador/alunos" />
      <Texto variante="suave">Dados, acesso, pastas de plano e evolução do aluno em um só lugar.</Texto>
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {!aluno && carregando ? <Esqueleto /> : null}
      {aluno ? (
        <>
          {duasColunas ? (
            <View style={estilos.colunas}>
              <View style={estilos.coluna}>
                <CartaoDados aluno={aluno} padrao={padrao} aoAlterar={definir} />
              </View>
              <View style={estilos.coluna}>
                <CartaoAcesso aluno={aluno} />
                <Permitido codigo="ALUNO_SENSIVEL_LER"><CartaoLesoes alunoId={aluno.id} /></Permitido>
              </View>
            </View>
          ) : (
            <>
              <CartaoDados aluno={aluno} padrao={padrao} aoAlterar={definir} />
              <CartaoAcesso aluno={aluno} />
              <Permitido codigo="ALUNO_SENSIVEL_LER"><CartaoLesoes alunoId={aluno.id} /></Permitido>
            </>
          )}
          {pode('ANAMNESE_LER') && pode('ALUNO_SENSIVEL_LER') ? <CartaoAnamnese alunoId={aluno.id} anonimizado={aluno.anonimizado}
            aoMudarCadastro={() => { recarregar(); setGeracaoPeso((g) => g + 1); }} /> : null}
          <CartaoPastas key={`${aluno.id}:${pastaId??''}`} pastaInicialId={pastaId} alunoId={aluno.id} alunoNome={aluno.nome} diasAtualizacao={cicloDoAluno(aluno.diasAtualizacao, padrao)} aoGravarPeso={() => setGeracaoPeso((g) => g + 1)} />
          <Permitido codigo="REGISTRO_LER"><CartaoFrequencia alunoId={aluno.id} /></Permitido>
          <Permitido codigo="REGISTRO_LER"><CartaoProgresso alunoId={aluno.id} /></Permitido>
          <Permitido codigo="ALUNO_SENSIVEL_LER"><CartaoPeso key={geracaoPeso} alunoId={aluno.id} /></Permitido>
          {pode('ATUALIZACAO_LER') && pode('ALUNO_SENSIVEL_LER') ? <CartaoEvolucaoRespostas alunoId={aluno.id} /> : null}
        </>
      ) : null}
    </Tela>
  );
}

function CartaoDados({ aluno, padrao, aoAlterar }: { aluno: AlunoDetalhe; padrao: number | null; aoAlterar: (a: AlunoDetalhe) => void }) {
  const {pode}=useSessao();
  const { avisar } = useAviso();
  const avisarDoPlano = useAvisoDoPlano();
  const [editando, setEditando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [mudando, setMudando] = useState(false);

  const mudarSituacao = () => {
    setMudando(true);
    alterarSituacaoAluno(aluno.id, !aluno.ativo).then(
      (a) => {
        setMudando(false);
        setConfirmar(false);
        aoAlterar(a);
        avisar(a.ativo ? 'Aluno reativado.' : 'Aluno inativado. O acesso ao app foi encerrado.', 'sucesso');
      },
      (e: unknown) => {
        setMudando(false);
        setConfirmar(false);
        if (!avisarDoPlano(e)) avisar(textoDoErro(e), 'perigo');
      },
    );
  };

  return (
    <Cartao
      titulo="Dados"
      descricao="Cadastro do aluno e responsável pelo acompanhamento."
      acoes={
        editando || aluno.anonimizado || !pode("ALUNO_ALTERAR") ? null : <Permitido codigo="ALUNO_ALTERAR"><Botao rotulo="Editar" tipo="secundario" Icone={Pencil} aoTocar={() => setEditando(true)} /></Permitido>
      }>
      {editando ? (
        <FormAluno
          inicial={aluno}
          rotuloSalvar="Salvar"
          aoCancelar={() => setEditando(false)}
          aoSalvar={async (dados) => {
            const a = await alterarAluno(aluno.id, dados);
            aoAlterar(a);
            setEditando(false);
            avisar('Dados salvos.', 'sucesso');
          }}
        />
      ) : (
        <View style={estilos.dados}>
          <View style={estilos.identidade}>
            <FotoDePerfil chave={`perfil:${aluno.id}`} carregar={() => baixarFotoDePerfilDoAluno(aluno.id)} nome={aluno.nome} tamanho={56} />
            <Selo texto={aluno.anonimizado ? 'Anonimizado' : aluno.ativo ? 'Ativo' : 'Inativo'} tipo={aluno.ativo && !aluno.anonimizado ? 'sucesso' : 'neutro'} />
          </View>
          <CampoLeitura rotulo="E-mail" valor={aluno.email} />
          <ResponsavelAluno id={aluno.responsavelId}/>
          <Permitido codigo="ALUNO_SENSIVEL_LER"><CampoLeitura rotulo="Objetivo" valor={aluno.objetivo} /></Permitido>
          <CampoLeitura rotulo="Nova atualização a cada" valor={textoDoCiclo(aluno.diasAtualizacao, padrao)} numerico />
          <SeletorDeQuestionario rotulo="Questionário de atualização" valor={aluno.questionarioId} rotuloDoNulo="Padrão da consultoria" podeAlterar={pode('ALUNO_ALTERAR')}
            aoEscolher={async (questionarioId) => { aoAlterar(await escolherQuestionarioDoAluno(aluno.id, questionarioId)); }} />
          <Permitido codigo="ALUNO_SENSIVEL_LER"><CampoLeitura rotulo="Observações" valor={aluno.observacoes} /></Permitido>
          <View style={estilos.botoes}>
            {aluno.anonimizado ? null : <Permitido codigo="ALUNO_ALTERAR"><Botao
              rotulo={aluno.ativo ? 'Inativar aluno' : 'Reativar aluno'}
              tipo={aluno.ativo ? 'perigoTexto' : 'secundario'}
              aoTocar={() => setConfirmar(true)}
            /></Permitido>}
          </View>
          <AcoesDePrivacidade aluno={aluno} aoAnonimizar={aoAlterar} />
        </View>
      )}
      <PainelConfirmacao
        visivel={confirmar}
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
        aoCancelar={() => setConfirmar(false)}
      />
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  colunas: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(3) },
  coluna: { flex: 1, gap: espaco(3) },
  dados: { gap: espaco(1.5) },
  identidade: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5) },
  botoes: { flexDirection: 'row', justifyContent: 'flex-end' },
});
