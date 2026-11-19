import { router } from 'expo-router';
import { MessageCircle } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { desfazerAcordo } from '../../api/financeiroRenegociar';
import type { CobrancaResponse, FormaDePagamento, LembretesDaCobranca, RecebimentoOnline } from '../../api/financeiroTipos';
import {
  buscarRecebimentoOnline, cancelarCobranca, contestarCobranca, desfazerBaixaDaCobranca, estornarCobranca, lembretesDaCobranca, linkDaCobranca,
  manterCobrancaPaga, registrarPagamentoManual,
} from '../../api/rotas';
import {
  atrasoParaTela, cpfMascarado, ehPagamentoOnline, emissaoDaCobranca, FORMAS_MANUAIS, hojeEmBrasilia, LIMITES, podeCancelarCobranca, podeCopiarLink, podeDesfazerBaixa,
  nomeNaListaDaCobranca, podeManterPaga, podeMarcarContestacao, podeMarcarEstorno, podeRegistrarPagamento, referenciaDaCobranca, ROTULO_ONLINE, rotuloDaForma,
  rotuloDoTipoDaCobranca, seloDaCobranca, seloDoTipoDaCobranca,
  temBaixaRegistrada, temDescricaoPropria, TEXTO_SEM_CONFIGURAR_O_RECEBIMENTO, validarBaixa,
} from '../../dominio/financeiro';
import { centavosParaTela, dataDaTela, dataParaTela } from '../../dominio/formatos';
import { botaoDoWhatsApp, rotuloDoTipo, situacaoDoLembrete } from '../../dominio/lembretesDeCobranca';
import { DETALHE_COBRADA_PELA_KIWIFY, ehCobradaPelaKiwify, TEXTO_COBRADA_PELA_KIWIFY } from '../../dominio/kiwify';
import { linkParaAbrir } from '../../dominio/links';
import { LINHA_DOS_LEMBRETES } from '../../dominio/responsavelFinanceiro';
import { rotuloDoMes } from '../../dominio/numeros';
import { motivoDeRenegociarDesabilitado, podeDesfazerAcordo, podeRenegociar } from '../../dominio/renegociar';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { useSaidaGuardada } from '../../ui/GuardaDeSaida';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { CampoLeitura } from '../../ui/CampoLeitura';
import { CamposEmLinha } from '../../ui/CamposEmLinha';
import { CampoData } from '../../ui/Campos';
import { Divisor } from '../../ui/Divisor';
import { Escolha } from '../../ui/Escolha';
import { MensagemErro } from '../../ui/Estados';
import { codigoApi, textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { avisoDeConflito, copiarTexto, ehConflito } from './comum';
import { FolhaRenegociar } from './FolhaRenegociar';

type Modo = 'detalhe' | 'baixa';
type Pergunta = 'desfazer' | 'cancelar' | 'contestar' | 'estornar' | 'manterPaga' | 'desfazerAcordo' | null;

/**
 * O painel de cada ação que pede motivo. Estorno e contestação só registram o que aconteceu fora do app: nenhum move
 * dinheiro, e o estorno não tem volta.
 */
const PERGUNTAS: Record<Exclude<Pergunta, null>, { titulo: string; mensagem: string; confirmar: string; sucesso: string; perigo: boolean }> = {
  desfazer: {
    titulo: 'Desfazer a baixa?', mensagem: 'A cobrança volta a ficar em aberto. O motivo fica registrado.',
    confirmar: 'Desfazer baixa', sucesso: 'Baixa desfeita.', perigo: false,
  },
  cancelar: {
    titulo: 'Cancelar esta cobrança?', mensagem: 'A cobrança deixa de valer e sai das contas de recebimento. O motivo é obrigatório.',
    confirmar: 'Cancelar cobrança', sucesso: 'Cobrança cancelada.', perigo: true,
  },
  contestar: {
    titulo: 'Marcar como contestada?',
    mensagem: 'Use quando o aluno contestou o pagamento no banco ou no cartão. A cobrança continua contando o período até a contestação terminar. O motivo é obrigatório.',
    confirmar: 'Marcar contestação', sucesso: 'Cobrança marcada como contestada.', perigo: false,
  },
  estornar: {
    titulo: 'Marcar como estornada?',
    mensagem: 'Use quando o dinheiro voltou ao aluno (estorno feito na InfinitePay ou no banco, ou contestação perdida). O app não devolve dinheiro: só registra. A cobrança deixa de contar o período e não volta a ficar paga. O motivo é obrigatório.',
    confirmar: 'Marcar estorno', sucesso: 'Cobrança marcada como estornada.', perigo: true,
  },
  manterPaga: {
    titulo: 'Manter como paga?',
    mensagem: 'Use quando a contestação terminou a seu favor. A cobrança volta a ficar paga, com a mesma data e forma. O motivo é obrigatório.',
    confirmar: 'Manter como paga', sucesso: 'Cobrança mantida como paga.', perigo: false,
  },
  desfazerAcordo: {
    titulo: 'Desfazer o acordo?',
    mensagem: 'As cobranças originais voltam a ficar em aberto e as parcelas do acordo são canceladas. Só dá para desfazer se nenhuma parcela foi paga, contestada ou estornada. O motivo é obrigatório.',
    confirmar: 'Desfazer acordo', sucesso: 'Acordo desfeito.', perigo: false,
  },
};

/**
 * Uma cobrança: os dados, o selo, e (com `FINANCEIRO_ALTERAR`) Registrar pagamento, Desfazer a baixa, Cancelar, Marcar
 * contestação, Marcar estorno e Manter como paga. Registrar e cancelar só em cobrança em aberto; desfazer só em baixa
 * manual; contestação e estorno em paga (o estorno também em contestada); manter paga só em contestada. A API confere
 * de novo. O app nunca envia valor de cobrança: só data, forma, observação e a versão que viu. O treinador não paga nem
 * recebe por aqui: "Copiar link de pagamento" pede o link da InfinitePay (cobrança em aberto, recebimento online
 * configurado) para ele mandar ao aluno.
 */
export function FolhaDaCobranca({ cobranca, podeAlterar, abrirEmBaixa, mostrarFicha, aoFechar, aoMudar }: {
  cobranca: CobrancaResponse | null;
  podeAlterar: boolean;
  /** Abre direto no formulário de pagamento (atalho da lista de inadimplentes). */
  abrirEmBaixa?: boolean;
  /** "Abrir ficha do aluno" no detalhe: em toda lista fora da ficha (na própria ficha seria voltar ao mesmo lugar). */
  mostrarFicha?: boolean;
  aoFechar: () => void;
  /** Depois de qualquer mudança (ou conflito): quem chamou recarrega as listas. */
  aoMudar: () => void;
}) {
  const { recebimentoOnlineHabilitado } = useSessao();
  // O estado do recebimento online só é buscado quando o link pode ser copiado (em aberto, com permissão e a InfinitePay
  // ligada); fica aqui, fora do `Conteudo`, para não buscar de novo a cada versão da cobrança.
  // A cobrança de saída não tem link de pagamento nesta fase (só baixa manual e WhatsApp): nem busca o recebimento online.
  // A cobrada pela Kiwify também não (D18): um link da InfinitePay ao lado da assinatura faria o aluno pagar duas vezes.
  const querLink = !!cobranca && cobranca.situacao === 'ABERTA' && cobranca.tipo !== 'SAIDA' && !ehCobradaPelaKiwify(cobranca) && podeAlterar && recebimentoOnlineHabilitado;
  const recebimento = useCarregar(querLink ? 'recebimento-online|folha' : null, () => buscarRecebimentoOnline());
  // Os lembretes por e-mail desta cobrança e a mensagem pronta do WhatsApp; falha na busca só esconde o bloco.
  // O id sai antes: o React Compiler lê as dependências da função na renderização, e `cobranca` pode ser nula aqui.
  const cobrancaId = cobranca?.id ?? null;
  const lembretes = useCarregar(cobrancaId ? `lembretes-da-cobranca|${cobrancaId}|${cobranca?.versao}` : null,
    () => lembretesDaCobranca(cobrancaId ?? ''));
  if (!cobranca) return null;
  // A chave reinicia o formulário a cada cobrança aberta.
  return <Conteudo key={`${cobranca.id}:${cobranca.versao}:${abrirEmBaixa ? 'b' : 'd'}`} cobranca={cobranca} podeAlterar={podeAlterar}
    abrirEmBaixa={!!abrirEmBaixa} mostrarFicha={!!mostrarFicha} querLink={querLink} recebimento={recebimento.dados} lembretes={lembretes.dados} aoFechar={aoFechar} aoMudar={aoMudar} />;
}

function Conteudo({ cobranca, podeAlterar, abrirEmBaixa, mostrarFicha, querLink, recebimento, lembretes, aoFechar, aoMudar }: {
  cobranca: CobrancaResponse;
  podeAlterar: boolean;
  abrirEmBaixa: boolean;
  mostrarFicha: boolean;
  /** Mostra o "Copiar link de pagamento" (ou o aviso de que falta configurar). */
  querLink: boolean;
  /** Estado do recebimento online; `undefined` enquanto carrega ou se a busca falhou (então nada é oferecido). */
  recebimento: RecebimentoOnline | undefined;
  /** Lembretes por e-mail e a mensagem do WhatsApp; `undefined` enquanto carrega ou se a busca falhou. */
  lembretes: LembretesDaCobranca | undefined;
  aoFechar: () => void;
  aoMudar: () => void;
}) {
  const { avisar } = useAviso();
  const [modo, setModo] = useState<Modo>(abrirEmBaixa && podeAlterar && podeRegistrarPagamento(cobranca) ? 'baixa' : 'detalhe');
  const [pergunta, setPergunta] = useState<Pergunta>(null);
  // O painel continua com o texto da última pergunta enquanto fecha.
  const [ultimaPergunta, setUltimaPergunta] = useState<Exclude<Pergunta, null>>('desfazer');
  const [data, setData] = useState(dataParaTela(hojeEmBrasilia()));
  const [forma, setForma] = useState<FormaDePagamento | null>('PIX_DIRETO');
  const [observacao, setObservacao] = useState('');
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const [tentou, setTentou] = useState(false);
  const [copiando, setCopiando] = useState(false);
  /** Só quando o navegador recusa a cópia: o link fica na tela para a pessoa copiar à mão. */
  const [linkParaCopiarAMao, setLinkParaCopiarAMao] = useState<string | null>(null);
  /** "Renegociar" troca o conteúdo desta folha pelo passo a passo (sem folha sobre folha); "Cancelar" volta ao detalhe. */
  const [renegociando, setRenegociando] = useState(false);

  const selo = seloDaCobranca(cobranca);
  const hoje = hojeEmBrasilia();
  const iso = dataDaTela(data);
  const erroDaBaixa = validarBaixa({ data: iso ?? null, forma }, hoje);

  const concluir = (acao: () => Promise<unknown>, sucesso: string) => {
    setEnviando(true);
    setErro(null);
    acao().then(
      () => {
        setEnviando(false);
        setPergunta(null);
        avisar(sucesso, 'sucesso');
        aoMudar();
        aoFechar();
      },
      (e: unknown) => {
        setEnviando(false);
        if (ehConflito(e)) {
          setPergunta(null);
          avisar(avisoDeConflito('A cobrança foi alterada'), 'neutro');
          aoMudar();
          aoFechar();
          return;
        }
        setErro(e);
      },
    );
  };

  const registrar = () => {
    setTentou(true);
    if (erroDaBaixa || !iso || !forma) return;
    concluir(
      () => registrarPagamentoManual(cobranca.id, { data: iso, forma, observacao: observacao.trim() || null, versao: cobranca.versao }),
      'Pagamento registrado.',
    );
  };

  const confirmarPergunta = () => {
    const texto = motivo.trim();
    if (!texto || !pergunta) return;
    const corpo = { motivo: texto, versao: cobranca.versao };
    const acoes = {
      desfazer: desfazerBaixaDaCobranca, cancelar: cancelarCobranca, contestar: contestarCobranca, estornar: estornarCobranca,
      manterPaga: manterCobrancaPaga,
      // O acordo é desfeito inteiro (originais e parcelas); a API recusa se alguma parcela já foi paga, contestada ou estornada.
      desfazerAcordo: (_id: string, c: { motivo: string }) => desfazerAcordo(cobranca.acordoId ?? '', { motivo: c.motivo }),
    };
    const acao = acoes[pergunta];
    concluir(() => acao(cobranca.id, corpo), PERGUNTAS[pergunta].sucesso);
  };

  const copiarLink = () => {
    setCopiando(true);
    setErro(null);
    setLinkParaCopiarAMao(null);
    linkDaCobranca(cobranca.id).then(
      ({ url }) => {
        const seguro = linkParaAbrir(url);
        if (!seguro) {
          setCopiando(false);
          setErro(new Error('O link de pagamento veio inválido. Tente de novo.'));
          return;
        }
        // O navegador pode recusar a escrita depois de uma espera (Safari): então o link fica na tela para copiar à mão.
        void copiarTexto(seguro).then((ok) => {
          setCopiando(false);
          if (ok) {
            avisar('Link copiado.', 'sucesso');
            return;
          }
          setLinkParaCopiarAMao(seguro);
          avisar('Não foi possível copiar sozinho. Selecione o link e copie à mão.', 'neutro');
        });
      },
      (e: unknown) => {
        setCopiando(false);
        setErro(e);
        // A cobrança deixou de estar aberta em outro lugar: a lista confere de novo.
        if (codigoApi(e) === 'COBRANCA_NAO_ABERTA') aoMudar();
      },
    );
  };

  // Saídas para outra tela passam pela guarda (a ficha pode estar em edição, D7); a Folha só fecha se a pessoa sair.
  const { confirmar } = useSaidaGuardada();
  const irParaORecebimento = () => confirmar(() => {
    aoFechar();
    router.push({ pathname: '/treinador/financeiro', params: { aba: 'recebimento' } });
  });

  const whatsapp = botaoDoWhatsApp(lembretes);
  const paraResponsavel = lembretes?.paraResponsavel ? <Texto variante="suave">{LINHA_DOS_LEMBRETES}</Texto> : null;
  // Abre fora do app, sem token; nada é registrado como enviado (é o treinador quem manda a mensagem).
  const abrirWhatsApp = () => {
    if (!whatsapp?.link) return;
    Linking.openURL(whatsapp.link).catch(() => avisar('Não foi possível abrir o WhatsApp.', 'perigo'));
  };

  const perguntar = (p: Exclude<Pergunta, null>) => { setMotivo(''); setErro(null); setUltimaPergunta(p); setPergunta(p); };

  const abrirFicha = () => confirmar(() => {
    aoFechar();
    router.push(`/treinador/alunos/${cobranca.alunoId}?aba=ficha`);
  });

  if (renegociando) {
    return <FolhaRenegociar cobrancas={[cobranca]} aoFechar={aoFechar} aoCancelar={() => setRenegociando(false)} aoMudar={aoMudar} />;
  }

  const doTipo = seloDoTipoDaCobranca(cobranca.tipo);
  // A mensalidade pelo mês; a saída e a avulsa pelo tipo (a descrição da avulsa vem logo abaixo do nome).
  const titulo = modo === 'baixa' ? 'Registrar pagamento' : doTipo ? rotuloDoTipoDaCobranca(cobranca.tipo) : `Cobrança de ${rotuloDoMes(cobranca.competencia)}`;
  const cpf = cpfMascarado(cobranca.alunoCpf);
  const rodape = modo === 'baixa' ? (
    <>
      <Botao rotulo="Voltar" tipo="secundario" aoTocar={() => (abrirEmBaixa ? aoFechar() : setModo('detalhe'))} desabilitado={enviando} />
      <Botao rotulo="Registrar pagamento" aoTocar={registrar} carregando={enviando} />
    </>
  ) : podeAlterar ? (
    // Ordem de todo rodapé: o que destrói à esquerda, os secundários e a ação principal por último, à direita.
    <LinhaDeAcoes alinhar="fim">
      {podeCancelarCobranca(cobranca) ? <Botao rotulo="Cancelar cobrança" tipo="perigoTexto" aoTocar={() => perguntar('cancelar')} /> : null}
      {podeMarcarEstorno(cobranca) ? <Botao rotulo="Marcar estorno" tipo="perigoTexto" aoTocar={() => perguntar('estornar')} /> : null}
      {podeDesfazerBaixa(cobranca) ? <Botao rotulo="Desfazer baixa" tipo="secundario" aoTocar={() => perguntar('desfazer')} /> : null}
      {podeMarcarContestacao(cobranca) ? <Botao rotulo="Marcar contestação" tipo="secundario" aoTocar={() => perguntar('contestar')} /> : null}
      {podeManterPaga(cobranca) ? <Botao rotulo="Manter como paga" tipo="secundario" aoTocar={() => perguntar('manterPaga')} /> : null}
      {podeDesfazerAcordo(cobranca) ? <Botao rotulo="Desfazer acordo" tipo="secundario" aoTocar={() => perguntar('desfazerAcordo')} /> : null}
      {podeRenegociar(cobranca) ? (
        <Botao rotulo="Renegociar" tipo="secundario" aoTocar={() => setRenegociando(true)}
          desabilitado={!!motivoDeRenegociarDesabilitado(cobranca)} motivo={motivoDeRenegociarDesabilitado(cobranca) ?? undefined} />
      ) : null}
      {querLink && recebimento && podeCopiarLink(cobranca, recebimento.configurado) ? (
        <Botao rotulo="Copiar link de pagamento" tipo="secundario" carregando={copiando} aoTocar={copiarLink} />
      ) : null}
      {podeRegistrarPagamento(cobranca) ? <Botao rotulo="Registrar pagamento" aoTocar={() => setModo('baixa')} /> : null}
    </LinhaDeAcoes>
  ) : undefined;

  const dataInvalida = tentou && (!iso || iso > hoje) ? erroDaBaixa : null;

  return (
    <Folha visivel titulo={titulo} aoFechar={aoFechar} rodape={rodape}>
      <View style={estilos.coluna}>
        {/* Quem, quanto e a situação, num bloco só: o resto são os detalhes, lado a lado. */}
        <View style={estilos.topo}>
          <View style={estilos.quem}>
            <Texto variante="bloco">{cobranca.alunoNome ?? '—'}</Texto>
            {/* CPF só quando a API manda (com `ALUNO_SENSIVEL_LER`), e só o meio dele. */}
            {cpf ? <Texto variante="suave" numerico accessibilityLabel={`CPF ${cpf}`}>CPF {cpf}</Texto> : null}
            <Texto variante="suave">{nomeNaListaDaCobranca(cobranca)}{modo === 'baixa' && !temDescricaoPropria(cobranca.tipo) ? ` · ${referenciaDaCobranca(cobranca)}` : ''}</Texto>
          </View>
          <View style={estilos.selos}>
            <Selo texto={selo.rotulo} tipo={selo.tom} />
            {doTipo ? <Selo texto={doTipo.rotulo} tipo={doTipo.tom} /> : null}
            {cobranca.situacao === 'PAGA' && ehPagamentoOnline(cobranca) ? <Selo texto={ROTULO_ONLINE} tipo="neutro" /> : null}
            {ehCobradaPelaKiwify(cobranca) ? <Selo texto={TEXTO_COBRADA_PELA_KIWIFY} tipo="neutro" /> : null}
          </View>
        </View>
        <Texto variante="destaque" numerico accessibilityLabel={`Valor: ${centavosParaTela(cobranca.valorCentavos)}`}>{centavosParaTela(cobranca.valorCentavos)}</Texto>
        {modo === 'detalhe' ? (
          <>
            {/* Os detalhes em grupos com título (datas, pagamento, observações), cada um em campos lado a lado. */}
            <Grupo titulo="Datas">
              <CamposEmLinha>
                {/* A avulsa não tem competência: a descrição já está no topo, abaixo do nome. */}
                {cobranca.competencia ? <CampoLeitura rotulo="Competência" valor={rotuloDoMes(cobranca.competencia)} /> : null}
                <CampoLeitura rotulo="Vencimento" valor={dataParaTela(cobranca.vencimento)} numerico />
                <CampoLeitura rotulo="Emissão" valor={dataParaTela(emissaoDaCobranca(cobranca))} numerico />
                {cobranca.situacao === 'ABERTA' && cobranca.vencida ? <CampoLeitura rotulo="Atraso" valor={atrasoParaTela(cobranca.diasDeAtraso)} /> : null}
              </CamposEmLinha>
              {ehCobradaPelaKiwify(cobranca) && cobranca.situacao === 'ABERTA' ? <Texto variante="suave">{DETALHE_COBRADA_PELA_KIWIFY}</Texto> : null}
            </Grupo>
            {temBaixaRegistrada(cobranca) ? (
              <Grupo titulo="Pagamento">
                <CamposEmLinha>
                  <CampoLeitura rotulo="Pago em" valor={dataParaTela(cobranca.pagoEm)} numerico />
                  <CampoLeitura rotulo="Forma" valor={rotuloDaForma(cobranca.forma)} />
                  <CampoLeitura rotulo="Baixa dada por" valor={cobranca.provedor === 'KIWIFY' ? 'Automática (Kiwify)' : ehPagamentoOnline(cobranca) ? 'Automática (pagamento online)' : cobranca.baixaPorNome} />
                </CamposEmLinha>
                {cobranca.idExterno ? <CampoLeitura rotulo="Transação no provedor" valor={cobranca.idExterno} /> : null}
              </Grupo>
            ) : null}
            {cobranca.situacao === 'RENEGOCIADA' || cobranca.tipo === 'RENEGOCIACAO' ? (
              <Grupo titulo="Acordo">
                <Texto variante="suave">
                  {cobranca.situacao === 'RENEGOCIADA'
                    ? 'Entrou num acordo de renegociação e não é mais cobrada. Quem se cobra agora são as parcelas, com o selo “Acordo” na lista.'
                    : 'Parcela de um acordo de renegociação. As cobranças originais estão na lista como “Renegociada”.'}
                </Texto>
              </Grupo>
            ) : null}
            {cobranca.observacao || cobranca.motivo ? (
              <Grupo titulo="Observações">
                {cobranca.observacao ? <CampoLeitura rotulo="Observação" valor={cobranca.observacao} /> : null}
                {cobranca.motivo ? <CampoLeitura rotulo="Motivo" valor={cobranca.motivo} /> : null}
              </Grupo>
            ) : null}
            {querLink && recebimento && !recebimento.configurado ? (
              <View style={estilos.aviso}>
                <Texto variante="suave">{TEXTO_SEM_CONFIGURAR_O_RECEBIMENTO}</Texto>
                <LinhaDeAcoes><Botao rotulo="Abrir Recebimento online" tipo="secundario" aoTocar={irParaORecebimento} /></LinhaDeAcoes>
              </View>
            ) : null}
            {linkParaCopiarAMao ? (
              // A cópia foi recusada: o link fica aqui, com rótulo, para selecionar e copiar à mão.
              <View style={estilos.linkAMao}>
                <Texto variante="rotulo">Link de pagamento para copiar</Texto>
                <Texto selectable>{linkParaCopiarAMao}</Texto>
              </View>
            ) : null}
            {/* D15: sem o nome do responsável e sem prometer os dois canais (cada um cai no aluno sozinho). Junto do WhatsApp, quando há. */}
            {!whatsapp && paraResponsavel}
            {whatsapp ? (
              <View style={estilos.aviso}>
                {paraResponsavel}
                <LinhaDeAcoes>
                  <Botao rotulo="Abrir WhatsApp com a mensagem" tipo="secundario" Icone={MessageCircle} aoTocar={abrirWhatsApp}
                    desabilitado={!whatsapp.link} motivo={whatsapp.motivo ?? undefined} />
                </LinhaDeAcoes>
                {/* Sem telefone, o botão desabilitado já mostra o porquê (`motivo`). */}
                {whatsapp.link ? <Texto variante="suave">Abre o WhatsApp com o lembrete pronto; quem envia é você.</Texto> : null}
              </View>
            ) : null}
            {lembretes && (lembretes.itens.length > 0 || lembretes.alunoDesligou) ? (
              <View style={estilos.lembretes}>
                <Texto variante="secao" nivel={3}>Lembretes por e-mail</Texto>
                {lembretes.alunoDesligou ? <Texto variante="suave">O aluno desligou os lembretes por e-mail</Texto> : null}
                {lembretes.itens.map((l) => {
                  const s = situacaoDoLembrete(l);
                  return (
                    <View key={l.id} style={estilos.lembrete}>
                      <View style={estilos.quem}>
                        <Texto>{rotuloDoTipo(l.tipo)}</Texto>
                        <Texto variante="suave">{s.texto}</Texto>
                      </View>
                      <Selo texto={s.selo} tipo={s.tom} />
                    </View>
                  );
                })}
              </View>
            ) : null}
            {/* Com divisor próprio: sem ele o botão parecia parte do último grupo (Pagamento). */}
            {mostrarFicha ? <Divisor /> : null}
            {mostrarFicha ? (
              <LinhaDeAcoes><Botao rotulo="Abrir ficha do aluno" tipo="secundario" rotuloAcessivel={`Abrir ficha de ${cobranca.alunoNome ?? 'aluno'}`} aoTocar={abrirFicha} /></LinhaDeAcoes>
            ) : null}
            <Divisor />
            {/* O id inteiro, selecionável, para conferir com quem pergunta pela cobrança (a tabela mostra só o final). */}
            <View style={estilos.id}>
              <Texto variante="rotulo">ID da cobrança</Texto>
              <Texto variante="suave" numerico selectable>{cobranca.id}</Texto>
            </View>
          </>
        ) : (
          <>
            <CampoData rotulo="Data do pagamento" valor={data} aoMudar={setData} erro={dataInvalida} />
            <Escolha rotulo="Forma de pagamento" opcoes={FORMAS_MANUAIS.map((f) => ({ valor: f.valor as FormaDePagamento | null, rotulo: f.rotulo }))}
              valor={forma} aoMudar={setForma} />
            <Campo rotulo="Observação (opcional)" valor={observacao} aoMudar={setObservacao} linhas={3} maxLength={LIMITES.observacao}
              ajuda="Só a equipe vê; o aluno não." />
          </>
        )}
        {erro && !pergunta ? <MensagemErro texto={textoDoErro(erro)} erro={erro} /> : null}
      </View>
      <PainelConfirmacao visivel={pergunta !== null}
        titulo={PERGUNTAS[ultimaPergunta].titulo}
        mensagem={PERGUNTAS[ultimaPergunta].mensagem}
        rotuloConfirmar={PERGUNTAS[ultimaPergunta].confirmar} rotuloCancelar="Voltar"
        perigo={PERGUNTAS[ultimaPergunta].perigo} carregando={enviando} desabilitado={!motivo.trim()} motivo="Informe o motivo."
        aoConfirmar={confirmarPergunta} aoCancelar={() => setPergunta(null)}>
        <Campo rotulo="Motivo" valor={motivo} aoMudar={setMotivo} linhas={3} maxLength={LIMITES.motivo} />
        {erro && pergunta ? <MensagemErro texto={textoDoErro(erro)} erro={erro} /> : null}
      </PainelConfirmacao>
    </Folha>
  );
}

/** Um grupo de detalhes: título de seção e os campos, separado do anterior por um fio. */
function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <View style={estilos.grupo}>
      <Divisor />
      <Texto variante="secao" nivel={3}>{titulo}</Texto>
      {children}
    </View>
  );
}

const estilos = StyleSheet.create({
  linkAMao: { gap: espaco(0.5) },
  coluna: { gap: espaco(2) },
  grupo: { gap: espaco(1.5) },
  id: { gap: espaco(0.25) },
  topo: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: espaco(1.5) },
  quem: { flex: 1, gap: 2 },
  selos: { alignItems: 'flex-end', gap: espaco(0.5) },
  aviso: { gap: espaco(0.5) },
  lembretes: { gap: espaco(1) },
  lembrete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1.5) },
});
