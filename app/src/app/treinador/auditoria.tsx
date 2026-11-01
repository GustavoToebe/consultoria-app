import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { listarAuditoria,pessoasAuditoria } from '../../api/rotas';
import { paraSetParams } from '../../dominio/filtrosComuns';
import {
  CHAVES_DO_ENDERECO, chipsDosFiltros, lerDoEndereco, paraEndereco, pedidoDaApi, SEM_FILTROS, semOFiltro,
  type ChaveDoFiltro, type FiltrosDeAuditoria, type ParametrosDoEndereco,
} from '../../dominio/filtrosDeAuditoria';
import { dataHoraParaTela } from '../../dominio/formatos';
import { LARGURA_LISTA,espaco } from '../../tema/tokens';
import { CamposDePeriodo, CelulaDoFiltro } from '../../treinador/SeletoresDeFiltro';
import { BarraDeFiltros } from '../../ui/BarraDeFiltros';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { Cartao } from '../../ui/Cartao';
import { EscolhaEmFolha } from '../../ui/EscolhaEmFolha';
import { Tabela } from '../../ui/Tabela';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro,Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { ACOES_AUDITORIA } from '../../treinador/equipe/acoesAuditoria';

const OPCOES_DE_ACAO=[{valor:'',rotulo:'Todas as ações'},...Object.entries(ACOES_AUDITORIA).map(([codigo,nome])=>({valor:codigo,rotulo:nome}))];

/**
 * Auditoria: eventos da consultoria. Pessoa, ação e período ficam na barra de filtros (`docs/planos/filtros-nas-listas.md`,
 * D9), no endereço (`?usuarioId=&acao=&de=&ate=`), e valem na hora. Período incompleto ou inválido não busca: fica o
 * último período válido.
 */
export default function Auditoria() {
  const filtros=lerDoEndereco(useLocalSearchParams<Record<keyof ParametrosDoEndereco,string>>(),ACOES_AUDITORIA);
  const [pagina,setPagina]=useState(0);
  const {dados:membros,erro:erroPessoas,recarregar:recarregarPessoas}=useCarregar('pessoas-auditoria',()=>pessoasAuditoria());
  const filtro={...pedidoDaApi(filtros),pagina};
  const {dados,erro,carregando,recarregar}=useCarregar(JSON.stringify(filtro),()=>listarAuditoria(filtro));
  // Trocar um filtro troca o endereço sem empilhar histórico e volta à página 1.
  const aplicar=(novos:FiltrosDeAuditoria)=>{setPagina(0);router.setParams(paraSetParams(CHAVES_DO_ENDERECO,paraEndereco(novos)));};
  const nomeDe=(id:string)=>membros?.find(m=>m.id===id)?.nome??null;
  const chips=chipsDosFiltros(filtros,nomeDe,ACOES_AUDITORIA);
  return <Tela largura={LARGURA_LISTA} bordas={['top']}><Cabecalho titulo="Auditoria" subtitulo="Ações feitas na consultoria, guardadas por um ano. Valores clínicos não aparecem."/>
    <BarraDeFiltros valor={filtros} aoAplicar={aplicar} limpo={SEM_FILTROS} chips={chips} aoTirar={(chave)=>aplicar(semOFiltro(filtros,chave as ChaveDoFiltro))}
      rotuloDoResultado="Ver eventos" seletores={(atuais,mudar)=><>
        {/* Pessoa e ação com o mesmo padrão: botão "Rótulo: valor" que abre a lista com busca. */}
        <CelulaDoFiltro><EscolhaEmFolha rotulo="Pessoa" valor={atuais.usuarioId} aoMudar={(usuarioId)=>mudar({...atuais,usuarioId})} opcoes={[{valor:'',rotulo:'Todas as pessoas'},...(membros??[]).map(m=>({valor:m.id,rotulo:m.nome}))]}/></CelulaDoFiltro>
        <CelulaDoFiltro><EscolhaEmFolha rotulo="Ação" titulo="Filtrar por ação" valor={atuais.acao} aoMudar={(acao)=>mudar({...atuais,acao})} opcoes={OPCOES_DE_ACAO}/></CelulaDoFiltro>
        <CelulaDoFiltro><CamposDePeriodo valor={atuais.periodo} aoMudar={(periodo)=>mudar({...atuais,periodo})}/></CelulaDoFiltro>
      </>}/>
    {erroPessoas?<MensagemErro texto={textoDoErro(erroPessoas)} tentarDeNovo={recarregarPessoas}/>:null}
    {erro?<MensagemErro texto={textoDoErro(erro)} tentarDeNovo={recarregar}/>:null}{carregando&&!dados?<Esqueleto/>:null}
    {dados?.itens.length===0?<Vazio titulo="Sem eventos neste filtro" texto="Tente outro período, pessoa ou ação." acao={chips.length?{rotulo:'Limpar filtros',aoTocar:()=>aplicar(SEM_FILTROS)}:undefined}/>:null}
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
