import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { AgendaPessoal, EscopoDaSerie, EventoDetalhe } from '../../api/agendaTipos';
import { detalheDoEvento, excluirEvento } from '../../api/rotas';
import { dataComDiaDaSemana } from '../../dominio/agendaCalendario';
import {
  alvoDoEvento, ehSerieDeEventos, escoposDoEvento, escoposParaExcluirEvento, explicacaoDoEscopoDoEvento, formularioDeEventoNovo, formularioDoEvento,
  mudouAAgendaDoEvento, mudouADataDoEvento, NOME_DA_AGENDA_PADRAO, ROTULOS_DAS_CORES_DA_AGENDA, ROTULOS_DO_ESCOPO_DO_EVENTO, textoDaRepeticaoDoEvento,
  textoDeExcluirEvento, textoDoErroDoCalendario,
} from '../../dominio/agendaEvento';
import { espaco, LARGURA_EDITOR } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { CampoLeitura } from '../../ui/CampoLeitura';
import { Escolha } from '../../ui/Escolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { MarcadorDaAgenda } from './itemDaAgenda';
import { useFormularioDoEvento } from './useFormularioDoEvento';

/** Um evento da agenda (a regra e a ocorrência tocada). O novo é da `FolhaCriar`. */
export interface EventoAberto { eventoId: string; ocorrencia: string | null }

interface Props {
  aberto: EventoAberto | null;
  /** As agendas pessoais (`null` = ainda carregando ou a leitura falhou: o formulário só abre sabendo a agenda). */
  agendas: readonly AgendaPessoal[] | null;
  /** O erro da leitura das agendas, quando falhou (sem ele, `agendas` nulo é carregando). */
  erroDasAgendas?: unknown;
  /** Lê as agendas de novo ("Tentar de novo" no lugar do formulário). */
  recarregarAgendas: () => void;
  hoje: string;
  podeAlterar: boolean;
  aoFechar: () => void;
  /** Depois de criar, alterar ou excluir. `agendas` = criou a "Pessoal" (a tela relê a lista). */
  aoMudar: (o: { agendas: boolean }) => void;
}

/**
 * Folha do evento pessoal: detalhe (título, quando, agenda, repetição, local, descrição; Editar e Excluir com
 * `AGENDA_ALTERAR`) ou a edição, no formulário completo em `LARGURA_EDITOR` (o formulário mora em `useFormularioDoEvento`;
 * o novo é a `FolhaCriar`). Numa série, salvar e excluir perguntam o escopo; mudar a data só vale em "Somente este" e a
 * agenda só na série toda. 409 de versão relê o evento e avisa. Cada evento aberto é uma folha nova (a `key`).
 */
export function FolhaEvento(props: Props) {
  const a = props.aberto;
  return <FolhaAberta key={a ? `${a.eventoId}:${a.ocorrencia ?? ''}` : 'fechada'} {...props} />;
}

type Pergunta =
  | { tipo: 'salvar'; escopos: EscopoDaSerie[] }
  | { tipo: 'excluir'; escopos: EscopoDaSerie[] };

