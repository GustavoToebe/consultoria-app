import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { MessageCircle } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import type { CobrancaResponse, FormaDePagamento, LembretesDaCobranca, RecebimentoOnline } from '../../api/financeiroTipos';
import {
  buscarRecebimentoOnline, cancelarCobranca, contestarCobranca, desfazerBaixaDaCobranca, estornarCobranca, lembretesDaCobranca, linkDaCobranca,
  manterCobrancaPaga, registrarPagamentoManual,
} from '../../api/rotas';
import {
  atrasoParaTela, ehPagamentoOnline, FORMAS_MANUAIS, hojeEmBrasilia, LIMITES, podeCancelarCobranca, podeCopiarLink, podeDesfazerBaixa,
  podeManterPaga, podeMarcarContestacao, podeMarcarEstorno, podeRegistrarPagamento, ROTULO_ONLINE, rotuloDaForma, seloDaCobranca,
  temBaixaRegistrada, TEXTO_SEM_CONFIGURAR_O_RECEBIMENTO, validarBaixa,
} from '../../dominio/financeiro';
import { centavosParaTela, dataDaTela, dataParaTela } from '../../dominio/formatos';
import { botaoDoWhatsApp, rotuloDoTipo, situacaoDoLembrete } from '../../dominio/lembretesDeCobranca';
import { linkParaAbrir } from '../../dominio/links';
import { rotuloDoMes } from '../../dominio/numeros';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { CampoLeitura } from '../../ui/CampoLeitura';
import { CamposEmLinha } from '../../ui/CamposEmLinha';
import { CampoData } from '../../ui/Campos';
import { Escolha } from '../../ui/Escolha';
import { MensagemErro } from '../../ui/Estados';
import { codigoApi, textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { avisoDeConflito, ehConflito } from './comum';

type Modo = 'detalhe' | 'baixa';
type Pergunta = 'desfazer' | 'cancelar' | 'contestar' | 'estornar' | 'manterPaga' | null;

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
  const querLink = !!cobranca && cobranca.situacao === 'ABERTA' && podeAlterar && recebimentoOnlineHabilitado;
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
        Clipboard.setStringAsync(seguro).then(
          () => { setCopiando(false); avisar('Link copiado.', 'sucesso'); },
          () => { setCopiando(false); setLinkParaCopiarAMao(seguro); avisar('Não foi possível copiar sozinho. Selecione o link e copie à mão.', 'neutro'); },
        );
      },
      (e: unknown) => {
        setCopiando(false);
        setErro(e);
        // A cobrança deixou de estar aberta em outro lugar: a lista confere de novo.
        if (codigoApi(e) === 'COBRANCA_NAO_ABERTA') aoMudar();
      },
    );
  };

  const irParaORecebimento = () => {
    aoFechar();
    router.push({ pathname: '/treinador/financeiro', params: { aba: 'recebimento' } });
  };

  const whatsapp = botaoDoWhatsApp(lembretes);
  // Abre fora do app, sem token; nada é registrado como enviado (é o treinador quem manda a mensagem).
  const abrirWhatsApp = () => {
    if (!whatsapp?.link) return;
    Linking.openURL(whatsapp.link).catch(() => avisar('Não foi possível abrir o WhatsApp.', 'perigo'));
  };

  const perguntar = (p: Exclude<Pergunta, null>) => { setMotivo(''); setErro(null); setUltimaPergunta(p); setPergunta(p); };

  const abrirFicha = () => {
    aoFechar();
    router.push(`/treinador/alunos/${cobranca.alunoId}`);
  };

  const titulo = modo === 'baixa' ? 'Registrar pagamento' : `Cobrança de ${rotuloDoMes(cobranca.competencia)}`;
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
            <Texto variante="suave">{cobranca.planoNome ?? '—'}{modo === 'baixa' ? ` · ${rotuloDoMes(cobranca.competencia)}` : ''}</Texto>
          </View>
          <View style={estilos.selos}>
            <Selo texto={selo.rotulo} tipo={selo.tom} />
            {cobranca.situacao === 'PAGA' && ehPagamentoOnline(cobranca) ? <Selo texto={ROTULO_ONLINE} tipo="neutro" /> : null}
          </View>
        </View>
        <Texto variante="destaque" numerico accessibilityLabel={`Valor: ${centavosParaTela(cobranca.valorCentavos)}`}>{centavosParaTela(cobranca.valorCentavos)}</Texto>
        {modo === 'detalhe' ? (
          <>
            <CamposEmLinha>
              <CampoLeitura rotulo="Vencimento" valor={dataParaTela(cobranca.vencimento)} numerico />
              {cobranca.situacao === 'ABERTA' && cobranca.vencida ? <CampoLeitura rotulo="Atraso" valor={atrasoParaTela(cobranca.diasDeAtraso)} /> : null}
              {temBaixaRegistrada(cobranca) ? <CampoLeitura rotulo="Pago em" valor={dataParaTela(cobranca.pagoEm)} numerico /> : null}
              {temBaixaRegistrada(cobranca) ? <CampoLeitura rotulo="Forma" valor={rotuloDaForma(cobranca.forma)} /> : null}
              {temBaixaRegistrada(cobranca) ? (
                <CampoLeitura rotulo="Baixa dada por" valor={ehPagamentoOnline(cobranca) ? 'Automática (pagamento online)' : cobranca.baixaPorNome} />
              ) : null}
            </CamposEmLinha>
            {cobranca.observacao ? <CampoLeitura rotulo="Observação" valor={cobranca.observacao} /> : null}
            {cobranca.motivo ? <CampoLeitura rotulo="Motivo" valor={cobranca.motivo} /> : null}
            {querLink && recebimento && !recebimento.configurado ? (
              <View style={estilos.aviso}>
                <Texto variante="suave">{TEXTO_SEM_CONFIGURAR_O_RECEBIMENTO}</Texto>
                <LinhaDeAcoes><Botao rotulo="Abrir Recebimento online" tipo="secundario" aoTocar={irParaORecebimento} /></LinhaDeAcoes>
              </View>
            ) : null}
            {linkParaCopiarAMao ? <Texto selectable>{linkParaCopiarAMao}</Texto> : null}
            {whatsapp ? (
              <View style={estilos.aviso}>
                <LinhaDeAcoes>
                  <Botao rotulo="Abrir WhatsApp com a mensagem" tipo="secundario" Icone={MessageCircle} aoTocar={abrirWhatsApp}
                    desabilitado={!whatsapp.link} motivo={whatsapp.motivo ?? undefined} />
                </LinhaDeAcoes>
                {/* Sem telefone, o botão desabilitado já mostra o porquê (`motivo`). */}
                {whatsapp.link ? <Texto variante="suave">Abre o WhatsApp com o lembrete pronto; quem envia é você.</Texto> : null}
              </View>
            ) : null}
            {lembretes && lembretes.itens.length > 0 ? (
              <View style={estilos.lembretes}>
                <Texto variante="secao" nivel={3}>Lembretes por e-mail</Texto>
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
            {mostrarFicha ? (
              <LinhaDeAcoes><Botao rotulo="Abrir ficha do aluno" tipo="secundario" rotuloAcessivel={`Abrir ficha de ${cobranca.alunoNome ?? 'aluno'}`} aoTocar={abrirFicha} /></LinhaDeAcoes>
            ) : null}
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

const estilos = StyleSheet.create({
  coluna: { gap: espaco(2) },
  topo: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: espaco(1.5) },
  quem: { flex: 1, gap: 2 },
  selos: { alignItems: 'flex-end', gap: espaco(0.5) },
  aviso: { gap: espaco(0.5) },
  lembretes: { gap: espaco(1) },
  lembrete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1.5) },
});
