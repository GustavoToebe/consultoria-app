import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { buscarOvertrainingPay } from '../../api/financeiroOvertrainingPay';
import type { JurosDoParcelamento, RecebimentoOnline, RecebimentoOnlineRequest } from '../../api/financeiroTipos';
import { buscarRecebimentoOnline, removerRecebimentoOnline, salvarRecebimentoOnline } from '../../api/rotas';
import { chaveParaEnviar } from '../../dominio/campoDeChave';
import {
  jurosQueValem, MOTIVO_JUROS_SEM_CHAVE, normalizarInfiniteTag, OPCOES_DE_JUROS, rotuloDosJurosParaLeitura, temChaveParaJuros,
  TEXTO_CHAVE_DO_RECEBIMENTO, TEXTO_JUROS_DO_PARCELAMENTO, TEXTO_RECEBIMENTO_ONLINE, TITULO_JUROS_DO_PARCELAMENTO,
  validarJurosDoParcelamento, validarRecebimentoOnline,
} from '../../dominio/financeiro';
import { useTema } from '../../tema/TemaProvider';
import { espaco, LARGURA_FORMULARIO } from '../../tema/tokens';
import { useGuardaDeSaida } from '../../ui/GuardaDeSaida';
import { useSessao } from '../../sessao/SessaoProvider';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { CampoLeitura } from '../../ui/CampoLeitura';
import { CamposEmLinha } from '../../ui/CamposEmLinha';
import { CampoDeChave, semPreencher } from '../../ui/CampoDeChave';
import { Cartao } from '../../ui/Cartao';
import { Escolha } from '../../ui/Escolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro } from '../../ui/Estados';
import { codigoApi, errosPorCampo, textoDoErro } from '../../ui/erros';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { BarraDeSalvar } from './AjustesDaAba';
import { AvisoDaChaveGravada, useChaveConferida } from './AvisoDaChave';
import { CartaoFormasDeRecebimento } from './CartaoFormasDeRecebimento';
import { avisoDeConflito, ehConflito } from './comum';
import { HomologacaoOvertrainingPay } from './HomologacaoOvertrainingPay';
import { KiwifyConfiguracao } from './KiwifyConfiguracao';

/**
 * Aba Recebimento (lembretes e recebimento, 19/11 + Overtraining Pay): na coluna de ajustes, as formas de recebimento
 * (Overtraining Pay em destaque quando habilitado, InfinitePay, link próprio, Pix e Manual, `CartaoFormasDeRecebimento`),
 * logo abaixo a homologação do Overtraining Pay (`HomologacaoOvertrainingPay`) e, recolhidas por padrão, as integrações
 * externas opcionais (InfinitePay e Kiwify); ao lado, "O que o aluno vê".
 */
