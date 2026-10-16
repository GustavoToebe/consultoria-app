import { Redirect } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { pedirRedefinicaoDeSenha } from '../api/rotas';
import { mensagemDaVerificacao, MOTIVO_VERIFICANDO, rotuloDoEnvio } from '../dominio/verificacaoHumana';
import { useSessao } from '../sessao/SessaoProvider';
import { espaco } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { Campo } from '../ui/Campo';
import { Cartao } from '../ui/Cartao';
import { MensagemErro } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { LinkTexto } from '../ui/LinkTexto';
import { Tela } from '../ui/Tela';
import { Texto } from '../ui/Texto';
import { useVerificacaoHumana } from '../ui/useVerificacaoHumana';
import { VerificacaoHumana } from '../ui/VerificacaoHumana';

/** Pede o link de redefinição por e-mail. A resposta é a mesma exista a conta ou não: a tela nunca diz se o e-mail é conhecido. */
export default function EsqueciSenha() {
  const sessao = useSessao();
  const verificacao = useVerificacaoHumana();
  const [email, setEmail] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [pedido, setPedido] = useState(false);

  if (sessao.situacao === 'autenticado') {
    return <Redirect href="/" />;
  }

  const enviar = async () => {
    if (!email.trim()) {
      setErro('Informe o e-mail.');
      return;
    }
    // O Enter no campo chama `enviar` sem passar pelo botão desabilitado.
    if (verificacao.aguardando) return;
    setEnviando(true);
    setErro(null);
    let falha: unknown;
    try {
      await pedirRedefinicaoDeSenha(email.trim(), verificacao.token ?? undefined);
      setPedido(true);
    } catch (e) {
      falha = e;
      setErro(mensagemDaVerificacao(e) ?? textoDoErro(e));
    } finally {
      setEnviando(false);
      // Token de uso único: gasto com a tentativa (sucesso ou erro).
      verificacao.depoisDoEnvio(falha);
    }
  };

  return (
    <Tela largura={440}>
      <View style={estilos.topo}>
        <Texto variante="titulo" nivel={1}>Esqueci minha senha</Texto>
        <Texto variante="suave">Enviaremos um link para você criar uma senha nova.</Texto>
      </View>
      {pedido ? (
        <Cartao>
          <Texto variante="bloco" nivel={2}>Confira seu e-mail</Texto>
          <Texto>
            Se existir uma conta com este e-mail, o link já está a caminho. Ele vale por 30 minutos e só pode ser usado uma vez.
            Se não chegar, olhe também o spam.
          </Texto>
          <Botao rotulo="Pedir outro link" tipo="secundario" aoTocar={() => setPedido(false)} cheio />
        </Cartao>
      ) : (
        <Cartao>
          <Campo rotulo="E-mail da sua conta" valor={email} aoMudar={setEmail} autoCapitalize="none" autoComplete="email"
            keyboardType="email-address" inputMode="email" textContentType="emailAddress" maxLength={254}
            onSubmitEditing={enviar} returnKeyType="send" />
          {erro ? <MensagemErro texto={erro} /> : null}
          {verificacao.exigida ? (
            <VerificacaoHumana siteKey={verificacao.siteKey} onToken={verificacao.aoReceberToken} chave={verificacao.chave} />
          ) : null}
          <Botao rotulo={rotuloDoEnvio('Enviar link', verificacao.aguardando, enviando)} aoTocar={enviar} carregando={enviando}
            desabilitado={verificacao.aguardando} motivo={MOTIVO_VERIFICANDO} cheio />
        </Cartao>
      )}
      <View style={estilos.links}>
        <LinkTexto href="/entrar" texto="Voltar para entrar" />
      </View>
    </Tela>
  );
}

const estilos = StyleSheet.create({
  topo: { gap: espaco(0.5), marginTop: espaco(6) },
  links: { alignItems: 'center', marginTop: espaco(1) },
});
