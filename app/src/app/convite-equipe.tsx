import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { useSessao } from '../sessao/SessaoProvider';
import { Botao } from '../ui/Botao';
import { Campo } from '../ui/Campo';
import { CampoSenha } from '../ui/CampoSenha';
import { Cartao } from '../ui/Cartao';
import { MensagemErro } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { LinkTexto } from '../ui/LinkTexto';
import { BotaoPublico, TelaPublica } from '../ui/TelaPublica';
import { Texto } from '../ui/Texto';

/**
 * Convite para a equipe. O código vem no fragmento do link (não vai para o servidor nem para o Referer) e sai do
 * endereço logo depois de lido. Vindo do link, o campo do código fica escondido (antes a tela pedia o código mesmo
 * assim); "Usar outro código" o mostra. A API ainda não tem consulta pública do convite de equipe, então o nome da
 * consultoria só aparece depois de entrar.
 */
export default function ConviteEquipe() {
  const [doLink] = useState(() => (Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.hash.slice(1) : ''));
  const [codigo, setCodigo] = useState(doLink);
  const [verCodigo, setVerCodigo] = useState(!doLink);
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const sessao = useSessao();
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.hash) window.history.replaceState(window.history.state, '', window.location.pathname);
  }, []);
  const aceitar = async () => {
    if (!codigo.trim()) return setErro('Informe o código do convite.');
    if (senha.length < 8) return setErro('A senha precisa ter pelo menos 8 caracteres.');
    if (senha !== confirmacao) return setErro('As senhas não conferem.');
    setOcupado(true);
    setErro(null);
    try {
      await sessao.aceitarConviteEquipe(codigo.trim(), senha);
      router.replace('/treinador');
    } catch (e) {
      setErro(textoDoErro(e));
    } finally {
      setOcupado(false);
    }
  };
  return (
    <TelaPublica titulo="Convite para a equipe" subtitulo="Crie sua senha para entrar na consultoria que convidou você.">
      <Cartao>
        {verCodigo ? (
          <Campo rotulo="Código do convite de equipe" valor={codigo} aoMudar={setCodigo} autoCapitalize="none" autoCorrect={false} maxLength={43} />
        ) : (
          <View style={estilos.codigoDoLink}>
            <Texto variante="suave">Código do convite recebido pelo link.</Texto>
            <Botao rotulo="Usar outro código" tipo="fantasma" aoTocar={() => { setCodigo(''); setVerCodigo(true); }} />
          </View>
        )}
        <CampoSenha rotulo="Crie uma senha" valor={senha} aoMudar={setSenha} autoComplete="new-password" ajuda="Mínimo de 8 caracteres." />
        <CampoSenha rotulo="Confirmar senha" valor={confirmacao} aoMudar={setConfirmacao} autoComplete="new-password" />
        {erro ? <MensagemErro texto={erro} /> : null}
        <BotaoPublico rotulo="Criar meu acesso à equipe" carregando={ocupado} aoTocar={() => void aceitar()} />
      </Cartao>
      <View style={estilos.links}>
        <LinkTexto href="/convite" texto="Sou aluno" />
        <LinkTexto href="/entrar" texto="Já tenho conta" />
      </View>
    </TelaPublica>
  );
}

const estilos = StyleSheet.create({
  codigoDoLink: { gap: 4 },
  links: { alignItems: 'center' },
});
