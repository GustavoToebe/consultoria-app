import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Compromisso, CompromissoRequest, EscopoDaSerie, Participante, SituacaoCompromisso } from '../../api/agendaTipos';
import type { ResponsavelEquipe } from '../../api/equipeTipos';
import { alterarCancelamentoCompromisso, alterarSituacaoDoAluno } from '../../api/rotas';
import {
  type AcaoDeSituacao, acaoDeCancelamento, escoposPermitidos, explicacaoDoEscopo, formularioDoCompromisso, formularioNovo, mudouAData, ROTULOS_DO_ESCOPO,
  textoDaOcorrencia, textoDoCancelamentoDoAluno, textoDoCancelamentoInteiro, textoDoErroDaAgenda,
} from '../../dominio/agendaPresencial';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco, LARGURA_EDITOR } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Escolha } from '../../ui/Escolha';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Texto } from '../../ui/Texto';
import { DetalheDoCompromisso } from './DetalheDoCompromisso';
import { useFormularioDoCompromisso } from './useFormularioDoCompromisso';

/** Vindo do resumo (F13): abre já no formulário de edição ou na confirmação do cancelamento. */
export type AcaoInicial = 'editar' | 'cancelar';

interface Props {
  /** Um compromisso abre o detalhe (ou a edição, pela `acaoInicial`); `null` fecha. O novo é da `FolhaCriar`. */
  aberto: Compromisso | null;
  acaoInicial?: AcaoInicial;
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
 * compromisso inteiro) ou a edição, no formulário completo em `LARGURA_EDITOR` (o formulário mora em
 * `useFormularioDoCompromisso`; o novo é a `FolhaCriar`). Cada compromisso aberto é uma folha nova (a `key` é o id), então
 * nada do anterior sobra. A observação é dado sensível: só aparece com `ALUNO_SENSIVEL_LER` e só se edita com
 * `ALUNO_SENSIVEL_ALTERAR` (a API também ignora sem a permissão).
 */
export function FolhaCompromisso(props: Props) {
  return <FolhaAberta key={props.aberto?.id ?? 'fechada'} {...props} />;
}

/** A pergunta antes de gravar: o escopo numa série e/ou a confirmação de cancelar. */
type Pergunta =
  | { tipo: 'salvar'; pedido: CompromissoRequest; escopos: EscopoDaSerie[] }
  | { tipo: 'aluno'; aluno: Participante; acao: AcaoDeSituacao; escopos: EscopoDaSerie[] }
  | { tipo: 'inteiro'; cancelado: boolean; escopos: EscopoDaSerie[] };

