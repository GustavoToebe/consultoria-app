import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { EventoAuditoria } from '../../api/equipeTipos';
import { listarAuditoria,pessoasAuditoria } from '../../api/rotas';
import { atalhoDoEndereco, atalhoParaEndereco, OPCOES_DE_ATALHO, type AtalhoDeAuditoria } from '../../dominio/categoriasDeAuditoria';
import { paraSetParams } from '../../dominio/filtrosComuns';
import {
  CHAVES_DO_ENDERECO, chipsDosFiltros, lerDoEndereco, opcoesDePessoa, paraEndereco, pedidoComAtalho, pedidoDaApi, SEM_FILTROS, semOFiltro,
  type ChaveDoFiltro, type FiltrosDeAuditoria, type ParametrosDoEndereco,
} from '../../dominio/filtrosDeAuditoria';
import { hojeEmBrasilia } from '../../dominio/financeiro';
import { agruparPorDia, juntarPaginas, textoDaContagem } from '../../dominio/resumoDeAuditoria';
import { useTema } from '../../tema/TemaProvider';
import { LARGURA_LISTA, espaco } from '../../tema/tokens';
import { CamposDePeriodo } from '../../treinador/SeletoresDeFiltro';
import { FolhaDoEvento, PainelDoEvento } from '../../treinador/auditoria/DetalheDoEvento';
import { ListaDeEventos } from '../../treinador/auditoria/ListaDeEventos';
import { ACOES_AUDITORIA } from '../../treinador/equipe/acoesAuditoria';
import { BarraDeFiltros, GrupoDoPainel } from '../../ui/BarraDeFiltros';
import { ChipsDeUmaOpcao } from '../../ui/ChipsDeFiltro';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { Cartao } from '../../ui/Cartao';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro,Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { SelecaoMultiplaSuspensa } from '../../ui/SelecaoMultiplaSuspensa';
import { Texto } from '../../ui/Texto';
import { Tela, useFaixaDaTela } from '../../ui/Tela';
import { useCarregar } from '../../ui/useCarregar';

const OPCOES_DE_ACAO=Object.entries(ACOES_AUDITORIA).map(([codigo,nome])=>({valor:codigo,rotulo:nome})).sort((a,b)=>a.rotulo.localeCompare(b.rotulo,'pt-BR'));
const TAMANHO_DA_PAGINA=50;

/** As páginas que o "Carregar mais" acrescentou, do filtro `chave` (outra chave = não valem). */
interface Mais { chave: string; itens: EventoAuditoria[]; pagina: number; total: number }

/**
 * Auditoria: eventos da consultoria. Pessoas (várias, e "Sistema"), ações (várias) e período ficam no painel lateral de
 * filtros (`docs/planos/filtros-laterais.md`), no endereço (`?usuarioId=&acao=&de=&ate=`, várias numa vírgula), e valem
 * no "Aplicar filtros". Período incompleto ou inválido segura o Aplicar com o erro no campo.
 *
 * Auditoria mais útil (27/11):
 * - Atalhos na linha do "Filtros" (Tudo · Sem logins · Alunos · Planos · Financeiro · Equipe; `?atalho=`, fora do painel e
 *   do "Limpar filtros"). Cada atalho vira a lista de ações da categoria (`dominio/categoriasDeAuditoria`) e combina com o
 *   filtro "Ação" por interseção; sem ação em comum, a tela não pergunta à API e diz o porquê.
 * - Lista agrupada por dia de Brasília ("Hoje", "Ontem", a data), a hora na coluna Quando, a bolinha da categoria na ação
 *   e as iniciais de quem fez; o resumo diz o objeto afetado ("Aluno Vitor Luiz Santos") ou a origem.
 * - "Carregar mais" acrescenta a página seguinte (50 por vez) e a contagem do filtro continua na barra.
 * - Tela larga (28/11): os atalhos são chips de uma escolha à esquerda (`ui/ChipsDeFiltro.ChipsDeUmaOpcao`, tonal com ✓; seis
 *   opções não cabem em segmento pela regra única dos filtros), o "Filtros" logo ao lado
 *   e a contagem ("252 eventos neste filtro", texto secundário e região viva) na própria barra; o cartão da lista não tem
 *   mais o título "Eventos".
 * - A partir da faixa `larga` (1600 px de área), a tabela ocupa o espaço e o detalhe fica num painel fixo de 420 px à
 *   direita (`PainelDoEvento`); abaixo, ou com "Detalhes abrem: No centro", o detalhe abre na folha.
 */
export default function Auditoria() {
  // O corpo mora dentro da `Tela`: só ali a faixa da área (`useFaixaDaTela`) é a medida, fora dela é sempre `compacta`.
  return <Tela largura={LARGURA_LISTA} bordas={['top']}><Cabecalho titulo="Auditoria" descricao="Ações feitas na consultoria, guardadas por um ano. Valores clínicos não aparecem."/><CorpoDaAuditoria/></Tela>;
}

