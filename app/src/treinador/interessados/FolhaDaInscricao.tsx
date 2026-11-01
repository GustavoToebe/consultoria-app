import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { Check, Copy, MessageCircle, MessageSquareText } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { ErroApi } from '../../api/cliente';
import type { ResponsavelEquipe } from '../../api/equipeTipos';
import type {
  AceiteInscricao,
  Encerramento,
  InscricaoDetalhe,
  MotivoEncerramento,
  Origem,
  PagamentoInscricao,
  SituacaoInscricao,
} from '../../api/inscricoesTipos';
import {
  aceitarInscricao,
  alterarInscricao,
  encerrarInscricao,
  inscricao,
  notaNaInscricao,
  opcoesDeQuestionario,
  origemDaInscricao,
  reabrirInscricao,
} from '../../api/rotas';
import type { OpcaoQuestionario } from '../../api/tipos';
import { QuestionarioAtualizacao } from '../../aluno/atualizacao/QuestionarioAtualizacao';
import { centavosParaTela, dataHoraParaTela, SEM_DADO } from '../../dominio/formatos';
import { rotuloDoSexo } from '../../dominio/sexo';
import {
  alunoDoConflito,
  anamneseInicialDoAceite,
  ENCERRAMENTOS,
  estaEncerradaSemAluno,
  INTERESSES,
  LIMITES_INSCRICAO,
  linkDoWhatsApp,
  MODALIDADES_DESEJADAS,
  OPCOES_MOTIVO,
  OPCOES_ORIGEM,
  OPCOES_PAGAMENTO,
  opcoesDeAnamneseDoAceite,
  ORIGENS_INFORMADAS,
  PERIODICIDADES,
  podeAceitar,
  podeEncerrar,
  podeReabrir,
  PREVISOES,
  rotuloDaOrigem,
  rotuloDoMotivo,
  rotuloOpcional,
  seloDaSituacao,
  seloDoPagamento,
  situacoesDoAndamento,
  temProposta,
} from '../../dominio/inscricoes';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { CaixaSelecao } from '../../ui/CaixaSelecao';
import { Campo } from '../../ui/Campo';
import { CampoLeitura } from '../../ui/CampoLeitura';
import { Cartao } from '../../ui/Cartao';
import { Escolha } from '../../ui/Escolha';
import { EscolhaEmFolha } from '../../ui/EscolhaEmFolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { Folha } from '../../ui/Folha';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { MensagemErro } from '../../ui/Estados';
import { codigoApi, textoDoErro } from '../../ui/erros';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { useAvisoDoPlano } from '../../ui/useAvisoDoPlano';
import { useCarregar } from '../../ui/useCarregar';
import type { Executar } from './executar';
import { HistoricoDaInscricao } from './HistoricoDaInscricao';
import { PropostaDaInscricao } from './PropostaDaInscricao';
import { RespostaComModelo } from './RespostaComModelo';
import { RetornosDaInscricao } from './RetornosDaInscricao';
import { SemelhantesDaInscricao } from './SemelhantesDaInscricao';

const SEM_RESPONSAVEL = '';
const SEM_ORIGEM = '';

/** O que abrir junto com a folha (Kanban): a confirmação do aceite, do encerramento (com a situação) ou da reabertura. */
export type PedidoDaFolha = { tipo: 'aceitar' } | { tipo: 'encerrar'; situacao: Encerramento } | { tipo: 'reabrir' };

/**
 * Uma inscrição aberta na fila: dados que a pessoa mandou, possível duplicidade e "mesma pessoa", contato pelo WhatsApp
 * (com ou sem resposta pronta: o app só prepara, a pessoa envia), proposta negociada, andamento, retornos, histórico com
 * as notas, Aceitar (cria o aluno e, se marcado, o convite e a anamnese), Encerrar (recusa ou desistência, com motivo) e
 * Reabrir. A API confere permissão e versão em tudo; aqui só se escolhe o que mostrar.
 */
