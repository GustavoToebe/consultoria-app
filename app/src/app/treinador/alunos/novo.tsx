import { router } from 'expo-router';
import { useWindowDimensions } from 'react-native';

import { consultoria, criarAluno } from '../../../api/rotas';
import { espaco, LARGURA_MENU_LATERAL } from '../../../tema/tokens';
import { FormAluno } from '../../../treinador/FormAluno';
import { useAviso } from '../../../ui/Aviso';
import { Cabecalho } from '../../../ui/Cabecalho';
import { useSaidaGuardada, useSairSemPerguntar } from '../../../ui/GuardaDeSaida';
import { Tela } from '../../../ui/Tela';
import { useCarregar } from '../../../ui/useCarregar';

/**
 * Novo aluno. No PC usa a largura útil (como Números); o formulário traz as mesmas quatro seções da ficha (cartões com
 * título, h2 logo abaixo do h1), na mesma regra dos Dados do aluno: duas colunas de 420 px que descem para uma quando não
 * cabem, na mesma ordem.
 */
export default function NovoAluno() {
  const { width } = useWindowDimensions();
  const { avisar } = useAviso();
  const { confirmar } = useSaidaGuardada();
  const sairSemPerguntar = useSairSemPerguntar();
  const lista = '/treinador/alunos' as const;
  // Ciclo padrão da consultoria, mostrado no campo vazio; quem não pode ler a consultoria fica sem a dica.
  const padrao = useCarregar('consultoria-ciclo', () => consultoria().then((c) => c.diasAtualizacaoPadrao ?? null, () => null)).dados ?? null;
  return (
    <Tela bordas={['top']} folga={width >= LARGURA_MENU_LATERAL ? espaco(3.5) : undefined}>
      <Cabecalho titulo="Novo aluno" descricao="Cadastre o aluno e, depois, gere o convite para ele entrar no app. Só o nome e o e-mail são obrigatórios." voltar="/treinador/alunos" trilha={[{ rotulo: 'Alunos', href: '/treinador/alunos' }, { rotulo: 'Novo aluno' }]} />
      <FormAluno
        rotuloSalvar="Cadastrar"
        diasPadrao={padrao}
        aoCancelar={() => confirmar(() => (router.canGoBack() ? router.back() : router.replace(lista)))}
        aoSalvar={async (dados) => {
          const aluno = await criarAluno(dados);
          avisar('Aluno cadastrado. Gere o convite em “Acesso ao app”, na ficha.', 'sucesso');
          // Cadastrado: a guarda do formulário ainda está montada, mas não há mais o que perder.
          sairSemPerguntar(() => router.replace(`/treinador/alunos/${aluno.id}`));
        }}
      />
    </Tela>
  );
}
