import { BarraDescanso } from '../../aluno/BarraDescanso';
import { CalendarDays, Dumbbell, PersonStanding, Salad, UserRound } from 'lucide-react-native';

import { AlunoProvider, useAluno } from '../../offline/AlunoProvider';
import { faseAtualizacao, temAcaoAtualizacao } from '../../dominio/atualizacao';
import { hojeIso } from '../../dominio/formatos';
import { temAbaMobilidade } from '../../dominio/mobilidade';
import { useSessao } from '../../sessao/SessaoProvider';
import { GuardaDePapel } from '../../ui/GuardaDePapel';
import { Navegacao, type ItemMenu } from '../../ui/Navegacao';

/** Aluno: barra inferior sempre (uso principal é no celular). */
const ITENS: ItemMenu[] = [
  { rotulo: 'Treino', href: '/aluno', caminho: '/aluno', Icone: Dumbbell, exato: true },
  { rotulo: 'Dieta', href: '/aluno/dieta', caminho: '/aluno/dieta', Icone: Salad },
  // Só aparece com mobilidade publicada (veja MenuAluno); fica antes do Histórico para a barra de 5 abas.
  { rotulo: 'Mobilidade', href: '/aluno/mobilidade', caminho: '/aluno/mobilidade', Icone: PersonStanding },
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
  const {atualizacao,mobilidade,escolhida}=useAluno();
  const comMobilidade=temAbaMobilidade(mobilidade,escolhida?{mobilidade:escolhida.planos.mobilidade}:null);
  const ponto=!!atualizacao && temAcaoAtualizacao({...atualizacao,...faseAtualizacao(hojeIso(),atualizacao.dataAtualizacao,atualizacao.atrasoAte,atualizacao.fase)});
  return <Navegacao itens={ITENS.filter(item=>item.caminho!=='/aluno/mobilidade'||comMobilidade).map(item=>item.caminho==='/aluno'?{...item,ponto}:item)} sempreInferior larguraInferior={720} rodape={<BarraDescanso />} />;
}