export function AbaRecebimentoOnline({ podeAlterar }: { podeAlterar: boolean }) {
  const { recebimentoOnlineHabilitado, overtrainingPayHabilitado, kiwifyHabilitada } = useSessao();
  const carga = useCarregar(recebimentoOnlineHabilitado ? 'recebimento-online' : null, () => buscarRecebimentoOnline());
  const cargaOvertrainingPay = useCarregar(overtrainingPayHabilitado ? 'overtraining-pay' : null, () => buscarOvertrainingPay());
  const { dados, erro, recarregar, definir } = carga;
  const otDados = cargaOvertrainingPay.dados;
  const temIntegracoesExternas = recebimentoOnlineHabilitado || kiwifyHabilitada;
  // Defeito de 28/11 (o navegador gravava a senha do login como API Key): com chave gravada, o aviso de conferir fica à vista,
  // fora das integrações recolhidas, até "Já conferi" ou até salvar uma chave nova.
  const chaveDaInfinitePay = useChaveConferida('infinitepay');
  return (
    <View style={estilos.coluna}>
      <CartaoFormasDeRecebimento
        podeAlterar={podeAlterar}
        comInfinitePay={recebimentoOnlineHabilitado}
        infinitePayConfigurada={dados?.configurado}
        comOvertrainingPay={overtrainingPayHabilitado}
        overtrainingPayAtivo={otDados?.situacao === 'ATIVA'}
        overtrainingPaySituacao={otDados?.situacao}
        maisAjustes={(
          <>
            {overtrainingPayHabilitado ? (
              <>
                {cargaOvertrainingPay.erro ? (
                  <MensagemErro
                    texto={codigoApi(cargaOvertrainingPay.erro) === 'OVERTRAINING_PAY_INDISPONIVEL'
                      ? 'O Overtraining Pay não está disponível agora.'
                      : textoDoErro(cargaOvertrainingPay.erro)}
                    erro={cargaOvertrainingPay.erro}
                    tentarDeNovo={cargaOvertrainingPay.recarregar}
                  />
                ) : null}
                {!otDados && cargaOvertrainingPay.carregando ? <Esqueleto /> : null}
                {otDados ? (
                  <HomologacaoOvertrainingPay
                    key={otDados.versao ?? 'novo'}
                    dados={otDados}
                    podeAlterar={podeAlterar}
                    aoMudar={cargaOvertrainingPay.definir}
                    aoRecarregar={cargaOvertrainingPay.recarregar}
                  />
                ) : null}
              </>
            ) : null}
            {recebimentoOnlineHabilitado ? (
              <AvisoDaChaveGravada integracao="infinitepay" podeAlterar={podeAlterar} chaveGravada={dados?.apiKeyConfigurada === true}
                conferido={chaveDaInfinitePay.conferido} aoConferir={chaveDaInfinitePay.conferir} />
            ) : null}
            {temIntegracoesExternas ? (
              <Cartao
                titulo="Integrações externas opcionais"
                descricao="InfinitePay e Kiwify para quem recebe fora do Overtraining Pay."
                recolhivel
              >
                <View style={estilos.coluna}>
                  {recebimentoOnlineHabilitado ? (
                    <>
                      {erro ? (
                        <MensagemErro
                          texto={codigoApi(erro) === 'RECEBIMENTO_ONLINE_INDISPONIVEL' ? 'O recebimento online não está disponível agora.' : textoDoErro(erro)}
                          erro={erro}
                          tentarDeNovo={recarregar}
                        />
                      ) : null}
                      {!dados && carga.carregando ? <Esqueleto /> : null}
                      {/* A chave do formulário é a versão: salvar ou remover traz outra versão e o formulário nasce de novo, sem resto de digitação. */}
                      {dados ? <Formulario key={dados.versao ?? 'novo'} dados={dados} podeAlterar={podeAlterar} aoMudar={definir} aoRecarregar={recarregar} aoSalvarChaveNova={chaveDaInfinitePay.conferir} /> : null}
                    </>
                  ) : null}
                  {/* Só com a Kiwify ligada na plataforma (o próprio cartão confere e some sem ela). */}
                  <KiwifyConfiguracao podeAlterar={podeAlterar} />
                </View>
              </Cartao>
            ) : null}
          </>
        )}
      />
    </View>
  );
}

type Pergunta = 'chave' | 'tudo' | null;

