import { useState } from 'react';
import { alterarMeuPerfil } from '../../api/rotas';
import { useSessao } from '../../sessao/SessaoProvider';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Texto } from '../../ui/Texto';
export function MeuPerfilEquipe() {
  const {usuario,perfilEquipe,recarregarPerfil}=useSessao();const [nome,setNome]=useState(usuario?.nome??'');const [telefone,setTelefone]=useState(usuario?.telefone??'');
  const [erro,setErro]=useState<unknown>(null);const [ocupado,setOcupado]=useState(false);const {avisar}=useAviso();
  const salvar=async()=>{setOcupado(true);setErro(null);try{await alterarMeuPerfil(nome.trim(),telefone.trim()||null);await recarregarPerfil();avisar('Perfil pessoal salvo.','sucesso');}catch(e){setErro(e);}finally{setOcupado(false);}};
  return <Cartao titulo="Meu perfil"><Texto>Perfil na equipe: {perfilEquipe?.nome??'—'}</Texto>
    <Campo rotulo="Seu nome" valor={nome} aoMudar={setNome} maxLength={120}/>
    <Campo rotulo="Telefone (opcional)" valor={telefone} aoMudar={setTelefone} maxLength={30} keyboardType="phone-pad" autoComplete="tel" ajuda="Informe o DDD e o número."/>
    {erro?<MensagemErro texto={textoDoErro(erro)}/>:null}<Botao rotulo="Salvar meu perfil" carregando={ocupado} desabilitado={!nome.trim()} aoTocar={()=>void salvar()}/>
  </Cartao>;
}
