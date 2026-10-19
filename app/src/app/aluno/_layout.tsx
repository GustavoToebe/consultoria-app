import { BarraDescanso } from '../../aluno/BarraDescanso';
import { SeloSincronizacao } from '../../aluno/SeloSincronizacao';
import { StyleSheet, View } from 'react-native';
import { espaco } from '../../tema/tokens';
import { CalendarDays, Dumbbell, PersonStanding, Salad, UserRound } from 'lucide-react-native';

import { AlunoProvider, useAluno } from '../../offline/AlunoProvider';
import { faseAtualizacao, temAcaoAtualizacao } from '../../dominio/atualizacao';
import { hojeIso } from '../../dominio/formatos';
import { temAbaMobilidade } from '../../dominio/mobilidade';
import { useSessao } from '../../sessao/SessaoProvider';
import { GuardaDePapel } from '../../ui/GuardaDePapel';
import { Navegacao, type ItemMenu } from '../../ui/Navegacao';
import { ProvedorDoPasseio } from '../../ui/Passeio';
import { GUIAS } from '../../ajuda/conteudo';
import { ContextoDeImagens } from '../../aluno/atualizacao/ImagemDaPergunta';
import { baixarImagemDoAluno } from '../../api/rotas';

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
          {/* Passeio pelo menu no primeiro acesso, logo depois do aceite dos termos; o lembrete da atualização espera. */}
          <ProvedorDoPasseio usuarioId={usuario.id} passos={GUIAS.aluno.passeio}>
            {/* As imagens das perguntas, no aluno, vêm pela rota dele (só as do que ele responde). */}
            <ContextoDeImagens.Provider value={baixarImagemDoAluno}>
              <MenuAluno />
            </ContextoDeImagens.Provider>
          </ProvedorDoPasseio>
        </AlunoProvider>
      ) : null}
    </GuardaDePapel>
  );
}

function MenuAluno() {
  const {atualizacao,mobilidade,escolhida}=useAluno();
  const comMobilidade=temAbaMobilidade(mobilidade,escolhida?{mobilidade:escolhida.planos.mobilidade}:null);
  const ponto=!!atualizacao && temAcaoAtualizacao({...atualizacao,...faseAtualizacao(hojeIso(),atualizacao.dataAtualizacao,atualizacao.atrasoAte,atualizacao.fase)});
  return <Navegacao itens={ITENS.filter(item=>item.caminho!=='/aluno/mobilidade'||comMobilidade).map(item=>item.caminho==='/aluno'?{...item,ponto}:item)} sempreInferior larguraInferior={720} rodape={<RodapeAluno />} />;
}

/** Sincronização à vista em todas as telas do aluno, logo acima da barra de baixo; o descanso vem por último. */
function RodapeAluno() {
  return (
    <>
      <View style={estilos.sincronizacao}><SeloSincronizacao /></View>
      <BarraDescanso />
    </>
  );
}

const estilos = StyleSheet.create({
  sincronizacao: { alignItems: 'center', paddingVertical: espaco(0.5) },
});