function Formulario({ dados, podeAlterar, aoMudar, aoRecarregar, aoSalvarChaveNova }: {
  dados: RecebimentoOnline;
  podeAlterar: boolean;
  aoMudar: (novo: RecebimentoOnline) => void;
  aoRecarregar: () => void;
  /** Uma chave nova foi salva: o aviso de conferir a chave gravada some. */
  aoSalvarChaveNova: () => void;
}) {
  const { avisar } = useAviso();
  const { cores } = useTema();
  const [tag, setTag] = useState(dados.infiniteTag ?? '');
  // Só o que a pessoa digitou ou colou agora (`CampoDeChave`); nunca vem de `dados` (a API não devolve a chave).
  const [chave, setChave] = useState('');
  const [trocando, setTrocando] = useState(false);
  const [juros, setJuros] = useState<JurosDoParcelamento>(dados.jurosDoParcelamento ?? 'ALUNO');
  const [pergunta, setPergunta] = useState<Pergunta>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const [tentou, setTentou] = useState(false);

  const campoDaChave = !dados.apiKeyConfigurada || trocando;
  const tagNormalizada = normalizarInfiniteTag(tag);
  const validacao = validarRecebimentoOnline({ infiniteTag: tag, apiKey: campoDaChave ? chave : '' });
  const doServidor = errosPorCampo(erro);
  const erroDaTag = tentou ? validacao.infiniteTag : (doServidor.infiniteTag ?? null);
  const erroDaChave = tentou ? validacao.apiKey : (doServidor.apiKey ?? null);
  // "Você" pede a chave: a que já existe ou uma válida digitada agora (assim dá para criar tag, chave e "Você" num salvar só).
  const temChave = temChaveParaJuros(dados.apiKeyConfigurada, campoDaChave ? chave : '');
  const jurosEscolhidos = jurosQueValem(juros, temChave);
  const erroDosJuros = tentou ? validarJurosDoParcelamento(jurosEscolhidos, temChave) : (doServidor.jurosDoParcelamento ?? null);
  // Sem nada gravado, vazio também é "sem mudança": a barra diz o que falta em vez de "Tudo salvo".
  const mudou = podeAlterar && (tagNormalizada !== (dados.infiniteTag ?? '') || !!chave.trim()
    || jurosEscolhidos !== (dados.jurosDoParcelamento ?? 'ALUNO'));
  useGuardaDeSaida(mudou);
  const descartar = () => {
    setTag(dados.infiniteTag ?? '');
    setChave('');
    setTrocando(false);
    setJuros(dados.jurosDoParcelamento ?? 'ALUNO');
    setTentou(false);
    setErro(null);
  };
  const mudarChave = (nova: string) => {
    setChave(nova);
    if (!temChaveParaJuros(dados.apiKeyConfigurada, nova)) setJuros('ALUNO');
  };

  const concluir = (acao: () => Promise<unknown>, depois: () => void) => {
    setEnviando(true);
    setErro(null);
    acao().then(
      () => {
        setEnviando(false);
        setPergunta(null);
        setChave('');
        setTrocando(false);
        setTentou(false);
        depois();
      },
      (e: unknown) => {
        setEnviando(false);
        if (ehConflito(e)) {
          setPergunta(null);
          setChave('');
          avisar(avisoDeConflito('O recebimento online foi alterado'), 'neutro');
          aoRecarregar();
          return;
        }
        // Erro de validação do servidor aparece no campo (nenhuma mensagem repete a chave); os outros, no painel aberto ou no cartão.
        setTentou(false);
        setErro(e);
      },
    );
  };

  const salvar = () => {
    setTentou(true);
    if (validacao.infiniteTag || validacao.apiKey) return;
    const corpo: RecebimentoOnlineRequest = { infiniteTag: tagNormalizada, versao: dados.versao, jurosDoParcelamento: jurosEscolhidos };
    // Só a chave digitada ou colada nesta tela; sem ela o corpo não leva `apiKey` e a gravada fica.
    const nova = campoDaChave ? chaveParaEnviar(chave) : null;
    if (nova) corpo.apiKey = nova;
    concluir(
      () => salvarRecebimentoOnline(corpo).then((r) => { aoMudar(r); }),
      () => {
        if (nova) aoSalvarChaveNova();
        avisar('Recebimento online salvo.', 'sucesso');
      },
    );
  };

  const removerChave = () => concluir(
    // Sem chave não há "Você": a remoção já manda os juros de volta para o aluno (senão a API recusa com 422).
    () => salvarRecebimentoOnline({
      infiniteTag: dados.infiniteTag ?? tagNormalizada, removerApiKey: true, jurosDoParcelamento: 'ALUNO', versao: dados.versao,
    }).then((r) => { aoMudar(r); }),
    () => avisar('Chave removida.', 'sucesso'),
  );

  const removerTudo = () => concluir(
    () => removerRecebimentoOnline(dados.versao).then(() => {
      aoMudar({ habilitado: dados.habilitado, configurado: false, infiniteTag: null, apiKeyConfigurada: false, jurosDoParcelamento: null, versao: null });
    }),
    () => avisar('Recebimento online removido.', 'sucesso'),
  );

  return (
    <>
      <Cartao titulo="Recebimento online pela InfinitePay" descricao={TEXTO_RECEBIMENTO_ONLINE}
        acoes={<Selo texto={dados.configurado ? 'Configurado' : 'Ainda não configurado'} tipo={dados.configurado ? 'sucesso' : 'neutro'} />}
        rodape={podeAlterar ? (
          <BarraDeSalvar mudou={mudou} enviando={enviando} aoSalvar={salvar} aoDescartar={descartar}
            semAlteracao={dados.configurado ? 'Tudo salvo' : 'Informe a InfiniteTag para salvar.'}
            rotuloAcessivelDescartar="Descartar alterações do recebimento online"
            erro={erro && !pergunta && Object.keys(doServidor).length === 0 ? <MensagemErro texto={textoDoErro(erro)} erro={erro} /> : null} />
        ) : undefined}>
        {!dados.configurado ? (
          <Texto variante="suave">Informe a sua InfiniteTag para o aluno poder pagar pelo link. Enquanto isso, você segue registrando os pagamentos à mão.</Texto>
        ) : null}
        {podeAlterar ? (
          <>
            <View style={estilos.secao}>
              <Texto variante="secao">Conta InfinitePay</Texto>
              {/* Id e atributos neutros: o navegador punha aqui o e-mail do login (defeito de 28/11). */}
              <Campo rotulo="InfiniteTag" valor={tag} aoMudar={(t) => setTag(normalizarInfiniteTag(t))}
                erro={erroDaTag} ajuda="É o seu identificador na InfinitePay. Pode digitar com ou sem o $; aqui ele aparece sem."
                maxLength={60} {...semPreencher('infinitetag')} />
              {campoDaChave ? (
                <>
                  <CampoDeChave id="chave-infinitepay" rotulo={trocando ? 'Nova API Key' : 'API Key (opcional)'} valor={chave} aoMudar={mudarChave}
                    erro={erroDaChave} maxLength={300} />
                  {trocando ? <LinhaDeAcoes><Botao rotulo="Cancelar a troca" tipo="fantasma" aoTocar={() => { setTrocando(false); setChave(''); }} /></LinhaDeAcoes> : null}
                </>
              ) : (
                <View style={estilos.chave}>
                  <Texto variante="rotulo">API Key</Texto>
                  <Texto>Chave configurada</Texto>
                  <LinhaDeAcoes>
                    <Botao rotulo="Trocar chave" tipo="secundario" aoTocar={() => { setChave(''); setTrocando(true); }} />
                    <Botao rotulo="Remover chave" tipo="perigoTexto" aoTocar={() => { setErro(null); setPergunta('chave'); }} />
                  </LinhaDeAcoes>
                </View>
              )}
              <Texto variante="suave">{TEXTO_CHAVE_DO_RECEBIMENTO}</Texto>
            </View>
            <View style={estilos.secao}>
              <Texto variante="secao">Parcelamento no cartão</Texto>
              <View style={estilos.chave}>
                <Escolha rotulo={TITULO_JUROS_DO_PARCELAMENTO} valor={jurosEscolhidos} aoMudar={setJuros}
                  opcoes={OPCOES_DE_JUROS.map((o) => (o.valor === 'TREINADOR'
                    ? { ...o, desabilitada: !temChave, motivo: MOTIVO_JUROS_SEM_CHAVE }
                    : { ...o }))} />
                <Texto variante="suave">{TEXTO_JUROS_DO_PARCELAMENTO}</Texto>
                {erroDosJuros ? <Texto variante="pequeno" cor={cores.perigo} accessibilityLiveRegion="polite">{erroDosJuros}</Texto> : null}
              </View>
            </View>
            {/* Remover tudo é raro e destrutivo: fica no fim do corpo, longe do Salvar, com confirmação. */}
            {dados.configurado ? (
              <LinhaDeAcoes>
                <Botao rotulo="Remover recebimento online" tipo="perigoTexto" aoTocar={() => { setErro(null); setPergunta('tudo'); }} />
              </LinhaDeAcoes>
            ) : null}
          </>
        ) : (
          <>
            <CamposEmLinha>
              <CampoLeitura rotulo="InfiniteTag" valor={dados.infiniteTag} />
              <CampoLeitura rotulo="API Key" valor={dados.apiKeyConfigurada ? 'Chave configurada' : 'Sem chave'} />
            </CamposEmLinha>
            <CampoLeitura rotulo={TITULO_JUROS_DO_PARCELAMENTO} valor={dados.configurado ? rotuloDosJurosParaLeitura(dados.jurosDoParcelamento) : null} />
            <Texto variante="suave">{TEXTO_CHAVE_DO_RECEBIMENTO}</Texto>
            <Texto variante="suave">Para mudar o recebimento online, peça a quem administra o financeiro.</Texto>
          </>
        )}
      </Cartao>
      <PainelConfirmacao visivel={pergunta === 'chave'} titulo="Remover a chave?"
        mensagem={`A chave é apagada. Os links voltam a ser gerados sem ela, e então podem ser pagos mais de uma vez e não vencem.${dados.jurosDoParcelamento === 'TREINADOR' ? ' Sem a chave os juros do parcelamento voltam a ser do aluno.' : ''}`}
        rotuloConfirmar="Remover chave" rotuloCancelar="Voltar" perigo carregando={enviando}
        aoConfirmar={removerChave} aoCancelar={() => setPergunta(null)}>
        {erro && pergunta === 'chave' ? <MensagemErro texto={textoDoErro(erro)} erro={erro} /> : null}
      </PainelConfirmacao>
      <PainelConfirmacao visivel={pergunta === 'tudo'} titulo="Remover o recebimento online?"
        mensagem="A InfiniteTag e a chave são apagadas e o aluno deixa de ver o Pagar. Os pagamentos já registrados continuam nas cobranças."
        rotuloConfirmar="Remover recebimento online" rotuloCancelar="Voltar" perigo carregando={enviando}
        aoConfirmar={removerTudo} aoCancelar={() => setPergunta(null)}>
        {erro && pergunta === 'tudo' ? <MensagemErro texto={textoDoErro(erro)} erro={erro} /> : null}
      </PainelConfirmacao>
    </>
  );
}

const estilos = StyleSheet.create({
  coluna: { gap: espaco(2), width: '100%' },
  // Campos curtos numa coluna de leitura confortável, não na largura toda do cartão (o campo da Tag ia de ponta a ponta).
  secao: { gap: espaco(1.5), maxWidth: LARGURA_FORMULARIO },
  chave: { gap: espaco(0.5) },
});
