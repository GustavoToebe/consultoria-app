import { useSessao } from '../../../sessao/SessaoProvider';
import { Permitido } from '../../../ui/Permitido';
import { useLocalSearchParams } from 'expo-router';
import { Pencil } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { aluno as buscarAluno, alterarAluno, alterarSituacaoAluno } from '../../../api/rotas';
import type { AlunoDetalhe } from '../../../api/tipos';
import { espaco, LARGURA_LISTA } from '../../../tema/tokens';
import { CartaoAcesso } from '../../../treinador/CartaoAcesso';
import { CartaoAtualizacoes } from '../../../treinador/CartaoAtualizacoes';
import { CartaoPeso } from '../../../treinador/CartaoPeso';
import { CartaoLesoes } from '../../../treinador/CartaoLesoes';
import { CartaoPastas } from '../../../treinador/CartaoPastas';
import { CartaoRegistros } from '../../../treinador/CartaoRegistros';
import { FormAluno } from '../../../treinador/FormAluno';
import { useAviso } from '../../../ui/Aviso';
import { Botao } from '../../../ui/Botao';
import { Cabecalho } from '../../../ui/Cabecalho';
import { Cartao } from '../../../ui/Cartao';
import { Esqueleto } from '../../../ui/Esqueleto';
import { MensagemErro } from '../../../ui/Estados';
import { textoDoErro } from '../../../ui/erros';
import { PainelConfirmacao } from '../../../ui/PainelConfirmacao';
import { Selo } from '../../../ui/Selo';
import { Tela } from '../../../ui/Tela';
import { Texto } from '../../../ui/Texto';
import { useCarregar } from '../../../ui/useCarregar';

/** Ficha do aluno: cada bloco em um cartão com os próprios botões (seção 10.4). */
export default function FichaAluno() {
  const { id, pastaId } = useLocalSearchParams<{ id: string; pastaId?: string }>();
  const { dados: aluno, erro, carregando, recarregar, definir } = useCarregar(id ?? null, (i) => buscarAluno(i));
  // Finalizar uma pasta pode gravar peso: o cartão de peso é remontado para buscar de novo.
  const [geracaoPeso, setGeracaoPeso] = useState(0);
  // A partir de 1.100 px: Dados à esquerda; Acesso e Lesões à direita. O resto vem em largura cheia.
  const { width } = useWindowDimensions();
  const duasColunas = width >= 1100;

  return (
    <Tela bordas={['top']} largura={LARGURA_LISTA}>
      <Cabecalho titulo={aluno?.nome ?? 'Aluno'} trilha={[{ rotulo: 'Alunos', href: '/treinador/alunos' }, { rotulo: aluno?.nome ?? 'Aluno' }]} voltar="/treinador/alunos" />
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {!aluno && carregando ? <Esqueleto /> : null}
      {aluno ? (
        <>
          {duasColunas ? (
            <View style={estilos.colunas}>
              <View style={estilos.coluna}>
                <CartaoDados aluno={aluno} aoAlterar={definir} />
              </View>
              <View style={estilos.coluna}>
                <CartaoAcesso aluno={aluno} />
                <Permitido codigo="ALUNO_SENSIVEL_LER"><CartaoLesoes alunoId={aluno.id} /></Permitido>
              </View>
            </View>
          ) : (
            <>
              <CartaoDados aluno={aluno} aoAlterar={definir} />
              <CartaoAcesso aluno={aluno} />
              <Permitido codigo="ALUNO_SENSIVEL_LER"><CartaoLesoes alunoId={aluno.id} /></Permitido>
            </>
          )}
          <CartaoPastas key={`${aluno.id}:${pastaId??''}`} pastaInicialId={pastaId} alunoId={aluno.id} diasAtualizacao={aluno.diasAtualizacao} aoGravarPeso={() => setGeracaoPeso((g) => g + 1)} />
          <Permitido codigo="REGISTRO_LER"><CartaoRegistros aluno={aluno} /></Permitido>
          <Permitido codigo="ATUALIZACAO_LER"><CartaoAtualizacoes alunoId={aluno.id} /></Permitido>
          <Permitido codigo="ALUNO_SENSIVEL_LER"><CartaoPeso key={geracaoPeso} alunoId={aluno.id} /></Permitido>
        </>
      ) : null}
    </Tela>
  );
}

function CartaoDados({ aluno, aoAlterar }: { aluno: AlunoDetalhe; aoAlterar: (a: AlunoDetalhe) => void }) {
  const {pode}=useSessao();
  const { avisar } = useAviso();
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
        avisar(textoDoErro(e), 'perigo');
      },
    );
  };

  return (
    <Cartao
      titulo="Dados"
      acoes={
        editando || !pode("ALUNO_ALTERAR") ? null : <Permitido codigo="ALUNO_ALTERAR"><Botao rotulo="Editar" tipo="secundario" Icone={Pencil} aoTocar={() => setEditando(true)} /></Permitido>
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
          <Selo texto={aluno.ativo ? 'Ativo' : 'Inativo'} tipo={aluno.ativo ? 'sucesso' : 'neutro'} />
          <Linha rotulo="E-mail" valor={aluno.email} />
          <Permitido codigo="ALUNO_SENSIVEL_LER"><Linha rotulo="Objetivo" valor={aluno.objetivo} /></Permitido>
          <Linha rotulo="Nova atualização a cada" valor={aluno.diasAtualizacao ? `${aluno.diasAtualizacao} dias` : null} />
          <Permitido codigo="ALUNO_SENSIVEL_LER"><Linha rotulo="Observações" valor={aluno.observacoes} /></Permitido>
          <View style={estilos.botoes}>
            <Permitido codigo="ALUNO_ALTERAR"><Botao
              rotulo={aluno.ativo ? 'Inativar aluno' : 'Reativar aluno'}
              tipo={aluno.ativo ? 'perigoTexto' : 'secundario'}
              aoTocar={() => setConfirmar(true)}
            /></Permitido>
          </View>
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

function Linha({ rotulo, valor }: { rotulo: string; valor: string | null | undefined }) {
  return (
    <View style={estilos.linha}>
      <Texto variante="pequeno">{rotulo}</Texto>
      <Texto>{valor || '—'}</Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  colunas: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(3) },
  coluna: { flex: 1, gap: espaco(3) },
  dados: { gap: espaco(1.25) },
  linha: { gap: 2 },
  botoes: { flexDirection: 'row', justifyContent: 'flex-end' },
});
