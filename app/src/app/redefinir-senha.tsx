import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { redefinirSenha } from '../api/rotas';
import { normalizarCodigo, pedeCodigoMfa } from '../dominio/mfa';
import { problemaDaNovaSenha, tokenDoFragmento } from '../dominio/redefinirSenha';
import { espaco } from '../tema/tokens';
import { Campo } from '../ui/Campo';
import { CampoSenha } from '../ui/CampoSenha';
import { Cartao } from '../ui/Cartao';
import { MensagemErro } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { LinkTexto } from '../ui/LinkTexto';
import { BotaoPublico, TelaPublica } from '../ui/TelaPublica';
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
      <TelaPublica titulo="Link inválido ou vencido">
        <Cartao>
          <Texto>{erro ?? 'Este link não funciona mais. Peça um novo para criar a senha.'}</Texto>
          <BotaoPublico rotulo="Pedir um novo link" aoTocar={() => router.replace('/esqueci-senha')} />
        </Cartao>
        <View style={estilos.links}>
          <LinkTexto href="/entrar" texto="Voltar para entrar" />
        </View>
      </TelaPublica>
    );
  }

  if (concluido) {
    return (
      <TelaPublica titulo="Senha redefinida">
        <Cartao>
          <Texto>Pronto. Por segurança, você saiu de todos os aparelhos. Entre com a senha nova.</Texto>
          <BotaoPublico rotulo="Entrar" aoTocar={() => router.replace('/entrar')} />
        </Cartao>
      </TelaPublica>
    );
  }

  return (
    <TelaPublica titulo="Criar senha nova" subtitulo="Escolha uma senha que você não use em outro lugar.">
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
        <BotaoPublico rotulo="Salvar senha nova" aoTocar={enviar} carregando={enviando} />
      </Cartao>
      <View style={estilos.links}>
        <LinkTexto href="/entrar" texto="Voltar para entrar" />
      </View>
    </TelaPublica>
  );
}

const estilos = StyleSheet.create({
  links: { alignItems: 'center', marginTop: espaco(1) },
});
