import { BookOpen, CircleUserRound, GraduationCap, House, NotebookTabs, Palette, UsersRound, History, LifeBuoy } from 'lucide-react-native';

import { Navigator, Slot, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { useSessao } from '../../sessao/SessaoProvider';
import { podeAcessarTela } from '../../dominio/permissoes';
import { GuardaDePermissao } from '../../ui/Permitido';
import { GuardaDePapel } from '../../ui/GuardaDePapel';
import { BarraTopo } from '../../ui/BarraTopo';
import { Navegacao, type ItemMenu } from '../../ui/Navegacao';

/** Só aparecem no menu as telas que já existem (nada de recurso fingido). No celular, Planejamento fica na Biblioteca. */
const ITENS: ItemMenu[] = [
  { rotulo: 'Início', href: '/treinador', caminho: '/treinador', Icone: House, exato: true },
  { rotulo: 'Alunos', href: '/treinador/alunos', caminho: '/treinador/alunos', Icone: GraduationCap },
  { rotulo: 'Biblioteca', href: '/treinador/biblioteca', caminho: '/treinador/biblioteca', Icone: BookOpen },
  { rotulo: 'Planejamento', href: '/treinador/planejamento', caminho: '/treinador/planejamento', Icone: NotebookTabs, soLateral: true },
  { rotulo: 'Marca', href: '/treinador/marca', caminho: '/treinador/marca', Icone: Palette },
  { rotulo: 'Perfil', href: '/treinador/perfil', caminho: '/treinador/perfil', Icone: CircleUserRound },
  { rotulo: 'Equipe', href: '/treinador/equipe', caminho: '/treinador/equipe', Icone: UsersRound, soLateral:true },
  { rotulo: 'Ajuda', href: '/treinador/ajuda', caminho: '/treinador/ajuda', Icone: LifeBuoy, soLateral: true },
  { rotulo: 'Auditoria', href: '/treinador/auditoria', caminho: '/treinador/auditoria', Icone: History, soLateral:true },
];

export default function LayoutTreinador() {
  const {pode,recarregarPerfil}=useSessao();const caminho=usePathname();
  useEffect(()=>{if(caminho.startsWith('/treinador')) void recarregarPerfil().catch(()=>undefined);},[recarregarPerfil,caminho]);
  return (
    <Navigator><GuardaDePapel papel="TREINADOR">
      <Navegacao topo={<BarraTopo />} itens={ITENS.filter(i=>podeAcessarTela(i.caminho,pode))} conteudo={<GuardaDePermissao><Slot /></GuardaDePermissao>} />
    </GuardaDePapel></Navigator>
  );
}
