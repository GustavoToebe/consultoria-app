import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useSessao } from '../sessao/SessaoProvider';
import { Botao } from '../ui/Botao';
import { Campo } from '../ui/Campo';
import { CampoSenha } from '../ui/CampoSenha';
import { Cartao } from '../ui/Cartao';
import { MensagemErro } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { LinkTexto } from '../ui/LinkTexto';
import { Tela } from '../ui/Tela';
import { Texto } from '../ui/Texto';

/** O fragmento não vai para o servidor nem para o Referer; removido do endereço após a leitura. */
export default function ConviteEquipe() {
  const [codigo,setCodigo]=useState(()=>Platform.OS==='web'&&typeof window!=='undefined'?window.location.hash.slice(1):'');
  const [senha,setSenha]=useState('');const [confirmacao,setConfirmacao]=useState('');const [erro,setErro]=useState<string|null>(null);const [ocupado,setOcupado]=useState(false);
  const sessao=useSessao();
  useEffect(()=>{if(Platform.OS==='web'&&typeof window!=='undefined'&&window.location.hash)window.history.replaceState(window.history.state,'',window.location.pathname);},[]);
  const aceitar=async()=>{if(!codigo.trim())return setErro('Informe o código do convite.');if(senha.length<8)return setErro('A senha precisa ter pelo menos 8 caracteres.');if(senha!==confirmacao)return setErro('As senhas não conferem.');setOcupado(true);setErro(null);try{await sessao.aceitarConviteEquipe(codigo.trim(),senha);router.replace('/treinador');}catch(e){setErro(textoDoErro(e));}finally{setOcupado(false);}};
  return <Tela largura={480}><Texto variante="titulo" nivel={1}>Convite para a equipe</Texto><Texto variante="suave">Defina sua senha para entrar na consultoria que convidou você.</Texto>
    <Cartao><Campo rotulo="Código do convite de equipe" valor={codigo} aoMudar={setCodigo} autoCapitalize="none" autoCorrect={false} maxLength={43}/>
      <CampoSenha rotulo="Crie uma senha" valor={senha} aoMudar={setSenha} autoComplete="new-password" ajuda="Mínimo de 8 caracteres."/>
      <CampoSenha rotulo="Confirmar senha" valor={confirmacao} aoMudar={setConfirmacao} autoComplete="new-password"/>
      {erro?<MensagemErro texto={erro}/>:null}<Botao rotulo="Criar meu acesso à equipe" carregando={ocupado} aoTocar={()=>void aceitar()} cheio/>
    </Cartao><LinkTexto href="/entrar" texto="Já tenho conta"/>
  </Tela>;
}
