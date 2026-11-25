import * as Clipboard from 'expo-clipboard';
import { Copy, CreditCard, ExternalLink, QrCode } from 'lucide-react-native';
import { type ReactNode, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import type { CobrancaDoAluno } from '../../api/financeiroTipos';
import { codigoPixDoAluno, linkDePagamentoDoAluno } from '../../api/rotas';
import {
  camposDoMeuPlano, informacaoDaCobranca, referenciaDaCobranca, rotuloDaAcaoDePagamento, rotuloDaForma, rotuloDoTipoDaCobranca, seloDaCobranca,
  seloDaContratacao, seloDoTipoNoMeuPlano, textoDasAbertasDoAluno, type AcaoDePagamento, type ComoPagar,
} from '../../dominio/financeiro';
import { centavosParaTela, dataParaTela } from '../../dominio/formatos';
import { TEXTO_COBRANCA_AUTOMATICA } from '../../dominio/kiwify';
import { espaco, RAIO } from '../../tema/tokens';
import { useTema } from '../../tema/TemaProvider';
import { ICONE_DO_SELO } from '../../treinador/iconesDosSelos';
import { abrirPagamento } from '../../ui/abrirPagamento';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { CampoLeitura } from '../../ui/CampoLeitura';
import { CamposEmLinha } from '../../ui/CamposEmLinha';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro } from '../../ui/Estados';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { codigoApi, textoDoErro } from '../../ui/erros';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { BlocoDaConta } from '../conta/SecaoDaConta';
import { FolhaCheckoutTransparente } from './FolhaCheckoutTransparente';
import { InterruptorDeLembretes } from './InterruptorDeLembretes';
import { useFinanceiroDoAluno, useRecarregarFinanceiroAoFocar } from './FinanceiroDoAlunoProvider';

const HISTORICO_VISIVEL = 6;

const dias = (n: number) => `${n} ${n === 1 ? 'dia' : 'dias'}`;

/**
 * Vigência do plano para o aluno, sempre neutra: quem renova é o treinador, o aluno espera (seção 4.5). Encerrado não
 * mostra vigência.
 */
function textoDaVigencia(situacao: string, restantes: number | null | undefined): string | null {
  if (restantes == null || situacao === 'ENCERRADA') return null;
  if (restantes < 0) return `Vigência terminou há ${dias(-restantes)}`;
  // shortcut: os 40 dias da janela de renovação repetem a API (`alertaRenovacao`), trocar quando o `PlanoDoAluno` da API o trouxer (hoje nem a vigência chega ao aluno, então este selo não aparece).
  if (restantes <= 40) return restantes === 0 ? 'Renovação hoje' : `Renovação em ${dias(restantes)}`;
  return `Vigente · ${dias(restantes)} restantes`;
}

/**
 * "Meu plano" na Conta do aluno: o plano comercial com o treinador (nome, valor, periodicidade, próximo vencimento; no
 * contrato fechado, "Valor do contrato" sem periodicidade e as cobranças pela descrição, sem selo de tipo nem saldo), as
 * cobranças em aberto e o histórico. Só online: nada fica guardado no aparelho. Como pagar depende da plataforma, da chave
 * da plataforma e das formas de recebimento ligadas (`acoesDaCobranca`, de `acoesDePagamentoDoAluno`): com o "Pagar" permitido,
 * cada cobrança em aberto tem as suas ações (InfinitePay, link do treinador e "Copiar código Pix"), abertas fora do app e sem
 * token; no celular sem a chave da plataforma não há botão, link, Pix nem frase mandando pagar: só informação por cobrança
 * (`informacaoDaCobranca`); só com o Manual o treinador combina a forma e dá a baixa. Não leva observação interna
 * nem quem registrou o pagamento. Aparece só com o módulo de pagamentos ligado para a consultoria. Desde 23/11 é o conteúdo
 * da seção "Meu plano" da Conta (o título é da seção; o bloco fica visível, sem abrir).
 */
