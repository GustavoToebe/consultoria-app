import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Compromisso, CompromissoRequest, EscopoDaSerie, FiltroAlunosOcupados, Participante, SituacaoCompromisso } from '../../api/agendaTipos';
import type { ResponsavelEquipe } from '../../api/equipeTipos';
import {
  alterarCancelamentoCompromisso, alterarCompromisso, alterarSituacaoDoAluno, criarCompromisso, listarAlunosOcupados,
} from '../../api/rotas';
import {
  type AcaoDeSituacao, acaoDeCancelamento, adicionarParticipante, conflitoNaLista, type ErrosDaRepeticao, type ErrosDoCompromisso,
  escoposPermitidos, explicacaoDoEscopo, filtroDeAlunosOcupados, type FormularioDaRepeticao, type FormularioDoCompromisso,
  formularioDoCompromisso, formularioNovo, intervaloDoPedido, mudouAData, pedidoDoFormulario, removerParticipante, ROTULOS_DO_ESCOPO,
  textoDaOcorrencia, textoDeAlunosOcupados, textoDoCancelamentoDoAluno, textoDoCancelamentoInteiro, textoDoErroDaAgenda,
} from '../../dominio/agendaPresencial';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Escolha } from '../../ui/Escolha';
import { Alerta, MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Texto } from '../../ui/Texto';
import { useAtrasado, useCarregar } from '../../ui/useCarregar';
import { CamposDoCompromisso } from './CamposDoCompromisso';
import { DetalheDoCompromisso } from './DetalheDoCompromisso';

interface Props {
  /** `'novo'` abre o formulário vazio; um compromisso abre o detalhe; `null` fecha. */
  aberto: Compromisso | 'novo' | null;
  /** Dia sugerido no compromisso novo (AAAA-MM-DD, Brasília). */
  dataSugerida: string;
  hoje: string;
  responsaveis: readonly ResponsavelEquipe[];
  /** Compromissos já na tela, só para avisar de sobreposição do responsável antes de salvar (quem decide é a API). */
  carregados: readonly Compromisso[];
  aoFechar: () => void;
  /** Depois de salvar ou mudar a situação: a tela recarrega a lista. */
  aoMudar: (c: Compromisso) => void;
}

/**
 * Folha do compromisso com aluno: detalhe (participantes com a situação de cada um, editar, cancelar ou reabrir o
 * compromisso inteiro) ou formulário (novo, com repetição; editar). Cada compromisso aberto é uma folha nova (a `key` é o
 * id), então nada do anterior sobra. A observação é dado sensível: só aparece com `ALUNO_SENSIVEL_LER` e só se edita com
 * `ALUNO_SENSIVEL_ALTERAR` (a API também ignora sem a permissão).
 */
export function FolhaCompromisso(props: Props) {
  const chave = props.aberto === null ? 'fechada' : props.aberto === 'novo' ? 'novo' : props.aberto.id;
  return <FolhaAberta key={chave} {...props} />;
}

/** A pergunta antes de gravar: o escopo numa série e/ou a confirmação de cancelar. */
type Pergunta =
  | { tipo: 'salvar'; pedido: CompromissoRequest; escopos: EscopoDaSerie[] }
  | { tipo: 'aluno'; aluno: Participante; acao: AcaoDeSituacao; escopos: EscopoDaSerie[] }
  | { tipo: 'inteiro'; cancelado: boolean; escopos: EscopoDaSerie[] };