export function FolhaDaInscricao({ id, pedidoInicial, responsaveis, aoFechar, aoMudar, aoAbrirOutra }: {
  id: string | null;
  /** Confirmação que já abre com a folha (vem do Kanban). */
  pedidoInicial?: PedidoDaFolha | null;
  responsaveis: readonly ResponsavelEquipe[];
  aoFechar: () => void;
  /** A lista recarrega depois de qualquer alteração. */
  aoMudar: () => void;
  /** Abrir outra inscrição (semelhante ou relacionada) no lugar desta. */
  aoAbrirOutra: (id: string) => void;
}) {
  const { pode } = useSessao();
  const detalhe = useCarregar(id ? `inscricao:${id}` : null, () => inscricao(id ?? ''));
  const dados = detalhe.dados && detalhe.dados.id === id ? detalhe.dados : null;
  // A decisão (Aceitar/Encerrar/Reabrir) fica no rodapé fixo da folha, sempre ao alcance; a confirmação, no conteúdo.
  const [pedido, setPedido] = useState<PedidoDaFolha | null>(pedidoInicial ?? null);
  const [decidindo, setDecidindo] = useState<PedidoDaFolha['tipo'] | null>(null);
  const [aceitaId, setAceitaId] = useState<string | null>(null);
  // Outra inscrição aberta: a decisão em andamento era da anterior e não vale para esta (o Kanban pode mandar outra).
  const [idVisto, setIdVisto] = useState(id);
  if (idVisto !== id) {
    setIdVisto(id);
    setPedido(id ? pedidoInicial ?? null : null);
    setDecidindo(null);
  }
  // Nota digitada e ainda não acrescentada, por inscrição: fechar e abrir de novo (ou salvar o andamento) não a perde.
  // Só em memória, enquanto a tela está aberta.
  const [rascunhos] = useState(() => new Map<string, string>());
  const fechar = () => { setPedido(null); aoFechar(); };
  const decide = !!dados && aceitaId !== dados.id && pode('INSCRICAO_ALTERAR');
  const podeAceitarAqui = decide && !!dados && pode('ALUNO_ALTERAR') && podeAceitar(dados.situacao);
  const podeEncerrarAqui = decide && !!dados && podeEncerrar(dados.situacao);
  const podeReabrirAqui = decide && !!dados && podeReabrir(dados.situacao);
  const rodape = podeAceitarAqui || podeEncerrarAqui || podeReabrirAqui ? (
    <>
      {podeEncerrarAqui ? <Botao rotulo="Encerrar" tipo="perigoTexto" aoTocar={() => setPedido({ tipo: 'encerrar', situacao: 'RECUSADA' })} carregando={decidindo === 'encerrar'} desabilitado={!!decidindo} /> : null}
      {podeReabrirAqui ? <Botao rotulo="Reabrir atendimento" aoTocar={() => setPedido({ tipo: 'reabrir' })} carregando={decidindo === 'reabrir'} desabilitado={!!decidindo} /> : null}
      {podeAceitarAqui ? <Botao rotulo="Aceitar" aoTocar={() => setPedido({ tipo: 'aceitar' })} carregando={decidindo === 'aceitar'} desabilitado={!!decidindo} /> : null}
    </>
  ) : undefined;
  return (
    <Folha visivel={!!id} titulo={dados?.nome ?? 'Inscrição'} aoFechar={fechar} rodape={rodape}>
      {detalhe.erro ? <MensagemErro texto={textoDoErro(detalhe.erro)} tentarDeNovo={detalhe.recarregar} erro={detalhe.erro} /> : null}
      {!dados && !detalhe.erro ? <Esqueleto /> : null}
      {dados ? (
        <Conteudo key={dados.id} dados={dados} responsaveis={responsaveis} aoFechar={fechar} rascunhos={rascunhos}
          pedido={pedido} aoFecharPedido={() => setPedido(null)} aoReabrirAceite={() => setPedido({ tipo: 'aceitar' })} aoDecidindo={setDecidindo} aoAceitar={() => setAceitaId(dados.id)}
          aoMudarLista={aoMudar} aoAtualizar={(d) => { detalhe.definir(d, `inscricao:${d.id}`); aoMudar(); }}
          aoRecarregar={() => { detalhe.recarregar(); aoMudar(); }} aoAbrirOutra={aoAbrirOutra} />
      ) : null}
    </Folha>
  );
}

