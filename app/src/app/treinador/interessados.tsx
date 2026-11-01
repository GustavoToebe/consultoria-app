import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { MessageSquareText } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { EtapaAberta, InscricaoResumo } from '../../api/inscricoesTipos';
import { contagensInscricoes, listarInscricoes, responsaveisEquipe, retornosPendentes } from '../../api/rotas';
import { hojeEmBrasilia } from '../../dominio/agendaPresencial';
import { instanteRelativo } from '../../dominio/datasRelativas';
import { paraSetParams } from '../../dominio/filtrosComuns';
import {
  chaveDosFiltros as chaveDaFila, CHAVES_DO_ENDERECO, chipsDosFiltros, filtrosDaFila, filtrosVisiveis, lerDoEndereco, limpos, MEUS,
  OPCOES_FILTRO_ORIGEM, opcoesDeResponsavel, paraEndereco, paraEnderecoSemSituacao, semOFiltro, temOutrosFiltros,
  type ChaveDoFiltro, type FiltrosDeInteressados,
} from '../../dominio/filtrosDeInteressados';
import { dataParaTela } from '../../dominio/formatos';
import {
  estadoVazio,
  ETAPAS_ABERTAS,
  FILTROS_INSCRICOES,
  paginaQueSobra,
  seloDaSituacao,
  seloDoRetorno,
  temDuplicidade,
} from '../../dominio/inscricoes';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco, LARGURA_LISTA } from '../../tema/tokens';
import { CartaoLinkInscricao } from '../../treinador/interessados/CartaoLinkInscricao';
import { CartaoRetornos, retornosAteHoje } from '../../treinador/interessados/CartaoRetornos';
import { FolhaDaInscricao, type PedidoDaFolha } from '../../treinador/interessados/FolhaDaInscricao';
import { FolhaModelosDeMensagem } from '../../treinador/interessados/FolhaModelosDeMensagem';
import { Indicadores } from '../../treinador/interessados/Indicadores';
import { QuadroKanban, type FiltrosDoQuadro } from '../../treinador/interessados/QuadroKanban';
import { EscolhaResponsabilidade } from '../../treinador/EscolhaResponsabilidade';
import { FiltroDoEndereco } from '../../treinador/FiltroDoEndereco';
import { CelulaDoFiltro, UmaOpcao } from '../../treinador/SeletoresDeFiltro';
import { Abas } from '../../ui/Abas';
import { BarraDeFiltros } from '../../ui/BarraDeFiltros';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { Cartao } from '../../ui/Cartao';
import { Escolha } from '../../ui/Escolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Selo } from '../../ui/Selo';
import { Tabela } from '../../ui/Tabela';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { useAtrasado, useCarregar } from '../../ui/useCarregar';

const TAMANHO_PAGINA = 30;

type Visao = 'lista' | 'kanban' | 'indicadores';
const VISOES: { valor: Visao; rotulo: string }[] = [
  { valor: 'lista', rotulo: 'Lista' },
  { valor: 'kanban', rotulo: 'Kanban' },
  { valor: 'indicadores', rotulo: 'Indicadores' },
];

/** `?retornos=ATE_HOJE`: só os retornos atrasados ou de hoje (o mini-cartão "Retornos" do Início). */
const RETORNOS_ATE_HOJE = 'ATE_HOJE';

/**
 * `?etapas=EM_CONTATO,EM_NEGOCIACAO` (o mini-cartão "Em contato ou negociação" do Início) no Kanban: só as etapas abertas
 * conhecidas, na ordem do quadro; valor desconhecido é ignorado e nenhuma conhecida = sem filtro.
 */
function etapasDoEndereco(valor: string | string[] | undefined): EtapaAberta[] | null {
  const pedidas = (Array.isArray(valor) ? valor : [valor ?? '']).flatMap((v) => v.split(',')).map((v) => v.trim());
  const etapas = ETAPAS_ABERTAS.filter((e) => pedidas.includes(e));
  return etapas.length ? etapas : null;
}

