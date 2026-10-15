import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { redefinirSenha } from '../api/rotas';
import { normalizarCodigo, pedeCodigoMfa } from '../dominio/mfa';
import { problemaDaNovaSenha, tokenDoFragmento } from '../dominio/redefinirSenha';
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

const WEB = Platform.OS === 'web' && typeof window !== 'undefined';

/**
 * Destino do link do e-mail (`/redefinir-senha#token=...`). O token está no fragmento, que não vai ao servidor nem ao Referer, e
 * sai do endereço logo após a leitura. Redefinir não abre sessão: todas as sessões antigas caem e a pessoa entra com a senha nova.
 */
export default function RedefinirSenha() {
  const [token] = useState(() => (WEB ? tokenDoFragmento(window.location.hash) : null));
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [pedirCodigo, setPedirCodigo] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [linkPerdido, setLinkPerdido] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [concluido, setConcluido] = useState(false);

  useEffect(() => {
    if (WEB && window.location.hash) {
      window.history.replaceState(window.history.state, '', window.location.pathname);
    }
  }, []);

  const enviar = async () => {
    const problema = problemaDaNovaSenha(senha, confirmacao);
    if (problema) {
      setErro(problema);
      return;
    }
    if (pedirCodigo && !codigo.trim()) {
      setErro('Informe o código de verificação.');
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      await redefinirSenha(token ?? '', senha, pedirCodigo ? normalizarCodigo(codigo) : undefined);
      setConcluido(true);
    } catch (e) {
      if (pedeCodigoMfa(e)) {
        setPedirCodigo(true);
      } else {
        setErro(textoDoErro(e));
        setLinkPerdido(typeof e === 'object' && e !== null && (e as { codigo?: unknown }).codigo === 'LINK_INVALIDO');
      }
    } finally {
      setEnviando(false);
    }
  };

  if (!token || linkPerdido) {
    return (
      <Tela largura={440}>
        <View style={estilos.topo}>
          <Texto variante="titulo" nivel={1}>Link inválido ou vencido</Texto>
        </View>
        <Cartao>
          <Texto>{erro ?? 'Este link não funciona mais. Peça um novo para criar a senha.'}</Texto>
          <Botao rotulo="Pedir um novo link" aoTocar={() => router.replace('/esqueci-senha')} cheio />
        </Cartao>
        <View style={estilos.links}>
          <LinkTexto href="/entrar" texto="Voltar para entrar" />
        </View>
      </Tela>
    );
  }

  if (concluido) {
    return (
      <Tela largura={440}>
        <View style={estilos.topo}>
          <Texto variante="titulo" nivel={1}>Senha redefinida</Texto>
        </View>
        <Cartao>
          <Texto>Pronto. Por segurança, você saiu de todos os aparelhos. Entre com a senha nova.</Texto>
          <Botao rotulo="Entrar" aoTocar={() => router.replace('/entrar')} cheio />
        </Cartao>
      </Tela>
    );
  }

  return (
    <Tela largura={440}>
      <View style={estilos.topo}>
        <Texto variante="titulo" nivel={1}>Criar senha nova</Texto>
        <Texto variante="suave">Escolha uma senha que você não use em outro lugar.</Texto>
      </View>
      <Cartao>
        <CampoSenha rotulo="Senha nova" valor={senha} aoMudar={setSenha} autoComplete="new-password" textContentType="newPassword"
          ajuda="Mínimo de 8 caracteres." />
        <CampoSenha rotulo="Confirmar senha" valor={confirmacao} aoMudar={setConfirmacao} autoComplete="new-password"
          textContentType="newPassword" onSubmitEditing={enviar} returnKeyType="go" />
        {pedirCodigo ? (
          <Campo rotulo="Código de verificação" valor={codigo} aoMudar={setCodigo} autoCapitalize="none" autoComplete="one-time-code"
            ajuda="Do aplicativo autenticador. Sem o celular, use um código de recuperação."
            onSubmitEditing={enviar} returnKeyType="go" />
        ) : null}
        {erro ? <MensagemErro texto={erro} /> : null}
        <Botao rotulo="Salvar senha nova" aoTocar={enviar} carregando={enviando} cheio />
      </Cartao>
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
