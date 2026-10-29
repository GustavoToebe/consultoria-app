import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SlidersHorizontal } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import type { Compromisso } from '../../api/agendaTipos';
import {
  alternarAgendaOculta, deslocarCalendario, diasDoPeriodo, type ItemDoCalendario, lerEnderecoDoCalendario, modoDaVisao, periodoDoCalendario,
  type VisaoDoCalendario, visaoDoAtalho,
} from '../../dominio/agendaCalendario';
import { hojeEmBrasilia, lerSituacao, OPCOES_SITUACAO } from '../../dominio/agendaPresencial';
import { caminhoListaAtualizacoes } from '../../dominio/atualizacao';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { espaco, LARGURA_LISTA } from '../../tema/tokens';
import { BarraDoCalendario } from '../../treinador/agenda/BarraDoCalendario';
import { FolhaCompromisso } from '../../treinador/agenda/FolhaCompromisso';
import { type EventoAberto, FolhaEvento } from '../../treinador/agenda/FolhaEvento';
import { GradeDeHorarios } from '../../treinador/agenda/GradeDeHorarios';
import { CartaoSemData, ListaDoCalendario } from '../../treinador/agenda/ListaDoCalendario';
import { MenuCriar } from '../../treinador/agenda/MenuCriar';
import { LARGURA_DO_MINI, MiniCalendario } from '../../treinador/agenda/MiniCalendario';
import { PainelDeAgendas } from '../../treinador/agenda/PainelDeAgendas';
import { useCalendario } from '../../treinador/agenda/useCalendario';
import { VisaoDoAno } from '../../treinador/agenda/VisaoDoAno';
import { VisaoDoMes } from '../../treinador/agenda/VisaoDoMes';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { Escolha } from '../../ui/Escolha';
import { EscolhaEmFolha } from '../../ui/EscolhaEmFolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { depoisDeFecharAsFolhas, portalDaFolhaDoTopo } from '../../ui/historicoDasFolhas';
import { LinkTexto } from '../../ui/LinkTexto';
import { Selo } from '../../ui/Selo';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';

/** Conteúdo a partir do qual o mini calendário, as agendas e os filtros ficam numa coluna à esquerda (PC). */
const LARGURA_DO_PAINEL_LATERAL = 960;
/** Valor do filtro de responsável sem escolha e com "Só os meus". */
const TODA_A_EQUIPE = '';
const SO_OS_MEUS = 'meus';

type Parametros = { meus?: string; membro?: string; visao?: string; data?: string; situacao?: string; novo?: string };

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
  return typeof document !== 'undefined' && !!document.querySelector('[role="dialog"],[role="alertdialog"]');
}