/** "Em contato ou em negociação", com os rótulos das situações. */
function rotuloDasEtapas(etapas: readonly EtapaAberta[]): string {
  return etapas.map((e, i) => {
    const r = FILTROS_INSCRICOES.find((f) => f.valor === e)?.rotulo ?? e;
    return i === 0 ? r : r.charAt(0).toLowerCase() + r.slice(1);
  }).join(' ou ');
}

/**
 * Interessados: o link de inscrição da consultoria e o atendimento de quem se inscreveu por ele, em lista, em Kanban por
 * etapa ou nos indicadores (a visão mora no endereço, `?visao=`). Na barra de filtros, busca, responsável e origem valem
 * nas duas primeiras e a situação na Lista (`docs/planos/filtros-nas-listas.md`, D6); as contagens seguem os mesmos
 * filtros. Situação, responsável e origem moram no endereço (`?situacao=&meus=&responsavel=&origem=`). Tocar abre a folha com contato, proposta, retornos, histórico e as decisões.
 * Ninguém vira aluno sem um aceite explícito, e o app nunca envia mensagem sozinho.
 */
export default function Interessados() {
  const { pode, usuario } = useSessao();
  // `?situacao=NOVA` vem do contador "Interessados novos" do Início; `?meus=true`, do filtro "Meus" de lá. Os mini-cartões
  // do painel trazem `?retornos=ATE_HOJE` (na Lista) e `?visao=kanban&etapas=EM_CONTATO,EM_NEGOCIACAO`; trocar de visão
  // pelas abas leva só a `visao`, então o filtro do endereço sai junto.
  const parametros = useLocalSearchParams<{ situacao?: string; visao?: string; meus?: string; responsavel?: string; origem?: string; retornos?: string; etapas?: string | string[] }>();
  const { visao: visaoPedida, retornos: retornosPedidos, etapas: etapasPedidas } = parametros;
  const visao: Visao = VISOES.find((v) => v.valor === visaoPedida)?.valor ?? 'lista';
  const soRetornos = visao === 'lista' && retornosPedidos === RETORNOS_ATE_HOJE;
  const etapas = visao === 'kanban' ? etapasDoEndereco(etapasPedidas) : null;
  const filtrosDaTela = lerDoEndereco(parametros);
  // Trocar de visão leva o responsável e a origem; a situação, os retornos e as etapas são de uma visão só.
  const setVisao = (valor: Visao) => {
    if (valor !== visao) router.push({ pathname: '/treinador/interessados', params: { visao: valor, ...paraEnderecoSemSituacao(filtrosDaTela) } });
  };
  const filtro = filtrosDaTela.situacao;
  const [buscaDigitada, setBuscaDigitada] = useState('');
  const busca = useAtrasado(buscaDigitada.trim(), 300);
  const [pagina, setPagina] = useState(0);
  const [aberta, setAberta] = useState<{ id: string; pedido?: PedidoDaFolha } | null>(null);
  const [modelos, setModelos] = useState(false);
  // Toda alteração (folha, Kanban) muda a rodada: lista, contagens, retornos e colunas recarregam juntos.
  const [rodada, setRodada] = useState(0);
  const meus = filtrosDaTela.responsavel === MEUS;
  const filtros: FiltrosDoQuadro = filtrosDaFila(filtrosDaTela, busca);
  const chaveDosFiltros = chaveDaFila(filtrosDaTela, busca);
  const lista = useCarregar(visao === 'lista' && !soRetornos ? `${filtro}|${chaveDosFiltros}|${pagina}|${rodada}` : null, () =>
    listarInscricoes({ ...filtros, situacao: filtro, pagina }));
  const contagens = useCarregar(visao !== 'indicadores' && !soRetornos ? `contagens|${chaveDosFiltros}|${rodada}` : null, () => contagensInscricoes(filtros));
  const retornos = useCarregar(visao !== 'indicadores' ? `retornos|${meus}|${rodada}` : null, () => retornosPendentes(meus));
  // Nomes para o responsável (padrão do link e de cada inscrição); falha deixa só "Sem responsável".
  const responsaveis = useCarregar('responsaveis-inscricao', () => responsaveisEquipe());
  const recarregar = useCallback(() => setRodada((r) => r + 1), []);
  useFocusEffect(useCallback(() => { recarregar(); }, [recarregar]));
  // Trocar um filtro troca o endereço sem empilhar histórico (o voltar sai da tela) e volta à página 1.
  const aplicar = (novos: FiltrosDeInteressados) => {
    setPagina(0);
    router.setParams(paraSetParams(CHAVES_DO_ENDERECO, paraEndereco(novos)));
  };
  const dados = lista.dados;
  const paginas = dados ? Math.max(1, Math.ceil(dados.total / TAMANHO_PAGINA)) : 1;
  // A última página esvaziou (aceitar ou encerrar tira a inscrição do filtro): volta para a última que ainda tem itens,
  // em vez de mostrar a lista vazia sem a paginação (achado F1).
  const paginaValida = paginaQueSobra(pagina, dados, TAMANHO_PAGINA);
  if (paginaValida !== pagina && !lista.carregando) setPagina(paginaValida);
  const rotuloDoFiltro = FILTROS_INSCRICOES.find((f) => f.valor === filtro)?.rotulo ?? 'Em atendimento';
  const c = contagens.dados;
  const opcoesDeSituacao = FILTROS_INSCRICOES.map((f) => {
    const n = !c ? undefined : f.valor === 'ABERTAS' ? c.abertas : f.valor === 'TODAS' ? c.todas : c.porSituacao[f.valor];
    return { valor: f.valor, rotulo: n === undefined ? f.rotulo : `${f.rotulo} · ${n}` };
  });
  const vazio = estadoVazio({ filtro, meus, busca, temFiltros: temOutrosFiltros(filtrosDaTela) });
  const visaoDosFiltros = visao === 'kanban' ? 'kanban' : 'lista';
  const nomeDe = (id: string) => (responsaveis.dados ?? []).find((r) => r.id === id)?.nome ?? null;
  const chips = chipsDosFiltros(filtrosDaTela, visaoDosFiltros, nomeDe);
  const visiveis = filtrosVisiveis(visaoDosFiltros);
  const abrir = (id: string, pedido?: PedidoDaFolha) => setAberta({ id, pedido });
  const hoje = hojeEmBrasilia();
  const retornosDoFiltro = soRetornos && retornos.dados ? retornosAteHoje(retornos.dados, hoje) : undefined;
  // Limpar o filtro do endereço fica na mesma visão e mantém o responsável e a origem de agora.
  const manterEscopo = paraEnderecoSemSituacao(filtrosDaTela);
  const limparRetornos = () => router.replace({ pathname: '/treinador/interessados', params: manterEscopo });
  const limparEtapas = () => router.replace({ pathname: '/treinador/interessados', params: { visao: 'kanban', ...manterEscopo } });

  return (
    <Tela largura={LARGURA_LISTA} bordas={['top']}>
      <Cabecalho titulo="Interessados" mostrarMarca="celular"
        acoes={pode('INSCRICAO_ALTERAR') ? <Botao rotulo="Respostas prontas" Icone={MessageSquareText} tipo="secundario" aoTocar={() => setModelos(true)} /> : undefined} />
      <Texto variante="suave">
        Quem se inscreveu pelo link da consultoria. Converse pelo WhatsApp, registre o andamento e, quando fechar, aceite:
        o aluno é cadastrado na hora.
      </Texto>
      {/* A fila vem antes da configuração: o link é uma faixa compacta (copiar e situação) e "Configurar" abre a folha. */}
      <CartaoLinkInscricao podeAlterar={pode('INSCRICAO_ALTERAR')} responsaveis={responsaveis.dados ?? []} />
      <Abas abas={VISOES} ativa={visao} aoMudar={setVisao} />
      {visao === 'indicadores' ? <Indicadores /> : soRetornos ? (
        <>
          {/* Retornos do dia (mini-cartão do Início): a fila de retornos só tem o filtro Todos/Meus; busca, responsável,
              origem e situação valem para as inscrições, então ficam de fora até limpar o filtro. */}
          <FiltroDoEndereco rotulo="Retornos atrasados ou de hoje" aoLimpar={limparRetornos} />
          <View style={estilos.filtros}>
            <EscolhaResponsabilidade valor={meus ? 'meus' : 'todos'}
              aoMudar={(v) => router.setParams({ meus: v === 'meus' ? 'true' : undefined, responsavel: undefined })} />
          </View>
          {retornos.erro ? <MensagemErro texto={textoDoErro(retornos.erro)} erro={retornos.erro} tentarDeNovo={retornos.recarregar} /> : null}
          {!retornos.dados && retornos.carregando ? <Esqueleto /> : null}
          {retornosDoFiltro && retornosDoFiltro.length === 0 ? (
            <Vazio titulo="Nenhum retorno para hoje"
              texto={meus ? 'Nenhum retorno seu está atrasado ou marcado para hoje.' : 'Nenhum retorno está atrasado ou marcado para hoje.'} />
          ) : null}
          <CartaoRetornos retornos={retornosDoFiltro} todos aoAbrir={(id) => abrir(id)} />
        </>
      ) : (
        <>
          {etapas ? <FiltroDoEndereco rotulo={rotuloDasEtapas(etapas)} aoLimpar={limparEtapas} /> : null}
          <CartaoRetornos retornos={retornos.dados} aoAbrir={(id) => abrir(id)} />
          {/* Ordem das listas: busca → filtros (botão "Filtros" com o painel e o "Filtrado por"). */}
          <BarraDeFiltros
            busca={{ valor: buscaDigitada, aoMudar: (t) => { setBuscaDigitada(t); setPagina(0); }, placeholder: 'Nome, e-mail ou WhatsApp' }}
            valor={filtrosDaTela} aoAplicar={aplicar} limpo={limpos(filtrosDaTela, visaoDosFiltros)} chips={chips}
            aoTirar={(chave) => aplicar(semOFiltro(filtrosDaTela, chave as ChaveDoFiltro))}
            rotuloDoResultado="Ver inscrições"
            seletores={(atuais, mudar) => <SeletoresDeInteressados visiveis={visiveis} filtros={atuais} aoMudar={mudar}
              opcoesDeSituacao={opcoesDeSituacao} opcoesDeResponsavel={opcoesDeResponsavel(responsaveis.dados ?? [], usuario?.id)} />} />
          {visao === 'lista' ? (
            <>
              {lista.erro ? <MensagemErro texto={textoDoErro(lista.erro)} erro={lista.erro} tentarDeNovo={lista.recarregar} /> : null}
              {!dados && lista.carregando ? <Esqueleto /> : null}
              {dados && dados.itens.length === 0 ? <Vazio titulo={vazio.titulo} texto={vazio.texto} /> : null}
              {dados && dados.itens.length > 0 ? (
                <Cartao descricao={`${rotuloDoFiltro}: ${dados.total} ${dados.total === 1 ? 'inscrição' : 'inscrições'}. Toque na linha para abrir.`}>
                  <View style={lista.carregando ? estilos.esmaecido : null}>
                    <Tabela rotulo="Inscrições" larguraMinima={760} linhas={dados.itens} chave={(i) => i.id}
                      aoTocarLinha={(i) => abrir(i.id)} rotuloDaLinha={(i) => `Abrir inscrição de ${i.nome}`} colunas={[
                      { chave: 'nome', titulo: 'Nome', flex: 1.4, principal: true, render: (i) => <Texto variante="bloco" numberOfLines={2}>{i.nome}</Texto> },
                      { chave: 'responsavel', titulo: 'Responsável', flex: 1.1, render: (i) => <Texto>{nomeDoResponsavel(i)}</Texto> },
                      { chave: 'retorno', titulo: 'Próximo retorno', flex: 1.1, render: (i) => <ProximoRetorno inscricao={i} hoje={hoje} /> },
                      { chave: 'atividade', titulo: 'Última atividade', flex: 1, render: (i) => <Texto numerico>{instanteRelativo(i.ultimaAtividadeEm)}</Texto> },
                      { chave: 'situacao', titulo: 'Situação', flex: 1.6, render: (i) => <Situacao inscricao={i} /> },
                    ]} />
                  </View>
                  {paginas > 1 ? (
                    <View style={estilos.paginacao}>
                      <Botao rotulo="Anterior" tipo="secundario" desabilitado={pagina === 0} aoTocar={() => setPagina(pagina - 1)} />
                      <Texto variante="suave">Página {pagina + 1} de {paginas}</Texto>
                      <Botao rotulo="Próxima" tipo="secundario" desabilitado={pagina + 1 >= paginas} aoTocar={() => setPagina(pagina + 1)} />
                    </View>
                  ) : null}
                </Cartao>
              ) : null}
            </>
          ) : (
            <QuadroKanban filtros={filtros} contagens={c} rodada={rodada} etapas={etapas ?? undefined} aoAbrir={abrir} aoMudou={recarregar} />
          )}
        </>
      )}
      <FolhaDaInscricao id={aberta?.id ?? null} pedidoInicial={aberta?.pedido ?? null} responsaveis={responsaveis.dados ?? []}
        aoFechar={() => setAberta(null)} aoMudar={recarregar} aoAbrirOutra={(id) => setAberta({ id })} />
      <FolhaModelosDeMensagem visivel={modelos} aoFechar={() => setModelos(false)} />
    </Tela>
  );
}

