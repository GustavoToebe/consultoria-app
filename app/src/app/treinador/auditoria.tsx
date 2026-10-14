import { useState } from 'react';
import { View } from 'react-native';
import { listarAuditoria,pessoasAuditoria } from '../../api/rotas';
import { dataDaTela,dataHoraParaTela } from '../../dominio/formatos';
import { LARGURA_LISTA,espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { CampoData } from '../../ui/Campos';
import { Cartao } from '../../ui/Cartao';
import { EscolhaEmFolha } from '../../ui/EscolhaEmFolha';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Tabela } from '../../ui/Tabela';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro,Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { ACOES_AUDITORIA } from '../../treinador/equipe/acoesAuditoria';
export default function Auditoria() {
  const [de,setDe]=useState('');const [ate,setAte]=useState('');const [pessoa,setPessoa]=useState('');const [acao,setAcao]=useState('');
  const [filtro,setFiltro]=useState<{de?:string;ate?:string;usuarioId?:string;acao?:string;pagina:number}>({pagina:0});
  const {dados:membros,erro:erroPessoas,recarregar:recarregarPessoas}=useCarregar('pessoas-auditoria',()=>pessoasAuditoria());
  const {dados,erro,carregando,recarregar}=useCarregar(JSON.stringify(filtro),()=>listarAuditoria(filtro));
  const inicio=dataDaTela(de),fim=dataDaTela(ate);const invalido=inicio===undefined||fim===undefined||!!(inicio&&fim&&fim<inicio);
  return <Tela largura={LARGURA_LISTA} bordas={['top']}><Cabecalho titulo="Auditoria"/>
    <Texto variante="suave">Registro das ações feitas na consultoria, guardado por um ano. Os valores clínicos não aparecem.</Texto>
    <Cartao titulo="Filtros" descricao="Combine pessoa, ação e período para achar um evento.">
      {/* Pessoa e ação com o mesmo padrão: botão "Rótulo: valor" que abre a lista com busca. */}
      <LinhaDeAcoes>
        <EscolhaEmFolha rotulo="Pessoa" valor={pessoa} aoMudar={setPessoa} opcoes={[{valor:'',rotulo:'Todas as pessoas'},...(membros??[]).map(m=>({valor:m.id,rotulo:m.nome}))]}/>
        <EscolhaEmFolha rotulo="Ação" titulo="Filtrar por ação" valor={acao} aoMudar={setAcao} opcoes={[{valor:'',rotulo:'Todas as ações'},...Object.entries(ACOES_AUDITORIA).map(([codigo,nome])=>({valor:codigo,rotulo:nome}))]}/>
      </LinhaDeAcoes>
      {erroPessoas?<MensagemErro texto={textoDoErro(erroPessoas)} tentarDeNovo={recarregarPessoas}/>:null}
      <View style={{flexDirection:'row',gap:espaco(2),flexWrap:'wrap',alignItems:'flex-end'}}>
        <CampoData rotulo="De" valor={de} aoMudar={setDe} erro={inicio===undefined?'Data inválida.':undefined}/><CampoData rotulo="Até" valor={ate} aoMudar={setAte} erro={fim===undefined?'Data inválida.':!!(inicio&&fim&&fim<inicio)?'Fim antes do início.':undefined}/>
      </View>
      <Botao rotulo="Filtrar auditoria" desabilitado={invalido} motivo="Confira o período informado." aoTocar={()=>setFiltro({de:inicio??undefined,ate:fim??undefined,usuarioId:pessoa||undefined,acao:acao.trim()||undefined,pagina:0})}/>
    </Cartao>
    {erro?<MensagemErro texto={textoDoErro(erro)} tentarDeNovo={recarregar}/>:null}{carregando&&!dados?<Esqueleto/>:null}
    {dados?.itens.length===0?<Vazio titulo="Sem eventos neste filtro" texto="Tente outro período, pessoa ou ação."/>:null}
    {dados?.itens.length ? <Cartao titulo="Eventos" descricao={`${dados.total} ${dados.total===1?'evento':'eventos'} neste filtro.`}>
    {/* Linhas de tabela a partir de 760 px (quando/quem/ação/resumo); no celular, cartões com os mesmos campos. */}
    <Tabela rotulo="Eventos da auditoria" larguraMinima={760} linhas={dados.itens} chave={e=>e.id} colunas={[
      {chave:'quando',titulo:'Quando',flex:1.1,render:e=><Texto numerico>{dataHoraParaTela(e.criadoEm)}</Texto>},
      {chave:'quem',titulo:'Quem',flex:1.2,principal:true,render:e=><Texto variante="bloco">{e.nomeUsuario}</Texto>},
      {chave:'acao',titulo:'Ação',flex:1.2,render:e=><Texto>{ACOES_AUDITORIA[e.acao]??'Ação registrada'}</Texto>},
      {chave:'resumo',titulo:'Resumo',flex:2.4,render:e=><Texto>{e.resumo}</Texto>},
    ]}/>
    {dados&&dados.total>50?<View style={{flexDirection:'row',gap:espaco(1),flexWrap:'wrap',alignItems:'center'}}><Botao rotulo="Anterior" tipo="secundario" desabilitado={filtro.pagina===0} aoTocar={()=>setFiltro({...filtro,pagina:filtro.pagina-1})}/><Texto>Página {filtro.pagina+1} de {Math.ceil(dados.total/50)}</Texto><Botao rotulo="Próxima" tipo="secundario" desabilitado={(filtro.pagina+1)*50>=dados.total} aoTocar={()=>setFiltro({...filtro,pagina:filtro.pagina+1})}/></View>:null}
    </Cartao> : null}
  </Tela>;
}
