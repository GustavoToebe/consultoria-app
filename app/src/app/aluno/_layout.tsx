import { BarraDescanso } from '../../aluno/BarraDescanso';
import { CalendarDays, Dumbbell, Salad, UserRound } from 'lucide-react-native';

import { AlunoProvider, useAluno } from '../../offline/AlunoProvider';
import { faseAtualizacao, temAcaoAtualizacao } from '../../dominio/atualizacao';
import { hojeIso } from '../../dominio/formatos';
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
          <MenuAluno />
        </AlunoProvider>
      ) : null}
    </GuardaDePapel>
  );
}

function MenuAluno() {
  const {atualizacao}=useAluno();
  const ponto=!!atualizacao && temAcaoAtualizacao({...atualizacao,...faseAtualizacao(hojeIso(),atualizacao.dataAtualizacao,atualizacao.atrasoAte,atualizacao.fase)});
  return <Navegacao itens={ITENS.map(item=>item.caminho==='/aluno'?{...item,ponto}:item)} sempreInferior rodape={<BarraDescanso />} />;
}
