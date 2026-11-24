import { router, type Href } from 'expo-router';
import { Copy } from 'lucide-react-native';
import { useState, type ComponentProps, type ComponentType, type ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { desfazerAcordo } from '../../api/financeiroRenegociar';
import type { CobrancaResponse, FormaDePagamento, LembretesDaCobranca, RecebimentoOnline } from '../../api/financeiroTipos';
import {
  buscarRecebimentoOnline, cancelarCobranca, contestarCobranca, desfazerBaixaDaCobranca, estornarCobranca, lembretesDaCobranca, linkDaCobranca,
  manterCobrancaPaga, registrarPagamentoManual,
} from '../../api/rotas';
import {
  cpfMascarado, ehPagamentoOnline, emissaoDaCobranca, FORMAS_MANUAIS, hojeEmBrasilia, LIMITES, podeCancelarCobranca, podeCopiarLink, podeDesfazerBaixa,
  podeManterPaga, podeMarcarContestacao, podeMarcarEstorno, podeRegistrarPagamento, referenciaDaCobranca, ROTULO_ONLINE, rotuloDaForma,
  rotuloDoTipoDaCobranca, seloDaCobranca, seloDoTipoDaCobranca, temBaixaRegistrada, temDescricaoPropria, validarBaixa,
} from '../../dominio/financeiro';
import { idEncurtado, origemDaCobranca, prazoDaCobranca, TEXTO_CONFIGURE_PARA_O_LINK, type TomDoPrazo } from '../../dominio/folhaDaCobranca';
import { centavosParaTela, dataDaTela, dataParaTela } from '../../dominio/formatos';
import { DETALHE_COBRADA_PELA_KIWIFY, ehCobradaPelaKiwify, TEXTO_COBRADA_PELA_KIWIFY } from '../../dominio/kiwify';
import { botaoDoWhatsApp, MOTIVO_SEM_TELEFONE, rotuloDoTipo, situacaoDoLembrete } from '../../dominio/lembretesDeCobranca';
import { linkParaAbrir } from '../../dominio/links';
import { rotuloDoMesNumerico } from '../../dominio/mesDaCompetencia';
import { escalar } from '../../dominio/preferencias';
import { motivoDeRenegociarDesabilitado, podeDesfazerAcordo, podeRenegociar } from '../../dominio/renegociar';
import { LINHA_DOS_LEMBRETES } from '../../dominio/responsavelFinanceiro';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { CampoLeitura } from '../../ui/CampoLeitura';
import { CamposEmLinha } from '../../ui/CamposEmLinha';
import { CampoData } from '../../ui/Campos';
import { Divisor } from '../../ui/Divisor';
import { Escolha } from '../../ui/Escolha';
import { MensagemErro } from '../../ui/Estados';
import { codigoApi, textoDoErro } from '../../ui/erros';
import { useSaidaGuardada } from '../../ui/GuardaDeSaida';
import { IconeBotao } from '../../ui/IconeBotao';
import { iconeWhatsApp } from '../../ui/IconeWhatsApp';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { propsDeLink } from '../../ui/propsDeLink';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { useFaixaDeLargura } from '../../ui/useFaixaDeLargura';
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

/** O que a casca recebe: título, fechar, as ações do rodapé (fora da rolagem) e o corpo. */
export interface PropsDaCasca {
  titulo: string;
  aoFechar: () => void;
  rodape?: ReactNode;
  children: ReactNode;
}

/**
 * Onde o detalhe da cobrança mora (variante nomeada): a `Folha` por cima da tela ou o painel fixo ao lado da tabela.
 * `renegociarPorCima`: na folha, "Renegociar" troca o conteúdo pelo passo a passo (sem folha sobre folha); no painel, o
 * passo a passo abre por cima e o painel fica. `rodapeEmDuasLinhas`: no painel estreito (480 px) a ação principal fica
 * em cima, na largura toda, e as outras embaixo, duas por linha, em meia largura; a folha mantém a fila de sempre.
 */
export interface CascaDoDetalhe {
  Componente: ComponentType<PropsDaCasca>;
  renegociarPorCima: boolean;
  rodapeEmDuasLinhas: boolean;
}

/** Uma ação do rodapé, descrita para a casca arranjar: em fila (folha) ou em duas linhas (painel). */
type AcaoDoRodape = { chave: string } & Pick<ComponentProps<typeof Botao>, 'rotulo' | 'tipo' | 'aoTocar' | 'desabilitado' | 'motivo' | 'carregando'>;

/** `fila`: tamanho do texto (cheio só no rodapé empilhado do celular); `topo`: largura toda; `par`: metade da linha. */
function BotaoDoRodape({ acao, lugar }: { acao: AcaoDoRodape; lugar: 'fila' | 'topo' | 'par' }) {
  return (
    <Botao rotulo={acao.rotulo} tipo={acao.tipo} aoTocar={acao.aoTocar} desabilitado={acao.desabilitado} motivo={acao.motivo} carregando={acao.carregando}
      cheio={lugar === 'fila' ? undefined : true} style={lugar === 'par' ? estilos.meiaLargura : undefined} />
  );
}

/**
 * Folha: o que destrói à esquerda, os secundários e a principal por último, à direita (a fila de sempre, que no celular
 * empilha). Painel: a principal (ou, sem ela, a última) em cima e cheia; as demais embaixo, duas por linha, na ordem.
 */
function RodapeDoDetalhe({ principal, secundarias, emDuasLinhas }: { principal: AcaoDoRodape | null; secundarias: AcaoDoRodape[]; emDuasLinhas: boolean }) {
  if (!emDuasLinhas) {
    return (
      <LinhaDeAcoes alinhar="fim">
        {secundarias.map((a) => <BotaoDoRodape key={a.chave} acao={a} lugar="fila" />)}
        {principal ? <BotaoDoRodape acao={principal} lugar="fila" /> : null}
      </LinhaDeAcoes>
    );
  }
  const topo = principal ?? secundarias[secundarias.length - 1];
  const resto = principal ? secundarias : secundarias.slice(0, -1);
  const pares = Array.from({ length: Math.ceil(resto.length / 2) }, (_, i) => resto.slice(i * 2, i * 2 + 2));
  return (
    <View style={estilos.duasLinhas}>
      <BotaoDoRodape acao={topo} lugar="topo" />
      {pares.map((par) => (
        <View key={par[0].chave} style={estilos.par}>
          {par.map((a) => <BotaoDoRodape key={a.chave} acao={a} lugar="par" />)}
        </View>
      ))}
    </View>
  );
}

export interface PropsDoDetalhe {
  cobranca: CobrancaResponse | null;
  podeAlterar: boolean;
  /** Abre direto no formulário de pagamento (atalho da lista de inadimplentes). */
  abrirEmBaixa?: boolean;
  /** O nome do aluno vira link para a ficha: em toda lista fora da ficha (na própria ficha seria voltar ao mesmo lugar). */
  mostrarFicha?: boolean;
  aoFechar: () => void;
  /** Depois de qualquer mudança (ou conflito): quem chamou recarrega as listas. */
  aoMudar: () => void;
}

/**
 * Uma cobrança (folha da cobrança, 23/11; `docs/planos/folha-da-cobranca.md`), na casca que quem chama escolhe (`Folha` ou
 * painel fixo). Cabeçalho com o nome (link para a ficha), a origem e o selo; o valor e o prazo relativo; as quatro datas;
 * "Cobrar o aluno" (link de pagamento, WhatsApp e os lembretes) só em aberto; o id encurtado no fim. Com
 * `FINANCEIRO_ALTERAR`, o rodapé: Registrar pagamento, Desfazer a baixa, Cancelar, Marcar contestação, Marcar estorno,
 * Manter como paga, Desfazer acordo e Renegociar, cada um só na situação em que vale (a API confere de novo). O app nunca
 * envia valor de cobrança: só data, forma, observação e a versão que viu. "Copiar link de pagamento" pede o link da
 * InfinitePay (cobrança em aberto, recebimento online configurado) para a equipe mandar ao aluno.
 */
export function DetalheDaCobranca({ cobranca, podeAlterar, abrirEmBaixa, mostrarFicha, aoFechar, aoMudar, casca }: PropsDoDetalhe & { casca: CascaDoDetalhe }) {
  const { recebimentoOnlineHabilitado } = useSessao();
  // O estado do recebimento online só é buscado quando o link pode ser copiado (em aberto, com permissão e a InfinitePay
  // ligada); fica aqui, fora do `Conteudo`, para não buscar de novo a cada versão da cobrança.
  // A cobrança de saída não tem link de pagamento nesta fase (só baixa manual e WhatsApp): nem busca o recebimento online.
  // A cobrada pela Kiwify também não (D18): um link da InfinitePay ao lado da assinatura faria o aluno pagar duas vezes.
  const querLink = !!cobranca && cobranca.situacao === 'ABERTA' && cobranca.tipo !== 'SAIDA' && !ehCobradaPelaKiwify(cobranca) && podeAlterar && recebimentoOnlineHabilitado;
  const recebimento = useCarregar(querLink ? 'recebimento-online|folha' : null, () => buscarRecebimentoOnline());
  // Os lembretes por e-mail desta cobrança e a mensagem pronta do WhatsApp; falha na busca só esconde o que depende deles.
  // O id sai antes: o React Compiler lê as dependências da função na renderização, e `cobranca` pode ser nula aqui.
  const cobrancaId = cobranca?.id ?? null;
  const lembretes = useCarregar(cobrancaId ? `lembretes-da-cobranca|${cobrancaId}|${cobranca?.versao}` : null,
    () => lembretesDaCobranca(cobrancaId ?? ''));
  if (!cobranca) return null;
  // A chave reinicia o formulário a cada cobrança aberta.
  return <Conteudo key={`${cobranca.id}:${cobranca.versao}:${abrirEmBaixa ? 'b' : 'd'}`} cobranca={cobranca} podeAlterar={podeAlterar}
    abrirEmBaixa={!!abrirEmBaixa} mostrarFicha={!!mostrarFicha} querLink={querLink} recebimento={recebimento.dados} lembretes={lembretes.dados}
    aoFechar={aoFechar} aoMudar={aoMudar} casca={casca} />;
}

function Conteudo({ cobranca, podeAlterar, abrirEmBaixa, mostrarFicha, querLink, recebimento, lembretes, aoFechar, aoMudar, casca }: {
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
  casca: CascaDoDetalhe;
}) {
  const { avisar } = useAviso();
  const { pode } = useSessao();
  const { cores } = useTema();
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
  /** O mesmo para o id da cobrança. */
  const [idParaCopiarAMao, setIdParaCopiarAMao] = useState(false);
  /** "Renegociar" abre o passo a passo; "Cancelar" volta ao detalhe. */
  const [renegociando, setRenegociando] = useState(false);

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

  const copiarId = () => {
    void copiarTexto(cobranca.id).then((ok) => {
      if (ok) {
        avisar('ID copiado.', 'sucesso');
        return;
      }
      setIdParaCopiarAMao(true);
      avisar('Não foi possível copiar sozinho. Selecione o ID e copie à mão.', 'neutro');
    });
  };

  // Saídas para outra tela passam pela guarda (a ficha pode estar em edição, D7); a casca só fecha se a pessoa sair.
  const { confirmar } = useSaidaGuardada();
  const sairPara = (href: Href) => () => confirmar(() => {
    aoFechar();
    router.push(href);
  });

  const whatsapp = botaoDoWhatsApp(lembretes);
  // Abre fora do app, sem token; nada é registrado como enviado (é a equipe quem manda a mensagem).
  const abrirWhatsApp = () => {
    if (!whatsapp?.link) return;
    Linking.openURL(whatsapp.link).catch(() => avisar('Não foi possível abrir o WhatsApp.', 'perigo'));
  };

  const perguntar = (p: Exclude<Pergunta, null>) => { setMotivo(''); setErro(null); setUltimaPergunta(p); setPergunta(p); };

  const renegociar = <FolhaRenegociar cobrancas={[cobranca]} aoFechar={aoFechar} aoCancelar={() => setRenegociando(false)} aoMudar={aoMudar} />;
  if (renegociando && !casca.renegociarPorCima) return renegociar;

  const doTipo = seloDoTipoDaCobranca(cobranca.tipo);
  // A mensalidade pelo mês; a saída e a avulsa pelo tipo (a origem diz o resto, logo abaixo do nome).
  const titulo = modo === 'baixa' ? 'Registrar pagamento' : doTipo ? rotuloDoTipoDaCobranca(cobranca.tipo) : `Cobrança de ${rotuloDoMesNumerico(cobranca.competencia)}`;
  const cpf = cpfMascarado(cobranca.alunoCpf);
  const nome = cobranca.alunoNome ?? '—';
  const prazo = prazoDaCobranca(cobranca, hoje);
  const corDoPrazo: Record<TomDoPrazo, string> = { suave: cores.textoSuave, atencao: cores.atencao, perigo: cores.perigo, sucesso: cores.sucesso };
  const emAberto = cobranca.situacao === 'ABERTA';
  const Casca = casca.Componente;

  // Ordem de todo rodapé: o que destrói primeiro, os secundários e a ação principal por último (a casca arranja).
  const acoes: { principal: AcaoDoRodape | null; secundarias: (AcaoDoRodape | false)[] } = modo === 'baixa' ? {
    principal: { chave: 'registrar', rotulo: 'Registrar pagamento', aoTocar: registrar, carregando: enviando },
    secundarias: [{ chave: 'voltar', rotulo: 'Voltar', tipo: 'secundario', aoTocar: () => (abrirEmBaixa ? aoFechar() : setModo('detalhe')), desabilitado: enviando }],
  } : podeAlterar ? {
    principal: podeRegistrarPagamento(cobranca) ? { chave: 'baixa', rotulo: 'Registrar pagamento', aoTocar: () => setModo('baixa') } : null,
    secundarias: [
      podeCancelarCobranca(cobranca) && { chave: 'cancelar', rotulo: 'Cancelar cobrança', tipo: 'perigoTexto', aoTocar: () => perguntar('cancelar') },
      podeMarcarEstorno(cobranca) && { chave: 'estornar', rotulo: 'Marcar estorno', tipo: 'perigoTexto', aoTocar: () => perguntar('estornar') },
      podeDesfazerBaixa(cobranca) && { chave: 'desfazer', rotulo: 'Desfazer baixa', tipo: 'secundario', aoTocar: () => perguntar('desfazer') },
      podeMarcarContestacao(cobranca) && { chave: 'contestar', rotulo: 'Marcar contestação', tipo: 'secundario', aoTocar: () => perguntar('contestar') },
      podeManterPaga(cobranca) && { chave: 'manterPaga', rotulo: 'Manter como paga', tipo: 'secundario', aoTocar: () => perguntar('manterPaga') },
      podeDesfazerAcordo(cobranca) && { chave: 'desfazerAcordo', rotulo: 'Desfazer acordo', tipo: 'secundario', aoTocar: () => perguntar('desfazerAcordo') },
      podeRenegociar(cobranca) && {
        chave: 'renegociar', rotulo: 'Renegociar', tipo: 'secundario', aoTocar: () => setRenegociando(true),
        desabilitado: !!motivoDeRenegociarDesabilitado(cobranca), motivo: motivoDeRenegociarDesabilitado(cobranca) ?? undefined,
      },
    ],
  } : { principal: null, secundarias: [] };
  const secundarias = acoes.secundarias.filter((a): a is AcaoDoRodape => !!a);
  const rodape = acoes.principal || secundarias.length > 0
    ? <RodapeDoDetalhe principal={acoes.principal} secundarias={secundarias} emDuasLinhas={casca.rodapeEmDuasLinhas} />
    : undefined;

  const dataInvalida = tentou && (!iso || iso > hoje) ? erroDaBaixa : null;
  const temHistorico = !!lembretes && (lembretes.itens.length > 0 || lembretes.alunoDesligou);
  const comLink = querLink && recebimento && podeCopiarLink(cobranca, recebimento.configurado);
  const semConfigurar = querLink && recebimento && !recebimento.configurado;
  const kiwify = emAberto && ehCobradaPelaKiwify(cobranca);
  const cobrar = emAberto && (comLink || semConfigurar || kiwify || whatsapp || lembretes?.paraResponsavel || temHistorico);

  return (
    <>
      <Casca titulo={titulo} aoFechar={aoFechar} rodape={rodape}>
        <View style={estilos.coluna}>
          {/* Quem, de onde e a situação, num bloco só: o resto são os detalhes, em grupos. */}
          <View style={estilos.topo}>
            <View style={estilos.quem}>
              {mostrarFicha ? (
                <Pressable accessibilityRole="link" accessibilityLabel={`Abrir ficha de ${nome}`} style={estilos.alvoDoLink}
                  {...propsDeLink(`/treinador/alunos/${cobranca.alunoId}?aba=ficha`, sairPara(`/treinador/alunos/${cobranca.alunoId}?aba=ficha`))}>
                  <Texto variante="bloco" style={estilos.sublinhado}>{nome}</Texto>
                </Pressable>
              ) : <Texto variante="bloco">{nome}</Texto>}
              {/* CPF só quando a API manda (com `ALUNO_SENSIVEL_LER`), e só o meio dele. */}
              {cpf ? <Texto variante="suave" numerico accessibilityLabel={`CPF ${cpf}`}>CPF {cpf}</Texto> : null}
              <Texto variante="suave">{origemDaCobranca(cobranca)}{modo === 'baixa' && !temDescricaoPropria(cobranca.tipo) ? ` · ${referenciaDaCobranca(cobranca)}` : ''}</Texto>
            </View>
            <View style={estilos.selos}>
              <Selo texto={seloDaCobranca(cobranca).rotulo} tipo={seloDaCobranca(cobranca).tom} />
              {cobranca.situacao === 'PAGA' && ehPagamentoOnline(cobranca) ? <Selo texto={ROTULO_ONLINE} tipo="neutro" /> : null}
              {ehCobradaPelaKiwify(cobranca) ? <Selo texto={TEXTO_COBRADA_PELA_KIWIFY} tipo="neutro" /> : null}
            </View>
          </View>
          <View style={estilos.valor}>
            <Texto variante="destaque" numerico accessibilityLabel={`Valor: ${centavosParaTela(cobranca.valorCentavos)}`}>{centavosParaTela(cobranca.valorCentavos)}</Texto>
            {/* A cor acompanha o selo (texto, nunca só a cor); a data exata fica nas Datas. */}
            {prazo ? <Texto cor={corDoPrazo[prazo.tom]} style={prazo.tom === 'suave' ? null : estilos.forte}>{prazo.texto}</Texto> : null}
          </View>
          {modo === 'detalhe' ? (
            <>
              <Grupo titulo="Datas">
                <DatasDaCobranca cobranca={cobranca} />
              </Grupo>
              {cobrar ? (
                <Grupo titulo="Cobrar o aluno">
                  {kiwify ? <Texto variante="suave">{DETALHE_COBRADA_PELA_KIWIFY}</Texto> : null}
                  {comLink ? (
                    <LinhaDeAcoes><Botao rotulo="Copiar link de pagamento" tipo="secundario" Icone={Copy} carregando={copiando} aoTocar={copiarLink} /></LinhaDeAcoes>
                  ) : null}
                  {semConfigurar ? (
                    <Texto variante="suave">
                      {TEXTO_CONFIGURE_PARA_O_LINK}{' '}
                      <LinkNaFrase texto="Configurar" rotulo="Configurar o recebimento online"
                        href="/treinador/financeiro?aba=recebimento" aoAbrir={sairPara({ pathname: '/treinador/financeiro', params: { aba: 'recebimento' } })} />
                    </Texto>
                  ) : null}
                  {linkParaCopiarAMao ? (
                    // A cópia foi recusada: o link fica aqui, com rótulo, para selecionar e copiar à mão.
                    <View style={estilos.aMao}>
                      <Texto variante="rotulo">Link de pagamento para copiar</Texto>
                      <Texto selectable>{linkParaCopiarAMao}</Texto>
                    </View>
                  ) : null}
                  {whatsapp ? (
                    <View style={estilos.linhaComLink}>
                      {/* O motivo fica ao lado do botão, uma vez (P5): por isso não vai também no `motivo` do botão. */}
                      <Botao rotulo="Enviar pelo WhatsApp" rotuloAcessivel="Enviar pelo WhatsApp: abrir WhatsApp com a mensagem" tipo="secundario"
                        Icone={iconeWhatsApp(!!whatsapp.link)} aoTocar={abrirWhatsApp} desabilitado={!whatsapp.link} />
                      {whatsapp.link ? <Texto variante="suave" style={estilos.encolher}>Abre o WhatsApp com o lembrete pronto; quem envia é você.</Texto> : null}
                      {whatsapp.motivo ? (
                        <Texto variante="suave" style={estilos.encolher}>
                          {whatsapp.motivo}
                          {whatsapp.motivo === MOTIVO_SEM_TELEFONE && pode('ALUNO_ALTERAR') ? (
                            <>
                              {' '}
                              <LinkNaFrase texto="Adicionar telefone" rotulo={`Adicionar telefone de ${nome}`}
                                href={`/treinador/alunos/${cobranca.alunoId}?editar=1`} aoAbrir={sairPara(`/treinador/alunos/${cobranca.alunoId}?editar=1`)} />
                            </>
                          ) : null}
                        </Texto>
                      ) : null}
                    </View>
                  ) : null}
                  {lembretes && (lembretes.paraResponsavel || temHistorico) ? (
                    <View style={estilos.lembretes}>
                      <Texto variante="rotulo" nivel={3}>Lembretes por e-mail</Texto>
                      <ParaQuemVaoOsLembretes lembretes={lembretes} />
                      {temHistorico ? <HistoricoDosLembretes lembretes={lembretes} /> : null}
                    </View>
                  ) : null}
                </Grupo>
              ) : null}
              {temBaixaRegistrada(cobranca) ? (
                // A data e (na paga) a forma já estão no prazo e nas Datas; aqui fica quem deu a baixa e o provedor.
                <Grupo titulo="Pagamento">
                  <CamposEmLinha>
                    {cobranca.situacao === 'PAGA' ? null : <CampoLeitura rotulo="Forma" valor={rotuloDaForma(cobranca.forma)} />}
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
              {/* Fora do aberto não há o que cobrar, mas o histórico dos lembretes que saíram continua à vista. */}
              {!cobrar && lembretes && temHistorico ? (
                <Grupo titulo="Lembretes por e-mail">
                  <ParaQuemVaoOsLembretes lembretes={lembretes} />
                  <HistoricoDosLembretes lembretes={lembretes} />
                </Grupo>
              ) : null}
              <Divisor />
              {/* O id encurtado; o inteiro vai na cópia e no leitor de tela, para conferir com quem pergunta pela cobrança. */}
              <View style={estilos.id}>
                <Texto variante="pequeno" numerico accessibilityLabel={`ID da cobrança: ${cobranca.id}`}>ID {idEncurtado(cobranca.id)}</Texto>
                <IconeBotao Icone={Copy} rotulo="Copiar ID da cobrança" aoTocar={copiarId} compacto />
              </View>
              {idParaCopiarAMao ? <Texto variante="pequeno" numerico selectable>{cobranca.id}</Texto> : null}
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
      </Casca>
      {renegociando ? renegociar : null}
    </>
  );
}

/** Cada data com 96 px cabe "05/10/2026" e "COMPETÊNCIA"; quatro numa linha pedem isto de largura (painel de 480, folha de 600). */
const MINIMO_DA_DATA = 96;
const QUATRO_DATAS = 4 * MINIMO_DA_DATA + 3 * espaco(2);
/** Abaixo das quatro, duas por linha (celular): o mínimo maior impede a fileira de 3 + 1. */
const MINIMO_DE_DUAS = 140;

/** Competência | Vencimento | Emissão | Pagamento, numa linha onde cabem as quatro; senão duas por linha. "—" sem a data. */
function DatasDaCobranca({ cobranca }: { cobranca: CobrancaResponse }) {
  const { fatorTexto } = useTema();
  const { largura, aoMedir } = useFaixaDeLargura();
  const quatro = largura >= escalar(QUATRO_DATAS, fatorTexto);
  return (
    <View onLayout={aoMedir}>
      <CamposEmLinha minimo={escalar(quatro ? MINIMO_DA_DATA : MINIMO_DE_DUAS, fatorTexto)}>
        {/* A avulsa e a parcela do acordo não têm competência: "—". */}
        <CampoLeitura rotulo="Competência" valor={cobranca.competencia ? rotuloDoMesNumerico(cobranca.competencia) : null} numerico />
        <CampoLeitura rotulo="Vencimento" valor={dataParaTela(cobranca.vencimento)} numerico />
        <CampoLeitura rotulo="Emissão" valor={dataParaTela(emissaoDaCobranca(cobranca))} numerico />
        <CampoLeitura rotulo="Pagamento" valor={temBaixaRegistrada(cobranca) ? dataParaTela(cobranca.pagoEm) : null} numerico />
      </CamposEmLinha>
    </View>
  );
}

/** Logo abaixo do título "Lembretes por e-mail". D15: sem o nome do responsável e sem prometer os dois canais. */
function ParaQuemVaoOsLembretes({ lembretes }: { lembretes: LembretesDaCobranca }) {
  return lembretes.paraResponsavel ? <Texto variante="suave">{LINHA_DOS_LEMBRETES}</Texto> : null;
}

/**
 * Lembretes por e-mail desta cobrança, numa lista compacta: o tipo e a data à esquerda, o selo da situação à direita. O
 * título fica com quem chama (subtítulo no bloco "Cobrar o aluno", título do grupo fora do aberto).
 */
function HistoricoDosLembretes({ lembretes }: { lembretes: LembretesDaCobranca }) {
  return (
    <View style={estilos.lembretes}>
      {lembretes.alunoDesligou ? <Texto variante="suave">O aluno desligou os lembretes por e-mail</Texto> : null}
      {lembretes.itens.map((l) => {
        const s = situacaoDoLembrete(l);
        return (
          <View key={l.id} style={estilos.lembrete}>
            <View style={estilos.quem}>
              <Texto>{rotuloDoTipo(l.tipo)}</Texto>
              <Texto variante="pequeno">{s.texto}</Texto>
            </View>
            <Selo texto={s.selo} tipo={s.tom} />
          </View>
        );
      })}
    </View>
  );
}

/**
 * Link dentro da frase (o motivo e o caminho na mesma linha) que sai da folha para outra tela: na web é `<a href>`
 * (Ctrl+clique abre outra guia); o clique simples passa pela guarda de saída, fecha a casca e navega (`aoAbrir`). O
 * `LinkTexto` não fecha a folha, por isso este. Link no meio do texto dispensa o alvo de 44 px (WCAG 2.5.8, exceção "inline").
 */
function LinkNaFrase({ texto, rotulo, href, aoAbrir }: { texto: string; rotulo: string; href: Href; aoAbrir: () => void }) {
  const { cores } = useTema();
  return (
    <Texto variante="suave" accessibilityRole="link" accessibilityLabel={rotulo} cor={cores.texto} style={[estilos.sublinhado, estilos.forte]} {...propsDeLink(href, aoAbrir)}>
      {texto}
    </Texto>
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
  aMao: { gap: espaco(0.5) },
  coluna: { gap: espaco(2) },
  grupo: { gap: espaco(1.5) },
  topo: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: espaco(1.5) },
  quem: { flex: 1, gap: 2, minWidth: 0 },
  selos: { alignItems: 'flex-end', gap: espaco(0.5) },
  valor: { gap: espaco(0.25) },
  forte: { fontFamily: fontes.semi },
  sublinhado: { textDecorationLine: 'underline' },
  // O link do nome fica na altura do texto (o alvo de 44 px vem do `minHeight`, sem empurrar o CPF e a origem para longe).
  alvoDoLink: { minHeight: ALVO_TOQUE, justifyContent: 'center', alignSelf: 'flex-start' },
  linhaComLink: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: espaco(1.5), rowGap: espaco(0.5) },
  encolher: { flexShrink: 1 },
  lembretes: { gap: espaco(1) },
  lembrete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1.5) },
  id: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5) },
  duasLinhas: { width: '100%', gap: espaco(1) },
  par: { flexDirection: 'row', gap: espaco(1) },
  // Metade da linha cada (o motivo de uma desabilitada fica sob ela, dentro da mesma metade).
  meiaLargura: { flex: 1, minWidth: 0 },
});
