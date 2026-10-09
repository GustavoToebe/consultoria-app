import { useState } from 'react';
import { membrosEquipe,perfisEquipe,catalogoPermissoes } from '../../api/rotas';
import { PerfisEquipe } from '../../treinador/equipe/PerfisEquipe';
import { UsuariosEquipe } from '../../treinador/equipe/UsuariosEquipe';
import { LARGURA_LISTA } from '../../tema/tokens';
import { Cabecalho } from '../../ui/Cabecalho';
import { Escolha } from '../../ui/Escolha';
import { Carregando,MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Tela } from '../../ui/Tela';
import { useCarregar } from '../../ui/useCarregar';
export default function Equipe() {
  const [aba,setAba]=useState<'usuarios'|'perfis'>('usuarios');
  const {dados,erro,carregando,recarregar}=useCarregar('equipe',async()=>{const [membros,perfis,catalogo]=await Promise.all([membrosEquipe(),perfisEquipe(),catalogoPermissoes()]);return {membros,perfis,catalogo};});
  return <Tela largura={LARGURA_LISTA} bordas={['top']}><Cabecalho titulo="Equipe"/>
    <Escolha descricao="Seção da equipe" opcoes={[{valor:'usuarios',rotulo:'Usuários'},{valor:'perfis',rotulo:'Perfis'}]} valor={aba} aoMudar={setAba}/>
    {erro?<MensagemErro texto={textoDoErro(erro)} tentarDeNovo={recarregar}/>:null}
    {!dados&&carregando?<Carregando/>:null}
    {dados?aba==='usuarios'?<UsuariosEquipe {...dados} recarregar={recarregar}/>:<PerfisEquipe {...dados} recarregar={recarregar}/>:null}
  </Tela>;
}
