import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import * as rotas from '../api/rotas';
import type { ConvitePublico } from '../api/tipos';
import { codigoDoFragmento } from '../dominio/linkDeConvite';
import { useSessao } from '../sessao/SessaoProvider';
import { Campo } from '../ui/Campo';
import { CampoSenha } from '../ui/CampoSenha';
import { Cartao } from '../ui/Cartao';
import { Carregando, MensagemErro } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { LinkTexto } from '../ui/LinkTexto';
import { BotaoPublico, TelaPublica } from '../ui/TelaPublica';

/**
 * Convite do aluno: abre pelo link (`/convite#codigo=...`, o código no fragmento, tirado do endereço logo depois de
 * lido) ou digitando o código. Mostra a marca do treinador e cria a conta do aluno. O código vale uma vez só.
 */
export default function Convite() {
  const [doLink] = useState(() => (Platform.OS === 'web' && typeof window !== 'undefined' ? codigoDoFragmento(window.location.hash) : ''));
  const sessao = useSessao();
  const [codigo, setCodigo] = useState(doLink);
  const [convite, setConvite] = useState<ConvitePublico | null>(null);
  const [carregando, setCarregando] = useState(!!doLink);
  const [erro, setErro] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [enviando, setEnviando] = useState(false);

  /** Consulta o convite; só muda o estado na resposta, e nada se a tela já fechou. */
  const buscar = useCallback((valor: string, ativo: () => boolean) => {
    rotas.consultarConvite(valor.trim().toUpperCase())
      .then((encontrado) => {
        if (ativo()) {
          setConvite(encontrado);
          setErro(null);
        }
      })
      .catch((e: unknown) => {
        if (ativo()) {
          setConvite(null);
          setErro(textoDoErro(e));
        }
      })
      .finally(() => {
        if (ativo()) setCarregando(false);
      });
  }, []);

  // O código não fica no endereço (histórico, captura de tela, link copiado).
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.hash) {
      window.history.replaceState(window.history.state, '', window.location.pathname);
    }
  }, []);

  // Aberto pelo link do convite: consulta direto.
  useEffect(() => {
    if (!doLink) return;
    let ativo = true;
    buscar(doLink, () => ativo);
    return () => {
      ativo = false;
    };
  }, [doLink, buscar]);

  const consultar = (valor: string) => {
    if (!valor.trim()) {
      setErro('Digite o código do convite.');
      return;
    }
    setCarregando(true);
    setErro(null);
    buscar(valor, () => true);
  };

  const aceitar = async () => {
    if (!email.trim()) return setErro('Informe seu e-mail.');
    if (senha.length < 8) return setErro('A senha precisa ter pelo menos 8 caracteres.');
    if (senha !== confirmar) return setErro('As senhas não conferem.');
    setEnviando(true);
    setErro(null);
    try {
      await sessao.aceitarConvite(codigo.trim().toUpperCase(), email, senha);
      router.replace('/');
    } catch (e) {
      setErro(textoDoErro(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <TelaPublica
      titulo={convite ? `Olá, ${convite.primeiroNomeAluno}!` : 'Convite'}
      subtitulo={convite ? 'Crie seu acesso para ver seus treinos e registrar suas cargas.' : 'Digite o código que seu treinador enviou.'}
      marca={convite?.consultoria}>
      {!convite ? (
        <Cartao>
          <Campo rotulo="Código do convite" valor={codigo} aoMudar={setCodigo} autoCapitalize="characters"
            autoCorrect={false} maxLength={20} onSubmitEditing={() => consultar(codigo)} />
          {erro ? <MensagemErro texto={erro} /> : null}
          {carregando ? <Carregando /> : <BotaoPublico rotulo="Continuar" aoTocar={() => consultar(codigo)} />}
        </Cartao>
      ) : (
        <Cartao>
          <Campo rotulo="Seu e-mail" valor={email} aoMudar={setEmail} autoCapitalize="none"
            keyboardType="email-address" inputMode="email" autoComplete="email" />
          <CampoSenha rotulo="Crie uma senha" valor={senha} aoMudar={setSenha} autoComplete="new-password"
            ajuda="Mínimo de 8 caracteres." />
          <CampoSenha rotulo="Confirmar senha" valor={confirmar} aoMudar={setConfirmar}
            autoComplete="new-password" />
          {erro ? <MensagemErro texto={erro} /> : null}
          <BotaoPublico rotulo="Criar meu acesso" aoTocar={aceitar} carregando={enviando} cor={convite.consultoria.corPrimaria} />
        </Cartao>
      )}
      <View style={estilos.links}>
        {/* O convite da equipe da consultoria é outro (outro código e outra tela). */}
        {convite ? null : <LinkTexto href="/convite-equipe" texto="Sou da equipe da consultoria" />}
        <LinkTexto href="/entrar" texto="Já tenho conta" />
      </View>
    </TelaPublica>
  );
}

const estilos = StyleSheet.create({
  links: { alignItems: 'center' },
});
