import { BookOpen, CircleUserRound, ContactRound, House, NotebookTabs, Palette, UsersRound, History, LifeBuoy } from 'lucide-react-native';

import { Navigator, Slot, usePathname } from 'expo-router';
import { Platform } from 'react-native';
import { useEffect } from 'react';
import { painelTreinador } from '../../api/rotas';
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
 * Biblioteca, Planejamento e Perfil; Marca, Equipe, Ajuda e Auditoria ficam no menu lateral e nos atalhos do Perfil.
 */
const ITENS: ItemMenu[] = [
  { rotulo: 'Início', href: '/treinador', caminho: '/treinador', Icone: House, exato: true },
  { rotulo: 'Alunos', href: '/treinador/alunos', caminho: '/treinador/alunos', Icone: ContactRound },
  { rotulo: 'Biblioteca', href: '/treinador/biblioteca', caminho: '/treinador/biblioteca', Icone: BookOpen },
  { rotulo: 'Planejamento', href: '/treinador/planejamento', caminho: '/treinador/planejamento', Icone: NotebookTabs },
  { rotulo: 'Marca', href: '/treinador/marca', caminho: '/treinador/marca', Icone: Palette, soLateral: true },
  // A barra de topo (com o cartão do usuário) é só da web; num tablet nativo largo o Perfil continua no menu lateral.
  { rotulo: 'Perfil', href: '/treinador/perfil', caminho: '/treinador/perfil', Icone: CircleUserRound, soCelular: Platform.OS === 'web', tambem: ['/treinador/meus-dados', '/treinador/seguranca', '/treinador/ajustes', '/treinador/minha-conta'] },
  { rotulo: 'Equipe', href: '/treinador/equipe', caminho: '/treinador/equipe', Icone: UsersRound, soLateral:true },
  { rotulo: 'Ajuda', href: '/treinador/ajuda', caminho: '/treinador/ajuda', Icone: LifeBuoy, soLateral: true },
  { rotulo: 'Auditoria', href: '/treinador/auditoria', caminho: '/treinador/auditoria', Icone: History, soLateral:true },
];

export default function LayoutTreinador() {
  const {pode,recarregarPerfil,usuario}=useSessao();const caminho=usePathname();
  useLimparFavoritosAoSair();
  useEffect(()=>{if(caminho.startsWith('/treinador')) void recarregarPerfil().catch(()=>undefined);},[recarregarPerfil,caminho]);
  // Ponto no Início quando há atualização para revisar (só quem pode vê-las); falha silenciosa, sem travar o menu.
  const verAtualizacoes=pode('PAINEL_VER')&&pode('ATUALIZACAO_LER')&&pode('ALUNO_SENSIVEL_LER');
  const painel=useCarregar(verAtualizacoes?`ponto-atualizacoes:${caminho}`:null,()=>painelTreinador(false));
  const ponto=verAtualizacoes&&(painel.dados?.atualizacoesParaRevisar??0)>0;
  return (
    <Navigator><GuardaDePapel papel="TREINADOR"><GuardaDeSaida>
      {/* Passeio pelo menu no primeiro acesso (depois dos termos, que a GuardaDePapel cobra); revisto pela Ajuda. */}
      <ProvedorDoPasseio key={usuario?.id ?? ''} usuarioId={usuario?.id ?? ''} passos={usuario ? GUIAS.treinador.passeio : []}>
        <Navegacao topo={Platform.OS === 'web' ? <BarraTopo /> : undefined} itens={ITENS.filter(i=>podeAcessarTela(i.caminho,pode)).map(i=>i.caminho==='/treinador'?{...i,ponto}:i)} conteudo={<GuardaDePermissao><Slot /></GuardaDePermissao>} />
      </ProvedorDoPasseio>
    </GuardaDeSaida></GuardaDePapel></Navigator>
  );
}