function FolhaAberta({ aberto, agendas, erroDasAgendas, recarregarAgendas, hoje, podeAlterar, aoFechar, aoMudar }: Props) {
  const detalhe = useCarregar(aberto ? `evento:${aberto.eventoId}:${aberto.ocorrencia ?? ''}` : null,
    () => detalheDoEvento(aberto?.eventoId ?? '', aberto?.ocorrencia));
  const e = detalhe.dados ?? null;
  const serie = !!e && ehSerieDeEventos(e);
  const lista = agendas ?? [];

  const [modo, setModo] = useState<'detalhe' | 'formulario'>('detalhe');
  // Formulário da edição (sempre o completo): o estado mora no hook para os botões irem ao rodapé fixo da folha.
  const f = useFormularioDoEvento({
    evento: e, inicial: () => formularioDeEventoNovo('', hoje), agendas, ativo: modo === 'formulario', hoje, completoInicial: true,
  });
  const [aviso, setAviso] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const [pergunta, setPergunta] = useState<Pergunta | null>(null);
  const [escopo, setEscopo] = useState<EscopoDaSerie>('ESTA');

  const limpar = () => { setErro(null); setAviso(null); f.limparMensagens(); };
  const editar = () => {
    if (!e) return;
    f.substituir(formularioDoEvento(e));
    limpar();
    setModo('formulario');
  };

  const ocorrencia = e?.ocorrencia ?? null;
  const restricoes = e && ocorrencia ? { mudouData: mudouADataDoEvento(f.form, ocorrencia), mudouAgenda: mudouAAgendaDoEvento(f.form, e) } : {};
  const escopos = e ? escoposDoEvento(serie, restricoes) : (['ESTA'] as EscopoDaSerie[]);
  const opcoesDoPedido = (escolhido: EscopoDaSerie) => ({
    versao: e?.versao,
    serie: e && serie ? { escopo: escolhido, ocorrencia: ocorrencia?.dataOriginal ?? null, primeiroDia: e.data } : undefined,
  });

  // 409 de versão: relê o evento, volta ao detalhe e diz o que houve (o que estava digitado não serve mais).
  const tratarErro = (x: unknown, noFormulario: boolean) => {
    if ((x as { codigo?: unknown } | null)?.codigo === 'CONFLITO_EDICAO' && e) {
      detalhe.recarregar();
      aoMudar({ agendas: false });
      setModo('detalhe');
      f.limparMensagens();
      setErro(null);
      setAviso('Este evento mudou em outra aba ou aparelho. Esta é a versão atual: confira e edite de novo, se precisar.');
      return;
    }
    if (noFormulario) f.mostrarErro(x); else setErro(x);
  };
  const enviar = async (escolhido: EscopoDaSerie) => {
    const r = await f.enviar(opcoesDoPedido(escolhido), alvoDoEvento(serie, escolhido, ocorrencia?.dataOriginal ?? null));
    setPergunta(null);
    if (r.criouAgenda || r.ok) aoMudar({ agendas: r.criouAgenda });
    if (r.ok) aoFechar();
    else if (r.erro) tratarErro(r.erro, true);
  };
  const salvar = () => {
    setAviso(null);
    if (!f.conferirPedido(opcoesDoPedido(escopos[0] ?? 'ESTA'))) return;
    if (escopos.length === 0) {
      setAviso('Mude a data ou a agenda, uma de cada vez: a data vale só para este evento e a agenda, para a série toda.');
      return;
    }
    if (escopos.length > 1) { setEscopo(escopos[0]); setPergunta({ tipo: 'salvar', escopos }); return; }
    void enviar(escopos[0]);
  };

  const excluir = async (escolhido: EscopoDaSerie) => {
    if (!e) return;
    setExcluindo(true);
    setErro(null);
    try {
      await excluirEvento(e.id, e.versao, alvoDoEvento(serie, escolhido, ocorrencia?.dataOriginal ?? null));
      setPergunta(null);
      aoMudar({ agendas: false });
      aoFechar();
    } catch (x) {
      setPergunta(null);
      tratarErro(x, false);
    } finally {
      setExcluindo(false);
    }
  };
  const pedirExcluir = () => {
    const lista = escoposParaExcluirEvento(serie);
    setEscopo(lista[0]);
    setPergunta({ tipo: 'excluir', escopos: lista });
  };

  const ocupado = f.salvando || excluindo;
  const textoDaFalha = erro ? textoDoErroDoCalendario(erro, 'evento') ?? textoDoErro(erro) : null;
  const linhaDaMensagem = modo === 'formulario' && f.mensagem ? f.mensagem
    : textoDaFalha ? <MensagemErro texto={textoDaFalha} erro={erro} />
      : aviso ? <Texto variante="suave" accessibilityLiveRegion="polite">{aviso}</Texto> : null;

  // O formulário só abre sabendo as agendas: carregando, espera; falhou, diz e deixa tentar de novo (sem beco sem saída).
  const semListaDeAgendas = modo === 'formulario' && agendas === null;
  const titulo = modo === 'formulario' ? 'Editar evento' : 'Evento';
  const voltar = () => { limpar(); setModo('detalhe'); };
  const rodape = semListaDeAgendas ? <>
    <Botao rotulo="Cancelar" tipo="secundario" aoTocar={voltar} />
  </> : modo === 'formulario' ? <>
    <Botao rotulo="Cancelar" tipo="secundario" aoTocar={voltar} />
    <Botao rotulo="Salvar alterações" aoTocar={salvar} carregando={f.salvando} desabilitado={f.salvando} motivo="Salvando." />
  </> : e && podeAlterar ? <>
    <Botao rotulo="Excluir" tipo="perigoTexto" aoTocar={pedirExcluir} desabilitado={ocupado} motivo="Salvando." />
    <Botao rotulo="Editar" tipo="secundario" aoTocar={editar} desabilitado={ocupado} motivo="Salvando." />
  </> : undefined;

  const dataDaOcorrencia = ocorrencia?.data ?? e?.data ?? hoje;
  const sobreASerie = e && serie ? <Texto variante="suave" accessibilityLiveRegion="polite">
    {restricoes.mudouData && restricoes.mudouAgenda ? 'A data só muda neste evento e a agenda só na série toda: mude uma de cada vez.'
      : restricoes.mudouData ? 'Mudar a data vale só para este evento da série.'
        : restricoes.mudouAgenda ? 'Mudar a agenda vale para a série toda.'
          : 'Este evento faz parte de uma série. Ao salvar, você escolhe se vale só para este, para os seguintes ou para todos.'}
  </Texto> : null;

  return (
    <Folha visivel={aberto !== null} titulo={titulo} aoFechar={aoFechar} rodape={rodape}
      statusDoRodape={!semListaDeAgendas && linhaDaMensagem ? linhaDaMensagem : undefined}
      largura={modo === 'formulario' && !semListaDeAgendas ? LARGURA_EDITOR : undefined}>
      {semListaDeAgendas ? (
        erroDasAgendas ? <MensagemErro texto={`Não deu para carregar as suas agendas. ${textoDoErro(erroDasAgendas)}`} erro={erroDasAgendas}
          tentarDeNovo={recarregarAgendas} />
          : <Esqueleto texto="Carregando as suas agendas" cartoes={1} />
      ) : modo === 'formulario' ? (
        f.campos({ comRepeticao: serie, sobreASerie })
      ) : e ? (
        <DetalheDoEvento evento={e} agendas={lista} hoje={hoje} />
      ) : detalhe.erro ? (
        <MensagemErro texto={textoDoErro(detalhe.erro)} erro={detalhe.erro} tentarDeNovo={detalhe.recarregar} />
      ) : <Esqueleto texto="Carregando o evento" cartoes={1} />}
      {pergunta && e ? (
        <PainelConfirmacao visivel perigo={pergunta.tipo === 'excluir'}
          titulo={pergunta.tipo === 'excluir' ? (serie ? 'Excluir quais eventos da série?' : 'Excluir o evento?') : 'Salvar em quais eventos da série?'}
          mensagem={pergunta.tipo === 'excluir' ? textoDeExcluirEvento(escopo, serie) : undefined}
          rotuloConfirmar={pergunta.tipo === 'excluir' ? 'Excluir' : 'Salvar alterações'} rotuloCancelar="Voltar" carregando={ocupado}
          aoCancelar={() => setPergunta(null)} aoConfirmar={() => void (pergunta.tipo === 'excluir' ? excluir(escopo) : enviar(escopo))}>
          {pergunta.escopos.length > 1 ? <View style={estilos.escopo}>
            <Escolha<EscopoDaSerie> rotulo="Aplicar a" valor={escopo} aoMudar={setEscopo}
              opcoes={pergunta.escopos.map((x) => ({ valor: x, rotulo: ROTULOS_DO_ESCOPO_DO_EVENTO[x] }))} />
            <Texto variante="suave" accessibilityLiveRegion="polite">{explicacaoDoEscopoDoEvento(escopo, dataDaOcorrencia, hoje)}</Texto>
          </View> : null}
        </PainelConfirmacao>
      ) : null}
    </Folha>
  );
}

