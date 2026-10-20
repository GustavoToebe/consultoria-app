import { useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { listarAuditoria,pessoasAuditoria } from '../../api/rotas';
import { dataDaTela,dataHoraParaTela } from '../../dominio/formatos';
import { LARGURA_LISTA,LARGURA_MENU_LATERAL,espaco } from '../../tema/tokens';
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
/**
 * Auditoria: eventos da consultoria com filtros que valem na hora (como em Interessados), sem botão "Filtrar". Período
 * incompleto ou inválido não busca: fica a última busca válida. No celular os filtros começam recolhidos.
 */
export default function Auditoria() {
  const {width}=useWindowDimensions();
  const [de,setDe]=useState('');const [ate,setAte]=useState('');const [pessoa,setPessoa]=useState('');const [acao,setAcao]=useState('');
  const [pagina,setPagina]=useState(0);
  const [valido,setValido]=useState<{de?:string;ate?:string}>({});
  const {dados:membros,erro:erroPessoas,recarregar:recarregarPessoas}=useCarregar('pessoas-auditoria',()=>pessoasAuditoria());
  const inicio=dataDaTela(de),fim=dataDaTela(ate);const invalido=inicio===undefined||fim===undefined||!!(inicio&&fim&&fim<inicio);
  // Data digitada pela metade não apaga a busca: o período só muda quando os dois campos fazem sentido.
  const periodo=invalido?valido:{de:inicio??undefined,ate:fim??undefined};
  const filtro={...periodo,usuarioId:pessoa||undefined,acao:acao.trim()||undefined,pagina};
  const mudarPeriodo=(campo:'de'|'ate',valor:string)=>{
    const novoDe=campo==='de'?valor:de,novoAte=campo==='ate'?valor:ate;
    if(campo==='de')setDe(valor);else setAte(valor);
    const i=dataDaTela(novoDe),f=dataDaTela(novoAte);
    if(i!==undefined&&f!==undefined&&!(i&&f&&f<i)){setValido({de:i??undefined,ate:f??undefined});setPagina(0);}
  };
  const {dados,erro,carregando,recarregar}=useCarregar(JSON.stringify(filtro),()=>listarAuditoria(filtro));
  return <Tela largura={LARGURA_LISTA} bordas={['top']}><Cabecalho titulo="Auditoria" subtitulo="Ações feitas na consultoria, guardadas por um ano. Valores clínicos não aparecem."/>
    <Cartao titulo="Filtros" descricao="Combine pessoa, ação e período. A lista muda na hora." recolhivel recolhido={width<LARGURA_MENU_LATERAL}>
      {/* Pessoa e ação com o mesmo padrão: botão "Rótulo: valor" que abre a lista com busca. */}
      <LinhaDeAcoes>
        <EscolhaEmFolha rotulo="Pessoa" valor={pessoa} aoMudar={(v)=>{setPessoa(v);setPagina(0);}} opcoes={[{valor:'',rotulo:'Todas as pessoas'},...(membros??[]).map(m=>({valor:m.id,rotulo:m.nome}))]}/>
        <EscolhaEmFolha rotulo="Ação" titulo="Filtrar por ação" valor={acao} aoMudar={(v)=>{setAcao(v);setPagina(0);}} opcoes={[{valor:'',rotulo:'Todas as ações'},...Object.entries(ACOES_AUDITORIA).map(([codigo,nome])=>({valor:codigo,rotulo:nome}))]}/>
      </LinhaDeAcoes>
      {erroPessoas?<MensagemErro texto={textoDoErro(erroPessoas)} tentarDeNovo={recarregarPessoas}/>:null}
      <View style={{flexDirection:'row',gap:espaco(2),flexWrap:'wrap',alignItems:'flex-end'}}>
        <CampoData rotulo="De" valor={de} aoMudar={(v)=>mudarPeriodo('de',v)} erro={inicio===undefined?'Data inválida.':undefined}/><CampoData rotulo="Até" valor={ate} aoMudar={(v)=>mudarPeriodo('ate',v)} erro={fim===undefined?'Data inválida.':!!(inicio&&fim&&fim<inicio)?'Fim antes do início.':undefined}/>
      </View>
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
    {dados&&dados.total>50?<View style={{flexDirection:'row',gap:espaco(1),flexWrap:'wrap',alignItems:'center'}}><Botao rotulo="Anterior" tipo="secundario" desabilitado={pagina===0} aoTocar={()=>setPagina(pagina-1)}/><Texto>Página {pagina+1} de {Math.ceil(dados.total/50)}</Texto><Botao rotulo="Próxima" tipo="secundario" desabilitado={(pagina+1)*50>=dados.total} aoTocar={()=>setPagina(pagina+1)}/></View>:null}
    </Cartao> : null}
  </Tela>;
}
