import { House, Palette, UserRound, Users } from 'lucide-react-native';

import { GuardaDePapel } from '../../ui/GuardaDePapel';
import { Navegacao, type ItemMenu } from '../../ui/Navegacao';

/** Só aparecem no menu as telas que já existem (nada de recurso fingido). */
const ITENS: ItemMenu[] = [
  { rotulo: 'Início', href: '/treinador', caminho: '/treinador', Icone: House, exato: true },
  { rotulo: 'Alunos', href: '/treinador/alunos', caminho: '/treinador/alunos', Icone: Users },
  { rotulo: 'Marca', href: '/treinador/marca', caminho: '/treinador/marca', Icone: Palette },
  { rotulo: 'Perfil', href: '/treinador/perfil', caminho: '/treinador/perfil', Icone: UserRound },
];

export default function LayoutTreinador() {
  return (
    <GuardaDePapel papel="TREINADOR">
      <Navegacao itens={ITENS} />
    </GuardaDePapel>
  );
}
