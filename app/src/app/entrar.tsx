import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { normalizarCodigo, pedeCodigoMfa } from '../dominio/mfa';
import { useSessao } from '../sessao/SessaoProvider';
import { espaco } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { Campo } from '../ui/Campo';
import { CampoSenha } from '../ui/CampoSenha';
import { Cartao } from '../ui/Cartao';
import { MensagemErro } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { LinkTexto } from '../ui/LinkTexto';
import { Tela } from '../ui/Tela';
import { Texto } from '../ui/Texto';

/** Entrar (marca neutra: a do treinador só aparece depois do login). */
export default function Entrar() {
  const sessao = useSessao();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  // Depois da senha, quem tem verificação em duas etapas informa o código do aplicativo (ou de recuperação).
  const [pedirCodigo, setPedirCodigo] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  // Em telas altas (PC), o formulário fica no meio em vez de colado no topo.
  const { height } = useWindowDimensions();
  const centrado = height >= 700;

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
    setEnviando(true);
    setErro(null);
    try {
      await sessao.entrar(email, senha, pedirCodigo ? normalizarCodigo(codigo) : undefined);
      router.replace('/');
    } catch (e) {
      if (pedeCodigoMfa(e)) {
        setPedirCodigo(true);
      } else {
        setErro(textoDoErro(e));
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Tela largura={440} centrado={centrado}>
      <View style={centrado ? estilos.topoCentrado : estilos.topo}>
        <Texto variante="titulo" nivel={1}>Entrar</Texto>
        <Texto variante="suave">Treinos e dieta da sua consultoria.</Texto>
      </View>
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
        <Botao rotulo="Entrar" aoTocar={enviar} carregando={enviando} cheio />
      </Cartao>
      <View style={estilos.links}>
        <LinkTexto href="/esqueci-senha" texto="Esqueci minha senha" />
        <LinkTexto href="/convite" texto="Tenho um convite" />
        <LinkTexto href="/cadastro" texto="Sou treinador, criar conta" />
      </View>
    </Tela>
  );
}

const estilos = StyleSheet.create({
  topo: { gap: espaco(0.5), marginTop: espaco(6) },
  topoCentrado: { gap: espaco(0.5) },
  links: { alignItems: 'center', marginTop: espaco(1) },
});
