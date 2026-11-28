import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { CalendarDays } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

import type { Compromisso } from '../../api/agendaTipos';
import {
  alternarAgendaOculta, deslocarCalendario, diasDoPeriodo, type ItemDoCalendario, lerEnderecoDoCalendario, modoDaVisao, periodoDoCalendario,
  type RetanguloNaJanela, type VisaoDoCalendario, visaoDoAtalho,
} from '../../dominio/agendaCalendario';
import { dicaDaGradeVazia, type TipoDaCriacao } from '../../dominio/agendaCriacao';
import { hojeEmBrasilia, OPCOES_SITUACAO } from '../../dominio/agendaPresencial';
import { caminhoListaAtualizacoes } from '../../dominio/atualizacao';
import {
  AGENDA_SEM_FILTRO, chipsDaAgenda, enderecoDaAgenda, type ChaveDoFiltroDaAgenda, type FiltrosDaAgenda, lerFiltrosDaAgenda, semOFiltroDaAgenda,
  SO_OS_MEUS, TODA_A_EQUIPE,
} from '../../dominio/filtrosDaAgenda';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { espaco, LARGURA_LISTA, LARGURA_MENU_LATERAL } from '../../tema/tokens';
import { PeriodoDoCalendario, SegmentoDaVisao } from '../../treinador/agenda/BarraDoCalendario';
import { type AcaoInicial, FolhaCompromisso } from '../../treinador/agenda/FolhaCompromisso';
import { type CriacaoAberta, FolhaCriar } from '../../treinador/agenda/FolhaCriar';
import { type EventoAberto, FolhaEvento } from '../../treinador/agenda/FolhaEvento';
import { GradeDeHorarios } from '../../treinador/agenda/GradeDeHorarios';
import { CartaoSemData, ListaDoCalendario } from '../../treinador/agenda/ListaDoCalendario';
import { iconeDoTom } from '../../treinador/agenda/itemDaAgenda';
import { MenuCriar } from '../../treinador/agenda/MenuCriar';
import { LARGURA_DA_LATERAL, MiniCalendario } from '../../treinador/agenda/MiniCalendario';
import { PainelDeAgendas, SecaoDaLateral } from '../../treinador/agenda/PainelDeAgendas';
import { ResumoDoCompromisso } from '../../treinador/agenda/ResumoDoCompromisso';
import { useCalendario } from '../../treinador/agenda/useCalendario';
import { UmaOpcao } from '../../treinador/SeletoresDeFiltro';
import { VisaoDoAno } from '../../treinador/agenda/VisaoDoAno';
import { VisaoDoMes } from '../../treinador/agenda/VisaoDoMes';
import { BarraDeFiltros, GrupoDoPainel } from '../../ui/BarraDeFiltros';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { depoisDeFecharAsFolhas, portalDaFolhaDoTopo } from '../../ui/historicoDasFolhas';
import { LinkTexto } from '../../ui/LinkTexto';
import { ChipsMultiplos } from '../../ui/ChipsDeFiltro';
import { Selo } from '../../ui/Selo';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';

/** Conteúdo a partir do qual o mini calendário e as agendas ficam numa coluna à esquerda (PC). */
const LARGURA_DO_PAINEL_LATERAL = 960;

type Parametros = { meus?: string; membro?: string; visao?: string; data?: string; situacao?: string | string[]; novo?: string };

const NOMES_DAS_FONTES: Record<string, string> = {
  agendas: 'Agendas', compromissos: 'Compromissos', eventos: 'Eventos', atualizacoes: 'Atualizações', resumo: 'Resumo do ano',
};

