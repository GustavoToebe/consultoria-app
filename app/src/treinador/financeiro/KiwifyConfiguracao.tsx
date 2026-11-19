import { Copy } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';

import { buscarKiwify, removerKiwify, salvarKiwify, type CampoDaKiwify, type KiwifyConfiguracao as Configuracao } from '../../api/financeiroKiwify';
import {
  CAMPO_MAXIMO, CAMPOS_DA_KIWIFY, clientIdParaTela, corpoDaKiwify, ehCampoSecreto, MENSAGEM_REMOVER_KIWIFY, mensagemDoErroDaKiwify,
  PASSOS_DA_KIWIFY, ROTULOS_DA_KIWIFY, TEXTO_DA_KIWIFY, validarCredenciaisKiwify, VALORES_VAZIOS, type ErrosDaKiwify, type ValoresDaKiwify,
} from '../../dominio/kiwify';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { CampoLeitura } from '../../ui/CampoLeitura';
import { CamposEmLinha } from '../../ui/CamposEmLinha';
import { CampoSenha } from '../../ui/CampoSenha';
import { Cartao } from '../../ui/Cartao';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro } from '../../ui/Estados';
import { codigoApi, focarPrimeiroComErro, separarErros, textoDoErro } from '../../ui/erros';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { avisoDeConflito, copiarTexto, ehConflito } from './comum';

/**
 * Assinaturas pela Kiwify, na aba Recebimento (D17; contrato em `api/financeiroKiwify.ts`). Só com a chave da plataforma ligada
 * (`kiwifyHabilitada`): desligada, nem busca e nada aparece; o 503 `KIWIFY_INDISPONIVEL` também some com o cartão. O treinador
 * cola o token do webhook, o client_id, o client_secret e o account_id; eles são **só de escrita**: a API nunca os devolve, os
 * campos nascem vazios e somem do estado ao salvar (a chave do formulário é a versão). Depois de salvar, a tela mostra a URL
 * do webhook (só a quem tem `FINANCEIRO_ALTERAR`; a API já a omite para quem só lê) para copiar e colar na Kiwify. A URL leva
 * o token da consultoria: fica só na tela, nunca em aviso, rótulo, log ou no aparelho.
 */
export function KiwifyConfiguracao({ podeAlterar }: { podeAlterar: boolean }) {
  const { kiwifyHabilitada } = useSessao();
  const carga = useCarregar(kiwifyHabilitada ? 'kiwify' : null, () => buscarKiwify());
  const { dados, erro, recarregar, definir } = carga;
  if (!kiwifyHabilitada || codigoApi(erro) === 'KIWIFY_INDISPONIVEL') return null;
  if (erro && !dados) return <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} />;
  if (!dados) return carga.carregando ? <Esqueleto /> : null;
  return <Formulario key={dados.versao ?? 'novo'} dados={dados} podeAlterar={podeAlterar} aoMudar={definir} aoRecarregar={recarregar} />;
}