export function CartaoMeuPlano() {
  const {
    habilitado,
    online,
    dados,
    erro,
    carregando,
    modoDePagamento: modo,
    modoDaCobranca,
    acoesDaCobranca,
    overtrainingPayMaxParcelas,
    overtrainingPayJuros,
    cpfPagadorCadastrado,
    recarregar,
  } = useFinanceiroDoAluno();
  const [todas, setTodas] = useState(false);
  const [cobrancaCheckout, setCobrancaCheckout] = useState<CobrancaDoAluno | null>(null);
  useRecarregarFinanceiroAoFocar();
  if (!habilitado) return null;
  if (!online) {
    return (
      <BlocoDaConta>
        <Texto variante="suave">Os dados do seu plano aparecem quando você estiver conectado à internet.</Texto>
      </BlocoDaConta>
    );
  }
  const historico = dados?.historico ?? [];
  const situacao = dados?.plano ? seloDaContratacao(dados.plano.situacao) : null;
  const vigencia = dados?.plano ? textoDaVigencia(dados.plano.situacao, dados.plano.diasRestantesVigencia) : null;
  const campos = dados?.plano ? camposDoMeuPlano(dados.plano) : null;
  const textoDoModo = textoDasAbertasDoAluno(modo, (dados?.abertas ?? []).map((c) => modoDaCobranca(c)));
  const visiveis = todas ? historico : historico.slice(0, HISTORICO_VISIVEL);
  // O nome da ação vem de todas as cobranças do cartão: a avulsa (sem o link do plano) não vira "Pagar" ao lado de uma
  // mensalidade com "Pagar pela InfinitePay"; a mesma ação tem o mesmo nome no cartão inteiro.
  const acoesDoCartao = [...new Set((dados?.abertas ?? []).flatMap((c) => acoesDaCobranca(c)))];
  return (
    <BlocoDaConta>
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {!dados && carregando ? <Esqueleto /> : null}
      {dados ? (
        <>
          {dados.plano ? (
            <View style={estilos.bloco}>
              <View style={estilos.linha}>
                <Texto variante="bloco" style={estilos.nome}>{dados.plano.planoNome ?? 'Plano'}</Texto>
                <View style={estilos.selos}>
                  {situacao ? <Selo texto={situacao.rotulo} tipo={situacao.tom} Icone={ICONE_DO_SELO[situacao.tom]} /> : null}
                  {vigencia ? <Selo texto={vigencia} tipo="neutro" Icone={ICONE_DO_SELO.neutro} /> : null}
                </View>
              </View>
              <CamposEmLinha minimo={110}>
                <CampoLeitura rotulo={campos?.rotuloDoValor ?? 'Valor'} valor={centavosParaTela(dados.plano.valorCentavos)} numerico />
                {campos?.periodicidade ? <CampoLeitura rotulo="Periodicidade" valor={campos.periodicidade} /> : null}
                <CampoLeitura rotulo="Próximo vencimento" valor={dados.plano.proximoVencimento ? dataParaTela(dados.plano.proximoVencimento) : null} numerico />
                {dados.plano.terminoVigencia ? (
                  <CampoLeitura rotulo="Término da vigência" valor={dataParaTela(dados.plano.terminoVigencia)} numerico />
                ) : null}
              </CamposEmLinha>
            </View>
          ) : (
            <Texto variante="suave">Você ainda não tem um plano comercial contratado com o seu treinador.</Texto>
          )}
          {dados.abertas.length > 0 ? (
            <View style={estilos.bloco}>
              <Texto variante="secao">Em aberto</Texto>
              {/* As ações moram dentro da própria cobrança: soltas embaixo, pareciam de outra. */}
              {dados.abertas.map((c) => {
                const acoes = acoesDaCobranca(c);
                return (
                  <LinhaDaCobranca key={c.id} cobranca={c} modo={modoDaCobranca(c)} empilhar={acoes.length > 1 || acoes.includes('COPIAR_PIX')}>
                    {acoes.length > 0 ? (
                      <AcoesDaCobranca
                        cobranca={c}
                        acoes={acoes}
                        doCartao={acoesDoCartao}
                        linkProprio={dados.plano?.linkDePagamento ?? null}
                        aoMudar={recarregar}
                        aoAbrirCheckout={setCobrancaCheckout}
                      />
                    ) : null}
                  </LinhaDaCobranca>
                );
              })}
              {textoDoModo ? <Texto variante="suave">{textoDoModo}</Texto> : null}
            </View>
          ) : null}
          {historico.length > 0 ? (
            <View style={estilos.bloco}>
              <Texto variante="secao">Histórico</Texto>
              {visiveis.map((c) => <LinhaDaCobranca key={c.id} cobranca={c} modo={modoDaCobranca(c)} />)}
              {historico.length > HISTORICO_VISIVEL && !todas ? (
                <LinhaDeAcoes><Botao rotulo={`Ver todas (${historico.length})`} tipo="fantasma" aoTocar={() => setTodas(true)} /></LinhaDeAcoes>
              ) : null}
            </View>
          ) : null}
          {dados.plano && dados.abertas.length === 0 && historico.length === 0 ? <Texto variante="suave">Ainda não há cobranças.</Texto> : null}
        </>
      ) : null}
      <InterruptorDeLembretes />
      <FolhaCheckoutTransparente
        cobranca={cobrancaCheckout}
        maxParcelas={overtrainingPayMaxParcelas}
        juros={overtrainingPayJuros}
        cpfPagadorCadastrado={cpfPagadorCadastrado}
        aoFechar={() => setCobrancaCheckout(null)}
        aoConfirmarPagamento={recarregar}
      />
    </BlocoDaConta>
  );
}