/** O foco está num campo de digitar (os atalhos de teclado não valem ali). */
function focoEmCampo(): boolean {
  const el = typeof document === 'undefined' ? null : (document.activeElement as HTMLElement | null);
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

/** Alguma Folha, painel ou menu aberto por cima da agenda. */
function algoPorCima(menuAberto: boolean): boolean {
  if (menuAberto || portalDaFolhaDoTopo() !== undefined) return true;
  return typeof document !== 'undefined' && document.querySelector('[role="dialog"],[role="alertdialog"]') !== null;
}

/**
 * Agenda do treinador, no jeito do Google Agenda: Dia, Semana, Mês e Ano (`?visao=&data=` no endereço), com as três fontes
 * juntas: compromissos com alunos (`AGENDA_LER`), eventos pessoais das agendas visíveis e as atualizações que vencem
 * (`ATUALIZACAO_LER` + `ALUNO_SENSIVEL_LER`). No PC, Dia e Semana são a grade de horários e o mini calendário, as agendas e
 * os filtros ficam à esquerda; no celular, a lista por dia e o painel abre numa folha. Setas e "Hoje" trocam a data sem
 * empilhar passos; trocar de visão e abrir um dia empilham (o voltar desfaz). Atalhos D, W, M e Y (só web). Datas e horas
 * de Brasília. `?novo=1` (atalho da busca) abre a janela de criação no compromisso e `?novo=evento`, no evento; os dois saem
 * do endereço. Criar (agenda: criar unificado, 23/11): o "Criar" fica no topo da coluna da esquerda no PC (no cabeçalho sem
 * ela) e abre a `FolhaCriar`, a mesma do clique num horário vazio da grade. Uma barra só acima da grade: "Hoje", setas e o
 * período à esquerda; "Filtros" e o segmento da visão à direita.
 */
export default function AgendaDoTreinador() {
  const p = useLocalSearchParams<Parametros>();
  const { pode, usuario, offline } = useSessao();
  const { preferencias, preferenciasLidas, escolherPreferencia } = useTema();
  const permissoes = useMemo(() => ({
    agenda: pode('AGENDA_LER'),
    atualizacoes: pode('ATUALIZACAO_LER') && pode('ALUNO_SENSIVEL_LER'),
    painel: pode('PAINEL_VER'),
    equipe: pode('ALUNO_LER') || pode('INSCRICAO_LER'),
  }), [pode]);
  const podeAlterar = permissoes.agenda && pode('AGENDA_ALTERAR');

  const hoje = hojeEmBrasilia();
  // Celular × PC é pela janela (abaixo de 768 px há a barra de baixo, como no resto do app); o painel lateral é pelo conteúdo
  // medido, que desconta o menu lateral.
  const { width: larguraDaJanela } = useWindowDimensions();
  const [largura, setLargura] = useState(0);
  const { visao, data } = lerEnderecoDoCalendario(p, hoje, larguraDaJanela);
  // Filtros aplicados (responsável, situação), lidos do endereço; o painel "Filtros da agenda" grava lá só no Aplicar.
  const filtros = useMemo(() => lerFiltrosDaAgenda({ meus: p.meus, membro: p.membro, situacao: p.situacao }, permissoes),
    [p.meus, p.membro, p.situacao, permissoes]);
  const meus = filtros.responsavel === SO_OS_MEUS;
  const membro = meus || filtros.responsavel === TODA_A_EQUIPE ? null : filtros.responsavel;
  const { situacoes } = filtros;
  const modo = modoDaVisao(visao, larguraDaJanela);
  const lateral = largura >= LARGURA_DO_PAINEL_LATERAL;

  const cal = useCalendario(permissoes, {
    visao, data, meus, membro, situacoes, usuarioId: usuario?.id ?? null, ocultasGravadas: preferencias.agendasOcultas, preferenciasLidas,
  });
  const { recarregarTudo } = cal;
  useFocusEffect(useCallback(() => { recarregarTudo(); }, [recarregarTudo]));

  // Endereço: setas, "Hoje", mini calendário e o dia do Mês no celular substituem; trocar de visão e abrir um dia empilham.
  const ir = (novos: Partial<Parametros>, como: 'replace' | 'push') => {
    const atual: Parametros = {
      visao: visao === 'semana' ? undefined : visao, data: data === hoje ? undefined : data,
      ...enderecoDaAgenda(filtros),
    };
    const juntos = { ...atual, ...novos };
    const params = Object.fromEntries(Object.entries(juntos).filter(([, v]) => v !== undefined && v !== '')) as Record<string, string>;
    const destino = { pathname: '/treinador/agenda' as const, params };
    if (como === 'push') router.push(destino); else router.replace(destino);
  };
  const paraVisao = (v: VisaoDoCalendario) => (v === 'semana' ? undefined : v);
  const mudarVisao = (v: VisaoDoCalendario) => { if (v !== visao) ir({ visao: paraVisao(v) }, 'push'); };
  const abrirDia = (d: string) => ir({ visao: 'dia', data: d === hoje ? undefined : d }, 'push');
  const escolherData = (d: string) => ir({ data: d === hoje ? undefined : d }, 'replace');

  // Atalhos D/W/M/Y (web): nunca num campo, com algo aberto por cima ou com Ctrl/Alt/Meta.
  const [menuAberto, setMenuAberto] = useState(false);
  const aoAtalho = useRef<(v: VisaoDoCalendario) => void>(mudarVisao);
  const menuAbertoRef = useRef(menuAberto);
  useEffect(() => {
    aoAtalho.current = mudarVisao;
    menuAbertoRef.current = menuAberto;
  });
  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const ouvir = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const v = visaoDoAtalho(e.key, { ctrl: e.ctrlKey, alt: e.altKey, meta: e.metaKey, emCampo: focoEmCampo(), sobreposto: algoPorCima(menuAbertoRef.current) });
      if (!v) return;
      e.preventDefault();
      aoAtalho.current(v);
    };
    document.addEventListener('keydown', ouvir, true);
    return () => document.removeEventListener('keydown', ouvir, true);
  }, []);

  // Folhas: a criação (`?novo=` abre e sai do endereço na hora), o compromisso, o evento e, no celular, as agendas.
  const [criar, setCriar] = useState<CriacaoAberta | null>(null);
  // Cada abertura ganha um número novo: a folha começa limpa mesmo no mesmo dia e na mesma hora.
  const vezes = useRef(0);
  const abrirCriacao = (tipo: TipoDaCriacao, dia: string, hora?: string) => { vezes.current += 1; setCriar({ tipo, data: dia, hora, vez: vezes.current }); };
  const [compromisso, setCompromisso] = useState<Compromisso | null>(null);
  // O que a folha do compromisso faz ao abrir pelo resumo (Editar, Cancelar).
  const [acaoInicial, setAcaoInicial] = useState<AcaoInicial | undefined>(undefined);
  const [resumo, setResumo] = useState<{ compromisso: Compromisso; origem: HTMLElement | null; ancora: RetanguloNaJanela | null } | null>(null);
  const [evento, setEvento] = useState<EventoAberto | null>(null);
  const [agendasAbertas, setAgendasAbertas] = useState(false);
  // `setParams` e não `replace`/`push`: troca o endereço sem remontar a tela e sem criar passo (o Voltar não desfaz o filtro).
  // O painel lateral chama o `aoAplicar` depois de fechar (fora da entrada de histórico dele).
  const aplicarFiltros = (f: FiltrosDaAgenda) => router.setParams(enderecoDaAgenda(f));
  const diaSugerido = data < hoje ? hoje : data;
  useEffect(() => {
    if ((p.novo !== '1' && p.novo !== 'evento') || !podeAlterar) return;
    let vivo = true;
    const tipo: TipoDaCriacao = p.novo === 'evento' ? 'evento' : 'compromisso';
    void Promise.resolve().then(() => {
      if (!vivo) return;
      vezes.current += 1;
      setCriar({ tipo, data: diaSugerido, vez: vezes.current });
      router.setParams({ novo: undefined });
    });
    return () => { vivo = false; };
  }, [p.novo, podeAlterar, diaSugerido]);
  // O item aberto na folha fica marcado na grade e na lista (contorno forte), só enquanto a folha dele está aberta.
  const [chaveAberta, setChaveAberta] = useState<string | null>(null);
  const escolhido = resumo || compromisso || evento ? chaveAberta : null;
  // F13: o compromisso tocado abre o resumo (ao lado do item no PC, numa folha no celular); o evento, a folha dele.
  const abrirItem = (item: ItemDoCalendario, origem?: HTMLElement | null) => {
    const f = item.fonte;
    setChaveAberta(item.chave);
    if (f.origem === 'COMPROMISSO') {
      const caixa = Platform.OS === 'web' && larguraDaJanela >= LARGURA_MENU_LATERAL ? origem?.getBoundingClientRect?.() : undefined;
      const ancora = caixa && caixa.width > 0 ? { x: caixa.left, y: caixa.top, w: caixa.width, h: caixa.height } : null;
      setResumo({ compromisso: f.compromisso, origem: origem ?? null, ancora });
    } else if (f.origem === 'EVENTO') setEvento({ eventoId: f.ocorrencia.eventoId, ocorrencia: item.ocorrencia });
  };
  /**
   * Fecha o resumo e, se `depois` vier, abre a folha do compromisso. No PC o foco volta ao item antes de a folha abrir
   * (é para ele que ela devolve o foco ao fechar); a folha do celular devolve o foco sozinha.
   */
  const fecharResumo = (depois?: () => void) => {
    const origem = resumo?.ancora ? resumo.origem : null;
    setResumo(null);
    const seguir = () => { if (origem?.isConnected) origem.focus(); depois?.(); };
    if (origem) setTimeout(seguir, 0); else if (depois) depoisDeFecharAsFolhas(depois);
  };
  const doResumo = (acao?: AcaoInicial) => {
    const c = resumo?.compromisso;
    if (!c) return;
    fecharResumo(() => { setAcaoInicial(acao); setCompromisso(c); });
  };
  const alternar = (chave: string) => escolherPreferencia({ agendasOcultas: alternarAgendaOculta(cal.ocultas, chave) });

  const { de, ate } = periodoDoCalendario(visao, data);
  const nomesDasAgendas = useMemo(() => new Map((cal.agendas ?? []).map((a) => [a.id, a.nome])), [cal.agendas]);
  const itens = cal.itens ?? [];
  const vazio = cal.pronto && itens.length === 0 && cal.semData.length === 0 && (visao !== 'ano' || (cal.contagem?.size ?? 0) === 0);
  // O clique num horário vazio cria só na grade da web, com `AGENDA_ALTERAR` (`GradeDeHorarios`): a dica só fala nele aí.
  const criaNoHorario = podeAlterar && Platform.OS === 'web';
  const dicaDoVazio = vazio && modo === 'grade' && (visao === 'dia' || visao === 'semana') ? dicaDaGradeVazia(visao, criaNoHorario) : null;
  const comSemData = cal.semData.length > 0 && de <= hoje && hoje <= ate;

  const nomeDoMembro = (id: string) => cal.equipe.find((r) => r.id === id)?.nome;
  const opcoesDeResponsavel = [
    { valor: TODA_A_EQUIPE, rotulo: 'Toda a equipe' },
    { valor: SO_OS_MEUS, rotulo: 'Só os meus' },
    ...(permissoes.equipe ? cal.equipe.filter((r) => r.id !== usuario?.id).map((r) => ({ valor: r.id, rotulo: r.nome })) : []),
  ];
  const atrasadas = cal.atrasadas ? <SecaoDaLateral titulo="Atualizações" divisoria={cal.painelDeAgendas.length > 0}>
    <View style={estilos.atrasadas}>
      <Selo texto={cal.atrasadas} tipo="perigo" Icone={iconeDoTom('perigo')} />
      <LinkTexto texto="Ver atrasadas" href={caminhoListaAtualizacoes('ATRASADAS', meus)} />
    </View>
  </SecaoDaLateral> : null;
  const painel = cal.painelDeAgendas.length ? <PainelDeAgendas agendas={cal.painelDeAgendas} pessoais={cal.agendas} carregando={cal.agendasCarregando}
    podeAlterar={podeAlterar} aoAlternar={alternar} aoMudar={() => { cal.recarregarAgendas(); cal.recarregarEventos(); }} /> : null;

  const conteudo = !cal.pronto && !cal.erros.length ? <Esqueleto texto="Carregando a agenda" /> : <>
    {/* Grade: a dica fica no meio dela. Lista: cada dia com o seu "Nada marcado" (nunca esconder datas). Mês e Ano: a linha. */}
    {vazio && (modo === 'mes' || modo === 'mesCompacto' || modo === 'ano') ? <Texto variante="suave" accessibilityLiveRegion="polite">Nada neste período.</Texto> : null}
    {modo === 'grade' ? <GradeDeHorarios dias={diasDoPeriodo(de, ate)} itens={itens} hoje={hoje} meus={meus} chaveDoPeriodo={`${visao}:${de}`}
      aoAbrir={abrirItem} aoAbrirDia={visao === 'semana' ? abrirDia : undefined} vazio={dicaDoVazio}
      aoCriarNoHorario={podeAlterar ? (d, hora) => abrirCriacao('compromisso', d, hora) : undefined} escolhido={escolhido} /> : null}
    {modo === 'lista' ? <ListaDoCalendario itens={itens} de={de} ate={ate} hoje={hoje} meus={meus} nomesDasAgendas={nomesDasAgendas}
      semData={cal.semData} aoAbrir={abrirItem} escolhido={escolhido} /> : null}
    {modo === 'mes' ? <VisaoDoMes data={data} hoje={hoje} itens={itens} compacta={false} aoTocarDia={abrirDia} /> : null}
    {modo === 'mesCompacto' ? <>
      <VisaoDoMes data={data} hoje={hoje} itens={itens} compacta aoTocarDia={escolherData} />
      <ListaDoCalendario itens={itens} de={data} ate={data} hoje={hoje} meus={meus} nomesDasAgendas={nomesDasAgendas} aoAbrir={abrirItem} escolhido={escolhido} />
    </> : null}
    {modo === 'ano' && cal.contagem ? <VisaoDoAno ano={Number(data.slice(0, 4))} hoje={hoje} contagem={cal.contagem} aoAbrirDia={abrirDia}
      aoAbrirMes={(primeiro) => ir({ visao: 'mes', data: primeiro.slice(0, 7) === hoje.slice(0, 7) ? undefined : primeiro }, 'push')} /> : null}
    {comSemData && modo !== 'lista' && modo !== 'ano' ? <CartaoSemData semData={cal.semData} meus={meus} /> : null}
  </>;

  const avisos = <>
    {offline ? <MensagemErro texto="Sem conexão. A agenda precisa de internet; tente de novo quando ela voltar." tentarDeNovo={recarregarTudo} /> : null}
    {offline ? null : cal.erros.map((e) => <MensagemErro key={e.chave} texto={`${NOMES_DAS_FONTES[e.chave] ?? 'Agenda'}: ${textoDoErro(e.erro)}`} erro={e.erro}
      tentarDeNovo={e.tentarDeNovo} />)}
  </>;
  // A barra única: "Hoje", setas e período à esquerda; "Filtros" (com o contador) e a visão à direita. As etiquetas
  // "Filtrando" ficam embaixo da linha inteira. Uma árvore só nas duas larguras (o painel aberto sobrevive à troca).
  const barra = <BarraDeFiltros valor={filtros} aoAplicar={aplicarFiltros} limpo={AGENDA_SEM_FILTRO}
    chips={chipsDaAgenda(filtros, nomeDoMembro)} aoTirar={(chave) => aplicarFiltros(semOFiltroDaAgenda(filtros, chave as ChaveDoFiltroDaAgenda))}
    painelLateral={{ titulo: 'Filtros da agenda' }}
    seletores={(atuais, mudar) => <SeletoresDaAgenda filtros={atuais} aoMudar={mudar} opcoesDeResponsavel={opcoesDeResponsavel} comSituacao={permissoes.agenda} />}
    antes={<PeriodoDoCalendario visao={visao} data={data} aoDeslocar={(s) => escolherData(deslocarCalendario(visao, data, s))}
      aoHoje={() => { if (data !== hoje) ir({ data: undefined }, 'replace'); }} />}
    depois={<>
      <SegmentoDaVisao visao={visao} aoMudar={mudarVisao} />
      {lateral || (!painel && !atrasadas) ? null : <Botao rotulo="Agendas" tipo="secundario" Icone={CalendarDays} aoTocar={() => setAgendasAbertas(true)} />}
    </>} />;
  // PC com a coluna da esquerda: o Criar no topo dela; sem ela (celular, PC estreito), no cabeçalho.
  const menuCriar = (naColuna: boolean) => (podeAlterar ? <MenuCriar naColuna={naColuna} aoMudarAberto={setMenuAberto}
    aoCompromisso={() => abrirCriacao('compromisso', diaSugerido)} aoEvento={() => abrirCriacao('evento', diaSugerido)} /> : undefined);

  return <Tela largura={LARGURA_LISTA} bordas={['top']}>
    <Cabecalho titulo="Agenda" mostrarMarca="celular" descricao="Seus compromissos com alunos e eventos pessoais, por dia, semana, mês ou ano. Crie, repita e cancele; o aluno vê no app os compromissos dele." acoes={lateral ? undefined : menuCriar(false)} />
    <View onLayout={(e) => setLargura(Math.round(e.nativeEvent.layout.width))}>
      {/* Uma árvore só nas duas larguras: a coluna principal (barra de filtros, grade) fica no mesmo lugar e só a lateral entra e
          sai, então cruzar o limite não remonta a barra (o painel de filtros aberto e o rascunho sobrevivem). */}
      {largura === 0 ? null : (
        <View style={lateral ? estilos.colunas : undefined}>
          {lateral ? (
            <View testID="lateral-da-agenda" style={estilos.lateral}>
              {menuCriar(true)}
              <MiniCalendario visao={visao} data={data} hoje={hoje} aoEscolher={escolherData} />
              {painel}
              {atrasadas}
            </View>
          ) : null}
          <View style={estilos.principal}>
            {barra}
            {avisos}
            {conteudo}
          </View>
        </View>
      )}
    </View>

    {lateral ? null : <Folha visivel={agendasAbertas} titulo="Agendas" aoFechar={() => setAgendasAbertas(false)}>
      <View style={estilos.painelDaFolha}>
        {painel}
        {atrasadas}
      </View>
    </Folha>}
    {resumo ? <ResumoDoCompromisso compromisso={resumo.compromisso} hoje={hoje} ancora={resumo.ancora} aoFechar={() => fecharResumo()}
      aoAbrirDetalhes={() => doResumo()} aoEditar={() => doResumo('editar')} aoCancelar={() => doResumo('cancelar')} /> : null}
    {permissoes.agenda ? <FolhaCompromisso aberto={compromisso} acaoInicial={acaoInicial} hoje={hoje} responsaveis={cal.equipe}
      carregados={cal.compromissosCarregados} aoFechar={() => setCompromisso(null)}
      aoMudar={(c) => { setCompromisso((atual) => (atual ? c : atual)); cal.recarregarCompromissos(); }} /> : null}
    {podeAlterar ? <FolhaCriar aberto={criar} hoje={hoje} responsaveis={cal.equipe} carregados={cal.compromissosCarregados}
      agendas={cal.agendas} erroDasAgendas={cal.erros.find((x) => x.chave === 'agendas')?.erro} recarregarAgendas={cal.recarregarAgendas}
      aoFechar={() => setCriar(null)} aoCriarCompromisso={() => cal.recarregarCompromissos()}
      aoCriarEvento={(o) => { cal.recarregarEventos(); if (o.agendas) cal.recarregarAgendas(); }} /> : null}
    {permissoes.agenda ? <FolhaEvento aberto={evento} agendas={cal.agendas} erroDasAgendas={cal.erros.find((x) => x.chave === 'agendas')?.erro}
      recarregarAgendas={cal.recarregarAgendas} hoje={hoje} podeAlterar={podeAlterar}
      aoFechar={() => setEvento(null)}
      aoMudar={(o) => { cal.recarregarEventos(); if (o.agendas) cal.recarregarAgendas(); }} /> : null}
  </Tela>;
}

