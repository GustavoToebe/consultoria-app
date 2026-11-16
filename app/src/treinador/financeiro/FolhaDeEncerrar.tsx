import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ContratacaoResponse, OpcaoDeSaida } from '../../api/financeiroTipos';
import { encerrarContratacao, previaDoEncerramento } from '../../api/rotas';
import { hojeEmBrasilia } from '../../dominio/financeiro';
import { dataParaTela } from '../../dominio/formatos';
import {
  avisoDeLinkVivo, corpoDoEncerrar, type ErrosDoEncerrar, fraseDasAbertasQueContinuam, linhasDaConta, MENSAGEM_VALOR_DA_SAIDA_MUDOU,
  OPCAO_INICIAL_DO_ENCERRAR, opcoesDoPainel, textoDosMesesQueFaltam, traduzirErroDoEncerrar,
} from '../../dominio/saidaDoPlano';
import { espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { CampoLeitura } from '../../ui/CampoLeitura';
import { CampoData } from '../../ui/Campos';
import { Escolha } from '../../ui/Escolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { Alerta, MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { CampoMoeda } from './comum';

/**
 * Encerrar a contratação com a cobrança de saída opcional (P1: folha com rodapé, sem confirmação empilhada). Tudo o que
 * é dinheiro vem da prévia da API (`previaDoEncerramento`); a tela só escolhe a opção, digita o "Outro valor" e o
 * vencimento, e o servidor confere de novo (409 `VALOR_DA_SAIDA_MUDOU` recarrega a prévia sem fechar).
 */
export function FolhaDeEncerrar({ contratacao, aoFechar, aoMudar }: {
  contratacao: ContratacaoResponse;
  aoFechar: () => void;
  /** Recarrega o cartão (contratações e cobranças). */
  aoMudar: () => void;
}) {
  const { avisar } = useAviso();
  const previa = useCarregar(`previa-de-encerramento:${contratacao.id}`, () => previaDoEncerramento(contratacao.id));
  const [opcao, setOpcao] = useState<OpcaoDeSaida>(OPCAO_INICIAL_DO_ENCERRAR);
  const [valorTexto, setValorTexto] = useState('');
  const [vencimentoTexto, setVencimentoTexto] = useState(() => dataParaTela(hojeEmBrasilia()));
  const [tentou, setTentou] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errosDoServidor, setErrosDoServidor] = useState<ErrosDoEncerrar>({});
  const [contaMudou, setContaMudou] = useState(false);
  const [erroDoEnvio, setErroDoEnvio] = useState<string | null>(null);

  const dados = previa.dados;
  const opcoes = dados ? opcoesDoPainel(dados) : [];
  // A prévia nova pode ter tirado a opção escolhida (ex.: não faltam mais meses): volta para "Não cobrar".
  const escolhida: OpcaoDeSaida = opcoes.find((o) => o.opcao === opcao)?.disponivel ? opcao : OPCAO_INICIAL_DO_ENCERRAR;
  const daOpcao = opcoes.find((o) => o.opcao === escolhida);
  const entrada = { opcao: escolhida, valorTexto, vencimentoTexto };
  const validacao = dados ? corpoDoEncerrar(dados, entrada, contratacao.versao) : null;
  // Campo a campo: o servidor apaga o dele com `undefined` ao digitar, e espalhar o objeto apagaria o erro da tela junto.
  const locais: ErrosDoEncerrar = tentou && validacao && !validacao.ok ? validacao.erros : {};
  const erros: ErrosDoEncerrar = {
    opcao: errosDoServidor.opcao ?? locais.opcao,
    valor: errosDoServidor.valor ?? locais.valor,
    vencimento: errosDoServidor.vencimento ?? locais.vencimento,
  };
  const atualizando = !!dados && previa.carregando;
  const erroDaPrevia = previa.erro ? traduzirErroDoEncerrar(previa.erro) : null;
  const fechar = () => { if (erroDaPrevia?.fechar) aoMudar(); aoFechar(); };
  const cobra = escolhida !== 'NAO_COBRAR';

  const mudarOpcao = (o: OpcaoDeSaida) => {
    setOpcao(o);
    setErrosDoServidor({});
    setErroDoEnvio(null);
  };

  const enviar = () => {
    if (!dados) return;
    setTentou(true);
    // A versão é lida da contratação atual no clique: depois de um 409 o cartão recarrega e a prop já vem nova.
    const montado = corpoDoEncerrar(dados, entrada, contratacao.versao);
    if (!montado.ok) return;
    setEnviando(true);
    setErroDoEnvio(null);
    setErrosDoServidor({});
    encerrarContratacao(contratacao.id, montado.corpo).then(
      () => {
        setEnviando(false);
        avisar(montado.corpo.saida ? 'Plano encerrado. A cobrança de saída foi criada.' : 'Contratação encerrada.', 'sucesso');
        aoMudar();
        aoFechar();
      },
      (e: unknown) => {
        setEnviando(false);
        const t = traduzirErroDoEncerrar(e);
        if (t.fechar) {
          avisar(t.mensagem, 'neutro');
          aoMudar();
          aoFechar();
          return;
        }
        if (t.recarregar) {
          previa.recarregar();
          aoMudar();
        }
        setContaMudou(t.mensagem === MENSAGEM_VALOR_DA_SAIDA_MUDOU);
        setErrosDoServidor(t.campos);
        setErroDoEnvio(t.mensagem === MENSAGEM_VALOR_DA_SAIDA_MUDOU ? null : t.mensagem);
      },
    );
  };

  const meses = dados ? textoDosMesesQueFaltam(dados) : null;
  const conta = dados && escolhida === 'FALTAM' ? linhasDaConta(dados) : [];
  const linkVivo = dados && escolhida === 'FALTAM' ? avisoDeLinkVivo(dados.comLinkVivo) : null;
  const abertas = dados ? fraseDasAbertasQueContinuam(dados, escolhida) : null;
  const motivoDoBotao = !dados ? 'Carregando a conta do encerramento…' : atualizando ? 'Atualizando a conta…' : undefined;

  return (
    <Folha visivel titulo="Encerrar este plano?" aoFechar={fechar}
      rodape={(
        <LinhaDeAcoes alinhar="fim">
          <Botao rotulo="Voltar" tipo="secundario" aoTocar={fechar} desabilitado={enviando} />
          <Botao rotulo="Encerrar plano" tipo="perigo" aoTocar={enviar} carregando={enviando}
            desabilitado={!dados || atualizando} motivo={motivoDoBotao} />
        </LinhaDeAcoes>
      )}>
      <View style={estilos.bloco}>
        {contaMudou ? <Alerta tom="atencao" texto={MENSAGEM_VALOR_DA_SAIDA_MUDOU} /> : null}
        <Texto variante="suave">O aluno deixa de receber novas mensalidades. Para voltar, será preciso contratar de novo.</Texto>
        {!dados && previa.carregando ? <Esqueleto /> : null}
        {previa.erro ? (
          // Plano que já foi encerrado (por outra pessoa) não tem o que tentar de novo: a mensagem diz e o cartão recarrega ao fechar.
          erroDaPrevia?.fechar
            ? <MensagemErro texto={erroDaPrevia.mensagem} />
            : <MensagemErro texto={textoDoErro(previa.erro)} erro={previa.erro} tentarDeNovo={previa.recarregar} />
        ) : null}
        {dados ? (
          <>
            {meses ? <Texto variante="bloco">{meses}</Texto> : null}
            {dados.regraDeSaida ? <CampoLeitura rotulo="Regra de saída do plano" valor={dados.regraDeSaida} /> : null}
            <Escolha chips rotulo="Cobrança de saída" valor={escolhida} aoMudar={mudarOpcao} erro={erros.opcao ?? null}
              opcoes={opcoes.map((o) => ({
                valor: o.opcao,
                rotulo: o.valor ? `${o.rotulo}: ${o.valor}` : o.rotulo,
                desabilitada: !o.disponivel,
                motivo: o.motivo ?? undefined,
              }))} />
            {daOpcao?.digitavel ? (
              <CampoMoeda mascara rotulo="Valor da cobrança de saída" texto={valorTexto}
                aoMudar={(t) => { setValorTexto(t); setErrosDoServidor((e) => ({ ...e, valor: undefined })); }}
                erro={erros.valor ?? null} ajuda="Valor combinado com o aluno. Nenhuma mensalidade é cancelada." />
            ) : cobra && daOpcao?.valor ? (
              <CampoLeitura rotulo="Valor da cobrança de saída" valor={daOpcao.valor} numerico />
            ) : null}
            {conta.length > 0 ? (
              <View style={estilos.conta} accessibilityRole="summary">
                {conta.map((l) => <Texto key={l} variante="pequeno">{l}</Texto>)}
              </View>
            ) : null}
            {linkVivo ? <Alerta tom="atencao" texto={linkVivo} /> : null}
            {cobra ? (
              <View style={estilos.campoComAjuda}>
                <CampoData rotulo="Vence em" valor={vencimentoTexto} erro={erros.vencimento ?? null}
                  aoMudar={(t) => { setVencimentoTexto(t); setErrosDoServidor((e) => ({ ...e, vencimento: undefined })); }} />
                <Texto variante="pequeno">De hoje até um ano à frente. Em branco, vence hoje.</Texto>
              </View>
            ) : null}
            {abertas ? <Texto variante="suave">{abertas}</Texto> : null}
          </>
        ) : null}
        {erroDoEnvio ? <MensagemErro texto={erroDoEnvio} /> : null}
      </View>
    </Folha>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(1.5) },
  conta: { gap: espaco(0.5) },
  campoComAjuda: { gap: espaco(0.5) },
});