const ICONE_DA_ACAO = {
  PAGAR_OVERTRAINING_PAY: QrCode,
  PAGAR_INFINITEPAY: CreditCard,
  PAGAR_LINK_PROPRIO: ExternalLink,
  COPIAR_PIX: Copy,
} as const;

/**
 * As ações de pagamento de uma cobrança em aberto, na ordem de `acoesDePagamentoDoAluno` (só existem com o "Pagar" permitido
 * nesta plataforma). Dois "Pagar" no cartão ganham o nome de cada um (`rotuloDaAcaoDePagamento` com as ações do cartão
 * inteiro, `doCartao`). Se o navegador recusar a cópia do Pix, o código aparece aqui, selecionável, enquanto a tela estiver
 * aberta (nunca é guardado).
 */
function AcoesDaCobranca({ cobranca, acoes, doCartao, linkProprio, aoMudar, aoAbrirCheckout }: {
  cobranca: CobrancaDoAluno;
  acoes: readonly AcaoDePagamento[];
  /** As ações de todas as cobranças em aberto do cartão: decidem o nome de cada uma. */
  doCartao: readonly AcaoDePagamento[];
  linkProprio: string | null;
  aoMudar: () => void;
  aoAbrirCheckout: (c: CobrancaDoAluno) => void;
}) {
  const { cores } = useTema();
  const [codigoAMao, setCodigoAMao] = useState<string | null>(null);
  // Com mais de uma ação a fileira fica embaixo do texto, em coluna e com os botões da mesma largura, no celular e no PC
  // (em linha, no PC, eles quebravam em escadinha de larguras diferentes alinhadas à direita).
  const cheio = acoes.length > 1;
  const mes = referenciaDaCobranca(cobranca);
  return (
    <>
      <LinhaDeAcoes alinhar={cheio ? 'inicio' : 'fim'} style={cheio ? estilos.emColuna : undefined}>
        {acoes.map((acao) => {
          const rotulo = rotuloDaAcaoDePagamento(acao, doCartao);
          if (acao === 'PAGAR_OVERTRAINING_PAY') {
            return (
              <Botao
                key={acao}
                rotulo={rotulo}
                Icone={ICONE_DA_ACAO[acao]}
                tipo="secundario"
                rotuloAcessivel={`${rotulo}: ${mes}, ${centavosParaTela(cobranca.valorCentavos)}`}
                cheio={cheio}
                style={cheio ? estilos.botaoCheio : undefined}
                aoTocar={() => aoAbrirCheckout(cobranca)}
              />
            );
          }
          if (acao === 'COPIAR_PIX') {
            return (
              <BotaoCopiarPix
                key={acao}
                cobranca={cobranca}
                rotulo={rotulo}
                cheio={cheio}
                aoMudar={aoMudar}
                aoRecusarCopia={setCodigoAMao}
              />
            );
          }
          return (
            <BotaoPagar
              key={acao}
              cobranca={cobranca}
              acao={acao}
              rotulo={rotulo}
              cheio={cheio}
              linkProprio={linkProprio}
              aoMudar={aoMudar}
            />
          );
        })}
      </LinhaDeAcoes>
      {codigoAMao ? (
        <View style={[estilos.codigo, { borderColor: cores.divisor, backgroundColor: cores.superficie }]}>
          <Texto variante="rotulo">Código Pix copia e cola</Texto>
          <Texto selectable>{codigoAMao}</Texto>
          <Texto variante="pequeno">Selecione o código, copie e cole no app do seu banco, em Pix copia e cola.</Texto>
        </View>
      ) : null}
    </>
  );
}

