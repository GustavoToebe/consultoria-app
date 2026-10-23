import { BookOpen, CalendarDays, ChartColumn, CircleUserRound, ClipboardCheck, ContactRound, FileUp, House, Inbox, NotebookTabs, UsersRound, History, LifeBuoy, Wallet } from 'lucide-react-native';

import { Navigator, Slot, usePathname } from 'expo-router';
import { Platform } from 'react-native';
import { useEffect } from 'react';
import { listarInscricoes, painelTreinador } from '../../api/rotas';
import { telasDaOrigem } from '../../dominio/telas';
import { useSessao } from '../../sessao/SessaoProvider';
import { useCarregar } from '../../ui/useCarregar';
import { podeAcessarTela } from '../../dominio/permissoes';
import { GuardaDePermissao } from '../../ui/Permitido';
import { GuardaDePapel } from '../../ui/GuardaDePapel';
import { BarraTopo } from '../../ui/BarraTopo';
import { useLimparFavoritosAoSair } from '../../ui/useFavoritos';
import { GuardaDeSaida } from '../../ui/GuardaDeSaida';
import { Navegacao, type ItemMenu } from '../../ui/Navegacao';
import { ProvedorDoPasseio } from '../../ui/Passeio';
import { GUIAS } from '../../ajuda/conteudo';

/**
 * Só aparecem no menu as telas que já existem (nada de recurso fingido). A barra do celular leva Início, Alunos,
 * Biblioteca, Planejamento e Perfil; Atualizações, Interessados, Equipe, Importação, Ajuda e Auditoria ficam no menu lateral e
 * no celular abrem pelo Início (Atualizações) ou pelos atalhos do Perfil. Marca fica no menu da conta, só para o Administrador.
 */
const ITENS: ItemMenu[] = [
  { rotulo: 'Início', href: '/treinador', caminho: '/treinador', Icone: House, exato: true, tambemNoCelular: telasDaOrigem('/treinador') },
  { rotulo: 'Alunos', href: '/treinador/alunos', caminho: '/treinador/alunos', Icone: ContactRound },
  { rotulo: 'Atualizações', href: '/treinador/atualizacoes', caminho: '/treinador/atualizacoes', Icone: ClipboardCheck, soLateral: true },
  { rotulo: 'Agenda', href: '/treinador/agenda', caminho: '/treinador/agenda', Icone: CalendarDays, soLateral: true },
  { rotulo: 'Interessados', href: '/treinador/interessados', caminho: '/treinador/interessados', Icone: Inbox, soLateral: true },
  { rotulo: 'Números', href: '/treinador/numeros', caminho: '/treinador/numeros', Icone: ChartColumn, soLateral: true },
  { rotulo: 'Biblioteca', href: '/treinador/biblioteca', caminho: '/treinador/biblioteca', Icone: BookOpen },
  { rotulo: 'Planejamento', rotuloCurto: 'Planos', href: '/treinador/planejamento', caminho: '/treinador/planejamento', Icone: NotebookTabs },
  { rotulo: 'Financeiro', href: '/treinador/financeiro', caminho: '/treinador/financeiro', Icone: Wallet, soLateral: true },
  // A barra de topo (com o cartão do usuário) é só da web; num tablet nativo largo o Perfil continua no menu lateral.
  { rotulo: 'Perfil', href: '/treinador/perfil', caminho: '/treinador/perfil', Icone: CircleUserRound, soCelular: Platform.OS === 'web', tambem: ['/treinador/meus-dados', '/treinador/seguranca', '/treinador/ajustes', '/treinador/minha-conta', '/treinador/marca'], tambemNoCelular: telasDaOrigem('/treinador/perfil') },
  { rotulo: 'Equipe', href: '/treinador/equipe', caminho: '/treinador/equipe', Icone: UsersRound, soLateral:true },
  { rotulo: 'Importação', href: '/treinador/importacao', caminho: '/treinador/importacao', Icone: FileUp, soLateral: true },
  // Termos e privacidade abre pela Ajuda no PC.
  { rotulo: 'Ajuda', href: '/treinador/ajuda', caminho: '/treinador/ajuda', Icone: LifeBuoy, soLateral: true, tambem: ['/treinador/termos'] },
  { rotulo: 'Auditoria', href: '/treinador/auditoria', caminho: '/treinador/auditoria', Icone: History, soLateral:true },
];

export default function LayoutTreinador() {
  const {pode,recarregarPerfil,usuario,pagamentosHabilitados}=useSessao();const caminho=usePathname();
  useLimparFavoritosAoSair();
  useEffect(()=>{if(caminho.startsWith('/treinador')) void recarregarPerfil().catch(()=>undefined);},[recarregarPerfil,caminho]);
  // Ponto em Atualizações quando há alguma para revisar (no celular, no Início, que leva a elas) e em Interessados quando
  // há inscrição nova (no celular, no Perfil, que tem o atalho). Só para quem pode ver; falha silenciosa, sem travar o menu.
  const verAtualizacoes=pode('PAINEL_VER')&&pode('ATUALIZACAO_LER')&&pode('ALUNO_SENSIVEL_LER');
  const painel=useCarregar(verAtualizacoes?`ponto-atualizacoes:${caminho}`:null,()=>painelTreinador(false));
  const pontoAtualizacoes=verAtualizacoes&&(painel.dados?.atualizacoesParaRevisar??0)>0;
  const verInscricoes=pode('INSCRICAO_LER');
  const novas=useCarregar(verInscricoes?`ponto-interessados:${caminho}`:null,()=>listarInscricoes({situacao:'NOVA',meus:false,pagina:0}));
  const pontoInteressados=verInscricoes&&(novas.dados?.total??0)>0;
  const comPontos=(i:ItemMenu):ItemMenu=>{
    if(i.caminho==='/treinador') return {...i,ponto:pontoAtualizacoes?'inferior':false};
    if(i.caminho==='/treinador/atualizacoes') return {...i,ponto:pontoAtualizacoes};
    if(i.caminho==='/treinador/interessados') return {...i,ponto:pontoInteressados};
    if(i.caminho==='/treinador/perfil') return {...i,ponto:pontoInteressados?'inferior':false};
    return i;
  };
  return (
    <Navigator><GuardaDePapel papel="TREINADOR"><GuardaDeSaida>
      {/* Passeio pelo menu no primeiro acesso (depois dos termos, que a GuardaDePapel cobra); revisto pela Ajuda. */}
      <ProvedorDoPasseio key={usuario?.id ?? ''} usuarioId={usuario?.id ?? ''} passos={usuario ? GUIAS.treinador.passeio : []}>
        <Navegacao topo={Platform.OS === 'web' ? <BarraTopo /> : undefined} itens={ITENS.filter(i=>podeAcessarTela(i.caminho,pode,pagamentosHabilitados)).map(comPontos)} conteudo={<GuardaDePermissao><Slot /></GuardaDePermissao>} />
      </ProvedorDoPasseio>
    </GuardaDeSaida></GuardaDePapel></Navigator>
  );
}