/**
 * Seletores do painel de filtros: situação (só na Lista, com a contagem de cada uma), responsável e origem, uma opção
 * cada (a rota aceita um responsável só).
 */
function SeletoresDeInteressados({ visiveis, filtros, aoMudar, opcoesDeSituacao, opcoesDeResponsavel }: {
  visiveis: readonly ChaveDoFiltro[];
  filtros: FiltrosDeInteressados;
  aoMudar: (f: FiltrosDeInteressados) => void;
  opcoesDeSituacao: { valor: FiltrosDeInteressados['situacao']; rotulo: string }[];
  opcoesDeResponsavel: { valor: string; rotulo: string }[];
}) {
  return (
    <>
      {visiveis.includes('situacao') ? (
        <CelulaDoFiltro>
          {/* Oito situações: a escolha quebra linha dentro da célula. */}
          <View style={estilos.caber}><Escolha rotulo="Situação" opcoes={opcoesDeSituacao} valor={filtros.situacao} aoMudar={(situacao) => aoMudar({ ...filtros, situacao })} /></View>
        </CelulaDoFiltro>
      ) : null}
      <CelulaDoFiltro>
        <UmaOpcao rotulo="Responsável" valor={filtros.responsavel} opcoes={opcoesDeResponsavel} aoMudar={(responsavel) => aoMudar({ ...filtros, responsavel })} />
      </CelulaDoFiltro>
      <CelulaDoFiltro>
        <UmaOpcao rotulo="Origem" valor={filtros.origem} opcoes={OPCOES_FILTRO_ORIGEM} aoMudar={(origem) => aoMudar({ ...filtros, origem })} />
      </CelulaDoFiltro>
    </>
  );
}