/**
 * "Pagar" pela InfinitePay (pede o link à API) ou pelo link de pagamento do treinador (o do plano, sem passar pela API): abre
 * fora do app e sem token (`abrirPagamento` confere o https). Na web a aba é aberta dentro do clique; o aluno paga lá e, ao
 * voltar, a lista recarrega. A baixa nunca vem daqui: a da InfinitePay vem do servidor, a do link próprio é do treinador.
 */
function BotaoPagar({ cobranca, acao, rotulo, cheio, linkProprio, aoMudar }: {
  cobranca: CobrancaDoAluno;
  acao: Exclude<AcaoDePagamento, 'COPIAR_PIX' | 'PAGAR_OVERTRAINING_PAY'>;
  rotulo: string;
  cheio: boolean;
  linkProprio: string | null;
  aoMudar: () => void;
}) {
  const { avisar } = useAviso();
  const [abrindo, setAbrindo] = useState(false);
  // O segundo clique chega antes de a tela redesenhar: sem a trava abriria duas abas e pediria dois links.
  const ocupado = useRef(false);
  const mes = referenciaDaCobranca(cobranca);
  const pagar = () => {
    if (ocupado.current) return;
    ocupado.current = true;
    setAbrindo(true);
    const buscar = acao === 'PAGAR_LINK_PROPRIO'
      ? () => Promise.resolve({ url: linkProprio ?? '' })
      : () => linkDePagamentoDoAluno(cobranca.id);
    abrirPagamento(buscar)
      .then((resultado) => {
        if (resultado === 'aberta') {
          avisar(Platform.OS === 'web' ? 'Abrimos o pagamento em outra aba. Quando terminar, volte para esta.' : 'Abrimos o pagamento no navegador. Quando terminar, volte para o app.', 'neutro');
        } else if (resultado === 'bloqueada') avisar(`O navegador bloqueou a nova aba. Libere os pop-ups deste site e toque em ${rotulo} de novo.`, 'atencao');
        else avisar('Não foi possível abrir o pagamento. Tente de novo ou fale com o seu treinador.', 'perigo');
      })
      .catch((erro: unknown) => {
        avisar(textoDoErro(erro), 'perigo');
        // Cobrança que deixou de estar aberta (paga ou cancelada em outro lugar): a lista confere de novo.
        if (codigoApi(erro) === 'COBRANCA_NAO_ABERTA') aoMudar();
      })
      .finally(() => {
        ocupado.current = false;
        setAbrindo(false);
      });
  };
  return (
    <Botao rotulo={rotulo} Icone={ICONE_DA_ACAO[acao]} tipo="secundario" rotuloAcessivel={`${rotulo}: ${mes}, ${centavosParaTela(cobranca.valorCentavos)}`}
      cheio={cheio} style={cheio ? estilos.botaoCheio : undefined} carregando={abrindo} aoTocar={pagar} />
  );
}

