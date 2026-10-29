import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Compromisso } from '../../api/agendaTipos';
import { listarAtualizacoes, listarCompromissos, painelTreinador, responsaveisEquipe } from '../../api/rotas';
import { resumoDeAtrasadas } from '../../dominio/agenda';
import {
  deslocarReferencia, diasDaAgenda, hojeEmBrasilia, lerDataDeReferencia, lerSituacao, lerVisao, metadadosDoCompromisso, nomesDosParticipantes,
  OPCOES_SITUACAO, periodoDaVisao, resumoDoDia, seloDoCompromisso, tituloDoPeriodo, type VisaoDaAgenda,
} from '../../dominio/agendaPresencial';
import { caminhoAtualizacaoTreinador, caminhoListaAtualizacoes, statusAtualizacaoTreinador } from '../../dominio/atualizacao';
import { FolhaCompromisso } from '../../treinador/agenda/FolhaCompromisso';
import { EscolhaResponsabilidade } from '../../treinador/EscolhaResponsabilidade';
import { espaco, LARGURA_LISTA } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { CabecalhoDeGrupo } from '../../ui/CabecalhoDeGrupo';
import { Cartao } from '../../ui/Cartao';
import { Escolha } from '../../ui/Escolha';
import { EscolhaEmFolha } from '../../ui/EscolhaEmFolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { LinhaDaLista, ListaDeLinhas } from '../../ui/LinhaDaLista';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { LinkTexto } from '../../ui/LinkTexto';
import { Selo } from '../../ui/Selo';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { useSessao } from '../../sessao/SessaoProvider';

/** Valor do filtro de membro quando nenhum foi escolhido. */
const TODA_A_EQUIPE = '';
/** Lista vazia estável (a parte que a pessoa não pode ver), para o `useMemo` dos dias não refazer a conta à toa. */
const NADA: never[] = [];

type Parametros = { meus?: string; membro?: string; visao?: string; data?: string; situacao?: string; novo?: string };

/**
 * Agenda do treinador: os compromissos presenciais (consultas, retornos; `AGENDA_LER`) e as atualizações que vencem
 * nos próximos dias (`ATUALIZACAO_LER` + `ALUNO_SENSIVEL_LER`, `PROXIMAS`), juntos, por dia. A guarda é
 * `podeAcessarTela` (uma das duas basta) e cada parte só aparece a quem pode vê-la. Visão Dia ou Semana (o dia e os 7
 * seguintes, como sempre foi); filtros no endereço: `meus`, `membro`, `visao`, `data`, `situacao` (só dos compromissos)
 * e `novo=1` (atalho da busca), consumido ao abrir. Datas e horas sempre de Brasília.
 */
