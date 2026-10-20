import { router } from 'expo-router';

import { consultoria, criarAluno } from '../../../api/rotas';
import { FormAluno } from '../../../treinador/FormAluno';
import { useAviso } from '../../../ui/Aviso';
import { Cabecalho } from '../../../ui/Cabecalho';
import { Cartao } from '../../../ui/Cartao';
import { Tela } from '../../../ui/Tela';
import { Texto } from '../../../ui/Texto';
import { useCarregar } from '../../../ui/useCarregar';

export default function NovoAluno() {
  const { avisar } = useAviso();
  // Ciclo padrão da consultoria, mostrado no campo vazio; quem não pode ler a consultoria fica sem a dica.
  const padrao = useCarregar('consultoria-ciclo', () => consultoria().then((c) => c.diasAtualizacaoPadrao ?? null, () => null)).dados ?? null;
  return (
    <Tela bordas={['top']} largura={640}>
      <Cabecalho titulo="Novo aluno" voltar="/treinador/alunos" trilha={[{ rotulo: 'Alunos', href: '/treinador/alunos' }, { rotulo: 'Novo aluno' }]} />
      <Texto variante="suave">Cadastre o aluno; depois gere o convite para ele entrar no app.</Texto>
      <Cartao>
        <FormAluno
          rotuloSalvar="Cadastrar"
          diasPadrao={padrao}
          aoCancelar={() => router.back()}
          aoSalvar={async (dados) => {
            const aluno = await criarAluno(dados);
            avisar('Aluno cadastrado. Gere o convite em “Acesso ao app”, na ficha.', 'sucesso');
            router.replace(`/treinador/alunos/${aluno.id}`);
          }}
        />
      </Cartao>
    </Tela>
  );
}