/** O evento só leitura: quando (com a hora de Brasília), agenda com a cor e o nome, repetição por extenso, local e descrição. */
function DetalheDoEvento({ evento: e, agendas, hoje }: { evento: EventoDetalhe; agendas: readonly AgendaPessoal[]; hoje: string }) {
  const o = e.ocorrencia;
  const agenda = agendas.find((a) => a.id === (o?.agendaId ?? e.agendaId));
  const data = o?.data ?? e.data;
  const diaInteiro = o?.diaInteiro ?? e.diaInteiro;
  const quando = `${dataComDiaDaSemana(data)}${diaInteiro ? ', dia inteiro' : o?.hora ? `, ${o.hora}–${o.horaFim ?? ''}` : e.hora ? `, ${e.hora}` : ''}`;
  return (
    <View style={estilos.detalhe}>
      <Texto variante="bloco" nivel={3}>{o?.titulo ?? e.titulo}</Texto>
      {!o ? <Texto variante="suave">Este evento da série foi excluído. Abaixo, a regra da série.</Texto> : null}
      <CampoLeitura rotulo="Quando" valor={quando} />
      <View style={estilos.agenda}>
        {agenda ? <MarcadorDaAgenda cor={agenda.cor} forma="ponto" /> : null}
        <View style={estilos.flex}>
          <CampoLeitura rotulo="Agenda" valor={agenda ? `${agenda.nome} (${ROTULOS_DAS_CORES_DA_AGENDA[agenda.cor]})` : NOME_DA_AGENDA_PADRAO} />
        </View>
      </View>
      <CampoLeitura rotulo="Repetição" valor={textoDaRepeticaoDoEvento(e.repeticao, hoje)} />
      <CampoLeitura rotulo="Local" valor={(o ? o.local : e.local) ?? null} />
      <CampoLeitura rotulo="Descrição" valor={(o ? o.descricao : e.descricao) ?? null} />
    </View>
  );
}

const estilos = StyleSheet.create({
  escopo: { gap: espaco(1) },
  detalhe: { gap: espaco(1.5) },
  agenda: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  flex: { flex: 1, minWidth: 0 },
});
