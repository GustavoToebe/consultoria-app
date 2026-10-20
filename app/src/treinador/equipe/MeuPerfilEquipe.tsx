import { useState } from 'react';
import { alterarMeuPerfil } from '../../api/rotas';
import { useSessao } from '../../sessao/SessaoProvider';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { CampoLeitura } from '../../ui/CampoLeitura';
export function MeuPerfilEquipe() {
  const {usuario,perfilEquipe,recarregarPerfil}=useSessao();const [nome,setNome]=useState(usuario?.nome??'');const [telefone,setTelefone]=useState(usuario?.telefone??'');
  const [erro,setErro]=useState<unknown>(null);const [ocupado,setOcupado]=useState(false);const {avisar}=useAviso();
  const salvar=async()=>{setOcupado(true);setErro(null);try{await alterarMeuPerfil(nome.trim(),telefone.trim()||null);await recarregarPerfil();avisar('Seus dados foram salvos.','sucesso');}catch(e){setErro(e);}finally{setOcupado(false);}};
  // "Seus dados": o nome que a equipe vê. "Perfil" fica só para o perfil de permissões da equipe (linha abaixo).
  return <Cartao titulo="Seus dados"><CampoLeitura rotulo="Perfil na equipe" valor={perfilEquipe?.nome}/>
    <Campo rotulo="Seu nome" valor={nome} aoMudar={setNome} maxLength={120}/>
    <Campo rotulo="Telefone (opcional)" valor={telefone} aoMudar={setTelefone} maxLength={30} keyboardType="phone-pad" autoComplete="tel" ajuda="Informe o DDD e o número."/>
    {erro?<MensagemErro texto={textoDoErro(erro)}/>:null}<Botao rotulo="Salvar seus dados" carregando={ocupado} desabilitado={!nome.trim()} aoTocar={()=>void salvar()}/>
  </Cartao>;
}
