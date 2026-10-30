import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { AgendaPessoal, EscopoDaSerie, EventoDetalhe, EventoRequest } from '../../api/agendaTipos';
import { alterarEvento, criarAgendaPessoal, criarEvento, detalheDoEvento, excluirEvento, listarAgendasPessoais } from '../../api/rotas';
import { dataComDiaDaSemana } from '../../dominio/agendaCalendario';
import {
  agendaDoFormulario, alvoDoEvento, ehSerieDeEventos, type ErrosDaRepeticaoDoEvento, type ErrosDoEvento, escoposDoEvento, escoposParaExcluirEvento,
  explicacaoDoEscopoDoEvento, type FormularioDaRepeticaoDoEvento, type FormularioDoEvento, formularioDeEventoNovo, formularioDoEvento,
  garantirAgendaPadrao, mudouAAgendaDoEvento, mudouADataDoEvento, NOME_DA_AGENDA_PADRAO, pedidoDeCruzamento, pedidoDoEvento,
  ROTULOS_DAS_CORES_DA_AGENDA, ROTULOS_DO_ESCOPO_DO_EVENTO, textoDaRepeticaoDoEvento, textoDeExcluirEvento, textoDoCruzamento, textoDoErroDoCalendario,
} from '../../dominio/agendaEvento';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco } from '../../tema/tokens';
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
import { CamposDoEvento } from './CamposDoEvento';
import { MarcadorDaAgenda } from './itemDaAgenda';
import { useAvisoDeCruzamento } from './useAvisoDeCruzamento';

/** Evento novo (com o dia e, se veio da grade, a hora) ou um evento da agenda (a regra e a ocorrência tocada). */
export type EventoAberto =
  | { tipo: 'novo'; data: string; hora?: string }
  | { tipo: 'abrir'; eventoId: string; ocorrencia: string | null };

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
 * `AGENDA_ALTERAR`) ou formulário. Numa série, salvar e excluir perguntam o escopo; mudar a data só vale em "Somente este" e
 * a agenda só na série toda. 409 de versão relê o evento e avisa. Cada evento aberto é uma folha nova (a `key`).
 */
export function FolhaEvento(props: Props) {
  const a = props.aberto;
  const chave = !a ? 'fechada' : a.tipo === 'novo' ? `novo:${a.data}:${a.hora ?? ''}` : `${a.eventoId}:${a.ocorrencia ?? ''}`;
  return <FolhaAberta key={chave} {...props} />;
}

type Pergunta =
  | { tipo: 'salvar'; escopos: EscopoDaSerie[] }
  | { tipo: 'excluir'; escopos: EscopoDaSerie[] };

