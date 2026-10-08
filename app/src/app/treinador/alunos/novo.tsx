import { router } from 'expo-router';

import { criarAluno } from '../../../api/rotas';
import { FormAluno } from '../../../treinador/FormAluno';
import { useAviso } from '../../../ui/Aviso';
import { Cabecalho } from '../../../ui/Cabecalho';
import { Cartao } from '../../../ui/Cartao';
import { Tela } from '../../../ui/Tela';

export default function NovoAluno() {
  const { avisar } = useAviso();
  return (
    <Tela bordas={['top']} largura={640}>
      <Cabecalho titulo="Novo aluno" voltar="/treinador/alunos" />
      <Cartao>
        <FormAluno
          rotuloSalvar="Cadastrar"
          aoCancelar={() => router.back()}
          aoSalvar={async (dados) => {
            const aluno = await criarAluno(dados);
            avisar('Aluno cadastrado. Gere o convite para ele entrar no app.', 'sucesso');
            router.replace(`/treinador/alunos/${aluno.id}`);
          }}
        />
      </Cartao>
    </Tela>
  );
}