function Formulario({ dados, podeAlterar, aoMudar, aoRecarregar }: {
  dados: Configuracao;
  podeAlterar: boolean;
  aoMudar: (novo: Configuracao) => void;
  aoRecarregar: () => void;
}) {
  const { avisar } = useAviso();
  // Os segredos digitados só existem aqui, enquanto o campo está na tela; nunca vêm de `dados`.
  const [valores, setValores] = useState<ValoresDaKiwify>(VALORES_VAZIOS);
  const [trocando, setTrocando] = useState(false);
  const [tentou, setTentou] = useState(false);
  const [doServidor, setDoServidor] = useState<ErrosDaKiwify>({});
  /** A falha que não é de um campo: o texto já traduzido e o erro original (a `MensagemErro` usa para dizer "sem conexão"). */
  const [falha, setFalha] = useState<{ texto: string; erro: unknown } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const [urlAMao, setUrlAMao] = useState(false);
  const refs = {
    tokenDoWebhook: useRef<TextInput>(null), clientId: useRef<TextInput>(null), clientSecret: useRef<TextInput>(null), accountId: useRef<TextInput>(null),
  };

  const criando = !dados.configurada;
  const comCampos = podeAlterar && (criando || trocando);
  const validacao = validarCredenciaisKiwify(valores, criando);
  const erroDoCampo = (c: CampoDaKiwify) => doServidor[c] ?? (tentou ? validacao.campos[c] : undefined) ?? null;

  const mudar = (c: CampoDaKiwify) => (t: string) => {
    setValores((v) => ({ ...v, [c]: t }));
    setDoServidor((e) => ({ ...e, [c]: undefined }));
  };
  const limpar = () => {
    setValores(VALORES_VAZIOS);
    setTentou(false);
    setDoServidor({});
  };

  const salvar = () => {
    setTentou(true);
    const campos = validacao.campos;
    if (Object.keys(campos).length > 0) {
      focarPrimeiroComErro(campos, CAMPOS_DA_KIWIFY.map((c) => [c, refs[c]] as const));
      return;
    }
    if (validacao.nada) return;
    setEnviando(true);
    setFalha(null);
    salvarKiwify(corpoDaKiwify(valores, dados.versao)).then(
      (nova) => {
        setEnviando(false);
        limpar();
        avisar(criando ? 'Kiwify configurada. Agora crie o webhook na Kiwify com a URL abaixo.' : 'Credenciais da Kiwify salvas.', 'sucesso');
        // A versão muda: o formulário nasce de novo, sem nada do que foi digitado.
        aoMudar(nova);
      },
      (e: unknown) => {
        setEnviando(false);
        if (ehConflito(e)) {
          limpar();
          avisar(avisoDeConflito('A configuração da Kiwify foi alterada'), 'neutro');
          aoRecarregar();
          return;
        }
        // 422 `KIWIFY_INVALIDA`: cada mensagem no seu campo (nenhuma repete o valor); o resto, no texto geral.
        const { campos, geral } = separarErros(e, CAMPOS_DA_KIWIFY, mensagemDoErroDaKiwify(codigoApi(e)) ?? textoDoErro(e));
        setTentou(false);
        setDoServidor(campos);
        setFalha(geral ? { texto: geral, erro: e } : null);
        focarPrimeiroComErro(campos, CAMPOS_DA_KIWIFY.map((c) => [c, refs[c]] as const));
      },
    );
  };

  const remover = () => {
    setEnviando(true);
    setFalha(null);
    removerKiwify(dados.versao).then(
      () => {
        setEnviando(false);
        setRemovendo(false);
        avisar('Kiwify removida. Apague também o webhook no painel da Kiwify.', 'sucesso');
        aoMudar({ configurada: false, webhookUrl: null, clientIdFinal: null, versao: null });
      },
      (e: unknown) => {
        setEnviando(false);
        if (ehConflito(e)) {
          setRemovendo(false);
          avisar(avisoDeConflito('A configuração da Kiwify foi alterada'), 'neutro');
          aoRecarregar();
          return;
        }
        setFalha({ texto: mensagemDoErroDaKiwify(codigoApi(e)) ?? textoDoErro(e), erro: e });
      },
    );
  };

  const copiarUrl = () => {
    if (!dados.webhookUrl) return;
    setUrlAMao(false);
    void copiarTexto(dados.webhookUrl).then((ok) => {
      if (ok) avisar('URL do webhook copiada.', 'sucesso');
      else {
        setUrlAMao(true);
        avisar('Não foi possível copiar sozinho. Selecione a URL e copie à mão.', 'neutro');
      }
    });
  };

  const salvarDesabilitado = !criando && validacao.nada;

  return (
    <>
      <Cartao titulo="Assinaturas pela Kiwify" descricao={TEXTO_DA_KIWIFY}
        acoes={<Selo texto={dados.configurada ? 'Configurada' : 'Ainda não configurada'} tipo={dados.configurada ? 'sucesso' : 'neutro'} />}
        rodape={podeAlterar && (comCampos || dados.configurada) ? (
          <LinhaDeAcoes alinhar="entre">
            {dados.configurada ? <Botao rotulo="Remover Kiwify" tipo="perigoTexto" aoTocar={() => { setFalha(null); setRemovendo(true); }} /> : <View />}
            {comCampos ? (
              <Botao rotulo={criando ? 'Salvar credenciais' : 'Salvar novas credenciais'} carregando={enviando}
                desabilitado={salvarDesabilitado} motivo="Digite pelo menos um campo para trocar." aoTocar={salvar} />
            ) : null}
          </LinhaDeAcoes>
        ) : undefined}>
        {/* Entre as seções o dobro do espaço de dentro delas (URL, credencial, campos): o grupo aparece sem borda. */}
        <View style={estilos.corpo}>
        {dados.configurada && dados.webhookUrl ? (
          <View style={estilos.secao}>
            <Texto variante="secao">URL do webhook</Texto>
            <Texto variante="suave">Cole esta URL no webhook da Kiwify, em Apps › Webhooks. Ela é só desta consultoria: não a compartilhe.</Texto>
            {/* A URL fica selecionável na tela (cópia à mão se o navegador recusar); o botão de copiar não a repete no nome. */}
            <Texto selectable numerico>{dados.webhookUrl}</Texto>
            {urlAMao ? <Texto variante="pequeno">Selecione a URL acima e copie à mão.</Texto> : null}
            <LinhaDeAcoes><Botao rotulo="Copiar URL do webhook" tipo="secundario" Icone={Copy} aoTocar={copiarUrl} /></LinhaDeAcoes>
          </View>
        ) : null}
        {dados.configurada ? (
          <View style={estilos.secao}>
            <Texto variante="secao">Credencial</Texto>
            <CamposEmLinha>
              <CampoLeitura rotulo="Client ID" valor={clientIdParaTela(dados.clientIdFinal)} />
              <CampoLeitura rotulo="Token, Client secret e Account ID" valor="Guardados" />
            </CamposEmLinha>
            {podeAlterar && !trocando ? (
              <LinhaDeAcoes><Botao rotulo="Trocar credenciais" tipo="secundario" aoTocar={() => { limpar(); setTrocando(true); }} /></LinhaDeAcoes>
            ) : null}
          </View>
        ) : null}
        {!podeAlterar ? (
          <>
            {!dados.configurada ? <Texto variante="suave">A Kiwify ainda não foi configurada.</Texto> : null}
            <Texto variante="suave">Para mudar a Kiwify, peça a quem administra o financeiro.</Texto>
          </>
        ) : null}
        {comCampos ? (
          <View style={estilos.secao}>
            <Texto variante="secao">{criando ? 'Como configurar' : 'Novas credenciais'}</Texto>
            {criando ? (
              <View role="list" style={estilos.passos}>
                {PASSOS_DA_KIWIFY.map((p, i) => (
                  <View key={p} role="listitem" style={estilos.passo}>
                    <Texto variante="rotulo" numerico aria-hidden>{`${i + 1}.`}</Texto>
                    <Texto variante="suave" style={estilos.textoDoPasso}>{p}</Texto>
                  </View>
                ))}
              </View>
            ) : (
              <Texto variante="suave" style={estilos.antesDosCampos}>Em branco, fica o que está salvo. Se trocar o token, troque também no webhook da Kiwify.</Texto>
            )}
            {CAMPOS_DA_KIWIFY.map((c) => {
              const comum = {
                ref: refs[c], rotulo: ROTULOS_DA_KIWIFY[c].rotulo, valor: valores[c], aoMudar: mudar(c), erro: erroDoCampo(c),
                ajuda: ROTULOS_DA_KIWIFY[c].ajuda, autoComplete: 'off' as const, maxLength: CAMPO_MAXIMO,
              };
              return ehCampoSecreto(c)
                ? <CampoSenha key={c} {...comum} />
                : <Campo key={c} {...comum} autoCapitalize="none" autoCorrect={false} spellCheck={false} />;
            })}
            {trocando ? (
              <LinhaDeAcoes><Botao rotulo="Cancelar a troca" tipo="fantasma" aoTocar={() => { limpar(); setFalha(null); setTrocando(false); }} /></LinhaDeAcoes>
            ) : null}
          </View>
        ) : null}
        {falha && !removendo ? <MensagemErro texto={falha.texto} erro={falha.erro} /> : null}
        </View>
      </Cartao>
      <PainelConfirmacao visivel={removendo} titulo="Remover a Kiwify?" mensagem={MENSAGEM_REMOVER_KIWIFY}
        rotuloConfirmar="Remover Kiwify" rotuloCancelar="Voltar" perigo carregando={enviando}
        aoConfirmar={remover} aoCancelar={() => setRemovendo(false)}>
        {falha && removendo ? <MensagemErro texto={falha.texto} erro={falha.erro} /> : null}
      </PainelConfirmacao>
    </>
  );
}

const estilos = StyleSheet.create({
  corpo: { gap: espaco(3) },
  secao: { gap: espaco(1.5) },
  // A lista de passos e os campos são dois grupos: o dobro do espaço entre eles.
  passos: { gap: espaco(1), marginBottom: espaco(1.5) },
  antesDosCampos: { marginBottom: espaco(1.5) },
  passo: { flexDirection: 'row', gap: espaco(1), alignItems: 'flex-start' },
  textoDoPasso: { flex: 1 },
});
