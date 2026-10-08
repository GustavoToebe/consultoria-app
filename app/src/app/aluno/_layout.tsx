import { CalendarDays, Dumbbell, Salad, UserRound } from 'lucide-react-native';

import { AlunoProvider } from '../../offline/AlunoProvider';
import { useSessao } from '../../sessao/SessaoProvider';
import { GuardaDePapel } from '../../ui/GuardaDePapel';
import { Navegacao, type ItemMenu } from '../../ui/Navegacao';

/** Aluno: barra inferior sempre (uso principal é no celular). */
const ITENS: ItemMenu[] = [
  { rotulo: 'Treino', href: '/aluno', caminho: '/aluno', Icone: Dumbbell, exato: true },
  { rotulo: 'Dieta', href: '/aluno/dieta', caminho: '/aluno/dieta', Icone: Salad },
  { rotulo: 'Histórico', href: '/aluno/historico', caminho: '/aluno/historico', Icone: CalendarDays },
  { rotulo: 'Conta', href: '/aluno/conta', caminho: '/aluno/conta', Icone: UserRound },
];

export default function LayoutAluno() {
  const { usuario } = useSessao();
  return (
    <GuardaDePapel papel="ALUNO">
      {usuario ? (
        // Um provedor por usuário: trocar de conta nunca mistura registros.
        <AlunoProvider key={usuario.id} usuarioId={usuario.id}>
          <Navegacao itens={ITENS} sempreInferior />
        </AlunoProvider>
      ) : null}
    </GuardaDePapel>
  );
}