/**
 * Agenda do treinador, no jeito do Google Agenda: Dia, Semana, Mês e Ano (`?visao=&data=` no endereço), com as três fontes
 * juntas: compromissos com alunos (`AGENDA_LER`), eventos pessoais das agendas visíveis e as atualizações que vencem
 * (`ATUALIZACAO_LER` + `ALUNO_SENSIVEL_LER`). No PC, Dia e Semana são a grade de horários e o mini calendário, as agendas e
 * os filtros ficam à esquerda; no celular, a lista por dia e o painel abre numa folha. Setas e "Hoje" trocam a data sem
 * empilhar passos; trocar de visão e abrir um dia empilham (o voltar desfaz). Atalhos D, W, M e Y (só web). Datas e horas
 * de Brasília. `?novo=1` (atalho da busca) abre o compromisso novo e `?novo=evento`, o evento novo; os dois saem do endereço.
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
  const [largura, setLargura] = useState(0);
  const { visao, data } = lerEnderecoDoCalendario(p, hoje, largura);
  // Os filtros (responsável, situação) vão para o endereço, mas só depois de as Folhas fecharem: um `router.replace` com a
  // Folha aberta cai na entrada de histórico dela e o fechar desfaz a escolha. Até lá o que foi escolhido vale daqui.
  const [ajuste, setAjuste] = useState<Partial<Parametros> | null>(null);
  const filtrosDoEndereco: Parametros = { ...p, ...ajuste };
  const meus = filtrosDoEndereco.meus === 'true';
  const membro = !meus && permissoes.equipe && filtrosDoEndereco.membro ? filtrosDoEndereco.membro : null;
  const situacao = permissoes.agenda ? lerSituacao(filtrosDoEndereco.situacao) : null;
  const modo = modoDaVisao(visao, largura);
  const lateral = largura >= LARGURA_DO_PAINEL_LATERAL;

  const cal = useCalendario(permissoes, {
    visao, data, meus, membro, situacao, usuarioId: usuario?.id ?? null, ocultasGravadas: preferencias.agendasOcultas, preferenciasLidas,
  });
  const { recarregarTudo } = cal;
  useFocusEffect(useCallback(() => { recarregarTudo(); }, [recarregarTudo]));

  // Endereço: setas, "Hoje", mini calendário e o dia do Mês no celular substituem; trocar de visão e abrir um dia empilham.
  const ir = (novos: Partial<Parametros>, como: 'replace' | 'push') => {
    const atual: Parametros = {
      visao: visao === 'semana' ? undefined : visao, data: data === hoje ? undefined : data,
      meus: meus ? 'true' : undefined, membro: membro ?? undefined, situacao: situacao ?? undefined,
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

  // Folhas: compromisso (`?novo=1` abre o novo e sai do endereço na hora), evento e, no celular, agendas e filtros.
  const [compromisso, setCompromisso] = useState<Compromisso | 'novo' | null>(null);
  const [evento, setEvento] = useState<EventoAberto | null>(null);
  const [painelAberto, setPainelAberto] = useState(false);
  const aoMudarFiltro = (novos: Partial<Parametros>) => setAjuste((atual) => ({ ...atual, ...novos }));
  useEffect(() => {
    if (!ajuste || painelAberto) return;
    const gravados = ajuste;
    depoisDeFecharAsFolhas(() => { ir(gravados, 'replace'); });
  // `ir` é recriada a cada render; o que decide é o ajuste e o painel terem fechado.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ajuste, painelAberto]);
  useEffect(() => {
    // O endereço já tem o que foi escolhido: o ajuste local cumpriu o papel.
    if (!ajuste || !(Object.keys(ajuste) as (keyof Parametros)[]).every((k) => (p[k] ?? undefined) === (ajuste[k] ?? undefined))) return undefined;
    let vivo = true;
    void Promise.resolve().then(() => { if (vivo) setAjuste(null); });
    return () => { vivo = false; };
  }, [ajuste, p]);
  const diaSugerido = data < hoje ? hoje : data;
  useEffect(() => {
    if ((p.novo !== '1' && p.novo !== 'evento') || !podeAlterar) return;
    let vivo = true;
    const comoEvento = p.novo === 'evento';
    void Promise.resolve().then(() => {
      if (!vivo) return;
      if (comoEvento) setEvento({ tipo: 'novo', data: diaSugerido }); else setCompromisso('novo');
      router.setParams({ novo: undefined });
    });
    return () => { vivo = false; };
  }, [p.novo, podeAlterar, diaSugerido]);
  const abrirItem = (item: ItemDoCalendario) => {
    const f = item.fonte;
    if (f.origem === 'COMPROMISSO') setCompromisso(f.compromisso);
    else if (f.origem === 'EVENTO') setEvento({ tipo: 'abrir', eventoId: f.ocorrencia.eventoId, ocorrencia: item.ocorrencia });
  };
  const alternar = (chave: string) => escolherPreferencia({ agendasOcultas: alternarAgendaOculta(cal.ocultas, chave) });

  const { de, ate } = periodoDoCalendario(visao, data);
  const noPeriodoDeHoje = visao === 'mes' ? data.slice(0, 7) === hoje.slice(0, 7) : visao === 'ano' ? data.slice(0, 4) === hoje.slice(0, 4)
    : de <= hoje && hoje <= ate;
  const nomesDasAgendas = useMemo(() => new Map((cal.agendas ?? []).map((a) => [a.id, a.nome])), [cal.agendas]);
  const itens = cal.itens ?? [];
  const vazio = cal.pronto && itens.length === 0 && cal.semData.length === 0 && (visao !== 'ano' || (cal.contagem?.size ?? 0) === 0);
  const comSemData = cal.semData.length > 0 && de <= hoje && hoje <= ate;

  const filtros = <Filtros meus={meus} membro={membro} situacao={situacao} permissoes={permissoes} cal={cal} usuarioId={usuario?.id ?? null}
    aoMudar={aoMudarFiltro} />;
  const painel = cal.painelDeAgendas.length ? <PainelDeAgendas agendas={cal.painelDeAgendas} pessoais={cal.agendas} carregando={cal.agendasCarregando}
    podeAlterar={podeAlterar} aoAlternar={alternar} aoMudar={() => { cal.recarregarAgendas(); cal.recarregarEventos(); }} /> : null;

  const conteudo = !cal.pronto && !cal.erros.length ? <Esqueleto texto="Carregando a agenda" /> : <>
    {vazio && modo === 'lista' ? <Vazio titulo="Nada neste período" texto="Nenhum compromisso, evento ou atualização nestes dias." /> : null}
    {vazio && modo !== 'lista' ? <Texto variante="suave" accessibilityLiveRegion="polite">Nada neste período.</Texto> : null}
    {modo === 'grade' ? <GradeDeHorarios dias={diasDoPeriodo(de, ate)} itens={itens} hoje={hoje} meus={meus} chaveDoPeriodo={`${visao}:${de}`}
      aoAbrir={abrirItem} aoAbrirDia={visao === 'semana' ? abrirDia : undefined}
      aoCriarNoHorario={podeAlterar ? (d, hora) => setEvento({ tipo: 'novo', data: d, hora }) : undefined} /> : null}
    {modo === 'lista' && !vazio ? <ListaDoCalendario itens={itens} de={de} ate={ate} hoje={hoje} meus={meus} nomesDasAgendas={nomesDasAgendas}
      semData={cal.semData} aoAbrir={abrirItem} /> : null}
    {modo === 'mes' ? <VisaoDoMes data={data} hoje={hoje} itens={itens} compacta={false} aoTocarDia={abrirDia} /> : null}
    {modo === 'mesCompacto' ? <>
      <VisaoDoMes data={data} hoje={hoje} itens={itens} compacta aoTocarDia={escolherData} />
      <ListaDoCalendario itens={itens} de={data} ate={data} hoje={hoje} meus={meus} nomesDasAgendas={nomesDasAgendas} aoAbrir={abrirItem} />
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
  const barra = <BarraDoCalendario visao={visao} data={data} noPeriodoDeHoje={noPeriodoDeHoje} aoMudarVisao={mudarVisao}
    aoDeslocar={(s) => escolherData(deslocarCalendario(visao, data, s))} aoHoje={() => ir({ data: undefined }, 'replace')}
    extra={lateral ? undefined : <Botao rotulo="Agendas e filtros" tipo="secundario" Icone={SlidersHorizontal} aoTocar={() => setPainelAberto(true)} />} />;

  return <Tela largura={LARGURA_LISTA} bordas={['top']}>
    <Cabecalho titulo="Agenda" mostrarMarca="celular"
      acoes={podeAlterar ? <MenuCriar aoCompromisso={() => setCompromisso('novo')} aoEvento={() => setEvento({ tipo: 'novo', data: diaSugerido })}
        aoMudarAberto={setMenuAberto} /> : undefined} />
    <View onLayout={(e) => setLargura(Math.round(e.nativeEvent.layout.width))}>
      {largura === 0 ? null : lateral ? (
        <View style={estilos.colunas}>
          <View style={estilos.lateral}>
            <MiniCalendario visao={visao} data={data} hoje={hoje} aoEscolher={escolherData} />
            {painel}
            {filtros}
          </View>
          <View style={estilos.principal}>
            {barra}
            {avisos}
            {conteudo}
          </View>
        </View>
      ) : (
        <View style={estilos.principal}>
          {barra}
          {avisos}
          {conteudo}
        </View>
      )}
    </View>

    {lateral ? null : <Folha visivel={painelAberto} titulo="Agendas e filtros" aoFechar={() => setPainelAberto(false)}>
      <View style={estilos.painelDaFolha}>
        {painel}
        {filtros}
      </View>
    </Folha>}
    {permissoes.agenda ? <FolhaCompromisso aberto={compromisso} dataSugerida={diaSugerido} hoje={hoje} responsaveis={cal.equipe}
      carregados={cal.compromissosCarregados} aoFechar={() => setCompromisso(null)}
      aoMudar={(c) => { setCompromisso((atual) => (atual && atual !== 'novo' ? c : atual)); cal.recarregarCompromissos(); }} /> : null}
    {permissoes.agenda ? <FolhaEvento aberto={evento} agendas={cal.agendas} erroDasAgendas={cal.erros.find((x) => x.chave === 'agendas')?.erro}
      recarregarAgendas={cal.recarregarAgendas} hoje={hoje} itens={itens} podeAlterar={podeAlterar}
      aoFechar={() => setEvento(null)}
      aoMudar={(o) => { cal.recarregarEventos(); if (o.agendas) cal.recarregarAgendas(); }} /> : null}
  </Tela>;
}

/**
 * Filtros da agenda: o responsável (D19: toda a equipe, só os meus ou um membro, nas três fontes), a situação dos
 * compromissos e o contador de atualizações atrasadas com o link para a lista.
 */