function FolhaAberta({ aberto, agendas, erroDasAgendas, recarregarAgendas, hoje, podeAlterar, aoFechar, aoMudar }: Props) {
  const { offline } = useSessao();
  const novo = aberto?.tipo === 'novo' ? aberto : null;
  const abrir = aberto?.tipo === 'abrir' ? aberto : null;
  const detalhe = useCarregar(abrir ? `evento:${abrir.eventoId}:${abrir.ocorrencia ?? ''}` : null,
    () => detalheDoEvento(abrir?.eventoId ?? '', abrir?.ocorrencia));
  const e = detalhe.dados ?? null;
  const serie = !!e && ehSerieDeEventos(e);
  const lista = agendas ?? [];

  const [modo, setModo] = useState<'detalhe' | 'formulario'>(novo ? 'formulario' : 'detalhe');
  const [form, setForm] = useState<FormularioDoEvento>(() => formularioDeEventoNovo(agendaDoFormulario(lista)?.id ?? '', novo?.data ?? hoje, novo?.hora ?? ''));
  const [erros, setErros] = useState<ErrosDoEvento>({});
  const [errosDaRepeticao, setErrosDaRepeticao] = useState<ErrosDaRepeticaoDoEvento>({});
  const [conferir, setConferir] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [pergunta, setPergunta] = useState<Pergunta | null>(null);
  const [escopo, setEscopo] = useState<EscopoDaSerie>('ESTA');

  const limpar = () => { setErro(null); setConferir(false); setAviso(null); };
  const mudar = <K extends keyof FormularioDoEvento>(campo: K, valor: FormularioDoEvento[K]) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    setErros((x) => ({ ...x, [campo]: undefined }));
    limpar();
  };
  const mudarRepeticao = (r: FormularioDaRepeticaoDoEvento) => {
    setForm((f) => ({ ...f, repeticao: r }));
    setErrosDaRepeticao({});
    setErros((x) => ({ ...x, repeticao: undefined }));
    limpar();
  };
  const editar = () => {
    if (!e) return;
    setForm(formularioDoEvento(e));
    setErros({});
    setErrosDaRepeticao({});
    limpar();
    setModo('formulario');
  };

  // A agenda do formulário: a escolhida ou, se as agendas chegaram depois de abrir, a sugerida (sem efeito nem setState).
  // Sem agenda nenhuma, a "Pessoal" nasce ao salvar: o formulário confere o resto com um id provisório.
  const semAgendas = agendas !== null && lista.length === 0;
  const agendaEfetiva = form.agendaId || agendaDoFormulario(lista)?.id || '';
  const formComAgenda = agendaEfetiva === form.agendaId ? form : { ...form, agendaId: agendaEfetiva };
  const formParaConferir = semAgendas && !agendaEfetiva ? { ...form, agendaId: 'pessoal' } : formComAgenda;
  const ocorrencia = e?.ocorrencia ?? null;
  const restricoes = e && ocorrencia ? { mudouData: mudouADataDoEvento(form, ocorrencia), mudouAgenda: mudouAAgendaDoEvento(form, e) } : {};
  const escopos = e ? escoposDoEvento(serie, restricoes) : (['ESTA'] as EscopoDaSerie[]);
  const opcoesDoPedido = (escolhido: EscopoDaSerie) => ({
    versao: e?.versao,
    serie: e && serie ? { escopo: escolhido, ocorrencia: ocorrencia?.dataOriginal ?? null, primeiroDia: e.data } : undefined,
  });

  // Aviso de outro evento no mesmo horário (só aviso, P5): a API confere a repetição por um ano. Pergunta com o horário e a
  // repetição completos; na edição o próprio evento não conta. Sem internet ou com falha, nenhum aviso (e nada trava o salvar).
  const perguntaDoAviso = modo === 'formulario' && agendas !== null ? pedidoDeCruzamento(form, e?.id ?? null) : null;
  const cruzamento = useAvisoDeCruzamento(perguntaDoAviso, offline);
  const textoDoAviso = textoDoCruzamento(cruzamento, hoje);

  const enviar = async (escolhido: EscopoDaSerie) => {
    const r = pedidoDoEvento(formParaConferir, opcoesDoPedido(escolhido));
    setErros(r.erros);
    setErrosDaRepeticao(r.errosDaRepeticao);
    if (!r.pedido) { setPergunta(null); setConferir(true); return; }
    setSalvando(true);
    setErro(null);
    let criouAgenda = false;
    try {
      let pedido: EventoRequest = r.pedido;
      if (semAgendas && !agendaEfetiva) {
        const pessoal = await garantirAgendaPadrao({ criar: criarAgendaPessoal, listar: listarAgendasPessoais });
        criouAgenda = true;
        pedido = { ...pedido, agendaId: pessoal.id };
      }
      if (e) await alterarEvento(e.id, pedido, alvoDoEvento(serie, escolhido, ocorrencia?.dataOriginal ?? null));
      else await criarEvento(pedido);
      setPergunta(null);
      aoMudar({ agendas: criouAgenda });
      aoFechar();
    } catch (x) {
      setPergunta(null);
      if (criouAgenda) aoMudar({ agendas: true });
      tratarErro(x);
    } finally {
      setSalvando(false);
    }
  };
  // 409 de versão: relê o evento, volta ao detalhe e diz o que houve (o que estava digitado não serve mais).
  const tratarErro = (x: unknown) => {
    if ((x as { codigo?: unknown } | null)?.codigo === 'CONFLITO_EDICAO' && e) {
      detalhe.recarregar();
      aoMudar({ agendas: false });
      setModo('detalhe');
      setErro(null);
      setAviso('Este evento mudou em outra aba ou aparelho. Esta é a versão atual: confira e edite de novo, se precisar.');
      return;
    }
    setErro(x);
  };
  const salvar = () => {
    const r = pedidoDoEvento(formParaConferir, opcoesDoPedido(escopos[0] ?? 'ESTA'));
    setErros(r.erros);
    setErrosDaRepeticao(r.errosDaRepeticao);
    setErro(null);
    setAviso(null);
    if (!r.pedido) { setConferir(true); return; }
    setConferir(false);
    if (escopos.length === 0) {
      setAviso('Mude a data ou a agenda, uma de cada vez: a data vale só para este evento e a agenda, para a série toda.');
      return;
    }
    if (escopos.length > 1) { setEscopo(escopos[0]); setPergunta({ tipo: 'salvar', escopos }); return; }
    void enviar(escopos[0]);
  };

  const excluir = async (escolhido: EscopoDaSerie) => {
    if (!e) return;
    setSalvando(true);
    setErro(null);
    try {
      await excluirEvento(e.id, e.versao, alvoDoEvento(serie, escolhido, ocorrencia?.dataOriginal ?? null));
      setPergunta(null);
      aoMudar({ agendas: false });
      aoFechar();
    } catch (x) {
      setPergunta(null);
      tratarErro(x);
    } finally {
      setSalvando(false);
    }
  };
  const pedirExcluir = () => {
    const lista = escoposParaExcluirEvento(serie);
    setEscopo(lista[0]);
    setPergunta({ tipo: 'excluir', escopos: lista });
  };

  const mensagem = erro ? textoDoErroDoCalendario(erro, 'evento') ?? textoDoErro(erro) : conferir ? 'Confira os campos destacados.' : aviso;
  const linhaDaMensagem = mensagem ? <View style={estilos.mensagem}>
    {erro || conferir ? <MensagemErro texto={mensagem} erro={erro ?? undefined} />
      : <Texto variante="suave" accessibilityLiveRegion="polite">{mensagem}</Texto>}
  </View> : null;

  // O formulário só abre sabendo as agendas: carregando, espera; falhou, diz e deixa tentar de novo (sem beco sem saída).
  const semListaDeAgendas = modo === 'formulario' && agendas === null;
  const titulo = novo ? 'Novo evento' : modo === 'formulario' ? 'Editar evento' : 'Evento';
  const rodape = semListaDeAgendas ? <>
    <Botao rotulo="Cancelar" tipo="secundario" aoTocar={novo ? aoFechar : () => { limpar(); setModo('detalhe'); }} />
  </> : modo === 'formulario' ? <>
    {linhaDaMensagem}
    <Botao rotulo="Cancelar" tipo="secundario" aoTocar={novo ? aoFechar : () => { limpar(); setModo('detalhe'); }} />
    <Botao rotulo={e ? 'Salvar alterações' : 'Criar evento'} aoTocar={salvar} carregando={salvando} desabilitado={salvando} motivo="Salvando." />
  </> : e && podeAlterar ? <>
    {linhaDaMensagem}
    <Botao rotulo="Excluir" tipo="perigoTexto" aoTocar={pedirExcluir} desabilitado={salvando} motivo="Salvando." />
    <Botao rotulo="Editar" tipo="secundario" aoTocar={editar} desabilitado={salvando} motivo="Salvando." />
  </> : linhaDaMensagem ?? undefined;

  const dataDaOcorrencia = ocorrencia?.data ?? e?.data ?? hoje;
  const sobreASerie = e && serie ? <Texto variante="suave" accessibilityLiveRegion="polite">
    {restricoes.mudouData && restricoes.mudouAgenda ? 'A data só muda neste evento e a agenda só na série toda: mude uma de cada vez.'
      : restricoes.mudouData ? 'Mudar a data vale só para este evento da série.'
        : restricoes.mudouAgenda ? 'Mudar a agenda vale para a série toda.'
          : 'Este evento faz parte de uma série. Ao salvar, você escolhe se vale só para este, para os seguintes ou para todos.'}
  </Texto> : null;

  return (
    <Folha visivel={aberto !== null} titulo={titulo} aoFechar={aoFechar} rodape={rodape}>
      {semListaDeAgendas ? (
        erroDasAgendas ? <MensagemErro texto={`Não deu para carregar as suas agendas. ${textoDoErro(erroDasAgendas)}`} erro={erroDasAgendas}
          tentarDeNovo={recarregarAgendas} />
          : <Esqueleto texto="Carregando as suas agendas" cartoes={1} />
      ) : modo === 'formulario' ? (
        <CamposDoEvento form={formComAgenda} erros={erros} errosDaRepeticao={errosDaRepeticao} mudar={mudar} mudarRepeticao={mudarRepeticao}
          agendas={lista} comRepeticao={!e || serie} hoje={hoje} sobreASerie={sobreASerie} aviso={textoDoAviso} />
      ) : e ? (
        <DetalheDoEvento evento={e} agendas={lista} hoje={hoje} />
      ) : detalhe.erro ? (
        <MensagemErro texto={textoDoErro(detalhe.erro)} erro={detalhe.erro} tentarDeNovo={detalhe.recarregar} />
      ) : <Esqueleto texto="Carregando o evento" cartoes={1} />}
      {pergunta && e ? (
        <PainelConfirmacao visivel perigo={pergunta.tipo === 'excluir'}
          titulo={pergunta.tipo === 'excluir' ? (serie ? 'Excluir quais eventos da série?' : 'Excluir o evento?') : 'Salvar em quais eventos da série?'}
          mensagem={pergunta.tipo === 'excluir' ? textoDeExcluirEvento(escopo, serie) : undefined}
          rotuloConfirmar={pergunta.tipo === 'excluir' ? 'Excluir' : 'Salvar alterações'} rotuloCancelar="Voltar" carregando={salvando}
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
  mensagem: { flexBasis: '100%' },
  escopo: { gap: espaco(1) },
  detalhe: { gap: espaco(1.5) },
  agenda: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  flex: { flex: 1, minWidth: 0 },
});
