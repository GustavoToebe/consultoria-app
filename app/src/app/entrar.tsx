import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { normalizarCodigo, pedeCodigoMfa } from '../dominio/mfa';
import { mensagemDaVerificacao, MOTIVO_VERIFICANDO, rotuloDoEnvio } from '../dominio/verificacaoHumana';
import { useSessao } from '../sessao/SessaoProvider';
import { espaco } from '../tema/tokens';
import { Campo } from '../ui/Campo';
import { CampoSenha } from '../ui/CampoSenha';
import { Cartao } from '../ui/Cartao';
import { MensagemErro } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { LinkTexto } from '../ui/LinkTexto';
import { BotaoPublico, TelaPublica } from '../ui/TelaPublica';
import { useVerificacaoHumana } from '../ui/useVerificacaoHumana';
import { VerificacaoHumana } from '../ui/VerificacaoHumana';

/** Entrar (símbolo e nome do produto: a marca do treinador só aparece depois do login). */
export default function Entrar() {
  const sessao = useSessao();
  const verificacao = useVerificacaoHumana();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  // Depois da senha, quem tem verificação em duas etapas informa o código do aplicativo (ou de recuperação).
  const [pedirCodigo, setPedirCodigo] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  if (sessao.situacao === 'autenticado') {
    return <Redirect href="/" />;
  }

  const enviar = async () => {
    if (!email.trim() || !senha) {
      setErro('Informe e-mail e senha.');
      return;
    }
    if (pedirCodigo && !codigo.trim()) {
      setErro('Informe o código de verificação.');
      return;
    }
    // O Enter nos campos chama `enviar` sem passar pelo botão desabilitado.
    if (verificacao.aguardando) return;
    setEnviando(true);
    setErro(null);
    let falha: unknown;
    try {
      await sessao.entrar(email, senha, pedirCodigo ? normalizarCodigo(codigo) : undefined, verificacao.token ?? undefined);
      router.replace('/');
    } catch (e) {
      falha = e;
      if (pedeCodigoMfa(e)) {
        setPedirCodigo(true);
      } else {
        setErro(mensagemDaVerificacao(e) ?? textoDoErro(e));
      }
    } finally {
      setEnviando(false);
      // O token é de uso único: também o do 1º envio (que pediu o MFA) já foi gasto; o 2º espera um novo.
      verificacao.depoisDoEnvio(falha);
    }
  };

  return (
    <TelaPublica titulo="Entrar" subtitulo="Treinos e dieta da sua consultoria.">
      <Cartao>
        <Campo rotulo="E-mail" valor={email} aoMudar={setEmail} autoCapitalize="none" autoComplete="email"
          keyboardType="email-address" inputMode="email" textContentType="emailAddress" />
        <CampoSenha rotulo="Senha" valor={senha} aoMudar={setSenha} autoComplete="current-password"
          textContentType="password" onSubmitEditing={enviar} returnKeyType="go" />
        {pedirCodigo ? (
          <Campo rotulo="Código de verificação" valor={codigo} aoMudar={setCodigo} autoCapitalize="none" autoComplete="one-time-code"
            ajuda="Do aplicativo autenticador. Sem o celular, use um código de recuperação."
            onSubmitEditing={enviar} returnKeyType="go" />
        ) : null}
        {erro ? <MensagemErro texto={erro} /> : null}
        {verificacao.exigida ? (
          <VerificacaoHumana siteKey={verificacao.siteKey} onToken={verificacao.aoReceberToken} chave={verificacao.chave} aoReconferir={verificacao.reconferir} />
        ) : null}
        <BotaoPublico rotulo={rotuloDoEnvio('Entrar', verificacao.aguardando, enviando)} aoTocar={enviar} carregando={enviando}
          desabilitado={verificacao.aguardando} motivo={MOTIVO_VERIFICANDO} />
      </Cartao>
      <View style={estilos.links}>
        <LinkTexto href="/esqueci-senha" texto="Esqueci minha senha" />
        <LinkTexto href="/convite" texto="Tenho um convite" />
        {verificacao.cadastroAberto ? <LinkTexto href="/cadastro" texto="Sou treinador, criar conta" /> : null}
      </View>
    </TelaPublica>
  );
}

const estilos = StyleSheet.create({
  links: { alignItems: 'center', marginTop: espaco(1) },
});