export default function AgendaDoTreinador() {
  const p = useLocalSearchParams<Parametros>();
  const { pode, usuario } = useSessao();
  const verAtualizacoes = pode('ATUALIZACAO_LER') && pode('ALUNO_SENSIVEL_LER');
  const verCompromissos = pode('AGENDA_LER');
  const podeMarcar = pode('AGENDA_ALTERAR');

  const hoje = hojeEmBrasilia();
  const meus = p.meus === 'true';
  const membro = !meus && verCompromissos ? p.membro ?? TODA_A_EQUIPE : TODA_A_EQUIPE;
  const visao = lerVisao(p.visao);
  const referencia = lerDataDeReferencia(p.data, hoje);
  const situacao = lerSituacao(p.situacao);
  const { de, ate } = periodoDaVisao(visao, referencia);

  // Filtros moram no endereço; trocar substitui a entrada (como o Todos/Meus de sempre), sem empilhar passos.
  const mudarParametros = (novos: Partial<Parametros>) => {
    const atual: Parametros = { meus: meus ? 'true' : undefined, membro: membro || undefined, visao: visao === 'dia' ? 'dia' : undefined,
      data: referencia === hoje ? undefined : referencia, situacao: situacao ?? undefined };
    const juntos = { ...atual, ...novos };
    const params = Object.fromEntries(Object.entries(juntos).filter(([, v]) => v !== undefined && v !== '')) as Record<string, string>;
    router.replace({ pathname: '/treinador/agenda', params });
  };

  // Atualizações: as próximas (hoje a hoje + 7), com o mesmo Todos/Meus. Com um membro escolhido elas ficam de fora
  // (a lista das atualizações só sabe filtrar "Meus").
  const lista = useCarregar(verAtualizacoes && !membro ? `agenda:${meus}` : null,
    async () => ({ meus, itens: await listarAtualizacoes('PROXIMAS', meus) }));
  const { recarregar } = lista;
  const painel = useCarregar(verAtualizacoes && pode('PAINEL_VER') ? `agenda-painel:${meus}` : null, () => painelTreinador(meus));
  const recarregarPainel = painel.recarregar;
  // Compromissos do período, do responsável escolhido ("Meus" = quem está logado).
  const responsavel = meus ? usuario?.id ?? null : membro || null;
  const chaveCompromissos = verCompromissos ? `compromissos:${de}:${ate}:${responsavel ?? ''}:${situacao ?? ''}` : null;
  const compromissos = useCarregar(chaveCompromissos, async (chave) => ({ chave, itens: await listarCompromissos({ de, ate, responsavel, situacao }) }));
  const recarregarCompromissos = compromissos.recarregar;
  const equipe = useCarregar(verCompromissos ? 'agenda-equipe' : null, () => responsaveisEquipe());
  useFocusEffect(useCallback(() => { recarregar(); recarregarPainel(); recarregarCompromissos(); }, [recarregar, recarregarPainel, recarregarCompromissos]));

  // Folha do compromisso: `?novo=1` abre o formulário e sai do endereço na hora (o voltar não fica com passo sobrando).
  const [aberto, setAberto] = useState<Compromisso | 'novo' | null>(null);
  useEffect(() => {
    if (p.novo !== '1' || !podeMarcar) return;
    let vivo = true;
    void Promise.resolve().then(() => { if (!vivo) return; setAberto('novo'); router.setParams({ novo: undefined }); });
    return () => { vivo = false; };
  }, [p.novo, podeMarcar]);

  // Só os dados do recorte atual: enquanto o novo chega, nada do anterior aparece como se fosse dele.
  const itensAtualizacoes = verAtualizacoes && !membro ? (lista.dados?.meus === meus ? lista.dados.itens : undefined) : NADA;
  const itensCompromissos = verCompromissos ? (compromissos.dados?.chave === chaveCompromissos ? compromissos.dados.itens : undefined) : NADA;
  const dias = useMemo(() => (itensAtualizacoes && itensCompromissos
    ? diasDaAgenda(de, ate, hoje, itensCompromissos, itensAtualizacoes) : null), [itensAtualizacoes, itensCompromissos, de, ate, hoje]);
  const atrasadas = verAtualizacoes ? resumoDeAtrasadas(painel.dados?.atualizacoesAtrasadas) : null;
  const carregando = (lista.carregando || compromissos.carregando) && !dias;
  const opcoesMembro = [{ valor: TODA_A_EQUIPE, rotulo: 'Toda a equipe' }, ...(equipe.dados ?? []).map((r) => ({ valor: r.id, rotulo: r.nome }))];

  const descricao = verCompromissos && verAtualizacoes
    ? 'Compromissos com os alunos e as atualizações que vencem, dia a dia. As atualizações aparecem de hoje até 7 dias à frente.'
    : verCompromissos ? 'Compromissos com os alunos, dia a dia. Toque num para ver, remarcar ou marcar como realizado.'
      : 'As atualizações que vencem nos próximos 7 dias, dia a dia. Toque numa para abrir.';

  return <Tela largura={LARGURA_LISTA} bordas={['top']}>
    <Cabecalho titulo="Agenda" mostrarMarca="celular"
      acoes={podeMarcar ? <Botao rotulo="Novo compromisso" aoTocar={() => setAberto('novo')} /> : undefined} />
    <Texto variante="suave">{descricao}</Texto>

    {/* Visão e período: Dia ou Semana, com as setas e o "Hoje". */}
    <View style={estilos.topo}>
      <Escolha<VisaoDaAgenda> rotulo="Visão" valor={visao} opcoes={[{ valor: 'dia', rotulo: 'Dia' }, { valor: 'semana', rotulo: 'Semana' }]}
        aoMudar={(v) => mudarParametros({ visao: v === 'dia' ? 'dia' : undefined })} />
      <View style={estilos.periodo}>
        <Texto variante="bloco" nivel={2}>{tituloDoPeriodo(visao, referencia, hoje)}</Texto>
        <LinhaDeAcoes>
          <Botao rotulo={visao === 'dia' ? '‹ Dia anterior' : '‹ Semana anterior'} tipo="secundario"
            aoTocar={() => mudarParametros({ data: deslocarReferencia(visao, referencia, -1) })} />
          {referencia !== hoje ? <Botao rotulo="Hoje" tipo="secundario" aoTocar={() => mudarParametros({ data: undefined })} /> : null}
          <Botao rotulo={visao === 'dia' ? 'Próximo dia ›' : 'Próxima semana ›'} tipo="secundario"
            aoTocar={() => mudarParametros({ data: deslocarReferencia(visao, referencia, 1) })} />
        </LinhaDeAcoes>
      </View>
    </View>

    {/* Filtros: o mesmo Todos/Meus das outras telas; com compromissos, também o membro e a situação. */}
    <View style={estilos.topo}>
      <EscolhaResponsabilidade valor={meus ? 'meus' : 'todos'} aoMudar={(v) => mudarParametros({ meus: v === 'meus' ? 'true' : undefined, membro: undefined })} />
      {verCompromissos && !meus ? <EscolhaEmFolha rotulo="Membro" titulo="Compromissos de" valor={membro} opcoes={opcoesMembro}
        rotuloDoValor="Toda a equipe" carregando={equipe.carregando} aoMudar={(id) => mudarParametros({ membro: id || undefined })}
        style={estilos.alinharAbaixo} /> : null}
      {verCompromissos ? <Escolha rotulo="Compromissos" valor={situacao ?? 'TODAS'} opcoes={OPCOES_SITUACAO}
        aoMudar={(v) => mudarParametros({ situacao: v === 'TODAS' ? undefined : v })} /> : null}
      {atrasadas && !membro ? <View style={estilos.atrasadas}>
        <Selo texto={atrasadas} tipo="perigo" />
        <LinkTexto texto="Ver atrasadas" href={caminhoListaAtualizacoes('ATRASADAS', meus)} />
      </View> : null}
    </View>
    {membro && verAtualizacoes ? <Texto variante="suave">As atualizações aparecem em “Todos” ou “Meus”.</Texto> : null}

    {lista.erro ? <MensagemErro texto={textoDoErro(lista.erro)} erro={lista.erro} tentarDeNovo={recarregar} /> : null}
    {compromissos.erro ? <MensagemErro texto={textoDoErro(compromissos.erro)} erro={compromissos.erro} tentarDeNovo={recarregarCompromissos} /> : null}
    {carregando ? <Esqueleto /> : null}
    {/* Um cartão por dia com a faixa do dia; dia vazio fica só na faixa, para a semana caber na tela. */}
    {dias ? dias.map((dia) => <Cartao key={dia.data ?? 'sem-data'}
      cabecalho={<CabecalhoDeGrupo titulo={dia.titulo} resumo={resumoDoDia(dia.compromissos.length, dia.atualizacoes.length)} />}>
      {dia.compromissos.length || dia.atualizacoes.length ? <ListaDeLinhas>
        {dia.compromissos.map((c) => {
          const selo = seloDoCompromisso(c);
          const nome = nomesDosParticipantes(c);
          return <LinhaDaLista key={`c:${c.id}`} titulo={nome} metadados={metadadosDoCompromisso(c)} selos={[selo]}
            esmaecido={c.cancelado} aoTocarTextos={() => setAberto(c)}
            acoes={<Botao rotulo="Abrir" tipo="secundario" rotuloAcessivel={`Abrir compromisso de ${nome}, ${c.hora}`} aoTocar={() => setAberto(c)} />} />;
        })}
        {dia.atualizacoes.map((a) => {
          const selo = statusAtualizacaoTreinador(a, hoje);
          const nome = a.nomeAluno ?? 'Aluno';
          // O dia já está no título do cartão: o selo só entra quando diz algo a mais (adiada, atrasada).
          return <LinhaDaLista key={`a:${a.pastaId}`} titulo={nome} metadados="Atualização"
            selos={selo.tipo === 'neutro' ? undefined : [{ texto: selo.curto, tipo: selo.tipo }]}
            href={caminhoAtualizacaoTreinador(a, { situacao: 'PROXIMAS', meus })}
            rotulo={`Abrir atualização de ${nome}, ${dia.titulo}${selo.tipo === 'neutro' ? '' : `, ${selo.curto}`}`} />;
        })}
      </ListaDeLinhas> : null}
    </Cartao>) : null}

    {verCompromissos ? <FolhaCompromisso aberto={aberto} dataSugerida={referencia < hoje ? hoje : referencia} hoje={hoje}
      responsaveis={equipe.dados ?? []} carregados={itensCompromissos ?? []} aoFechar={() => setAberto(null)}
      aoMudar={(c) => { setAberto((atual) => (atual && atual !== 'novo' ? c : atual)); recarregarCompromissos(); }} /> : null}
  </Tela>;
}

const estilos = StyleSheet.create({
  topo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: espaco(1.5) },
  periodo: { gap: espaco(1), alignItems: 'flex-end', flexShrink: 1 },
  atrasadas: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5) },
  alinharAbaixo: { alignSelf: 'flex-end' },
});
