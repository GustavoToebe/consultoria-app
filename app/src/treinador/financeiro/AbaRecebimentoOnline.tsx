import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { JurosDoParcelamento, RecebimentoOnline, RecebimentoOnlineRequest } from '../../api/financeiroTipos';
import { buscarRecebimentoOnline, removerRecebimentoOnline, salvarRecebimentoOnline } from '../../api/rotas';
import {
  jurosQueValem, MOTIVO_JUROS_SEM_CHAVE, normalizarInfiniteTag, OPCOES_DE_JUROS, rotuloDosJurosParaLeitura, temChaveParaJuros,
  TEXTO_CHAVE_DO_RECEBIMENTO, TEXTO_JUROS_DO_PARCELAMENTO, TEXTO_RECEBIMENTO_ONLINE, TITULO_JUROS_DO_PARCELAMENTO,
  validarJurosDoParcelamento, validarRecebimentoOnline,
} from '../../dominio/financeiro';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { CampoLeitura } from '../../ui/CampoLeitura';
import { CampoSenha } from '../../ui/CampoSenha';
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
import { avisoDeConflito, ehConflito } from './comum';

/**
 * Recebimento online: o treinador liga a InfinitePay informando a InfiniteTag (e, se quiser, uma API Key). O aluno paga
 * por Pix ou cartão por um link e o dinheiro cai direto na conta InfinitePay do treinador: o app não recebe nem guarda
 * dinheiro. A API Key é **só de escrita**: a API nunca a devolve, o campo nasce vazio, o que foi digitado some do estado
 * depois de salvar e a tela só sabe dizer "Chave configurada". Quem paga os juros do parcelamento no cartão (Aluno, padrão,
 * ou Você) também mora aqui; "Você" só vale com a API Key (sem ela a opção fica apagada e a escolha volta para Aluno). Só
 * aparece com o recebimento online ligado na consultoria.
 */
export function AbaRecebimentoOnline({ podeAlterar }: { podeAlterar: boolean }) {
  const carga = useCarregar('recebimento-online', () => buscarRecebimentoOnline());
  const { dados, erro, recarregar, definir } = carga;
  return (
    <View style={estilos.coluna}>
      {erro ? <MensagemErro texto={codigoApi(erro) === 'RECEBIMENTO_ONLINE_INDISPONIVEL' ? 'O recebimento online não está disponível agora.' : textoDoErro(erro)}
        erro={erro} tentarDeNovo={recarregar} /> : null}
      {!dados && carga.carregando ? <Esqueleto /> : null}
      {/* A chave do formulário é a versão: salvar ou remover traz outra versão e o formulário nasce de novo, sem resto de digitação. */}
      {dados ? <Formulario key={dados.versao ?? 'novo'} dados={dados} podeAlterar={podeAlterar} aoMudar={definir} aoRecarregar={recarregar} /> : null}
    </View>
  );
}

type Pergunta = 'chave' | 'tudo' | null;

function Formulario({ dados, podeAlterar, aoMudar, aoRecarregar }: {
  dados: RecebimentoOnline;
  podeAlterar: boolean;
  aoMudar: (novo: RecebimentoOnline) => void;
  aoRecarregar: () => void;
}) {
  const { avisar } = useAviso();
  const { cores } = useTema();
  const [tag, setTag] = useState(dados.infiniteTag ?? '');
  // A chave digitada só existe aqui enquanto o campo está na tela; nunca vem de `dados` (a API não a devolve).
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
  const semMudanca = dados.configurado && tagNormalizada === (dados.infiniteTag ?? '') && !chave.trim()
    && jurosEscolhidos === (dados.jurosDoParcelamento ?? 'ALUNO');
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
    const nova = chave.trim();
    if (campoDaChave && nova) corpo.apiKey = nova;
    concluir(
      () => salvarRecebimentoOnline(corpo).then((r) => { aoMudar(r); }),
      () => avisar('Recebimento online salvo.', 'sucesso'),
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
      <Cartao titulo="Recebimento online" descricao={TEXTO_RECEBIMENTO_ONLINE}
        acoes={<Selo texto={dados.configurado ? 'Configurado' : 'Ainda não configurado'} tipo={dados.configurado ? 'sucesso' : 'neutro'} />}>
        {!dados.configurado ? (
          <Texto variante="suave">Informe a sua InfiniteTag para o aluno poder pagar pelo link. Enquanto isso, você segue registrando os pagamentos à mão.</Texto>
        ) : null}
        {podeAlterar ? (
          <>
            <Campo rotulo="InfiniteTag" valor={tag} aoMudar={(t) => setTag(normalizarInfiniteTag(t))} erro={erroDaTag}
              ajuda="É o seu identificador na InfinitePay. Pode digitar com ou sem o $; aqui ele aparece sem."
              autoCapitalize="none" autoCorrect={false} maxLength={60} />
            {campoDaChave ? (
              <>
                <CampoSenha rotulo={trocando ? 'Nova API Key' : 'API Key (opcional)'} valor={chave} aoMudar={mudarChave} erro={erroDaChave}
                  autoComplete="off" maxLength={300} />
                {trocando ? <Botao rotulo="Cancelar a troca" tipo="fantasma" aoTocar={() => { setTrocando(false); setChave(''); }} /> : null}
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
            <View style={estilos.chave}>
              <Escolha rotulo={TITULO_JUROS_DO_PARCELAMENTO} valor={jurosEscolhidos} aoMudar={setJuros}
                opcoes={OPCOES_DE_JUROS.map((o) => (o.valor === 'TREINADOR'
                  ? { ...o, desabilitada: !temChave, motivo: MOTIVO_JUROS_SEM_CHAVE }
                  : { ...o }))} />
              <Texto variante="suave">{TEXTO_JUROS_DO_PARCELAMENTO}</Texto>
              {erroDosJuros ? <Texto variante="pequeno" cor={cores.perigo} accessibilityLiveRegion="polite">{erroDosJuros}</Texto> : null}
            </View>
            {erro && !pergunta && Object.keys(doServidor).length === 0 ? <MensagemErro texto={textoDoErro(erro)} erro={erro} /> : null}
            <LinhaDeAcoes>
              <Botao rotulo="Salvar" carregando={enviando} desabilitado={semMudanca} motivo="Nada foi alterado." aoTocar={salvar} />
              {dados.configurado ? <Botao rotulo="Remover recebimento online" tipo="perigoTexto" aoTocar={() => { setErro(null); setPergunta('tudo'); }} /> : null}
            </LinhaDeAcoes>
          </>
        ) : (
          <>
            <CampoLeitura rotulo="InfiniteTag" valor={dados.infiniteTag} />
            <CampoLeitura rotulo="API Key" valor={dados.apiKeyConfigurada ? 'Chave configurada' : 'Sem chave'} />
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
  coluna: { gap: espaco(2) },
  chave: { gap: espaco(0.5) },
});