function FolhaAberta({ aberto, dataSugerida, hoje, responsaveis, carregados, aoFechar, aoMudar }: Props) {
  const { pode, usuario } = useSessao();
  const comObservacao = pode('ALUNO_SENSIVEL_ALTERAR');
  const c = aberto && aberto !== 'novo' ? aberto : null;
  const novo = aberto === 'novo';
  const [modo, setModo] = useState<'detalhe' | 'formulario'>(novo ? 'formulario' : 'detalhe');

  // Formulário (novo ou editar): o estado mora aqui para os botões irem ao rodapé fixo da folha.
  const formInicial = (): FormularioDoCompromisso => (c ? formularioDoCompromisso(c)
    : formularioNovo(responsaveis.some((r) => r.id === usuario?.id) ? usuario?.id ?? '' : '', dataSugerida));
  const nomesIniciais = () => Object.fromEntries((c?.participantes ?? []).map((p) => [p.id, p.nome ?? 'Aluno']));
  const [form, setForm] = useState<FormularioDoCompromisso>(formInicial);
  const [nomes, setNomes] = useState<Record<string, string>>(nomesIniciais);
  const [erros, setErros] = useState<ErrosDoCompromisso>({});
  const [errosDaRepeticao, setErrosDaRepeticao] = useState<ErrosDaRepeticao>({});
  const [conferir, setConferir] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const [salvando, setSalvando] = useState(false);
  // Detalhe: a ação em andamento e a pergunta aberta (escopo e/ou confirmação).
  const [enviando, setEnviando] = useState<string | null>(null);
  const [pergunta, setPergunta] = useState<Pergunta | null>(null);
  const [escopo, setEscopo] = useState<EscopoDaSerie>('ESTA');
  const agora = new Date();

  const limparMensagens = () => { setErro(null); setConferir(false); };
  const mudar = <K extends keyof FormularioDoCompromisso>(campo: K, valor: FormularioDoCompromisso[K]) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    setErros((e) => ({ ...e, [campo]: undefined }));
    limparMensagens();
  };
  const mudarRepeticao = (r: FormularioDaRepeticao) => {
    setForm((f) => ({ ...f, repeticao: r }));
    setErrosDaRepeticao({});
    setErros((e) => ({ ...e, repeticao: undefined }));
    limparMensagens();
  };
  const editar = () => {
    setForm(formInicial());
    setNomes(nomesIniciais());
    setErros({});
    setErrosDaRepeticao({});
    limparMensagens();
    setModo('formulario');
  };
  const voltarAoDetalhe = () => { limparMensagens(); setModo('detalhe'); };

  // Aviso de aluno ocupado (só aviso, D11/P5): com alunos, data, hora e duração válidas, depois de parar de digitar.
  const filtro = modo === 'formulario' ? filtroDeAlunosOcupados(form, c?.id) : null;
  const chaveOcupados = filtro ? JSON.stringify(filtro) : null;
  const chaveAtrasada = useAtrasado(chaveOcupados, 400);
  const ocupados = useCarregar(chaveAtrasada,
    async (k) => ({ chave: k, itens: await listarAlunosOcupados(JSON.parse(k) as FiltroAlunosOcupados) }));
  const ocupadosAtuais = ocupados.dados?.chave === chaveOcupados ? ocupados.dados.itens : null;
  const textoOcupados = ocupadosAtuais ? textoDeAlunosOcupados(ocupadosAtuais) : null;
  const falhouOcupados = !!ocupados.erro && chaveAtrasada === chaveOcupados && chaveOcupados !== null;
  // Responsável com outro compromisso na lista desta tela (também só aviso; quem decide é a API, 409).
  const previa = modo === 'formulario' ? pedidoDoFormulario(form, comObservacao).pedido : null;
  const conflito = previa ? conflitoNaLista(carregados, { id: c?.id, responsavelId: previa.responsavelId, ...intervaloDoPedido(previa) }) : null;

  const enviarFormulario = async (pedido: CompromissoRequest, escolhido: EscopoDaSerie) => {
    setSalvando(true);
    setErro(null);
    try {
      const salvo = c ? await alterarCompromisso(c.id, pedido, escolhido) : await criarCompromisso(pedido);
      setPergunta(null);
      aoMudar(salvo);
      if (novo) aoFechar();
      else setModo('detalhe');
    } catch (e) {
      // 409 HORARIO_OCUPADO (com as datas), ALUNO_INATIVO, CONFLITO_EDICAO...: o formulário fica como está.
      setPergunta(null);
      setErro(e);
    } finally {
      setSalvando(false);
    }
  };
  const salvar = () => {
    const r = pedidoDoFormulario(form, comObservacao, c ? c.versao : undefined);
    setErros(r.erros);
    setErrosDaRepeticao(r.errosDaRepeticao);
    setErro(null);
    if (!r.pedido) { setConferir(true); return; }
    setConferir(false);
    const escopos = c ? escoposPermitidos(c, { mudouData: mudouAData(form, c) }) : ['ESTA' as const];
    if (escopos.length > 1) { setEscopo('ESTA'); setPergunta({ tipo: 'salvar', pedido: r.pedido, escopos }); return; }
    void enviarFormulario(r.pedido, 'ESTA');
  };

  const mudarAluno = async (aluno: Participante, situacao: SituacaoCompromisso, escolhido: EscopoDaSerie) => {
    if (!c) return;
    setEnviando(`${aluno.id}:${situacao}`);
    setErro(null);
    try {
      aoMudar(await alterarSituacaoDoAluno(c.id, aluno.id, { situacao, versao: c.versao }, escolhido));
    } catch (e) {
      setErro(e);
    } finally {
      setPergunta(null);
      setEnviando(null);
    }
  };
  const agirNoAluno = (aluno: Participante, acao: AcaoDeSituacao) => {
    if (!c) return;
    const escopos = escoposPermitidos(c, { situacao: acao.situacao });
    if (acao.confirmar || escopos.length > 1) { setEscopo('ESTA'); setPergunta({ tipo: 'aluno', aluno, acao, escopos }); return; }
    void mudarAluno(aluno, acao.situacao, 'ESTA');
  };
  const mudarInteiro = async (cancelado: boolean, escolhido: EscopoDaSerie) => {
    if (!c) return;
    setEnviando(`inteiro:${cancelado}`);
    setErro(null);
    try {
      aoMudar(await alterarCancelamentoCompromisso(c.id, { cancelado, versao: c.versao }, escolhido));
    } catch (e) {
      // Reabrir com aluno inativo dá 409 ALUNO_INATIVO: a mensagem da API, e a folha segue usável.
      setErro(e);
    } finally {
      setPergunta(null);
      setEnviando(null);
    }
  };
  const acaoInteiro = c ? acaoDeCancelamento(c) : null;
  const pedirInteiro = () => {
    if (!c || !acaoInteiro) return;
    const escopos = escoposPermitidos(c);
    if (acaoInteiro.confirmar || escopos.length > 1) { setEscopo('ESTA'); setPergunta({ tipo: 'inteiro', cancelado: acaoInteiro.cancelado, escopos }); return; }
    void mudarInteiro(acaoInteiro.cancelado, 'ESTA');
  };

  const mensagem = erro ? textoDoErroDaAgenda(erro, hoje) ?? textoDoErro(erro) : conferir ? 'Confira os campos destacados.' : null;
  const linhaDaMensagem = mensagem ? <View style={estilos.mensagem}><MensagemErro texto={mensagem} erro={erro ?? undefined} /></View> : null;
  const ocupado = salvando || enviando !== null;

  const titulo = novo ? 'Novo compromisso' : modo === 'formulario' ? 'Editar compromisso' : 'Compromisso';
  const rodape = modo === 'formulario' ? <>
    {linhaDaMensagem}
    <Botao rotulo="Cancelar" tipo="secundario" aoTocar={novo ? aoFechar : voltarAoDetalhe} />
    <Botao rotulo={c ? 'Salvar alterações' : 'Marcar compromisso'} aoTocar={salvar} carregando={salvando} desabilitado={salvando} motivo="Salvando." />
  </> : c && pode('AGENDA_ALTERAR') && acaoInteiro ? <>
    {linhaDaMensagem}
    <Botao rotulo={acaoInteiro.rotulo} tipo={acaoInteiro.perigo ? 'perigoTexto' : 'secundario'} aoTocar={pedirInteiro}
      carregando={enviando === `inteiro:${acaoInteiro.cancelado}`} desabilitado={ocupado} motivo="Salvando." />
    <Botao rotulo="Editar" tipo="secundario" aoTocar={editar} desabilitado={ocupado} motivo="Salvando." />
  </> : linhaDaMensagem ?? undefined;

  const ocorrencia = c ? textoDaOcorrencia(c) : null;
  const dataMudou = !!c && !!c.serieId && mudouAData(form, c);
  const sobreASerie = c && ocorrencia ? <Texto variante="suave" accessibilityLiveRegion="polite">
    {dataMudou ? `${ocorrencia}. Mudar a data vale só para este compromisso da série.`
      : `${ocorrencia}. Ao salvar, você escolhe se vale só para este, para os seguintes ou para todos.`}
  </Texto> : null;
  // Só avisos (não impedem salvar): caixa de atenção, como os outros avisos do app.
  const avisos = textoOcupados || conflito || falhouOcupados ? <View style={estilos.avisos} accessibilityLiveRegion="polite" aria-live="polite">
    {conflito ? <Alerta tom="atencao" texto={`Atenção: este responsável já tem um compromisso das ${conflito.hora} às ${conflito.horaFim} nesse período.`} /> : null}
    {textoOcupados ? <Alerta tom="atencao" texto={`Atenção: ${textoOcupados}`} /> : null}
    {falhouOcupados ? <Alerta tom="atencao" texto="Não deu para conferir se os alunos estão livres nesse horário." /> : null}
  </View> : null;

  return (
    <Folha visivel={aberto !== null} titulo={titulo} aoFechar={aoFechar} rodape={rodape}>
      {modo === 'formulario' ? (
        <CamposDoCompromisso form={form} erros={erros} errosDaRepeticao={errosDaRepeticao} mudar={mudar} mudarRepeticao={mudarRepeticao}
          nomes={nomes} responsaveis={responsaveis} nomeDoResponsavel={c?.responsavelNome ?? null} comObservacao={comObservacao}
          comRepeticao={!c} hoje={hoje} avisos={avisos} sobreASerie={sobreASerie}
          aoAdicionarAluno={(id, nome) => { setNomes((n) => ({ ...n, [id]: nome })); mudar('alunoIds', adicionarParticipante(form.alunoIds, id)); }}
          aoRemoverAluno={(id) => mudar('alunoIds', removerParticipante(form.alunoIds, id))} />
      ) : c ? (
        <DetalheDoCompromisso compromisso={c} hoje={hoje} agora={agora} enviando={enviando} aoAgirNoAluno={agirNoAluno} />
      ) : null}
      {c && pergunta ? <Confirmacao pergunta={pergunta} compromisso={c} hoje={hoje} agora={agora} escopo={escopo} aoEscolherEscopo={setEscopo}
        carregando={ocupado} aoCancelar={() => setPergunta(null)}
        aoConfirmar={() => {
          if (pergunta.tipo === 'salvar') void enviarFormulario(pergunta.pedido, escopo);
          else if (pergunta.tipo === 'aluno') void mudarAluno(pergunta.aluno, pergunta.acao.situacao, escopo);
          else void mudarInteiro(pergunta.cancelado, escopo);
        }} /> : null}
    </Folha>
  );
}