function Conteudo({ dados, responsaveis, rascunhos, aoFechar, aoMudarLista, aoAtualizar, aoRecarregar, pedido, aoFecharPedido, aoDecidindo, aoAceitar, aoReabrirAceite, aoAbrirOutra }: {
  dados: InscricaoDetalhe;
  /** Notas não enviadas, por inscrição (da folha, em memória). */
  rascunhos: Map<string, string>;
  /** Botão do rodapé tocado (ou pedido do Kanban): abre a confirmação correspondente. */
  pedido: PedidoDaFolha | null;
  aoFecharPedido: () => void;
  /** O aceite fecha o painel antes de ir à API; se a API pedir outra escolha (anamnese indisponível), ele volta. */
  aoReabrirAceite: () => void;
  /** Mantém o rodapé em "carregando" enquanto a decisão vai à API. */
  aoDecidindo: (d: PedidoDaFolha['tipo'] | null) => void;
  aoAceitar: () => void;
  responsaveis: readonly ResponsavelEquipe[];
  aoFechar: () => void;
  aoMudarLista: () => void;
  aoAtualizar: (d: InscricaoDetalhe) => void;
  aoRecarregar: () => void;
  aoAbrirOutra: (id: string) => void;
}) {
  const { pode, marca, pagamentosHabilitados } = useSessao();
  const { avisar } = useAviso();
  const avisoDoPlano = useAvisoDoPlano(aoFechar);
  const podeAlterar = pode('INSCRICAO_ALTERAR');
  const podeCadastrar = podeAlterar && pode('ALUNO_ALTERAR');
  const podeConvidar = pode('ALUNO_CONVITE');
  const podeVerAluno = pode('ALUNO_LER');

  const [situacao, setSituacao] = useState<SituacaoInscricao>(dados.situacao);
  const [pagamento, setPagamento] = useState<PagamentoInscricao>(dados.pagamento);
  const [responsavelId, setResponsavelId] = useState(dados.responsavelId ?? SEM_RESPONSAVEL);
  const [origem, setOrigem] = useState<Origem | ''>(dados.origem ?? SEM_ORIGEM);
  // Versão nova (andamento salvo aqui ou recarregado): o andamento volta ao gravado, sem remontar a folha. Antes a
  // folha era remontada pela versão e a nota ainda não acrescentada sumia (achado F2).
  const [versaoVista, setVersaoVista] = useState(dados.versao);
  if (versaoVista !== dados.versao) {
    setVersaoVista(dados.versao);
    setSituacao(dados.situacao);
    setPagamento(dados.pagamento);
    setResponsavelId(dados.responsavelId ?? SEM_RESPONSAVEL);
    setOrigem(dados.origem ?? SEM_ORIGEM);
  }
  const [nota, setNotaNaTela] = useState(() => rascunhos.get(dados.id) ?? '');
  const setNota = (texto: string) => {
    setNotaNaTela(texto);
    if (texto) rascunhos.set(dados.id, texto);
    else rascunhos.delete(dados.id);
  };
  // Resposta que chega depois de a folha trocar de inscrição (ou fechar) não mexe na tela atual (achado F3): só a
  // lista é atualizada.
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; };
  }, []);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<unknown>(null);
  const [alunoExistente, setAlunoExistente] = useState<string | null>(null);
  const [convidar, setConvidar] = useState(podeConvidar);
  const [aceite, setAceite] = useState<AceiteInscricao | null>(null);
  const [respondendo, setRespondendo] = useState(false);
  // Encerrar: a situação vem do pedido (Kanban) e pode ser trocada no painel; o motivo é obrigatório.
  const [encerramento, setEncerramento] = useState<Encerramento>(pedido?.tipo === 'encerrar' ? pedido.situacao : 'RECUSADA');
  const [pedidoVisto, setPedidoVisto] = useState(pedido);
  if (pedidoVisto !== pedido) {
    setPedidoVisto(pedido);
    if (pedido?.tipo === 'encerrar') setEncerramento(pedido.situacao);
  }
  const [motivo, setMotivo] = useState<MotivoEncerramento | null>(null);
  const [motivoDetalhe, setMotivoDetalhe] = useState('');
  const [motivoReabertura, setMotivoReabertura] = useState('');
  // Anamnese enviada junto com o aceite: `undefined` = a pessoa ainda não mexeu (vale a padrão publicada, sem efeito).
  const [anamneseEscolhida, setAnamneseEscolhida] = useState<string | null | undefined>(undefined);
  const podeEnviarAnamnese = pode('ANAMNESE_LER') && pode('ANAMNESE_ALTERAR') && pode('ALUNO_SENSIVEL_LER');
  const opcoes = useCarregar(pedido?.tipo === 'aceitar' && podeEnviarAnamnese ? 'aceite:anamneses' : null, () => opcoesDeQuestionario('ANAMNESE'));
  const semAcessoAsAnamneses = opcoes.erro instanceof ErroApi && opcoes.erro.status === 403;
  const anamneseDoAceite = anamneseEscolhida !== undefined ? anamneseEscolhida : anamneseInicialDoAceite(opcoes.dados ?? []);

  const mudouOrigem = origem !== (dados.origem ?? SEM_ORIGEM);
  const mudouAndamento = situacao !== dados.situacao || pagamento !== dados.pagamento
    || responsavelId !== (dados.responsavelId ?? SEM_RESPONSAVEL) || mudouOrigem;
  const whatsapp = linkDoWhatsApp(dados.whatsapp);
  const situacaoTela = seloDaSituacao(dados.situacao);
  const pagamentoTela = seloDoPagamento(dados.pagamento);
  const encerrada = estaEncerradaSemAluno(dados.situacao);

  /** Erro comum: conflito de versão recarrega; limite do plano vai para o aviso do plano; o resto fica na folha. */
  const falhou = (e: unknown) => {
    if (!montado.current) return;
    setOcupado(null);
    aoDecidindo(null);
    const aluno = alunoDoConflito(e);
    if (aluno) {
      setAlunoExistente(aluno);
      setErro(e);
      return;
    }
    if (codigoApi(e) === 'QUESTIONARIO_INDISPONIVEL') {
      // Nada foi criado: a anamnese escolhida saiu do ar. Recarrega as opções e devolve o painel para a pessoa escolher outra.
      avisar('Essa anamnese não está mais disponível. Escolha outra.', 'neutro');
      opcoes.recarregar();
      setAnamneseEscolhida(undefined);
      aoReabrirAceite();
      return;
    }
    if (codigoApi(e) === 'CONFLITO_EDICAO') {
      avisar('A inscrição foi alterada em outro lugar. Recarregamos para você conferir.', 'neutro');
      aoRecarregar();
      return;
    }
    if (avisoDoPlano(e)) return;
    setErro(e);
  };

  const executar: Executar = (tipo, acao, sucesso, depois) => {
    setOcupado(tipo);
    setErro(null);
    setAlunoExistente(null);
    acao().then((d) => {
      if (!montado.current) {
        aoMudarLista();
        return;
      }
      setOcupado(null);
      aoDecidindo(null);
      if (tipo === 'nota') setNota('');
      avisar(sucesso, 'sucesso');
      depois?.();
      aoAtualizar(d);
    }, falhou);
  };

  const salvarAndamento = () => {
    const mudouLinha = situacao !== dados.situacao || pagamento !== dados.pagamento
      || responsavelId !== (dados.responsavelId ?? SEM_RESPONSAVEL);
    const novaOrigem = origem || null;
    executar('andamento', async () => {
      let atual = dados;
      if (mudouLinha) {
        atual = await alterarInscricao(dados.id, { situacao, pagamento, responsavelId: responsavelId || null, versao: dados.versao });
      }
      // A origem tem rota própria; vai com a versão que o andamento acabou de gravar.
      if (mudouOrigem) atual = await origemDaInscricao(dados.id, novaOrigem, atual.versao);
      return atual;
    }, 'Andamento salvo.');
  };

  const acrescentarNota = () => {
    if (!nota.trim()) return;
    executar('nota', () => notaNaInscricao(dados.id, nota.trim()), 'Nota acrescentada.');
  };

  const encerrar = () => {
    if (!motivo) return;
    aoFecharPedido();
    aoDecidindo('encerrar');
    executar('encerrar', () => encerrarInscricao(dados.id, {
      situacao: encerramento, motivo, detalhe: motivoDetalhe.trim() || null, versao: dados.versao,
    }), encerramento === 'RECUSADA' ? 'Inscrição recusada.' : 'Desistência registrada.', () => { setMotivo(null); setMotivoDetalhe(''); });
  };

  const reabrir = () => {
    if (!motivoReabertura.trim()) return;
    aoFecharPedido();
    aoDecidindo('reabrir');
    executar('reabrir', () => reabrirInscricao(dados.id, motivoReabertura.trim(), dados.versao), 'Atendimento reaberto.',
      () => setMotivoReabertura(''));
  };

  const aceitar = () => {
    aoFecharPedido();
    aoDecidindo('aceitar');
    setOcupado('aceitar');
    setErro(null);
    setAlunoExistente(null);
    aceitarInscricao(dados.id, {
      convidar: convidar && podeConvidar,
      anamneseQuestionarioId: podeEnviarAnamnese ? anamneseDoAceite : null,
      versao: dados.versao,
    }).then((r) => {
      if (!montado.current) {
        aoMudarLista();
        return;
      }
      setOcupado(null);
      aoDecidindo(null);
      aoAceitar();
      // O código do convite só existe nesta resposta: fica na folha até ela fechar (nada de recarregar o detalhe agora).
      setAceite(r);
      avisar(`Inscrição aceita: o aluno foi cadastrado.${r.anamneseId ? ' Anamnese enviada.' : ''}`, 'sucesso');
      aoMudarLista();
    }, falhou);
  };

  const abrirWhatsApp = () => {
    if (!whatsapp) return;
    Linking.openURL(whatsapp).catch(() => avisar('Não foi possível abrir o WhatsApp neste aparelho.', 'perigo'));
  };

  const copiar = (texto: string, oque: string) => {
    Clipboard.setStringAsync(texto).then(
      () => avisar(`${oque} copiado.`, 'sucesso'),
      () => avisar('Não foi possível copiar. Selecione e copie à mão.', 'perigo'),
    );
  };

  const abrirFicha = (alunoId: string) => {
    aoFechar();
    router.push(`/treinador/alunos/${alunoId}`);
  };

  if (aceite) {
    return <ResultadoDoAceite aceite={aceite} dados={dados} podeVerAluno={podeVerAluno} pagamentosHabilitados={pagamentosHabilitados}
      aoCopiar={copiar} aoAbrirFicha={abrirFicha} />;
  }

  const proposta = dados.proposta;
  const resumoDaProposta = temProposta(proposta)
    ? [proposta.planoNome, proposta.valorCentavos !== null ? centavosParaTela(proposta.valorCentavos) : null,
        proposta.periodicidade ? PERIODICIDADES[proposta.periodicidade] : null].filter(Boolean).join(' · ')
    : 'Sem proposta';

  return (
    <View style={estilos.corpo}>
      <View style={estilos.selos}>
        <Selo texto={situacaoTela.texto} tipo={situacaoTela.tipo} />
        {dados.ciclo > 1 ? <Selo texto={`${dados.ciclo}º atendimento`} tipo="neutro" /> : null}
        {/* "Não controlado" é o padrão: o selo só aparece quando o pagamento está sendo acompanhado. */}
        {dados.pagamento !== 'NAO_CONTROLADO' ? <Selo texto={`Pagamento: ${pagamentoTela.texto}`} tipo={pagamentoTela.tipo} /> : null}
      </View>

      <SemelhantesDaInscricao dados={dados} podeAlterar={podeAlterar} podeVerAluno={podeVerAluno} executar={executar} ocupado={ocupado}
        aoAbrirOutra={aoAbrirOutra} aoAbrirFicha={abrirFicha} />

      <Cartao titulo="Contato" descricao={`Inscrição em ${dataHoraParaTela(dados.criadaEm)}.`}>
        <CampoLeitura rotulo="WhatsApp" valor={dados.whatsapp} />
        <CampoLeitura rotulo="E-mail" valor={dados.email} />
        <LinhaDeAcoes>
          {podeAlterar ? <Botao rotulo="Responder com modelo" Icone={MessageSquareText} tipo="secundario" aoTocar={() => setRespondendo(true)} /> : null}
          <Botao rotulo="Abrir WhatsApp" Icone={MessageCircle} tipo="secundario" aoTocar={abrirWhatsApp}
            desabilitado={!whatsapp} motivo="O número não tem DDD válido." />
          <Botao rotulo="Copiar WhatsApp" Icone={Copy} tipo="secundario" aoTocar={() => copiar(dados.whatsapp, 'WhatsApp')} />
        </LinhaDeAcoes>
        <Texto variante="pequeno">Abrir o WhatsApp não envia nada: registre o contato numa nota ou no andamento.</Texto>
      </Cartao>

      <Cartao titulo="O que a pessoa escreveu">
        <CampoLeitura rotulo="Sexo" valor={dados.sexo ? rotuloDoSexo(dados.sexo) : 'Prefiro não informar'} />
        <CampoLeitura rotulo="Objetivo" valor={dados.objetivo} />
        {/* A "Observação" deixou de ser campo fixo (virou pergunta do treinador); só as inscrições de antes a têm. */}
        {dados.observacao ? <CampoLeitura rotulo="Observação" valor={dados.observacao} /> : null}
        <CampoLeitura rotulo="O que procura" valor={rotuloOpcional(INTERESSES, dados.interesse)} />
        <CampoLeitura rotulo="Acompanhamento" valor={rotuloOpcional(MODALIDADES_DESEJADAS, dados.modalidadeDesejada)} />
        <CampoLeitura rotulo="Quando quer começar" valor={rotuloOpcional(PREVISOES, dados.previsaoInicio)} />
        <CampoLeitura rotulo="Como conheceu"
          valor={`${rotuloOpcional(ORIGENS_INFORMADAS, dados.origemInformada)}${dados.origemLink ? ` · Link: ${dados.origemLink}` : ''}`} />
        <CampoLeitura rotulo="Ciência do texto da consultoria"
          valor={dados.cienciaEm ? `Marcada em ${dataHoraParaTela(dados.cienciaEm)}` : 'Não havia texto de privacidade'} />
      </Cartao>

      {/* Respostas às perguntas da página (D9), na versão que a pessoa respondeu; só leitura. O aceite não as copia. */}
      {dados.respostas ? <>
        <Cartao titulo="Respostas às perguntas da página">
          <Texto variante="pequeno">{`Versão ${dados.respostas.questionarioVersaoNumero} das perguntas. Não vão para o cadastro do aluno no aceite.`}</Texto>
        </Cartao>
        <QuestionarioAtualizacao modelo={dados.respostas.modelo} respostas={dados.respostas.respostas} />
      </> : null}

      {encerrada ? (
        <Cartao titulo={dados.situacao === 'RECUSADA' ? 'Inscrição recusada' : 'A pessoa desistiu'}
          descricao="Recusadas e desistentes sem atividade são apagadas sozinhas depois de 180 dias.">
          <CampoLeitura rotulo="Motivo" valor={rotuloDoMotivo(dados.motivoEncerramento)} />
          <CampoLeitura rotulo="Detalhe" valor={dados.motivoDetalhe} />
          <Texto variante="pequeno">
            {dados.encerradaEm ? `Encerrada por ${dados.encerradaPorNome ?? SEM_DADO} em ${dataHoraParaTela(dados.encerradaEm)}.` : 'Encerramento sem registro de quem e quando.'}
          </Texto>
        </Cartao>
      ) : null}

      <PropostaDaInscricao dados={dados} podeEditar={podeAlterar && dados.situacao !== 'ACEITA'} executar={executar} ocupado={ocupado} />

      <Cartao titulo="Andamento">
        {podeAlterar && podeAceitar(dados.situacao) ? (
          <Escolha rotulo="Etapa" opcoes={situacoesDoAndamento(dados.situacao)} valor={situacao} aoMudar={setSituacao} />
        ) : (
          <CampoLeitura rotulo="Situação" valor={situacaoTela.texto} />
        )}
        {podeAlterar ? (
          <>
            <Escolha rotulo="Pagamento (registro manual)" opcoes={OPCOES_PAGAMENTO} valor={pagamento} aoMudar={setPagamento} />
            <EscolhaEmFolha rotulo="Responsável" valor={responsavelId} aoMudar={setResponsavelId}
              opcoes={[{ valor: SEM_RESPONSAVEL, rotulo: 'Sem responsável' }, ...responsaveis.map((r) => ({ valor: r.id, rotulo: r.nome }))]}
              rotuloDoValor={dados.responsavelNome ?? 'Membro inativo'} />
            <Escolha rotulo="Origem" opcoes={[{ valor: SEM_ORIGEM as Origem | '', rotulo: 'Não informada' }, ...OPCOES_ORIGEM]}
              valor={origem} aoMudar={setOrigem} />
          </>
        ) : (
          <>
            <CampoLeitura rotulo="Pagamento (registro manual)" valor={pagamentoTela.texto} />
            <CampoLeitura rotulo="Responsável" valor={dados.responsavelNome ?? (dados.responsavelId ? 'Membro inativo' : 'Sem responsável')} />
            <CampoLeitura rotulo="Origem" valor={rotuloDaOrigem(dados.origem)} />
          </>
        )}
        {dados.pagamento === 'CONFIRMADO_MANUAL' ? (
          <Texto variante="pequeno">
            Confirmado por {dados.pagamentoConfirmadoPorNome ?? SEM_DADO} em {dataHoraParaTela(dados.pagamentoConfirmadoEm)}. O app não confere pagamento.
          </Texto>
        ) : null}
        {podeAlterar ? (
          <LinhaDeAcoes>
            <Botao rotulo="Salvar andamento" tipo="secundario" aoTocar={salvarAndamento} carregando={ocupado === 'andamento'}
              desabilitado={!mudouAndamento} motivo="Nada mudou no andamento." />
          </LinhaDeAcoes>
        ) : null}
      </Cartao>

      <RetornosDaInscricao dados={dados} podeAlterar={podeAlterar} responsaveis={responsaveis} executar={executar} ocupado={ocupado} />

      <HistoricoDaInscricao dados={dados} podeAlterar={podeAlterar} nota={nota} aoMudarNota={setNota} aoAcrescentar={acrescentarNota}
        acrescentando={ocupado === 'nota'} />

      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} /> : null}
      {alunoExistente && podeVerAluno ? (
        <LinhaDeAcoes>
          <Botao rotulo="Abrir ficha do aluno" tipo="secundario" aoTocar={() => abrirFicha(alunoExistente)} />
        </LinhaDeAcoes>
      ) : null}

      {dados.situacao === 'ACEITA' ? (
        <Cartao titulo="Aluno cadastrado" descricao={`Esta inscrição já virou aluno${dados.aceitaEm ? ` em ${dataHoraParaTela(dados.aceitaEm)}` : ''}.`}>
          {dados.alunoId && podeVerAluno ? (
            <LinhaDeAcoes><Botao rotulo="Abrir ficha" aoTocar={() => abrirFicha(dados.alunoId ?? '')} /></LinhaDeAcoes>
          ) : null}
        </Cartao>
      ) : null}

      <RespostaComModelo visivel={respondendo} dados={dados} consultoria={marca?.nome ?? null} aoFechar={() => setRespondendo(false)}
        aoRegistrar={aoRecarregar} />

      <PainelConfirmacao visivel={pedido?.tipo === 'aceitar' && podeCadastrar && podeAceitar(dados.situacao)} titulo="Aceitar inscrição?"
        mensagem={`${dados.nome} vira aluno da consultoria, com o nome${dados.email ? ' e o e-mail' : ''} da inscrição. O app não confere pagamento.`}
        rotuloConfirmar="Aceitar e cadastrar" aoConfirmar={aceitar} aoCancelar={aoFecharPedido}
        desabilitado={podeEnviarAnamnese && opcoes.carregando} motivo="Aguarde a lista de anamneses.">
        <View style={estilos.conferir}>
          <Texto variante="secao">Conferir antes de aceitar</Texto>
          <Texto variante="pequeno">Nome: {dados.nome}</Texto>
          <Texto variante="pequeno">E-mail: {dados.email ?? SEM_DADO}</Texto>
          <Texto variante="pequeno">Responsável: {dados.responsavelNome ?? 'Sem responsável'}</Texto>
          <Texto variante="pequeno">Proposta: {resumoDaProposta}</Texto>
          <Texto variante="pequeno">Pagamento (registro manual): {pagamentoTela.texto}</Texto>
        </View>
        {podeConvidar ? (
          <CaixaSelecao rotulo="Enviar convite de acesso ao app" marcado={convidar} aoMudar={setConvidar}
            ajuda="Gera o link para a pessoa criar a senha. Você copia e manda." />
        ) : null}
        {podeEnviarAnamnese && !semAcessoAsAnamneses ? (
          <SeletorDaAnamnese opcoes={opcoes.dados} carregando={opcoes.carregando} erro={opcoes.erro} aoTentarDeNovo={opcoes.recarregar}
            valor={anamneseDoAceite} aoMudar={setAnamneseEscolhida}
            avisoDoAcesso={!(convidar && podeConvidar) && anamneseDoAceite !== null} />
        ) : null}
      </PainelConfirmacao>
      <PainelConfirmacao visivel={pedido?.tipo === 'encerrar' && podeAlterar && podeEncerrar(dados.situacao)} titulo="Encerrar atendimento?" perigo
        mensagem="A inscrição sai da fila de atendimento. Recusadas e desistentes sem atividade são apagadas sozinhas depois de 180 dias; dá para reabrir antes disso."
        rotuloConfirmar={encerramento === 'RECUSADA' ? 'Recusar' : 'Registrar desistência'} aoConfirmar={encerrar} aoCancelar={aoFecharPedido}
        desabilitado={!motivo} motivo="Escolha o motivo.">
        <Escolha rotulo="Como encerrar" opcoes={ENCERRAMENTOS} valor={encerramento} aoMudar={setEncerramento} />
        <Escolha rotulo="Motivo" opcoes={OPCOES_MOTIVO} valor={motivo} aoMudar={setMotivo} />
        <Campo rotulo="Detalhe (opcional)" valor={motivoDetalhe} aoMudar={setMotivoDetalhe} maxLength={LIMITES_INSCRICAO.motivoDetalhe} linhas={2} />
      </PainelConfirmacao>
      <PainelConfirmacao visivel={pedido?.tipo === 'reabrir' && podeAlterar && podeReabrir(dados.situacao)} titulo="Reabrir atendimento?"
        mensagem="A inscrição volta para Em contato num novo ciclo. O encerramento anterior fica no histórico."
        rotuloConfirmar="Reabrir" aoConfirmar={reabrir} aoCancelar={aoFecharPedido}
        desabilitado={!motivoReabertura.trim()} motivo="Escreva por que está reabrindo.">
        <Campo rotulo="Por que reabrir" valor={motivoReabertura} aoMudar={setMotivoReabertura} maxLength={LIMITES_INSCRICAO.motivoReabertura}
          placeholder="Ex.: a pessoa voltou a procurar" />
      </PainelConfirmacao>
    </View>
  );
}

