import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

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
    setEnviando(true);
    setErro(null);
    try {
      await sessao.entrar(email, senha);
      router.replace('/');
    } catch (e) {
      setErro(textoDoErro(e));
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
        {erro ? <MensagemErro texto={erro} /> : null}
        <Botao rotulo="Entrar" aoTocar={enviar} carregando={enviando} cheio />
      </Cartao>
      <View style={estilos.links}>
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