function FolhaAberta({ aberto: c, acaoInicial, hoje, responsaveis, carregados, aoFechar, aoMudar }: Props) {
  const { pode } = useSessao();
  const [modo, setModo] = useState<'detalhe' | 'formulario'>(c && acaoInicial === 'editar' ? 'formulario' : 'detalhe');
  // Formulário da edição (sempre o completo): o estado mora no hook para os botões irem ao rodapé fixo da folha.
  const f = useFormularioDoCompromisso({
    compromisso: c, inicial: () => (c ? formularioDoCompromisso(c) : formularioNovo('', hoje)), ativo: modo === 'formulario',
    hoje, responsaveis, carregados, completoInicial: true,
  });
  const [erro, setErro] = useState<unknown>(null);
  // Detalhe: a ação em andamento e a pergunta aberta (escopo e/ou confirmação).
  const [enviando, setEnviando] = useState<string | null>(null);
  // "Cancelar compromisso" do resumo abre direto a confirmação (cancelar sempre confirma; reabrir fica no detalhe).
  const [pergunta, setPergunta] = useState<Pergunta | null>(() => (c && !c.cancelado && acaoInicial === 'cancelar'
    ? { tipo: 'inteiro', cancelado: true, escopos: escoposPermitidos(c) } : null));
  const [escopo, setEscopo] = useState<EscopoDaSerie>('ESTA');
  const agora = new Date();

  const limparMensagens = () => { setErro(null); f.limparMensagens(); };
  const editar = () => {
    f.recomecar();
    setErro(null);
    setModo('formulario');
  };
  const voltarAoDetalhe = () => { limparMensagens(); setModo('detalhe'); };
  // Aberta pelo "Editar" ou pelo cancelamento do resumo: desistir fecha a folha (a pessoa não abriu o detalhe), até a
  // primeira ação concluída; depois disso a folha se comporta como a aberta pelo detalhe.
  const [doResumo, setDoResumo] = useState(!!acaoInicial);

  // 409 HORARIO_OCUPADO (com as datas), ALUNO_INATIVO, CONFLITO_EDICAO...: o formulário fica como está, com a mensagem.
  const enviarFormulario = async (pedido: CompromissoRequest, escolhido: EscopoDaSerie) => {
    const salvo = await f.enviar(pedido, escolhido);
    setPergunta(null);
    if (!salvo) return;
    aoMudar(salvo);
    setDoResumo(false);
    setModo('detalhe');
  };
  const salvar = () => {
    if (!c) return;
    const pedido = f.conferirPedido();
    if (!pedido) return;
    const escopos = escoposPermitidos(c, { mudouData: mudouAData(f.form, c) });
    if (escopos.length > 1) { setEscopo('ESTA'); setPergunta({ tipo: 'salvar', pedido, escopos }); return; }
    void enviarFormulario(pedido, 'ESTA');
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
      setDoResumo(false);
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

  const mensagem = erro ? textoDoErroDaAgenda(erro, hoje) ?? textoDoErro(erro) : null;
  const linhaDaMensagem = modo === 'formulario' ? f.mensagem : mensagem ? <MensagemErro texto={mensagem} erro={erro} /> : null;
  const ocupado = f.salvando || enviando !== null;

  const titulo = modo === 'formulario' ? 'Editar compromisso' : 'Compromisso';
  const rodape = modo === 'formulario' ? <>
    <Botao rotulo="Cancelar" tipo="secundario" aoTocar={doResumo ? aoFechar : voltarAoDetalhe} />
    <Botao rotulo="Salvar alterações" aoTocar={salvar} carregando={f.salvando} desabilitado={f.salvando} motivo="Salvando." />
  </> : c && pode('AGENDA_ALTERAR') && acaoInteiro ? <>
    <Botao rotulo={acaoInteiro.rotulo} tipo={acaoInteiro.perigo ? 'perigoTexto' : 'secundario'} aoTocar={pedirInteiro}
      carregando={enviando === `inteiro:${acaoInteiro.cancelado}`} desabilitado={ocupado} motivo="Salvando." />
    <Botao rotulo="Editar" tipo="secundario" aoTocar={editar} desabilitado={ocupado} motivo="Salvando." />
  </> : undefined;

  const ocorrencia = c ? textoDaOcorrencia(c) : null;
  const dataMudou = !!c && !!c.serieId && mudouAData(f.form, c);
  const sobreASerie = c && ocorrencia ? <Texto variante="suave" accessibilityLiveRegion="polite">
    {dataMudou ? `${ocorrencia}. Mudar a data vale só para este compromisso da série.`
      : `${ocorrencia}. Ao salvar, você escolhe se vale só para este, para os seguintes ou para todos.`}
  </Texto> : null;
  return (
    <Folha visivel={c !== null} titulo={titulo} aoFechar={aoFechar} rodape={rodape} statusDoRodape={linhaDaMensagem ?? undefined}
      largura={modo === 'formulario' ? LARGURA_EDITOR : undefined}>
      {modo === 'formulario' ? (
        f.campos({ comRepeticao: false, sobreASerie })
      ) : c ? (
        <DetalheDoCompromisso compromisso={c} hoje={hoje} agora={agora} enviando={enviando} aoAgirNoAluno={agirNoAluno} />
      ) : null}
      {c && pergunta ? <Confirmacao pergunta={pergunta} compromisso={c} hoje={hoje} agora={agora} escopo={escopo} aoEscolherEscopo={setEscopo}
        carregando={ocupado} aoCancelar={doResumo ? aoFechar : () => setPergunta(null)}
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
  escopo: { gap: espaco(1) },
});
