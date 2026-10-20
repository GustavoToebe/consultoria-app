import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { consultarConviteEquipe } from '../api/rotas';
import type { Marca } from '../api/tipos';
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
 * assim); "Usar outro código" o mostra. Com o código na mão (do link ou digitado, 43 caracteres), a tela consulta a marca da
 * consultoria (`POST /publico/convites-equipe/consultar`, código no corpo) e mostra nome e logo, como o convite do aluno;
 * código inválido, vencido ou já aceito dá a mesma resposta, e a tela só segue sem a marca. O aceite
 * (`POST /publico/convites-equipe/aceitar`) também leva o código no corpo, nunca no caminho.
 */
export default function ConviteEquipe() {
  const [doLink] = useState(() => (Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.hash.slice(1) : ''));
  const [codigo, setCodigo] = useState(doLink);
  const [verCodigo, setVerCodigo] = useState(!doLink);
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  // Marca da consulta e o código a que ela pertence: trocar o código esconde a marca antiga até a nova resposta.
  const [consultado, setConsultado] = useState<{ codigo: string; marca: Marca } | null>(null);
  const sessao = useSessao();
  // Só consulta código com o tamanho certo (o de equipe tem 43 caracteres); o resultado de uma consulta velha não vale.
  useEffect(() => {
    const valor = codigo.trim();
    if (valor.length !== 43) return;
    let ativo = true;
    consultarConviteEquipe(valor).then(
      (c) => { if (ativo) setConsultado({ codigo: valor, marca: c.consultoria }); },
      () => { if (ativo) setConsultado(null); },
    );
    return () => { ativo = false; };
  }, [codigo]);
  const marca = consultado && consultado.codigo === codigo.trim() ? consultado.marca : null;
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
    <TelaPublica titulo="Convite para a equipe" subtitulo={marca ? `Crie sua senha para entrar na equipe de ${marca.nome}.` : 'Crie sua senha para entrar na consultoria que convidou você.'} marca={marca}>
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