function Filtros({ meus, membro, situacao, permissoes, cal, usuarioId, aoMudar }: {
  meus: boolean; membro: string | null; situacao: ReturnType<typeof lerSituacao>;
  permissoes: { agenda: boolean; equipe: boolean };
  cal: ReturnType<typeof useCalendario>; usuarioId: string | null; aoMudar: (novos: Partial<Parametros>) => void;
}) {
  const opcoes = [
    { valor: TODA_A_EQUIPE, rotulo: 'Toda a equipe' },
    { valor: SO_OS_MEUS, rotulo: 'Só os meus' },
    ...(permissoes.equipe ? cal.equipe.filter((r) => r.id !== usuarioId).map((r) => ({ valor: r.id, rotulo: r.nome })) : []),
  ];
  const valor = meus ? SO_OS_MEUS : membro ?? TODA_A_EQUIPE;
  const nomeDoMembro = membro ? cal.equipe.find((r) => r.id === membro)?.nome ?? 'Membro da equipe' : 'Toda a equipe';
  return (
    <View style={estilos.filtros}>
      <Texto variante="secao" nivel={2}>Filtros</Texto>
      <EscolhaEmFolha rotulo="Responsável" titulo="Mostrar a agenda de" valor={valor} opcoes={opcoes} rotuloDoValor={nomeDoMembro}
        carregando={cal.equipeCarregando}
        aoMudar={(v) => aoMudar({ meus: v === SO_OS_MEUS ? 'true' : undefined, membro: v && v !== SO_OS_MEUS ? v : undefined })} />
      {permissoes.agenda ? <>
        <Escolha rotulo="Compromissos" valor={situacao ?? 'TODAS'} opcoes={OPCOES_SITUACAO}
          aoMudar={(v) => aoMudar({ situacao: v === 'TODAS' ? undefined : v })} />
        {situacao ? <Texto variante="suave">Com vários alunos, aparecem os compromissos em que algum aluno está nessa situação.</Texto> : null}
      </> : null}
      {cal.atrasadas ? <View style={estilos.atrasadas}>
        <Selo texto={cal.atrasadas} tipo="perigo" />
        <LinkTexto texto="Ver atrasadas" href={caminhoListaAtualizacoes('ATRASADAS', meus)} />
      </View> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  colunas: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(3) },
  lateral: { width: LARGURA_DO_MINI, gap: espaco(3) },
  principal: { flex: 1, minWidth: 0, gap: espaco(2) },
  painelDaFolha: { gap: espaco(3) },
  filtros: { gap: espaco(1.5) },
  atrasadas: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: espaco(1.5) },
});
