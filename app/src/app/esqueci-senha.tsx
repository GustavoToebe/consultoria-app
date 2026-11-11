import { Redirect } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';

import { pedirRedefinicaoDeSenha } from '../api/rotas';
import { mensagemDaVerificacao, MOTIVO_VERIFICANDO, rotuloDoEnvio } from '../dominio/verificacaoHumana';
import { useSessao } from '../sessao/SessaoProvider';
import { espaco } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { Campo } from '../ui/Campo';
import { Cartao } from '../ui/Cartao';
import { MensagemErro } from '../ui/Estados';
import { separarErros, textoDoErro } from '../ui/erros';
import { LinkTexto } from '../ui/LinkTexto';
import { BotaoPublico, TelaPublica } from '../ui/TelaPublica';
import { Texto } from '../ui/Texto';
import { useVerificacaoHumana } from '../ui/useVerificacaoHumana';
import { VerificacaoHumana } from '../ui/VerificacaoHumana';

/** Pede o link de redefinição por e-mail. A resposta é a mesma exista a conta ou não: a tela nunca diz se o e-mail é conhecido. */
export default function EsqueciSenha() {
  const sessao = useSessao();
  const verificacao = useVerificacaoHumana();
  const [email, setEmail] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  // Erro do campo (C6): vazio ou recusado pela API fica embaixo do e-mail; o alerta é só para o erro do servidor.
  const [erroEmail, setErroEmail] = useState<string | null>(null);
  const refEmail = useRef<TextInput>(null);
  const [enviando, setEnviando] = useState(false);
  const [pedido, setPedido] = useState(false);

  if (sessao.situacao === 'autenticado') {
    return <Redirect href="/" />;
  }

  const enviar = async () => {
    if (!email.trim()) {
      setErroEmail('Informe o e-mail.');
      setErro(null);
      refEmail.current?.focus();
      return;
    }
    // O Enter no campo chama `enviar` sem passar pelo botão desabilitado.
    if (verificacao.aguardando) return;
    setEnviando(true);
    setErro(null);
    setErroEmail(null);
    let falha: unknown;
    try {
      await pedirRedefinicaoDeSenha(email.trim(), verificacao.token ?? undefined);
      setPedido(true);
    } catch (e) {
      falha = e;
      const separados = separarErros(e, ['email'], mensagemDaVerificacao(e) ?? textoDoErro(e));
      setErroEmail(separados.campos.email ?? null);
      setErro(separados.geral);
      if (separados.campos.email) refEmail.current?.focus();
    } finally {
      setEnviando(false);
      // Token de uso único: gasto com a tentativa (sucesso ou erro).
      verificacao.depoisDoEnvio(falha);
    }
  };

  return (
    // Um título por estado: o pedido é "solicitado", nunca "entregue" (a tela não sabe se a conta existe nem se o e-mail chegou).
    <TelaPublica titulo={pedido ? 'Link solicitado' : 'Esqueci minha senha'}
      subtitulo={pedido ? undefined : 'Enviaremos um link para você criar uma senha nova.'}>
      {pedido ? (
        <Cartao>
          <View accessibilityLiveRegion="polite">
            <Texto>
              Se existir uma conta com este e-mail, o link já está a caminho. Ele vale por 30 minutos e só pode ser usado uma vez.
              Se não chegar, olhe também o spam.
            </Texto>
          </View>
          <Botao rotulo="Pedir outro link" tipo="secundario" aoTocar={() => setPedido(false)} cheio />
        </Cartao>
      ) : (
        <Cartao>
          <Campo ref={refEmail} rotulo="E-mail da sua conta" valor={email} aoMudar={setEmail} erro={erroEmail} autoCapitalize="none" autoComplete="email"
            keyboardType="email-address" inputMode="email" textContentType="emailAddress" maxLength={254}
            onSubmitEditing={enviar} returnKeyType="send" />
          {erro ? <MensagemErro texto={erro} /> : null}
          {verificacao.exigida ? (
            <VerificacaoHumana siteKey={verificacao.siteKey} onToken={verificacao.aoReceberToken} chave={verificacao.chave} aoReconferir={verificacao.reconferir} />
          ) : null}
          <BotaoPublico rotulo={rotuloDoEnvio('Enviar link', verificacao.aguardando, enviando)} aoTocar={enviar} carregando={enviando}
            desabilitado={verificacao.aguardando} motivo={MOTIVO_VERIFICANDO} />
        </Cartao>
      )}
      <View style={estilos.links}>
        <LinkTexto href="/entrar" texto="Voltar para entrar" />
      </View>
    </TelaPublica>
  );
}

const estilos = StyleSheet.create({
  links: { alignItems: 'center', marginTop: espaco(1) },
});
