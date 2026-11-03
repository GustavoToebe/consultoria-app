import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Platform, Share, View } from 'react-native';
import * as api from '../../api/rotas';
import type { ConviteEquipe, MembroEquipe, PerfilEquipe } from '../../api/equipeTipos';
import { naOrdem } from '../../dominio/filtrosComuns';
import { chipsDosFiltros, filtrarMembros, SEM_FILTROS, semOFiltro, SITUACOES_DO_MEMBRO, type ChaveDoFiltro, type FiltrosDeMembros } from '../../dominio/filtrosDeMembros';
import { dataHoraParaTela } from '../../dominio/formatos';
import { MOTIVO_FORA_DO_PLANO } from '../../dominio/funcionalidadesDoPlano';
import { AJUDA_DO_LIMITE, lerLimiteDeAlunos, limiteParaCampo, textoDoLimite } from '../../dominio/limiteDeAlunos';
import { perfisAtribuiveis, podeCancelarConvite, podeEditarMembro } from '../../dominio/perfilEquipe';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { BarraDeFiltros } from '../../ui/BarraDeFiltros';
import { Botao } from '../../ui/Botao';
import { CaixaSelecao } from '../../ui/CaixaSelecao';
import { Campo } from '../../ui/Campo';
import { CampoLeitura } from '../../ui/CampoLeitura';
import { Cartao } from '../../ui/Cartao';
import { Escolha } from '../../ui/Escolha';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { errosPorCampo, textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { NoPlano } from '../../ui/NoPlano';
import { Permitido } from '../../ui/Permitido';
import { SelecaoMultiplaSuspensa } from '../../ui/SelecaoMultiplaSuspensa';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { useAvisoDoPlano } from '../../ui/useAvisoDoPlano';
import { CelulaDoFiltro } from '../SeletoresDeFiltro';
import { useAtorEquipe } from './useAtorEquipe';

export function UsuariosEquipe({membros,perfis,recarregar}:{membros:MembroEquipe[];perfis:PerfilEquipe[];recarregar:()=>void}) {
  const [editar,setEditar]=useState<MembroEquipe|'novo'|null>(null);
  const [cancelar,setCancelar]=useState<MembroEquipe|null>(null);const [ocupado,setOcupado]=useState(false);const {avisar}=useAviso();
  const ator=useAtorEquipe();
  const {temFuncionalidade}=useSessao();
  // Equipe fora do plano: dá para ver e desativar membros, mas não convidar nem renovar convite.
  const convidaLiberado=temFuncionalidade('EQUIPE');
  const {cores}=useTema();
  // Filtros da lista (`docs/planos/filtros-nas-listas.md`, D11): a lista vem inteira, então filtram aqui.
  const [busca,setBusca]=useState('');const [filtros,setFiltros]=useState<FiltrosDeMembros>(SEM_FILTROS);
  const visiveis=filtrarMembros(membros,filtros,busca);const chips=chipsDosFiltros(filtros,perfis);
  const opcoesDePerfil=perfis.map(p=>({valor:p.id,rotulo:p.nome}));
  const cancelarConvite=async()=>{if(!cancelar)return;setOcupado(true);try{await api.cancelarConviteEquipe(cancelar.id);avisar('Convite cancelado.','sucesso');setCancelar(null);recarregar();}catch(e){avisar(textoDoErro(e),'perigo');setCancelar(null);}finally{setOcupado(false);}};
  return <>
    <Cartao titulo="Membros da equipe" descricao="Convide pessoas por e-mail e escolha o perfil de cada uma." acoes={<NoPlano funcionalidade="EQUIPE"><Permitido codigo="USUARIO_ALTERAR"><Botao rotulo="Convidar membro" aoTocar={()=>setEditar('novo')}/></Permitido></NoPlano>}>
    <BarraDeFiltros busca={{valor:busca,aoMudar:setBusca,placeholder:'Nome ou e-mail'}} valor={filtros} aoAplicar={setFiltros} limpo={SEM_FILTROS} chips={chips}
      aoTirar={(chave)=>setFiltros(semOFiltro(filtros,chave as ChaveDoFiltro))} rotuloDoResultado="Ver membros"
      seletores={(atuais,mudar)=><>
        <CelulaDoFiltro><SelecaoMultiplaSuspensa rotulo="Situação" opcoes={SITUACOES_DO_MEMBRO} marcados={new Set(atuais.situacoes)} aoMudar={(m)=>mudar({...atuais,situacoes:naOrdem(m,SITUACOES_DO_MEMBRO)})} rotuloDeTodos="Todas"/></CelulaDoFiltro>
        <CelulaDoFiltro><SelecaoMultiplaSuspensa rotulo="Perfil" opcoes={opcoesDePerfil} marcados={new Set(atuais.perfis)} aoMudar={(m)=>mudar({...atuais,perfis:naOrdem(m,opcoesDePerfil)})} rotuloDeTodos="Todos"/></CelulaDoFiltro>
      </>}/>
    {membros.length&&!visiveis.length?<Vazio titulo="Nenhum membro encontrado" texto="Tente outro nome ou tire algum filtro." acao={chips.length?{rotulo:'Limpar filtros',aoTocar:()=>setFiltros(SEM_FILTROS)}:undefined}/>:null}
    {visiveis.map(m=><Cartao key={m.id} titulo={m.nome} style={{backgroundColor:cores.superficie2}} acoes={<Selo texto={m.convitePendente?'Convite pendente':m.ativo?'Ativo':'Inativo'} tipo={m.convitePendente?'atencao':m.ativo?'sucesso':'neutro'}/>}>
      <Texto variante="suave">{m.email} · {m.perfilNome}</Texto>
      <Texto variante="suave">{m.convitePendente?`Convite até ${dataHoraParaTela(m.conviteExpiraEm)}`:`Último acesso: ${dataHoraParaTela(m.ultimoAcesso)||'—'} · ${textoDoLimite(m.limiteDeAlunos)}`}</Texto>
      {podeEditarMembro(ator,m,perfis)&&(convidaLiberado||!m.convitePendente)?<Permitido codigo="USUARIO_ALTERAR"><Botao rotulo={m.convitePendente?'Renovar convite':'Editar'} rotuloAcessivel={m.convitePendente?`Renovar convite de ${m.nome}`:`Editar ${m.nome}`} tipo="secundario" aoTocar={()=>setEditar(m)}/></Permitido>:null}
      {podeCancelarConvite(ator,m,perfis)?<Permitido codigo="USUARIO_ALTERAR"><Botao rotulo="Cancelar convite" rotuloAcessivel={`Cancelar convite de ${m.nome}`} tipo="perigoTexto" aoTocar={()=>setCancelar(m)}/></Permitido>:null}
    </Cartao>)}
    </Cartao>
    <PainelConfirmacao visivel={!!cancelar} titulo="Cancelar convite?" mensagem={`O link enviado para ${cancelar?.email??''} deixa de funcionar.`} perigo rotuloConfirmar="Cancelar convite" carregando={ocupado} aoConfirmar={()=>void cancelarConvite()} aoCancelar={()=>setCancelar(null)}/>
    {editar?<EditorUsuario membro={editar==='novo'?null:editar} perfis={perfis} aoFechar={()=>setEditar(null)} recarregar={recarregar}/>:null}
  </>;
}
function EditorUsuario({membro,perfis,aoFechar,recarregar}:{membro:MembroEquipe|null;perfis:PerfilEquipe[];aoFechar:()=>void;recarregar:()=>void}) {
  const novo=!membro||membro.convitePendente;
  const ator=useAtorEquipe();
  const opcoes=perfisAtribuiveis(ator,perfis,membro&&!membro.convitePendente?membro:undefined);
  // Limite de alunos (supervisão da equipe, D2): só o Administrador grava (a API confere o perfil de acesso total) e só
  // membro que já é usuário (convite pendente não tem). O administrador também pode ter limite (D18).
  const mostraLimite=!novo&&ator.administrador;
  const limiteGravado=membro?.limiteDeAlunos??null;
  const [limiteTexto,setLimiteTexto]=useState(limiteParaCampo(limiteGravado));const [erroDoLimite,setErroDoLimite]=useState<string|null>(null);
  const leituraDoLimite=lerLimiteDeAlunos(limiteTexto);
  const limiteInvalido=mostraLimite&&!leituraDoLimite.ok;
  const [nome,setNome]=useState(membro?.nome??'');const [email,setEmail]=useState(membro?.email??'');
  const [perfilId,setPerfilId]=useState(membro&&opcoes.some(p=>p.id===membro.perfilId)?membro.perfilId:opcoes.find(p=>p.nome==='Assistente')?.id??opcoes[0]?.id??'');
  const [ativo,setAtivo]=useState(membro?.ativo??true);const [confirmar,setConfirmar]=useState(false);
  const [convite,setConvite]=useState<ConviteEquipe|null>(null);const [erro,setErro]=useState<unknown>(null);const [ocupado,setOcupado]=useState(false);const {avisar}=useAviso();
  const avisarDoPlano=useAvisoDoPlano();const {temFuncionalidade,usuario}=useSessao();
  // A própria pessoa não troca o próprio perfil nem se desativa (a API recusa): mostra o perfil só para leitura.
  const euMesmo=!!membro&&!membro.convitePendente&&membro.id===usuario?.id;
  // Reativar membro inativo conta no limite do plano: fora do plano de equipe fica desabilitado.
  const reativacaoBloqueada=!!membro&&!membro.convitePendente&&!membro.ativo&&!temFuncionalidade('EQUIPE');
  const salvar=async()=>{setConfirmar(false);setOcupado(true);setErro(null);setErroDoLimite(null);let membroSalvo=false;try{if(novo)setConvite(await api.convidarMembro({nome:nome.trim(),email:email.trim(),perfilId}));else{
    await api.alterarMembro(membro.id,{nome:nome.trim(),perfilId:euMesmo?membro.perfilId:perfilId,ativo:euMesmo?membro.ativo:ativo});membroSalvo=true;
    // Rota própria do limite, só quando mudou (cada gravação é auditada). Vai depois: o 422 dela não desfaz o resto.
    if(mostraLimite&&leituraDoLimite.ok&&leituraDoLimite.limite!==limiteGravado)await api.definirLimiteDeAlunos(membro.id,leituraDoLimite.limite);
    avisar('Membro atualizado.','sucesso');aoFechar();}recarregar();}
    catch(e){if(membroSalvo){recarregar();const campo=errosPorCampo(e).limite;if(campo)setErroDoLimite(campo);else setErro(e);avisar('Nome, perfil e situação foram salvos; o limite de alunos não.','perigo');}
    else if(avisarDoPlano(e))aoFechar();else setErro(e);}finally{setOcupado(false);}};
  const copiar=async(texto:string)=>{try{await Clipboard.setStringAsync(texto);avisar('Copiado.','sucesso');}catch{avisar('Selecione o texto e copie à mão.','neutro');}};
  const compartilhar=async()=>{if(!convite)return;try{if(Platform.OS==='web'){if(typeof navigator.share==='function')await navigator.share({title:'Convite para a equipe',url:convite.link});else await copiar(convite.link);}else await Share.share({message:convite.link});}catch{avisar('Não foi possível compartilhar. Use Copiar link do convite.','neutro');}};
  return <>
    <Folha visivel titulo={convite?'Convite criado':novo?'Convidar membro':'Editar membro'} aoFechar={aoFechar} rodape={convite?<Botao rotulo="Concluir" aoTocar={aoFechar}/>:<><Botao rotulo="Cancelar" tipo="secundario" aoTocar={aoFechar}/><Botao rotulo={novo?'Enviar convite':'Salvar membro'} carregando={ocupado} desabilitado={!nome.trim()||(!perfilId&&!euMesmo)||(novo&&!email.trim())||limiteInvalido} motivo={limiteInvalido?'Corrija o limite de alunos.':undefined} aoTocar={()=>{if(!novo&&membro?.ativo&&!ativo)setConfirmar(true);else void salvar();}}/></>}>
      {convite?<>
        {convite.emailEnviado?<Texto>O e-mail do convite já foi enviado para {email.trim()}. Use o link só se precisar mandar por outro meio.</Texto>:<Texto>O e-mail do convite não foi enviado agora. Copie o link e mande ao membro.</Texto>}
        <Texto>Válido até {dataHoraParaTela(convite.expiraEm)}. O link só pode ser usado uma vez.</Texto>
        <Texto selectable>{convite.codigo}</Texto><Botao rotulo="Copiar código" tipo="secundario" aoTocar={()=>void copiar(convite.codigo)}/>
        <Texto selectable>{convite.link}</Texto>
        <View style={{flexDirection:'row',gap:espaco(1),flexWrap:'wrap'}}><Botao rotulo="Copiar link do convite" tipo="secundario" aoTocar={()=>void copiar(convite.link)}/><Botao rotulo="Compartilhar convite" tipo="secundario" aoTocar={()=>void compartilhar()}/></View>
      </>:<>
        {novo?<Texto variante="suave">O convite vai por e-mail na hora, se o envio de e-mails estiver ligado. O link fica disponível depois, para copiar se precisar.</Texto>:null}
        {membro?.convitePendente?<Texto variante="suave">Gerar outro convite invalida o anterior.</Texto>:null}
        <Campo rotulo="Nome do membro" valor={nome} aoMudar={setNome} maxLength={120}/>
        {novo?<Campo rotulo="E-mail do membro" valor={email} aoMudar={setEmail} keyboardType="email-address" autoCapitalize="none" maxLength={254}/>:<Texto>{email}</Texto>}
        {euMesmo?<><CampoLeitura rotulo="Perfil do membro" valor={membro.perfilNome}/><Texto variante="pequeno">Você não pode trocar o próprio perfil nem se desativar. Peça a outro administrador.</Texto></>
          :<Escolha rotulo="Perfil do membro" opcoes={opcoes.map(p=>({valor:p.id,rotulo:p.nome}))} valor={perfilId} aoMudar={setPerfilId}/>}
        {!novo&&!euMesmo?<CaixaSelecao rotulo="Membro ativo" marcado={ativo} aoMudar={setAtivo} desabilitado={reativacaoBloqueada} ajuda={reativacaoBloqueada?`${MOTIVO_FORA_DO_PLANO}.`:undefined}/>:null}
        {mostraLimite?<Campo rotulo="Limite de alunos (opcional)" valor={limiteTexto} aoMudar={(t)=>{setLimiteTexto(t);setErroDoLimite(null);}} numerico keyboardType="number-pad" inputMode="numeric" maxLength={3} placeholder="Sem limite"
          erro={erroDoLimite??(leituraDoLimite.ok?null:leituraDoLimite.erro)} ajuda={AJUDA_DO_LIMITE}/>
          :!novo?<><CampoLeitura rotulo="Limite de alunos" valor={textoDoLimite(limiteGravado)}/><Texto variante="pequeno">Só um administrador altera o limite de alunos.</Texto></>:null}
      </>}
      {erro?<MensagemErro texto={textoDoErro(erro)}/>:null}
    </Folha>
    <PainelConfirmacao visivel={confirmar} titulo="Desativar membro?" mensagem="A sessão será encerrada e ele não poderá entrar até ser reativado." perigo rotuloConfirmar="Desativar membro" aoConfirmar={()=>void salvar()} aoCancelar={()=>setConfirmar(false)}/>
  </>;
}