/**
 * O que vai no painel "Filtros da agenda": o responsável (D19: toda a equipe, só os meus ou um membro, nas três fontes;
 * escolha única) e, com `AGENDA_LER`, a situação dos compromissos (várias; nenhuma = sem filtro).
 */
function SeletoresDaAgenda({ filtros, aoMudar, opcoesDeResponsavel, comSituacao }: {
  filtros: FiltrosDaAgenda; aoMudar: (f: FiltrosDaAgenda) => void;
  opcoesDeResponsavel: { valor: string; rotulo: string }[]; comSituacao: boolean;
}) {
  const { situacoes } = filtros;
  return <>
    <GrupoDoPainel titulo="Identificação" primeiro>
      <UmaOpcao rotulo="Responsável" valor={filtros.responsavel} opcoes={opcoesDeResponsavel} aoMudar={(responsavel) => aoMudar({ ...filtros, responsavel })} />
    </GrupoDoPainel>
    {comSituacao ? (
      <GrupoDoPainel titulo="Situação">
        <ChipsMultiplos rotulo="Compromissos" opcoes={OPCOES_SITUACAO.map((o) => ({ ...o, tom: o.valor === 'REALIZADO' ? 'sucesso' as const : o.valor === 'FALTOU' ? 'perigo' as const : undefined }))}
          marcados={situacoes} aoMudar={(marcados) => aoMudar({ ...filtros, situacoes: marcados })} />
        {situacoes.length && situacoes.length < OPCOES_SITUACAO.length
          ? <Texto variante="pequeno">Com vários alunos, aparecem os compromissos em que algum aluno está em alguma dessas situações.</Texto> : null}
      </GrupoDoPainel>
    ) : null}
  </>;
}

const estilos = StyleSheet.create({
  colunas: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(3) },
  // F20: lateral compacta (272 px, seções com 16 px entre si); o resto da largura é da grade.
  lateral: { width: LARGURA_DA_LATERAL, gap: espaco(2) },
  principal: { flex: 1, minWidth: 0, gap: espaco(2) },
  painelDaFolha: { gap: espaco(3) },
  cheio: { alignSelf: 'stretch' },
  atrasadas: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: espaco(1.5) },
});