/**
 * Painel na própria folha (sem `confirm`): numa série pergunta o escopo (só este, este e os seguintes, todos), com o que
 * cada um alcança; cancelar (um aluno ou o compromisso inteiro) diz quem recebe o aviso.
 */
function Confirmacao({ pergunta, compromisso: c, hoje, agora, escopo, aoEscolherEscopo, carregando, aoConfirmar, aoCancelar }: {
  pergunta: Pergunta; compromisso: Compromisso; hoje: string; agora: Date; escopo: EscopoDaSerie;
  aoEscolherEscopo: (e: EscopoDaSerie) => void; carregando: boolean; aoConfirmar: () => void; aoCancelar: () => void;
}) {
  const varios = c.participantes.length > 1;
  const nome = pergunta.tipo === 'aluno' ? pergunta.aluno.nome ?? 'Aluno' : '';
  const cancelandoAluno = pergunta.tipo === 'aluno' && pergunta.acao.situacao === 'CANCELADO';
  const titulo = pergunta.tipo === 'salvar' ? 'Salvar em quais compromissos da série?'
    : pergunta.tipo === 'aluno' ? (cancelandoAluno ? `Cancelar a participação de ${nome}?` : `${pergunta.acao.rotulo}: ${nome}`)
      : pergunta.cancelado ? (varios ? 'Cancelar o compromisso inteiro?' : 'Cancelar este compromisso?') : 'Reabrir o compromisso?';
  const mensagem = pergunta.tipo === 'aluno' ? (cancelandoAluno ? textoDoCancelamentoDoAluno(nome, c, agora) : undefined)
    : pergunta.tipo === 'inteiro' ? (pergunta.cancelado ? textoDoCancelamentoInteiro(c, agora)
      : 'O compromisso volta a ocupar o horário do responsável. Aluno inativo precisa sair da lista antes.')
      : undefined;
  const rotuloConfirmar = pergunta.tipo === 'salvar' ? 'Salvar alterações' : pergunta.tipo === 'aluno' ? pergunta.acao.rotulo
    : acaoDeCancelamento(c).rotulo;
  const perigo = cancelandoAluno || (pergunta.tipo === 'inteiro' && pergunta.cancelado);
  return (
    <PainelConfirmacao visivel titulo={titulo} mensagem={mensagem} perigo={perigo} rotuloConfirmar={rotuloConfirmar} rotuloCancelar="Voltar"
      carregando={carregando} aoConfirmar={aoConfirmar} aoCancelar={aoCancelar}>
      {pergunta.escopos.length > 1 ? <View style={estilos.escopo}>
        <Escolha<EscopoDaSerie> rotulo="Aplicar a" valor={escopo} aoMudar={aoEscolherEscopo}
          opcoes={pergunta.escopos.map((e) => ({ valor: e, rotulo: ROTULOS_DO_ESCOPO[e] }))} />
        <Texto variante="suave" accessibilityLiveRegion="polite">{explicacaoDoEscopo(escopo, c.data, hoje)}</Texto>
      </View> : null}
    </PainelConfirmacao>
  );
}

const estilos = StyleSheet.create({
  // O rodapé é uma linha alinhada à direita: a mensagem ocupa a linha inteira, logo acima dos botões que acabaram de ser tocados.
  mensagem: { flexBasis: '100%' },
  avisos: { gap: espaco(0.5) },
  escopo: { gap: espaco(1) },
});
