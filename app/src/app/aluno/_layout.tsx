import { Dumbbell, UserRound } from 'lucide-react-native';

import { GuardaDePapel } from '../../ui/GuardaDePapel';
import { Navegacao, type ItemMenu } from '../../ui/Navegacao';

/** Aluno: barra inferior sempre (uso principal é no celular). Dieta e Histórico entram na fase 6. */
const ITENS: ItemMenu[] = [
  { rotulo: 'Treino', href: '/aluno', caminho: '/aluno', Icone: Dumbbell, exato: true },
  { rotulo: 'Conta', href: '/aluno/conta', caminho: '/aluno/conta', Icone: UserRound },
];

export default function LayoutAluno() {
  return (
    <GuardaDePapel papel="ALUNO">
      <Navegacao itens={ITENS} sempreInferior />
    </GuardaDePapel>
  );
}
