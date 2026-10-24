import { BarraDescanso } from '../../aluno/BarraDescanso';
import { SeloSincronizacao } from '../../aluno/SeloSincronizacao';
import { StyleSheet, View } from 'react-native';
import { espaco } from '../../tema/tokens';
import { CalendarDays, Dumbbell, House, Salad, UserRound } from 'lucide-react-native';

import { AlunoProvider, useAluno } from '../../offline/AlunoProvider';
import { faseAtualizacao, temAcaoAtualizacao } from '../../dominio/atualizacao';
import { pagamentoPendente, hojeEmBrasilia } from '../../dominio/financeiro';
import { hojeIso } from '../../dominio/formatos';
import { telasDaOrigem } from '../../dominio/telas';
import { useSessao } from '../../sessao/SessaoProvider';
import { GuardaDePapel } from '../../ui/GuardaDePapel';
import { Navegacao, type ItemMenu } from '../../ui/Navegacao';
import { ProvedorDoPasseio } from '../../ui/Passeio';
import { GUIAS } from '../../ajuda/conteudo';
import { ContextoDeImagens } from '../../aluno/atualizacao/ImagemDaPergunta';
import { baixarImagemDoAluno } from '../../api/rotas';
import { useAnamnese } from '../../aluno/anamnese/useAnamnese';
import { FinanceiroDoAlunoProvider, useFinanceiroDoAluno } from '../../aluno/financeiro/FinanceiroDoAlunoProvider';

/** Aluno: barra inferior sempre (uso principal é no celular). */
const ITENS: ItemMenu[] = [
  { rotulo: 'Início', href: '/aluno', caminho: '/aluno', Icone: House, exato: true },
  // A sessão e o endereço antigo da mobilidade continuam acendendo Treino.
  { rotulo: 'Treino', href: '/aluno/treino', caminho: '/aluno/treino', Icone: Dumbbell, tambem: ['/aluno/sessao', '/aluno/mobilidade'] },
  { rotulo: 'Dieta', href: '/aluno/dieta', caminho: '/aluno/dieta', Icone: Salad, tambem: ['/aluno/lista-de-compras'] },
  { rotulo: 'Histórico', href: '/aluno/historico', caminho: '/aluno/historico', Icone: CalendarDays },
  // Ajuda e Termos abrem pela Conta: o item fica aceso enquanto estão abertos.
  { rotulo: 'Conta', href: '/aluno/conta', caminho: '/aluno/conta', Icone: UserRound, tambem: telasDaOrigem('/aluno/conta') },
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
              {/* O financeiro do aluno fica só em memória (nada no aparelho) e só é buscado com o módulo ligado e online. */}
              <FinanceiroDoAlunoProvider>
                <MenuAluno />
              </FinanceiroDoAlunoProvider>
            </ContextoDeImagens.Provider>
          </ProvedorDoPasseio>
        </AlunoProvider>
      ) : null}
    </GuardaDePapel>
  );
}

function MenuAluno() {
  const {atualizacao}=useAluno();
  // O ponto no Início conta as pendências: a atualização a enviar, a anamnese a responder e o pagamento em aberto.
  const anamnese=useAnamnese();
  const anamnesePendente=anamnese.dados?.situacao==='PENDENTE';
  const financeiro=useFinanceiroDoAluno();
  const pagamentoEmAberto=financeiro.habilitado&&pagamentoPendente(financeiro.dados?.abertas,hojeEmBrasilia()).length>0;
  const ponto=pagamentoEmAberto || anamnesePendente || (!!atualizacao && temAcaoAtualizacao({...atualizacao,...faseAtualizacao(hojeIso(),atualizacao.dataAtualizacao,atualizacao.atrasoAte,atualizacao.fase)}));
  return <Navegacao itens={ITENS.map(item=>item.caminho==='/aluno'?{...item,ponto}:item)} sempreInferior larguraInferior={720} rodape={<RodapeAluno />} />;
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
