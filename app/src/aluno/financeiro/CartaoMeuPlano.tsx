import { CreditCard } from 'lucide-react-native';
import { type ReactNode, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import type { CobrancaDoAluno } from '../../api/financeiroTipos';
import { linkDePagamentoDoAluno } from '../../api/rotas';
import {
  informacaoDaCobranca, rotuloDaForma, rotuloDaPeriodicidade, seloDaCobranca, seloDaContratacao, textoDeComoPagar,
  type ComoPagar,
} from '../../dominio/financeiro';
import { centavosParaTela, dataParaTela } from '../../dominio/formatos';
import { rotuloDoMes } from '../../dominio/numeros';
import { espaco, RAIO } from '../../tema/tokens';
import { useTema } from '../../tema/TemaProvider';
import { ICONE_DO_SELO } from '../../treinador/iconesDosSelos';
import { abrirPagamento } from '../../ui/abrirPagamento';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { CampoLeitura } from '../../ui/CampoLeitura';
import { CamposEmLinha } from '../../ui/CamposEmLinha';
import { Cartao } from '../../ui/Cartao';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro } from '../../ui/Estados';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { codigoApi, textoDoErro } from '../../ui/erros';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
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
 * "Meu plano" na Conta do aluno: o plano comercial com o treinador (nome, valor, periodicidade, próximo vencimento), as
 * cobranças em aberto e o histórico. Só online: nada fica guardado no aparelho. Como pagar depende da plataforma, da chave
 * da plataforma e do recebimento online da consultoria (`modoDePagamento`, de `comoPagar`): com o "Pagar" permitido e o
 * recebimento online, cada cobrança em aberto tem o botão "Pagar" (link da InfinitePay, aberto fora do app, sem token);
 * no celular sem a chave da plataforma não há botão, link nem frase mandando pagar: só informação por cobrança
 * (`informacaoDaCobranca`); sem recebimento online o treinador combina a forma e dá a baixa. Não leva observação interna
 * nem quem registrou o pagamento. Aparece só com o módulo de pagamentos ligado para a consultoria.
 */
export function CartaoMeuPlano() {
  const { habilitado, online, dados, erro, carregando, modoDePagamento: modo, recarregar } = useFinanceiroDoAluno();
  const [todas, setTodas] = useState(false);
  useRecarregarFinanceiroAoFocar();
  if (!habilitado) return null;
  if (!online) {
    return (
      <Cartao titulo="Meu plano">
        <Texto variante="suave">Os dados do seu plano aparecem quando você estiver conectado à internet.</Texto>
      </Cartao>
    );
  }
  const historico = dados?.historico ?? [];
  const situacao = dados?.plano ? seloDaContratacao(dados.plano.situacao) : null;
  const vigencia = dados?.plano ? textoDaVigencia(dados.plano.situacao, dados.plano.diasRestantesVigencia) : null;
  const textoDoModo = textoDeComoPagar(modo);
  const visiveis = todas ? historico : historico.slice(0, HISTORICO_VISIVEL);
  return (
    <Cartao titulo="Meu plano" descricao="Seu plano comercial com o seu treinador.">
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
                <CampoLeitura rotulo="Valor" valor={centavosParaTela(dados.plano.valorCentavos)} numerico />
                <CampoLeitura rotulo="Periodicidade" valor={rotuloDaPeriodicidade(dados.plano.periodicidade)} />
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
              {/* O "Pagar" mora dentro da própria cobrança: solto embaixo, parecia de outra. */}
              {dados.abertas.map((c) => (
                <LinhaDaCobranca key={c.id} cobranca={c} modo={modo}>
                  {modo === 'botao' ? <BotaoPagar cobranca={c} aoMudar={recarregar} /> : null}
                </LinhaDaCobranca>
              ))}
              {textoDoModo ? <Texto variante="suave">{textoDoModo}</Texto> : null}
            </View>
          ) : null}
          {historico.length > 0 ? (
            <View style={estilos.bloco}>
              <Texto variante="secao">Histórico</Texto>
              {visiveis.map((c) => <LinhaDaCobranca key={c.id} cobranca={c} modo={modo} />)}
              {historico.length > HISTORICO_VISIVEL && !todas ? (
                <LinhaDeAcoes><Botao rotulo={`Ver todas (${historico.length})`} tipo="fantasma" aoTocar={() => setTodas(true)} /></LinhaDeAcoes>
              ) : null}
            </View>
          ) : null}
          {dados.plano && dados.abertas.length === 0 && historico.length === 0 ? <Texto variante="suave">Ainda não há cobranças.</Texto> : null}
        </>
      ) : null}
      <InterruptorDeLembretes />
    </Cartao>
  );
}

