import { useState } from 'react';
import { View } from 'react-native';
import { listarAuditoria,pessoasAuditoria } from '../../api/rotas';
import { dataDaTela,dataHoraParaTela } from '../../dominio/formatos';
import { LARGURA_LISTA,espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { Campo } from '../../ui/Campo';
import { CampoData } from '../../ui/Campos';
import { Cartao } from '../../ui/Cartao';
import { Escolha } from '../../ui/Escolha';
import { Carregando,MensagemErro,Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { Folha } from '../../ui/Folha';
import { ACOES_AUDITORIA } from '../../treinador/equipe/acoesAuditoria';
export default function Auditoria() {
  const [de,setDe]=useState('');const [ate,setAte]=useState('');const [pessoa,setPessoa]=useState('');const [acao,setAcao]=useState('');
  const [escolherAcao,setEscolherAcao]=useState(false);const [buscaAcao,setBuscaAcao]=useState('');
  const [filtro,setFiltro]=useState<{de?:string;ate?:string;usuarioId?:string;acao?:string;pagina:number}>({pagina:0});
  const {dados:membros,erro:erroPessoas,recarregar:recarregarPessoas}=useCarregar('pessoas-auditoria',()=>pessoasAuditoria());
  const {dados,erro,carregando,recarregar}=useCarregar(JSON.stringify(filtro),()=>listarAuditoria(filtro));
  const inicio=dataDaTela(de),fim=dataDaTela(ate);const invalido=inicio===undefined||fim===undefined||!!(inicio&&fim&&fim<inicio);
  return <Tela largura={LARGURA_LISTA} bordas={['top']}><Cabecalho titulo="Auditoria"/>
    <Cartao titulo="Filtros"><Escolha rotulo="Pessoa" valor={pessoa} aoMudar={setPessoa} opcoes={[{valor:'',rotulo:'Todas as pessoas'},...(membros??[]).map(m=>({valor:m.id,rotulo:m.nome}))]}/>
      {erroPessoas?<MensagemErro texto={textoDoErro(erroPessoas)} tentarDeNovo={recarregarPessoas}/>:null}
      <Botao rotulo={`Ação: ${ACOES_AUDITORIA[acao]??'Todas as ações'}`} tipo="secundario" aoTocar={()=>setEscolherAcao(true)}/>
      <View style={{flexDirection:'row',gap:espaco(2),flexWrap:'wrap'}}><CampoData rotulo="De" valor={de} aoMudar={setDe}/><CampoData rotulo="Até" valor={ate} aoMudar={setAte}/></View>
      {invalido?<Texto>Confira o período informado.</Texto>:null}
      <Botao rotulo="Filtrar auditoria" desabilitado={invalido} aoTocar={()=>setFiltro({de:inicio??undefined,ate:fim??undefined,usuarioId:pessoa||undefined,acao:acao.trim()||undefined,pagina:0})}/>
    </Cartao>
    {erro?<MensagemErro texto={textoDoErro(erro)} tentarDeNovo={recarregar}/>:null}{carregando&&!dados?<Carregando/>:null}
    {dados?.itens.length===0?<Vazio titulo="Sem eventos neste filtro" texto="Tente outro período, pessoa ou ação."/>:null}
    {dados?.itens.map(e=><Cartao key={e.id} titulo={e.nomeUsuario}><Texto variante="pequeno">{dataHoraParaTela(e.criadoEm)} · {ACOES_AUDITORIA[e.acao]??'Ação registrada'}</Texto><Texto>{e.resumo}</Texto></Cartao>)}
    {dados&&dados.total>50?<View style={{flexDirection:'row',gap:espaco(1),flexWrap:'wrap'}}><Botao rotulo="Anterior" tipo="secundario" desabilitado={filtro.pagina===0} aoTocar={()=>setFiltro({...filtro,pagina:filtro.pagina-1})}/><Texto>Página {filtro.pagina+1} de {Math.ceil(dados.total/50)}</Texto><Botao rotulo="Próxima" tipo="secundario" desabilitado={(filtro.pagina+1)*50>=dados.total} aoTocar={()=>setFiltro({...filtro,pagina:filtro.pagina+1})}/></View>:null}
    {escolherAcao?<Folha visivel titulo="Filtrar por ação" aoFechar={()=>setEscolherAcao(false)}>
      <Campo rotulo="Buscar ação" valor={buscaAcao} aoMudar={setBuscaAcao}/>
      <Botao rotulo="Todas as ações" tipo="secundario" aoTocar={()=>{setAcao('');setEscolherAcao(false);}}/>
      {Object.entries(ACOES_AUDITORIA).filter(([,nome])=>nome.toLocaleLowerCase('pt-BR').includes(buscaAcao.toLocaleLowerCase('pt-BR'))).map(([codigo,nome])=><Botao key={codigo} rotulo={nome} tipo="secundario" aoTocar={()=>{setAcao(codigo);setEscolherAcao(false);}}/>)}
    </Folha>:null}
  </Tela>;
}
