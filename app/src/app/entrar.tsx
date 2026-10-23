import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { normalizarCodigo, pedeCodigoMfa } from '../dominio/mfa';
import { errosDaNovaSenha, pedeNovaSenha } from '../dominio/senhaProvisoria';
import { mensagemDaVerificacao, MOTIVO_VERIFICANDO, rotuloDoEnvio } from '../dominio/verificacaoHumana';
import { useSessao } from '../sessao/SessaoProvider';
import { espaco } from '../tema/tokens';
import { Botao } from '../ui/Botao';
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
  // Senha provisória do treinador: o login pede a senha nova do aluno. A provisória fica só neste estado (nunca armazenada).
  const [criarSenha, setCriarSenha] = useState(false);
  const [novaSenha, setNovaSenha] = useState('');
  const [repetida, setRepetida] = useState('');
  const [errosSenha, setErrosSenha] = useState<{ nova?: string; repetida?: string }>({});
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
    if (criarSenha) {
      const locais = errosDaNovaSenha(novaSenha, repetida);
      setErrosSenha(locais);
      if (locais.nova || locais.repetida) return;
    }
    // O Enter nos campos chama `enviar` sem passar pelo botão desabilitado.
    if (verificacao.aguardando) return;
    setEnviando(true);
    setErro(null);
    let falha: unknown;
    try {
      await sessao.entrar(email, senha, pedirCodigo ? normalizarCodigo(codigo) : undefined, verificacao.token ?? undefined,
        criarSenha ? novaSenha : undefined);
      router.replace('/');
    } catch (e) {
      falha = e;
      if (pedeCodigoMfa(e)) {
        setPedirCodigo(true);
      } else if (pedeNovaSenha(e)) {
        setCriarSenha(true);
      } else if (criarSenha && (e as { status?: unknown }).status === 400) {
        // Regra da senha nova (tamanho, igual ao e-mail, igual à provisória): embaixo do campo.
        setErrosSenha({ nova: textoDoErro(e) });
      } else {
        setErro(mensagemDaVerificacao(e) ?? textoDoErro(e));
      }
    } finally {
      setEnviando(false);
      // O token é de uso único: também o do 1º envio (que pediu o MFA) já foi gasto; o 2º espera um novo.
      verificacao.depoisDoEnvio(falha);
    }
  };

  const voltar = () => {
    setCriarSenha(false);
    setSenha('');
    setNovaSenha('');
    setRepetida('');
    setErrosSenha({});
    setErro(null);
  };

  // Um só cartão para os dois passos: erro, verificação humana e botão ficam no mesmo lugar e o widget não é remontado
  // ao trocar de passo (o token novo chega como no passo do código do MFA).
  return (
    <TelaPublica titulo={criarSenha ? 'Crie sua senha' : 'Entrar'}
      subtitulo={criarSenha ? 'Seu treinador criou uma senha provisória. Escolha agora a sua senha para entrar.' : 'Treinos e dieta da sua consultoria.'}>
      <Cartao>
        {criarSenha ? (
          <>
            <CampoSenha rotulo="Nova senha" valor={novaSenha} aoMudar={setNovaSenha} erro={errosSenha.nova}
              autoComplete="new-password" textContentType="newPassword" ajuda="Mínimo de 8 caracteres." />
            <CampoSenha rotulo="Repita a nova senha" valor={repetida} aoMudar={setRepetida} erro={errosSenha.repetida}
              autoComplete="new-password" textContentType="newPassword" onSubmitEditing={enviar} returnKeyType="go" />
          </>
        ) : (
          <>
            <Campo rotulo="E-mail" valor={email} aoMudar={setEmail} autoCapitalize="none" autoComplete="email"
              keyboardType="email-address" inputMode="email" textContentType="emailAddress" />
            <CampoSenha rotulo="Senha" valor={senha} aoMudar={setSenha} autoComplete="current-password"
              textContentType="password" onSubmitEditing={enviar} returnKeyType="go" />
            {pedirCodigo ? (
              <Campo rotulo="Código de verificação" valor={codigo} aoMudar={setCodigo} autoCapitalize="none" autoComplete="one-time-code"
                ajuda="Do aplicativo autenticador. Sem o celular, use um código de recuperação."
                onSubmitEditing={enviar} returnKeyType="go" />
            ) : null}
          </>
        )}
        {erro ? <MensagemErro texto={erro} /> : null}
        {verificacao.exigida ? (
          <VerificacaoHumana siteKey={verificacao.siteKey} onToken={verificacao.aoReceberToken} chave={verificacao.chave} aoReconferir={verificacao.reconferir} />
        ) : null}
        <BotaoPublico rotulo={rotuloDoEnvio(criarSenha ? 'Salvar e entrar' : 'Entrar', verificacao.aguardando, enviando)} aoTocar={enviar}
          carregando={enviando} desabilitado={verificacao.aguardando} motivo={MOTIVO_VERIFICANDO} />
      </Cartao>
      <View style={estilos.links}>
        {criarSenha ? <Botao tipo="fantasma" rotulo="Voltar" aoTocar={voltar} /> : (
          <>
            <LinkTexto href="/esqueci-senha" texto="Esqueci minha senha" />
            <LinkTexto href="/convite" texto="Tenho um convite" />
            {verificacao.cadastroAberto ? <LinkTexto href="/cadastro" texto="Sou treinador, criar conta" /> : null}
          </>
        )}
      </View>
    </TelaPublica>
  );
}

const estilos = StyleSheet.create({
  links: { alignItems: 'center', marginTop: espaco(1) },
});
