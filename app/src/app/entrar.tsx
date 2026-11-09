import { Redirect, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';

import { normalizarCodigo, pedeCodigoMfa } from '../dominio/mfa';
import { errosDaNovaSenha, pedeNovaSenha } from '../dominio/senhaProvisoria';
import { mensagemDaVerificacao, MOTIVO_VERIFICANDO, rotuloDoEnvio } from '../dominio/verificacaoHumana';
import { useSessao } from '../sessao/SessaoProvider';
import { espaco } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { Campo } from '../ui/Campo';
import { Escolha } from '../ui/Escolha';
import { CampoSenha } from '../ui/CampoSenha';
import { Cartao } from '../ui/Cartao';
import { MensagemErro } from '../ui/Estados';
import { errosPorCampo, focarPrimeiroComErro, separarErros, textoDoErro } from '../ui/erros';
import { LinksDosTermos } from '../ui/LinksDosTermos';
import { LinkTexto } from '../ui/LinkTexto';
import { BotaoPublico, TelaPublica } from '../ui/TelaPublica';
import { useVerificacaoHumana } from '../ui/useVerificacaoHumana';
import { VerificacaoHumana } from '../ui/VerificacaoHumana';

/** Entrar (símbolo e nome do produto: a marca do treinador só aparece depois do login). */
export default function Entrar({ modoFixo }: { modoFixo?: 'ALUNO' | 'TREINADOR' } = {}) {
  const sessao = useSessao();
  const verificacao = useVerificacaoHumana();
  // Só muda o texto e o link de criar conta: o papel vem do login, a senha é a mesma tela para os dois.
  const [modoEntrada, setModoEntrada] = useState<'ALUNO' | 'TREINADOR'>(modoFixo ?? 'ALUNO');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  // Depois da senha, quem tem verificação em duas etapas informa o código do aplicativo (ou de recuperação).
  const [pedirCodigo, setPedirCodigo] = useState(false);
  const [codigo, setCodigo] = useState('');
  // Senha provisória do treinador: o login pede a senha nova do aluno. A provisória fica só neste estado (nunca armazenada).
  const [criarSenha, setCriarSenha] = useState(false);
  const [novaSenha, setNovaSenha] = useState('');
  const [repetida, setRepetida] = useState('');
  // Erro de cada campo (C6), pelos nomes da API (`fieldErrors`); o alerta fica só para o erro do servidor.
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const refEmail = useRef<TextInput>(null);
  const refSenha = useRef<TextInput>(null);
  const refCodigo = useRef<TextInput>(null);
  const refNovaSenha = useRef<TextInput>(null);
  const refRepetida = useRef<TextInput>(null);
  // "Crie sua senha" e o código de verificação entram no lugar dos campos anteriores: o foco vai para o campo novo.
  useEffect(() => {
    if (criarSenha) refNovaSenha.current?.focus();
  }, [criarSenha]);
  useEffect(() => {
    if (pedirCodigo) refCodigo.current?.focus();
  }, [pedirCodigo]);

  if (sessao.situacao === 'autenticado') {
    return <Redirect href="/" />;
  }

  // Campos na tela em cada passo, na ordem do foco; erro da API num campo de fora (a senha provisória) vai ao alerta.
  const refs = criarSenha
    ? ([['novaSenha', refNovaSenha], ['repetida', refRepetida]] as const)
    : ([['email', refEmail], ['senha', refSenha], ...(pedirCodigo ? [['codigoMfa', refCodigo] as const] : [])] as const);
  const mostrar = (locais: Record<string, string>, geral: string | null) => {
    setCampos(locais);
    setErro(geral);
    focarPrimeiroComErro(locais, refs);
  };

  const enviar = async () => {
    const locais: Record<string, string> = {};
    if (criarSenha) {
      const nova = errosDaNovaSenha(novaSenha, repetida);
      if (nova.nova) locais.novaSenha = nova.nova;
      if (nova.repetida) locais.repetida = nova.repetida;
    } else {
      if (!email.trim()) locais.email = 'Informe o e-mail.';
      if (!senha) locais.senha = 'Informe a senha.';
      if (pedirCodigo && !codigo.trim()) locais.codigoMfa = 'Informe o código de verificação.';
    }
    if (Object.keys(locais).length) {
      mostrar(locais, null);
      return;
    }
    // O Enter nos campos chama `enviar` sem passar pelo botão desabilitado.
    if (verificacao.aguardando) return;
    setEnviando(true);
    setErro(null);
    setCampos({});
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
      } else if (criarSenha && (e as { status?: unknown }).status === 400 && !mensagemDaVerificacao(e)
        && Object.keys(errosPorCampo(e)).length === 0) {
        // Regra da senha nova (tamanho, igual ao e-mail, igual à provisória): embaixo do campo. A verificação humana
        // recusada e o erro que já aponta o campo seguem pelo `separarErros`.
        mostrar({ novaSenha: textoDoErro(e) }, null);
      } else {
        const separados = separarErros(e, refs.map(([c]) => c), mensagemDaVerificacao(e) ?? textoDoErro(e));
        mostrar(separados.campos, separados.geral);
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
    setCampos({});
    setErro(null);
  };

  // Um só cartão para os dois passos: erro, verificação humana e botão ficam no mesmo lugar e o widget não é remontado
  // ao trocar de passo (o token novo chega como no passo do código do MFA).
  return (
    <TelaPublica titulo={criarSenha ? 'Crie sua senha' : 'Entrar'}
      subtitulo={criarSenha ? 'Seu treinador criou uma senha provisória. Escolha agora a sua senha para entrar.' : modoEntrada === 'ALUNO' ? 'Entre com o e-mail e a senha que seu treinador enviou.' : 'Treinos, dietas e a gestão da sua consultoria.'}>
      <Cartao>
        {!criarSenha && !modoFixo ? (
          <Escolha
            rotulo="Quem está entrando"
            distribuida
            opcoes={[
              { valor: 'ALUNO', rotulo: 'Sou aluno' },
              { valor: 'TREINADOR', rotulo: 'Sou treinador' },
            ]}
            valor={modoEntrada}
            aoMudar={setModoEntrada}
          />
        ) : null}
        {criarSenha ? (
          <>
            <CampoSenha ref={refNovaSenha} rotulo="Nova senha" valor={novaSenha} aoMudar={setNovaSenha} erro={campos.novaSenha}
              autoComplete="new-password" textContentType="newPassword" ajuda="Mínimo de 8 caracteres." />
            <CampoSenha ref={refRepetida} rotulo="Repita a nova senha" valor={repetida} aoMudar={setRepetida} erro={campos.repetida}
              autoComplete="new-password" textContentType="newPassword" onSubmitEditing={enviar} returnKeyType="go" />
          </>
        ) : (
          <>
            <Campo ref={refEmail} rotulo="E-mail" valor={email} aoMudar={setEmail} erro={campos.email} autoCapitalize="none" autoComplete="email"
              keyboardType="email-address" inputMode="email" textContentType="emailAddress" />
            <CampoSenha ref={refSenha} rotulo="Senha" valor={senha} aoMudar={setSenha} erro={campos.senha} autoComplete="current-password"
              textContentType="password" onSubmitEditing={enviar} returnKeyType="go" />
            {pedirCodigo ? (
              <Campo ref={refCodigo} rotulo="Código de verificação" valor={codigo} aoMudar={setCodigo} erro={campos.codigoMfa} autoCapitalize="none" autoComplete="one-time-code"
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
            {verificacao.cadastroAberto && modoEntrada === 'TREINADOR' ? <LinkTexto href="/cadastro" texto="Sou treinador, criar conta" /> : null}
          </>
        )}
      </View>
      <LinksDosTermos />
    </TelaPublica>
  );
}

const estilos = StyleSheet.create({
  links: { alignItems: 'center', marginTop: espaco(1) },
});
