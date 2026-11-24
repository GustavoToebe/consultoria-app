import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { CobrancaDoEncerramento, ContratacaoResponse, OpcaoDeSaida } from '../../api/financeiroTipos';
import { encerrarContratacao, previaDoEncerramento } from '../../api/rotas';
import { NOTA_DA_MULTA, textoAoEncerrar } from '../../dominio/contratoFechado';
import { hojeEmBrasilia } from '../../dominio/financeiro';
import { centavosParaTela, dataParaTela } from '../../dominio/formatos';
import {
  avisoDeLinkVivo, corpoDoEncerrar, type ErrosDoEncerrar, fraseDasAbertasQueContinuam, linhasDaConta, MENSAGEM_VALOR_DA_SAIDA_MUDOU,
  MENSAGEM_OPCAO_ESCOLHIDA_INDISPONIVEL, motivoDaOpcaoEscolhidaIndisponivel, OPCAO_INICIAL_DO_ENCERRAR, opcoesDoPainel, textoDosMesesQueFaltam, traduzirErroDoEncerrar,
} from '../../dominio/saidaDoPlano';
import { espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { CampoLeitura } from '../../ui/CampoLeitura';
import { CampoData } from '../../ui/Campos';
import { Escolha } from '../../ui/Escolha';
import { Divisor } from '../../ui/Divisor';
import { Esqueleto } from '../../ui/Esqueleto';
import { Alerta, MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { CampoMoeda } from './comum';

/**
 * Encerrar a contratação com a cobrança de saída opcional (P1: folha com rodapé, sem confirmação empilhada). Tudo o que
 * é dinheiro vem da prévia da API (`previaDoEncerramento`); a tela só escolhe a opção, digita o "Outro valor" e o
 * vencimento, e o servidor confere de novo (409 `VALOR_DA_SAIDA_MUDOU` recarrega a prévia sem fechar).
 * Contrato fechado (D7): só "Não cobrar" e "Multa rescisória" (a opção `OUTRO`), as seções "Serão canceladas" (encerrar
 * sempre cancela as futuras em aberto) e "Continua em aberto" (as vencidas), e a frase "Ao encerrar: ..."; sem "Motivo" (D12).
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
  const fechado = !!contratacao.contrato;
  // No contrato fechado só valem "Não cobrar" e a multa (a API manda as outras indisponíveis; aqui nem aparecem).
  const opcoes = (dados ? opcoesDoPainel(dados) : [])
    .filter((o) => !fechado || o.opcao === 'NAO_COBRAR' || o.opcao === 'OUTRO')
    .map((o) => (fechado && o.opcao === 'OUTRO' ? { ...o, rotulo: 'Multa rescisória' } : o));
  // A prévia nova pode ter tirado a opção escolhida (ex.: não faltam mais meses). NÃO volta em silêncio para "Não cobrar":
  // encerrar não tem volta e o treinador queria cobrar. O erro aparece nas opções e o botão fica desabilitado até escolher de novo.
  const escolhida: OpcaoDeSaida = opcao;
  // O motivo da API já aparece sob o grupo (opção desabilitada); o erro do grupo e o do botão dizem só o que fazer.
  const opcaoIndisponivel = dados && motivoDaOpcaoEscolhidaIndisponivel(dados.opcoes, opcao) ? MENSAGEM_OPCAO_ESCOLHIDA_INDISPONIVEL : null;
  const daOpcao = opcoes.find((o) => o.opcao === escolhida);
  const entrada = { opcao: escolhida, valorTexto, vencimentoTexto };
  const validacao = dados ? corpoDoEncerrar(dados, entrada, contratacao.versao, hojeEmBrasilia(), fechado) : null;
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
  const cobra = escolhida !== 'NAO_COBRAR' && !opcaoIndisponivel;

  const mudarOpcao = (o: OpcaoDeSaida) => {
    setOpcao(o);
    setErrosDoServidor({});
    setErroDoEnvio(null);
  };

  const enviar = () => {
    if (!dados || opcaoIndisponivel) return;
    setTentou(true);
    // A versão é lida da contratação atual no clique: depois de um 409 o cartão recarrega e a prop já vem nova.
    const montado = corpoDoEncerrar(dados, entrada, contratacao.versao, hojeEmBrasilia(), fechado);
    if (!montado.ok) return;
    setEnviando(true);
    setErroDoEnvio(null);
    setErrosDoServidor({});
    encerrarContratacao(contratacao.id, montado.corpo).then(
      () => {
        setEnviando(false);
        avisar(fechado
          ? (montado.corpo.saida?.opcao === 'OUTRO' ? 'Contrato encerrado. A cobrança da multa rescisória foi criada.' : 'Contrato encerrado.')
          : (montado.corpo.saida ? 'Plano encerrado. A cobrança de saída foi criada.' : 'Contratação encerrada.'), 'sucesso');
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
  const conta = dados && escolhida === 'FALTAM' && !opcaoIndisponivel ? linhasDaConta(dados) : [];
  // No contrato fechado as futuras são sempre canceladas: o aviso do link vivo vale em qualquer opção.
  const linkVivo = dados && (escolhida === 'FALTAM' || fechado) && !opcaoIndisponivel ? avisoDeLinkVivo(dados.comLinkVivo) : null;
  const abertas = dados && !opcaoIndisponivel && !fechado ? fraseDasAbertasQueContinuam(dados, escolhida) : null;
  const saidaValida = cobra && validacao?.ok ? validacao.corpo.saida : null;
  const multa = saidaValida?.valorCentavos ? { valorCentavos: saidaValida.valorCentavos, vencimento: saidaValida.vencimento ?? hojeEmBrasilia() } : null;
  const motivoDoBotao = !dados ? 'Carregando a conta do encerramento…' : atualizando ? 'Atualizando a conta…' : opcaoIndisponivel ?? undefined;

  return (
    <Folha visivel titulo={fechado ? 'Encerrar contrato antes do fim?' : 'Encerrar este plano?'} aoFechar={fechar}
      rodape={(
        <LinhaDeAcoes alinhar="fim">
          <Botao rotulo="Voltar" tipo="secundario" aoTocar={fechar} desabilitado={enviando} />
          <Botao rotulo={fechado ? 'Encerrar contrato' : 'Encerrar plano'} tipo="perigo" aoTocar={enviar} carregando={enviando}
            desabilitado={!dados || atualizando || !!opcaoIndisponivel} motivo={motivoDoBotao} />
        </LinhaDeAcoes>
      )}>
      <View style={estilos.bloco}>
        {contaMudou ? <Alerta tom="atencao" texto={MENSAGEM_VALOR_DA_SAIDA_MUDOU} /> : null}
        <Texto variante="suave">{fechado
          ? 'O contrato fica Encerrado. As cobranças futuras em aberto são canceladas; as pagas e as vencidas ficam como estão.'
          : 'O aluno deixa de receber novas mensalidades. Para voltar, será preciso contratar de novo.'}</Texto>
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
            {fechado ? (
              <>
                <CobrancasDoEncerramento titulo="Serão canceladas" nota="Só as cobranças futuras em aberto. As pagas ficam como estão." itens={dados.aCancelar ?? []}
                  vazio="Nenhuma cobrança futura em aberto." />
                <CobrancasDoEncerramento titulo="Continua em aberto" nota="O aluno ainda deve estas cobranças; elas continuam valendo." itens={dados.vencidasQueFicam ?? []}
                  vencidas vazio="Nenhuma cobrança vencida." />
                <Divisor />
              </>
            ) : null}
            <Escolha chips rotulo={fechado ? 'Multa rescisória (opcional)' : 'Cobrança de saída'} valor={escolhida} aoMudar={mudarOpcao} erro={opcaoIndisponivel ?? erros.opcao ?? null}
              opcoes={opcoes.map((o) => ({
                valor: o.opcao,
                rotulo: o.valor ? `${o.rotulo}: ${o.valor}` : o.rotulo,
                desabilitada: !o.disponivel,
                motivo: o.motivo ?? undefined,
              }))} />
            {daOpcao?.digitavel && !opcaoIndisponivel ? (
              <CampoMoeda mascara rotulo={fechado ? 'Valor da multa' : 'Valor da cobrança de saída'} texto={valorTexto}
                aoMudar={(t) => { setValorTexto(t); setErrosDoServidor((e) => ({ ...e, valor: undefined })); }}
                erro={erros.valor ?? null} ajuda={fechado ? NOTA_DA_MULTA : 'Valor combinado com o aluno. Nenhuma mensalidade é cancelada.'} />
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
            {fechado && !opcaoIndisponivel ? (
              <View accessibilityLiveRegion="polite" aria-live="polite" role="status">
                <Texto variante="rotulo">{textoAoEncerrar((dados.aCancelar ?? []).length, multa)}</Texto>
              </View>
            ) : null}
          </>
        ) : null}
        {erroDoEnvio ? <MensagemErro texto={erroDoEnvio} /> : null}
      </View>
    </Folha>
  );
}

/** Uma seção do encerrar do contrato: a lista que a API separou (descrição, vencimento, valor), sem somar nada. */
function CobrancasDoEncerramento({ titulo, nota, itens, vazio, vencidas }: {
  titulo: string; nota: string; itens: readonly CobrancaDoEncerramento[]; vazio: string; vencidas?: boolean;
}) {
  return (
    <View style={estilos.secao}>
      <Texto variante="secao" nivel={3}>{titulo}</Texto>
      {itens.length === 0 ? <Texto variante="suave">{vazio}</Texto> : (
        <>
          <Texto variante="pequeno">{nota}</Texto>
          <View role="list" accessibilityLabel={titulo}>
            {itens.map((c, i) => (
              <View key={c.cobrancaId} role="listitem">
                {i > 0 ? <Divisor /> : null}
                <View style={estilos.linha}>
                  <View style={estilos.textoDaLinha}>
                    <Texto numberOfLines={2}>{c.descricao}</Texto>
                    <Texto variante="pequeno" numerico>{`${vencidas ? 'Venceu' : 'Vence'} em ${dataParaTela(c.vencimento)}`}</Texto>
                  </View>
                  {vencidas ? <Selo texto="Vencida" tipo="perigo" /> : null}
                  <Texto numerico>{centavosParaTela(c.valorCentavos)}</Texto>
                </View>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(1.5) },
  secao: { gap: espaco(1) },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5), paddingVertical: espaco(1), minHeight: 44 },
  textoDaLinha: { flex: 1, minWidth: 0, gap: 2 },
  conta: { gap: espaco(0.5) },
  campoComAjuda: { gap: espaco(0.5) },
});