/**
 * Campo "Enviar anamnese" do painel de aceite: "Não enviar agora" mais as anamneses publicadas, numa `Escolha` (os botões
 * quebram linha). Não usa `EscolhaEmFolha` mesmo com muitas opções: o painel é um AlertDialog modal (Radix) e a folha de
 * escolha abre num `Modal` fora dele, onde o toque não chega (testado no e2e). Também não usa o `SeletorDeQuestionario`
 * (busca outra finalidade, grava na hora).
 */
function SeletorDaAnamnese({ opcoes, carregando, erro, aoTentarDeNovo, valor, aoMudar, avisoDoAcesso }: {
  opcoes: readonly OpcaoQuestionario[] | undefined;
  carregando: boolean;
  erro: unknown;
  aoTentarDeNovo: () => void;
  valor: string | null;
  aoMudar: (valor: string | null) => void;
  /** Convite desmarcado e anamnese escolhida: lembra que o aluno só vê quando entrar no app. */
  avisoDoAcesso: boolean;
}) {
  if (erro && !opcoes) return <MensagemErro texto="Não foi possível carregar as anamneses." tentarDeNovo={aoTentarDeNovo} erro={erro} />;
  if (!opcoes) return carregando ? <Texto variante="suave">Carregando as anamneses.</Texto> : null;
  if (opcoes.length === 0) return <Texto variante="suave">Nenhuma anamnese publicada.</Texto>;
  const lista = opcoesDeAnamneseDoAceite(opcoes);
  return (
    <View style={estilos.anamnese}>
      <Escolha rotulo="Enviar anamnese" valor={valor} opcoes={lista} aoMudar={aoMudar} />
      {avisoDoAcesso ? <Texto variante="pequeno">O aluno responde quando entrar no app.</Texto> : null}
    </View>
  );
}

