import { useState } from 'react';
import { View } from 'react-native';
import * as api from '../../api/rotas';
import type { PerfilEquipe, PermissaoEquipe } from '../../api/equipeTipos';
import { completarPermissoes, desmarcarPermissoes, permissaoMarcavel, podeDuplicarPerfil, podeEditarPerfil } from '../../dominio/perfilEquipe';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { CabecalhoDeGrupo } from '../../ui/CabecalhoDeGrupo';
import { CaixaSelecao } from '../../ui/CaixaSelecao';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Permitido } from '../../ui/Permitido';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { useAtorEquipe } from './useAtorEquipe';

export function PerfisEquipe({perfis,catalogo,recarregar}:{perfis:PerfilEquipe[];catalogo:PermissaoEquipe[];recarregar:()=>void}) {
  const [editar,setEditar]=useState<PerfilEquipe|'novo'|null>(null);
  const [excluir,setExcluir]=useState<PerfilEquipe|null>(null);
  const [ocupado,setOcupado]=useState(false);const [erro,setErro]=useState<unknown>(null);const {avisar}=useAviso();
  const ator=useAtorEquipe();
  const {cores}=useTema();
  const duplicar=async(p:PerfilEquipe)=>{setErro(null);try{await api.duplicarPerfilEquipe(p.id);recarregar();avisar('Perfil duplicado.','sucesso');}catch(e){setErro(e);}};
  const apagar=async()=>{if(!excluir)return;setOcupado(true);setErro(null);try{await api.excluirPerfilEquipe(excluir.id);setExcluir(null);recarregar();avisar('Perfil excluído.','sucesso');}catch(e){setExcluir(null);setErro(e);}finally{setOcupado(false);}};
  return <>
    <Cartao titulo="Perfis de acesso" descricao="Cada perfil define o que a pessoa vê e altera." acoes={<Permitido codigo="PERFIL_ALTERAR"><Botao rotulo="Novo perfil" aoTocar={()=>setEditar('novo')}/></Permitido>}>
    {erro?<MensagemErro texto={textoDoErro(erro)}/>:null}
    {perfis.map(p=><Cartao key={p.id} titulo={p.nome} style={{backgroundColor:cores.superficie2}} acoes={<>
      {p.sistema?<Selo texto="Acesso total · perfil do sistema" tipo="neutro"/>:null}
      {!p.ativo?<Selo texto="Inativo" tipo="neutro"/>:null}
    </>}>
      <Texto variante="suave">{p.descricao||'—'}</Texto><Texto variante="suave">{p.usuarios} {p.usuarios===1?'usuário':'usuários'}</Texto>
      <Permitido codigo="PERFIL_ALTERAR"><View style={{flexDirection:'row',gap:espaco(1),flexWrap:'wrap'}}>
        {podeEditarPerfil(ator,p)?<Botao rotulo={`Editar ${p.nome}`} tipo="secundario" aoTocar={()=>setEditar(p)}/>:null}
        {podeDuplicarPerfil(ator,p)?<Botao rotulo={`Duplicar ${p.nome}`} tipo="secundario" aoTocar={()=>void duplicar(p)}/>:null}
        {!p.sistema?<Botao rotulo={`Excluir ${p.nome}`} tipo="perigoTexto" aoTocar={()=>setExcluir(p)}/>:null}
      </View></Permitido>
    </Cartao>)}
    </Cartao>
    {editar?<EditorPerfil inicial={editar==='novo'?null:editar} catalogo={catalogo} aoFechar={()=>setEditar(null)} aoSalvar={()=>{setEditar(null);recarregar();avisar('Perfil salvo.','sucesso');}}/>:null}
    <PainelConfirmacao visivel={!!excluir} titulo={`Excluir ${excluir?.nome??'perfil'}?`} mensagem="Só é possível excluir perfis sem usuários nem convites pendentes." perigo rotuloConfirmar="Excluir perfil" carregando={ocupado} aoCancelar={()=>setExcluir(null)} aoConfirmar={()=>void apagar()}/>
  </>;
}
function EditorPerfil({inicial,catalogo,aoFechar,aoSalvar}:{inicial:PerfilEquipe|null;catalogo:PermissaoEquipe[];aoFechar:()=>void;aoSalvar:()=>void}) {
  const [nome,setNome]=useState(inicial?.nome??'');const [descricao,setDescricao]=useState(inicial?.descricao??'');
  const [permissoes,setPermissoes]=useState(inicial?.permissoes??[]);const [ativo,setAtivo]=useState(inicial?.ativo??true);
  const [erro,setErro]=useState<unknown>(null);const [ocupado,setOcupado]=useState(false);
  const ator=useAtorEquipe();
  // Só aparecem as permissões que quem edita também tem (a API recusa as outras).
  const disponiveis=catalogo.filter(p=>permissaoMarcavel(ator,p.codigo));
  const grupos=[...new Set(disponiveis.map(p=>p.secao))];
  const marcar=(codigos:string[],valor:boolean)=>setPermissoes(atuais=>valor?completarPermissoes([...atuais,...codigos]):desmarcarPermissoes(atuais,codigos));
  const salvar=async()=>{setOcupado(true);setErro(null);try{const dados={nome:nome.trim(),descricao:descricao.trim()||null,permissoes,ativo,versao:inicial?.versao??null};if(inicial)await api.alterarPerfilEquipe(inicial.id,dados);else await api.criarPerfilEquipe(dados);aoSalvar();}catch(e){setErro(e);}finally{setOcupado(false);}};
  return <Folha visivel titulo={inicial?'Editar perfil':'Novo perfil'} aoFechar={aoFechar} rodape={<><Botao rotulo="Cancelar" tipo="secundario" aoTocar={aoFechar}/><Botao rotulo="Salvar perfil" carregando={ocupado} desabilitado={!nome.trim()} aoTocar={()=>void salvar()}/></>}>
    <Campo rotulo="Nome do perfil" valor={nome} aoMudar={setNome} maxLength={120}/>
    <Campo rotulo="Descrição" valor={descricao} aoMudar={setDescricao} linhas={3} maxLength={500}/>
    <CaixaSelecao rotulo="Perfil ativo" marcado={ativo} aoMudar={setAtivo}/>
    <Texto variante="suave">As permissões necessárias são marcadas automaticamente. Desmarcar uma delas remove as ações que dependem dela.</Texto>
    {grupos.map(secao=>{const itens=disponiveis.filter(p=>p.secao===secao);return <View key={secao} style={{gap:espaco(1),marginTop:espaco(2)}}>
      <CabecalhoDeGrupo titulo={secao}/>
      <CaixaSelecao rotulo={`Marcar toda a seção ${secao}`} marcado={itens.every(p=>permissoes.includes(p.codigo))} aoMudar={v=>marcar(itens.map(p=>p.codigo),v)}/>
      {itens.map(p=><View key={p.codigo} style={{gap:espaco(.5)}}>
        <CaixaSelecao rotulo={`${p.modulo} · ${p.descricao}`} marcado={permissoes.includes(p.codigo)} aoMudar={v=>marcar([p.codigo],v)}/>
        {p.sensivel?<Selo texto="Dado sensível" tipo="atencao"/>:null}
      </View>)}
    </View>;})}
    {erro?<MensagemErro texto={textoDoErro(erro)}/>:null}
  </Folha>;
}