function CorpoDaAuditoria() {
  const parametros=useLocalSearchParams<Record<keyof ParametrosDoEndereco|'atalho',string>>();
  const filtros=lerDoEndereco(parametros,ACOES_AUDITORIA);
  const atalho=atalhoDoEndereco(parametros.atalho);
  const faixa=useFaixaDaTela();
  const {preferencias}=useTema();
  const comPainel=(faixa==='larga'||faixa==='ultralarga')&&preferencias.detalhesAbrem!=='CENTRO';
  const {dados:membros,erro:erroPessoas,recarregar:recarregarPessoas}=useCarregar('pessoas-auditoria',()=>pessoasAuditoria());
  const pedido=pedidoComAtalho(filtros,atalho,ACOES_AUDITORIA);
  // Sem ação em comum entre o atalho e o filtro "Ação" não há o que buscar (lista vazia, para a API, é "todas").
  const chave=pedido==='NENHUMA'?null:JSON.stringify(pedido);
  const primeira=useCarregar(chave,()=>listarAuditoria({...(pedido==='NENHUMA'?{}:pedido),pagina:0}));
  const [mais,setMais]=useState<Mais|null>(null);
  const [carregandoMais,setCarregandoMais]=useState<string|null>(null);
  const [erroMais,setErroMais]=useState<{chave:string;erro:unknown}|null>(null);
  const [escolhido,setEscolhido]=useState<{chave:string;id:string}|null>(null);
  // A chave em vigor, para descartar a página que chega depois de a pessoa trocar o filtro.
  const chaveAtual=useRef(chave);
  useEffect(()=>{ chaveAtual.current=chave; },[chave]);

  const extra=mais&&mais.chave===chave?mais:null;
  const dados=pedido==='NENHUMA'?undefined:primeira.dados;
  const itens=dados?extra?juntarPaginas(dados.itens,extra.itens):dados.itens:[];
  const total=extra?.total??dados?.total??0;
  const pagina=extra?.pagina??0;
  const temMais=!!dados&&(pagina+1)*TAMANHO_DA_PAGINA<total;
  const aCarregar=chave!==null&&carregandoMais===chave;
  const falhaDoMais=erroMais&&erroMais.chave===chave?erroMais.erro:null;
  const selecionado=escolhido&&escolhido.chave===chave?itens.find(e=>e.id===escolhido.id)??null:null;
  const desatualizada=primeira.dadosDeOutraChave;

  const carregarMais=async()=>{
    if(chave===null||pedido==='NENHUMA'||aCarregar)return;
    const daChave=chave;const proxima=pagina+1;
    setCarregandoMais(daChave);setErroMais(null);
    try {
      const r=await listarAuditoria({...pedido,pagina:proxima});
      if(chaveAtual.current!==daChave)return;
      setMais(m=>({chave:daChave,itens:juntarPaginas(m&&m.chave===daChave?m.itens:[],r.itens),pagina:proxima,total:r.total}));
    } catch(erro) {
      if(chaveAtual.current===daChave)setErroMais({chave:daChave,erro});
    } finally {
      setCarregandoMais(c=>(c===daChave?null:c));
    }
  };

  // Trocar um filtro troca o endereço sem empilhar histórico; Aplicar sem mudar nada não mexe em nada. As páginas a mais
  // e o evento escolhido valem só para o filtro em que nasceram (`chave`).
  const aplicar=(novos:FiltrosDeAuditoria)=>{
    if(JSON.stringify(pedidoDaApi(novos))===JSON.stringify(pedidoDaApi(filtros)))return;
    router.setParams(paraSetParams(CHAVES_DO_ENDERECO,paraEndereco(novos)));
  };
  const mudarAtalho=(novo:AtalhoDeAuditoria)=>{ if(novo!==atalho)router.setParams({atalho:atalhoParaEndereco(novo)}); };
  const nomeDe=(id:string)=>membros?.find(m=>m.id===id)?.nome??null;
  const chips=chipsDosFiltros(filtros,nomeDe,ACOES_AUDITORIA);
  const rotuloDoAtalho=OPCOES_DE_ATALHO.find(o=>o.valor===atalho)?.rotulo??'Tudo';
  const escolher=(e:EventoAuditoria)=>{ if(chave!==null)setEscolhido({chave,id:e.id}); };
  const fechar=()=>setEscolhido(null);
  // Sempre montada (região viva): o leitor de tela ouve a contagem nova ao trocar o filtro; some na carga e com a lista velha.
  const contagem=(
    <View accessibilityLiveRegion="polite" aria-live="polite">
      {itens.length&&dados&&!desatualizada?<Texto variante="suave" numerico>{textoDaContagem(total)}</Texto>:null}
    </View>
  );

  const lista=itens.length&&dados?(
    <Cartao>
      <View style={desatualizada?estilos.esmaecido:null} pointerEvents={desatualizada?'none':'auto'}>
        <ListaDeEventos grupos={agruparPorDia(itens,hojeEmBrasilia())} selecionadoId={selecionado?.id??null} aoEscolher={escolher}/>
      </View>
      {falhaDoMais?<MensagemErro texto={textoDoErro(falhaDoMais)} erro={falhaDoMais} tentarDeNovo={carregarMais}/>:null}
      {temMais&&!desatualizada?(
        <View style={estilos.rodape}>
          <Botao rotulo={aCarregar?'Carregando eventos…':'Carregar mais'} tipo="secundario" carregando={aCarregar} aoTocar={carregarMais}/>
        </View>
      ):null}
    </Cartao>
  ):null;

  return <>
    <BarraDeFiltros valor={filtros} aoAplicar={aplicar} limpo={SEM_FILTROS} chips={chips} aoTirar={(c)=>aplicar(semOFiltro(filtros,c as ChaveDoFiltro))}
      painelLateral={{titulo:'Filtros de eventos'}}
      // "Mostrar N eventos": o mesmo pedido da lista (com o atalho em vigor), página 0, lendo o total.
      resultado={{itens:{um:'evento',varios:'eventos'},total:desatualizada?undefined:dados?.total,buscar:(r)=>{ const p=pedidoComAtalho(r,atalho,ACOES_AUDITORIA); return p==='NENHUMA'?Promise.resolve(0):listarAuditoria({...p,pagina:0}).then(x=>x.total); }}}
      // Atalhos à esquerda do "Filtros", na mesma linha: o recorte mais usado sem abrir o painel.
      // Seis opções de uma escolha: chips da regra única (tonal com ✓), não segmento; "Tudo" fica à vista.
      antes={<ChipsDeUmaOpcao<AtalhoDeAuditoria> rotulo="Atalhos de eventos" rotuloVisivel={false} opcoes={OPCOES_DE_ATALHO} valor={atalho} aoMudar={mudarAtalho}/>}
      // Uma linha só, à esquerda: atalhos, "Filtros · N", as etiquetas com o "Limpar" e a contagem no fim.
      arranjo="linhaUnica" fim={contagem}
      seletores={(atuais,mudar)=><>
        {/* Pessoa e ação com o mesmo padrão: várias opções com busca (nada marcado = todas). Exceção da regra única dos
            filtros: são listas longas e do cadastro (dezenas de pessoas, centenas de ações), que em chips não teriam busca. */}
        <GrupoDoPainel titulo="Identificação" primeiro>
          <SelecaoMultiplaSuspensa rotulo="Pessoa" opcoes={opcoesDePessoa(membros??[])} marcados={new Set(atuais.pessoas)} rotuloDeTodos="Todas as pessoas" aoMudar={(m)=>mudar({...atuais,pessoas:[...m]})} style={{alignSelf:'stretch'}}/>
          {/* Falha da lista de pessoas é do filtro: fica no controle dele, não como segundo alerta acima da lista. */}
          {erroPessoas?<MensagemErro texto={textoDoErro(erroPessoas)} erro={erroPessoas} tentarDeNovo={recarregarPessoas}/>:null}
          <SelecaoMultiplaSuspensa rotulo="Ação" opcoes={OPCOES_DE_ACAO} marcados={new Set(atuais.acoes)} rotuloDeTodos="Todas as ações" aoMudar={(m)=>mudar({...atuais,acoes:[...m]})} style={{alignSelf:'stretch'}}/>
        </GrupoDoPainel>
        <GrupoDoPainel titulo="Datas"><CamposDePeriodo regra="PLANEJAMENTO" valor={atuais.periodo} aoMudar={(periodo)=>mudar({...atuais,periodo})}/></GrupoDoPainel>
      </>}/>
    {pedido==='NENHUMA'?(
      <Vazio titulo="Nenhuma ação em comum" texto={`O atalho “${rotuloDoAtalho}” e o filtro de ação não têm nenhuma ação em comum. Escolha outro atalho ou mude a ação.`}
        acao={{rotulo:'Ver tudo',aoTocar:()=>mudarAtalho('TUDO')}}/>
    ):null}
    {primeira.erro?<MensagemErro texto={textoDoErro(primeira.erro)} erro={primeira.erro} tentarDeNovo={primeira.recarregar}/>:null}
    {primeira.carregando&&!dados?<Esqueleto/>:null}
    {dados?.itens.length===0&&!desatualizada?<Vazio titulo="Sem eventos neste filtro" texto={atalho==='TUDO'?'Tente outro período, pessoa ou ação.':`Nenhum evento em “${rotuloDoAtalho}” com estes filtros. Tente outro atalho, período, pessoa ou ação.`}
      acao={chips.length?{rotulo:'Limpar filtros',aoTocar:()=>aplicar(SEM_FILTROS)}:atalho!=='TUDO'?{rotulo:'Ver tudo',aoTocar:()=>mudarAtalho('TUDO')}:undefined}/>:null}
    {lista&&comPainel?(
      <View style={estilos.comPainel}>
        <View style={estilos.ladoDaLista}>{lista}</View>
        <PainelDoEvento evento={selecionado} aoFechar={fechar}/>
      </View>
    ):lista}
    <FolhaDoEvento evento={comPainel?null:selecionado} aoFechar={fechar}/>
  </>;
}

const estilos=StyleSheet.create({
  comPainel:{flexDirection:'row',alignItems:'flex-start',gap:espaco(3)},
  ladoDaLista:{flex:1,minWidth:0},
  rodape:{flexDirection:'row',justifyContent:'center'},
  esmaecido:{opacity:0.6},
});
