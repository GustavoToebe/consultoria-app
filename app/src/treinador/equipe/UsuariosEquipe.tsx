import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Platform, Share, View } from 'react-native';
import * as api from '../../api/rotas';
import type { ConviteEquipe, MembroEquipe, PerfilEquipe } from '../../api/equipeTipos';
import { dataHoraParaTela } from '../../dominio/formatos';
import { perfisAtribuiveis, podeEditarMembro } from '../../dominio/perfilEquipe';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { CaixaSelecao } from '../../ui/CaixaSelecao';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { Escolha } from '../../ui/Escolha';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Permitido } from '../../ui/Permitido';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { useAtorEquipe } from './useAtorEquipe';

export function UsuariosEquipe({membros,perfis,recarregar}:{membros:MembroEquipe[];perfis:PerfilEquipe[];recarregar:()=>void}) {
  const [editar,setEditar]=useState<MembroEquipe|'novo'|null>(null);
  const ator=useAtorEquipe();
  const {cores}=useTema();
  return <>
    <Cartao titulo="Membros da equipe" descricao="Convide pessoas por e-mail e escolha o perfil de cada uma." acoes={<Permitido codigo="USUARIO_ALTERAR"><Botao rotulo="Convidar membro" aoTocar={()=>setEditar('novo')}/></Permitido>}>
    {membros.map(m=><Cartao key={m.id} titulo={m.nome} style={{backgroundColor:cores.superficie2}} acoes={<Selo texto={m.convitePendente?'Convite pendente':m.ativo?'Ativo':'Inativo'} tipo={m.convitePendente?'atencao':m.ativo?'sucesso':'neutro'}/>}>
      <Texto variante="suave">{m.email} · {m.perfilNome}</Texto>
      <Texto variante="suave">{m.convitePendente?`Convite até ${dataHoraParaTela(m.conviteExpiraEm)}`:`Último acesso: ${dataHoraParaTela(m.ultimoAcesso)||'—'}`}</Texto>
      {podeEditarMembro(ator,m,perfis)?<Permitido codigo="USUARIO_ALTERAR"><Botao rotulo={m.convitePendente?`Renovar convite de ${m.nome}`:`Editar ${m.nome}`} tipo="secundario" aoTocar={()=>setEditar(m)}/></Permitido>:null}
    </Cartao>)}
    </Cartao>
    {editar?<EditorUsuario membro={editar==='novo'?null:editar} perfis={perfis} aoFechar={()=>setEditar(null)} recarregar={recarregar}/>:null}
  </>;
}
function EditorUsuario({membro,perfis,aoFechar,recarregar}:{membro:MembroEquipe|null;perfis:PerfilEquipe[];aoFechar:()=>void;recarregar:()=>void}) {
  const novo=!membro||membro.convitePendente;
  const opcoes=perfisAtribuiveis(useAtorEquipe(),perfis,membro&&!membro.convitePendente?membro:undefined);
  const [nome,setNome]=useState(membro?.nome??'');const [email,setEmail]=useState(membro?.email??'');
  const [perfilId,setPerfilId]=useState(membro&&opcoes.some(p=>p.id===membro.perfilId)?membro.perfilId:opcoes.find(p=>p.nome==='Assistente')?.id??opcoes[0]?.id??'');
  const [ativo,setAtivo]=useState(membro?.ativo??true);const [confirmar,setConfirmar]=useState(false);
  const [convite,setConvite]=useState<ConviteEquipe|null>(null);const [erro,setErro]=useState<unknown>(null);const [ocupado,setOcupado]=useState(false);const {avisar}=useAviso();
  const salvar=async()=>{setConfirmar(false);setOcupado(true);setErro(null);try{if(novo)setConvite(await api.convidarMembro({nome:nome.trim(),email:email.trim(),perfilId}));else{await api.alterarMembro(membro.id,{nome:nome.trim(),perfilId,ativo});avisar('Membro atualizado.','sucesso');aoFechar();}recarregar();}catch(e){setErro(e);}finally{setOcupado(false);}};
  const copiar=async(texto:string)=>{try{await Clipboard.setStringAsync(texto);avisar('Copiado.','sucesso');}catch{avisar('Selecione o texto e copie à mão.','neutro');}};
  const compartilhar=async()=>{if(!convite)return;try{if(Platform.OS==='web'){if(typeof navigator.share==='function')await navigator.share({title:'Convite para a equipe',url:convite.link});else await copiar(convite.link);}else await Share.share({message:convite.link});}catch{avisar('Não foi possível compartilhar. Use Copiar link.','neutro');}};
  return <>
    <Folha visivel titulo={convite?'Convite criado':novo?'Convidar membro':'Editar membro'} aoFechar={aoFechar} rodape={convite?<Botao rotulo="Concluir" aoTocar={aoFechar}/>:<><Botao rotulo="Cancelar" tipo="secundario" aoTocar={aoFechar}/><Botao rotulo={novo?'Gerar convite':'Salvar membro'} carregando={ocupado} desabilitado={!nome.trim()||!perfilId||(novo&&!email.trim())} aoTocar={()=>{if(!novo&&membro?.ativo&&!ativo)setConfirmar(true);else void salvar();}}/></>}>
      {convite?<>
        <Texto>Válido até {dataHoraParaTela(convite.expiraEm)}. O link só pode ser usado uma vez.</Texto>
        <Texto selectable>{convite.codigo}</Texto><Botao rotulo="Copiar código" tipo="secundario" aoTocar={()=>void copiar(convite.codigo)}/>
        <Texto selectable>{convite.link}</Texto>
        <View style={{flexDirection:'row',gap:espaco(1),flexWrap:'wrap'}}><Botao rotulo="Copiar link" tipo="secundario" aoTocar={()=>void copiar(convite.link)}/><Botao rotulo="Compartilhar convite" tipo="secundario" aoTocar={()=>void compartilhar()}/></View>
      </>:<>
        {membro?.convitePendente?<Texto variante="suave">Gerar outro convite invalida o anterior.</Texto>:null}
        <Campo rotulo="Nome do membro" valor={nome} aoMudar={setNome} maxLength={120}/>
        {novo?<Campo rotulo="E-mail do membro" valor={email} aoMudar={setEmail} keyboardType="email-address" autoCapitalize="none" maxLength={254}/>:<Texto>{email}</Texto>}
        <Escolha rotulo="Perfil do membro" opcoes={opcoes.map(p=>({valor:p.id,rotulo:p.nome}))} valor={perfilId} aoMudar={setPerfilId}/>
        {!novo?<CaixaSelecao rotulo="Membro ativo" marcado={ativo} aoMudar={setAtivo}/>:null}
      </>}
      {erro?<MensagemErro texto={textoDoErro(erro)}/>:null}
    </Folha>
    <PainelConfirmacao visivel={confirmar} titulo="Desativar membro?" mensagem="A sessão será encerrada e ele não poderá entrar até ser reativado." perigo rotuloConfirmar="Desativar membro" aoConfirmar={()=>void salvar()} aoCancelar={()=>setConfirmar(false)}/>
  </>;
}