/**
 * "Copiar código Pix": pede o código ao servidor (valor e identificador são da cobrança, lá) e o põe na área de transferência.
 * O código leva a chave Pix do treinador: não fica em estado além do texto de reserva, nem em log ou no aparelho. Se a cópia
 * for recusada (Safari depois de uma espera), o código aparece para copiar à mão. Pix desligado (409 `PIX_INDISPONIVEL`),
 * cobrança que deixou de estar aberta ou não encontrada: a mensagem e a lista confere de novo.
 */
function BotaoCopiarPix({ cobranca, rotulo, cheio, aoMudar, aoRecusarCopia }: {
  cobranca: CobrancaDoAluno;
  rotulo: string;
  cheio: boolean;
  aoMudar: () => void;
  aoRecusarCopia: (codigo: string | null) => void;
}) {
  const { avisar } = useAviso();
  const [copiando, setCopiando] = useState(false);
  const ocupado = useRef(false);
  const mes = referenciaDaCobranca(cobranca);
  const copiar = () => {
    if (ocupado.current) return;
    ocupado.current = true;
    setCopiando(true);
    aoRecusarCopia(null);
    codigoPixDoAluno(cobranca.id)
      .then(({ codigo }) => {
        const recusada = () => {
          aoRecusarCopia(codigo);
          avisar('Não foi possível copiar sozinho. Selecione o código abaixo e copie à mão.', 'neutro');
        };
        // Na web o `setStringAsync` não rejeita quando o navegador recusa: resolve `false` (cópia antiga que falhou).
        return Clipboard.setStringAsync(codigo).then(
          (ok) => (ok === false ? recusada() : avisar('Código Pix copiado. No app do seu banco, escolha Pix copia e cola e cole o código.', 'sucesso')),
          recusada,
        );
      })
      .catch((erro: unknown) => {
        const codigo = codigoApi(erro);
        avisar(codigo === 'PIX_INDISPONIVEL' ? 'O Pix não está disponível para esta cobrança agora. Fale com o seu treinador.' : textoDoErro(erro), 'perigo');
        if (codigo === 'PIX_INDISPONIVEL' || codigo === 'COBRANCA_NAO_ABERTA' || codigo === 'NAO_ENCONTRADO') aoMudar();
      })
      .finally(() => {
        ocupado.current = false;
        setCopiando(false);
      });
  };
  return (
    <Botao rotulo={rotulo} Icone={Copy} tipo="secundario" rotuloAcessivel={`${rotulo}: ${mes}, ${centavosParaTela(cobranca.valorCentavos)}`}
      cheio={cheio} style={cheio ? estilos.botaoCheio : undefined} carregando={copiando} aoTocar={copiar} />
  );
}

/**
 * Uma cobrança: mês (na avulsa, a descrição) e selo na primeira linha; valor e a data que importa na segunda ("R$ 150,00 · Vence em 05/11/2026").
 * Em aberto, o "Pagar" (quando há) vem dentro do mesmo cartão, à direita.
 */