/** Depois do aceite: os próximos passos e o link do convite, que aparece uma vez só (sai daqui ao fechar a folha). */
function ResultadoDoAceite({ aceite, dados, podeVerAluno, pagamentosHabilitados, aoCopiar, aoAbrirFicha }: {
  aceite: AceiteInscricao;
  dados: InscricaoDetalhe;
  podeVerAluno: boolean;
  pagamentosHabilitados: boolean;
  aoCopiar: (texto: string, oque: string) => void;
  aoAbrirFicha: (alunoId: string) => void;
}) {
  const { cores } = useTema();
  const convite = aceite.convite;
  const proposta = dados.proposta;
  const pagamento = dados.pagamento === 'CONFIRMADO_MANUAL' ? 'Confirmado manualmente'
    : dados.pagamento === 'AGUARDANDO' ? 'Aguardando' : 'Não controlado';
  return (
    <View style={estilos.corpo}>
      <Selo texto="Aceita" tipo="sucesso" />
      <Cartao titulo="Próximos passos" descricao="A inscrição fica na lista como aceita, ligada ao aluno.">
        <Passo feito texto="Aluno cadastrado" />
        <Passo feito={!!convite} texto={convite ? 'Convite de acesso gerado' : 'Convite de acesso não gerado (dá para gerar na ficha do aluno)'} />
        {convite ? (
          <>
            <Texto variante="suave">
              Envie o link para a pessoa criar a senha. Válido até {dataHoraParaTela(convite.expiraEm)}. O link não aparece
              de novo depois que você fechar; dá para gerar outro na ficha do aluno.
            </Texto>
            <View style={[estilos.destaque, { borderColor: cores.borda, backgroundColor: cores.superficie2 }]}>
              <View style={estilos.textoDestaque}>
                <Texto variante="pequeno">Link do convite</Texto>
                <Texto selectable style={estilos.link}>{convite.link}</Texto>
              </View>
              <Botao rotulo="Copiar" tipo="secundario" Icone={Copy} aoTocar={() => aoCopiar(convite.link, 'Link')} />
            </View>
          </>
        ) : null}
        <Passo feito={!!aceite.anamneseId} texto={aceite.anamneseId ? 'Anamnese enviada' : 'Anamnese não enviada'} />
        <Passo feito={dados.pagamento === 'CONFIRMADO_MANUAL'} texto={`Pagamento: ${pagamento}. O app não confere pagamento.`} />
        <Passo feito={temProposta(proposta)} texto={temProposta(proposta)
          ? `Proposta: ${[proposta.planoNome, centavosParaTela(proposta.valorCentavos)].filter((x) => x && x !== SEM_DADO).join(' · ') || 'registrada'}`
          : 'Sem proposta registrada'} />
        {pagamentosHabilitados ? (
          <Texto variante="pequeno">Para cobrar pelo app, cadastre a contratação no Financeiro, na ficha do aluno.</Texto>
        ) : null}
        {podeVerAluno ? (
          <LinhaDeAcoes><Botao rotulo="Abrir ficha" aoTocar={() => aoAbrirFicha(aceite.alunoId)} /></LinhaDeAcoes>
        ) : null}
      </Cartao>
    </View>
  );
}

function Passo({ feito, texto }: { feito: boolean; texto: string }) {
  const { cores } = useTema();
  return (
    <View style={estilos.passo}>
      <View style={[estilos.marca, { borderColor: feito ? cores.sucesso : cores.borda, backgroundColor: feito ? cores.sucesso : 'transparent' }]}>
        {feito ? <Check size={14} color={cores.fundo} /> : null}
      </View>
      <Texto style={estilos.textoPasso}>{texto}</Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  corpo: { gap: espaco(2) },
  selos: { flexDirection: 'row', gap: espaco(0.75), flexWrap: 'wrap' },
  anamnese: { gap: espaco(0.75) },
  conferir: { gap: 2 },
  destaque: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco(1),
    borderWidth: 1,
    borderRadius: RAIO,
    padding: espaco(1.5),
    flexWrap: 'wrap',
  },
  textoDestaque: { flex: 1, minWidth: 180, gap: 2 },
  link: { fontFamily: fontes.normal, fontSize: 14 },
  passo: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  marca: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  textoPasso: { flex: 1 },
});