function nomeDoResponsavel(i: InscricaoResumo): string {
  if (i.responsavelNome) return i.responsavelNome;
  return i.responsavelId ? 'Membro inativo' : 'Sem responsável';
}

function ProximoRetorno({ inscricao, hoje }: { inscricao: InscricaoResumo; hoje: string }) {
  const r = inscricao.proximoRetorno;
  if (!r) return <Texto variante="suave">—</Texto>;
  const selo = seloDoRetorno(r.data, hoje);
  return (
    <View style={estilos.selos}>
      <Texto numerico>{dataParaTela(r.data)}</Texto>
      {selo ? <Selo texto={selo.texto} tipo={selo.tipo} /> : null}
    </View>
  );
}

function Situacao({ inscricao }: { inscricao: InscricaoResumo }) {
  const selo = seloDaSituacao(inscricao.situacao);
  return (
    <View style={estilos.selos}>
      <Selo texto={selo.texto} tipo={selo.tipo} />
      {inscricao.ciclo > 1 ? <Selo texto={`${inscricao.ciclo}º atendimento`} tipo="neutro" /> : null}
      {temDuplicidade(inscricao.duplicidade) ? <Selo texto="Possível duplicidade" tipo="atencao" /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  filtros: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espaco(3), rowGap: espaco(1.5), alignItems: 'flex-end' },
  selos: { flexDirection: 'row', gap: espaco(0.75), flexWrap: 'wrap', alignItems: 'center' },
  caber: { flexShrink: 1, maxWidth: '100%' },
  esmaecido: { opacity: 0.6 },
  paginacao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1), flexWrap: 'wrap' },
});