function LinhaDaCobranca({ cobranca, modo, empilhar, children }: {
  cobranca: CobrancaDoAluno;
  modo: ComoPagar;
  /** Várias ações (ou o Pix, que pode mostrar o código embaixo): as ações vão numa linha só delas, abaixo do texto. */
  empilhar?: boolean;
  children?: ReactNode;
}) {
  const { cores } = useTema();
  const selo = seloDaCobranca(cobranca);
  // Celular sem o "Pagar" (`informar`): só a linha de informação; sem ela (cancelada...), o texto de sempre. A cobrada pela
  // Kiwify em aberto diz só quem cobra e a data, em qualquer plataforma (D18): nada de forma, link nem frase de pagamento.
  const detalhe = modo === 'automatica' && cobranca.situacao === 'ABERTA'
    ? `${TEXTO_COBRANCA_AUTOMATICA} · ${textoDaData(cobranca)}`
    : (modo === 'informar' ? informacaoDaCobranca(cobranca) : null) ?? textoDaData(cobranca);
  const doTipo = seloDoTipoNoMeuPlano(cobranca);
  const mes = referenciaDaCobranca(cobranca);
  const valor = centavosParaTela(cobranca.valorCentavos);
  return (
    <View style={[estilos.cobranca, empilhar && estilos.cobrancaEmColuna, { borderColor: cores.divisor, backgroundColor: cores.superficie2 }]}>
      <View accessible accessibilityLabel={`${doTipo ? `${rotuloDoTipoDaCobranca(cobranca.tipo)}, ` : ''}${mes}, ${valor}, ${selo.rotulo}. ${detalhe}`}
        style={[estilos.textos, empilhar && estilos.textosEmColuna]}>
        <View style={estilos.linha}>
          <Texto variante="bloco">{mes}</Texto>
          <View style={estilos.selos}>
            {doTipo ? <Selo texto={doTipo.rotulo} tipo={doTipo.tom} /> : null}
            <Selo texto={selo.rotulo} tipo={selo.tom} Icone={ICONE_DO_SELO[selo.tom]} />
          </View>
        </View>
        <Texto numerico>{valor}</Texto>
        <Texto variante="suave">{detalhe}</Texto>
      </View>
      {children}
    </View>
  );
}

/** A data que importa para a situação: paga (também contestada e estornada, que já tiveram baixa), vencida, cancelada ou a vencer. */
function textoDaData(c: CobrancaDoAluno): string {
  if ((c.situacao === 'PAGA' || c.situacao === 'CONTESTADA' || c.situacao === 'ESTORNADA') && c.pagoEm) {
    return `Pago em ${dataParaTela(c.pagoEm)}${c.forma ? ` · ${rotuloDaForma(c.forma)}` : ''}`;
  }
  if (c.situacao === 'CANCELADA') return `Vencia em ${dataParaTela(c.vencimento)}`;
  // Entrou num acordo (D14): só informa, sem frase de pagamento (regra das lojas); as parcelas aparecem com o selo "Acordo".
  if (c.situacao === 'RENEGOCIADA') return `Vencia em ${dataParaTela(c.vencimento)} · entrou num acordo de renegociação`;
  return `${c.situacao === 'ABERTA' && c.vencida ? 'Venceu' : 'Vence'} em ${dataParaTela(c.vencimento)}`;
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(1) },
  linha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1) },
  nome: { flexShrink: 1 },
  selos: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: espaco(0.5) },
  // Texto e "Pagar" lado a lado quando cabem (PC), o botão embaixo e à direita quando não (celular).
  cobranca: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), gap: espaco(1), flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'flex-end' },
  textos: { gap: espaco(0.25), flexGrow: 1, flexShrink: 1, flexBasis: 240 },
  // O código de reserva ocupa a linha toda, abaixo dos botões (o texto do React Native quebra a sequência longa sozinho).
  // Empilhada: texto em cima e as ações embaixo, cada um na largura toda (sem porcentagem: a coluna estica os filhos).
  cobrancaEmColuna: { flexDirection: 'column', flexWrap: 'nowrap', alignItems: 'stretch' },
  textosEmColuna: { flexBasis: 'auto' },
  emColuna: { flexDirection: 'column', alignItems: 'stretch' },
  // O `<button>` da web não estica só com `alignSelf: 'stretch'` (medido em 390 px): a largura vai explícita.
  botaoCheio: { width: '100%' },
  codigo: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), gap: espaco(0.5) },
});