/**
 * "Pagar" (só com o recebimento online e a plataforma liberada): pede o link à API e abre fora do app. Na web a aba é
 * aberta dentro do clique (`abrirPagamento`); o aluno paga lá e, ao voltar, a lista recarrega. A baixa vem do servidor,
 * nunca daqui.
 */
function BotaoPagar({ cobranca, aoMudar }: { cobranca: CobrancaDoAluno; aoMudar: () => void }) {
  const { avisar } = useAviso();
  const [abrindo, setAbrindo] = useState(false);
  // O segundo clique chega antes de a tela redesenhar: sem a trava abriria duas abas e pediria dois links.
  const ocupado = useRef(false);
  const mes = rotuloDoMes(cobranca.competencia);
  const pagar = () => {
    if (ocupado.current) return;
    ocupado.current = true;
    setAbrindo(true);
    abrirPagamento(() => linkDePagamentoDoAluno(cobranca.id))
      .then((resultado) => {
        if (resultado === 'aberta') {
          avisar(Platform.OS === 'web' ? 'Abrimos o pagamento em outra aba. Quando terminar, volte para esta.' : 'Abrimos o pagamento no navegador. Quando terminar, volte para o app.', 'neutro');
        } else if (resultado === 'bloqueada') avisar('O navegador bloqueou a nova aba. Libere os pop-ups deste site e toque em Pagar de novo.', 'atencao');
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
    <Botao rotulo="Pagar" Icone={CreditCard} tipo="secundario" rotuloAcessivel={`Pagar ${mes}, ${centavosParaTela(cobranca.valorCentavos)}`}
      carregando={abrindo} aoTocar={pagar} />
  );
}

/**
 * Uma cobrança: mês e selo na primeira linha; valor e a data que importa na segunda ("R$ 150,00 · Vence em 05/11/2026").
 * Em aberto, o "Pagar" (quando há) vem dentro do mesmo cartão, à direita.
 */
function LinhaDaCobranca({ cobranca, modo, children }: { cobranca: CobrancaDoAluno; modo: ComoPagar; children?: ReactNode }) {
  const { cores } = useTema();
  const selo = seloDaCobranca(cobranca);
  // Celular sem o "Pagar" (`informar`): só a linha de informação; sem ela (cancelada...), o texto de sempre.
  const detalhe = (modo === 'informar' ? informacaoDaCobranca(cobranca) : null) ?? textoDaData(cobranca);
  const mes = rotuloDoMes(cobranca.competencia);
  const valor = centavosParaTela(cobranca.valorCentavos);
  return (
    <View style={[estilos.cobranca, { borderColor: cores.borda, backgroundColor: cores.superficie2 }]}>
      <View accessible accessibilityLabel={`${mes}, ${valor}, ${selo.rotulo}. ${detalhe}`} style={estilos.textos}>
        <View style={estilos.linha}>
          <Texto variante="bloco">{mes}</Texto>
          <Selo texto={selo.rotulo} tipo={selo.tom} Icone={ICONE_DO_SELO[selo.tom]} />
        </View>
        <Texto numerico>{valor}</Texto>
        <Texto variante="suave">{detalhe}</Texto>
      </View>
      {children ? <LinhaDeAcoes alinhar="fim">{children}</LinhaDeAcoes> : null}
    </View>
  );
}

/** A data que importa para a situação: paga (também contestada e estornada, que já tiveram baixa), vencida, cancelada ou a vencer. */
function textoDaData(c: CobrancaDoAluno): string {
  if ((c.situacao === 'PAGA' || c.situacao === 'CONTESTADA' || c.situacao === 'ESTORNADA') && c.pagoEm) {
    return `Pago em ${dataParaTela(c.pagoEm)}${c.forma ? ` · ${rotuloDaForma(c.forma)}` : ''}`;
  }
  if (c.situacao === 'CANCELADA') return `Vencia em ${dataParaTela(c.vencimento)}`;
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
});
