import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View, type TextInput } from 'react-native';

import * as rotas from '../api/rotas';
import type { ConvitePublico } from '../api/tipos';
import { codigoDoFragmento } from '../dominio/linkDeConvite';
import { useSessao } from '../sessao/SessaoProvider';
import { Campo } from '../ui/Campo';
import { CampoSenha } from '../ui/CampoSenha';
import { Cartao } from '../ui/Cartao';
import { MensagemErro } from '../ui/Estados';
import { erroDeSenhaNoCampo, focarPrimeiroComErro, separarErros } from '../ui/erros';
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
  // Erro de cada campo (C6), pelos nomes da API; o alerta fica para o erro do servidor (convite vencido, rede).
  const [campos, setCampos] = useState<Record<string, string>>({});
  const refCodigo = useRef<TextInput>(null);
  const refEmail = useRef<TextInput>(null);
  const refSenha = useRef<TextInput>(null);
  const refConfirmar = useRef<TextInput>(null);
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
          setCampos({});
        }
      })
      .catch((e: unknown) => {
        if (ativo()) {
          setConvite(null);
          const separados = separarErros(e, ['codigo']);
          setCampos(separados.campos);
          setErro(separados.geral);
          focarPrimeiroComErro(separados.campos, [['codigo', refCodigo]]);
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
      setCampos({ codigo: 'Digite o código do convite.' });
      setErro(null);
      refCodigo.current?.focus();
      return;
    }
    setCarregando(true);
    setErro(null);
    setCampos({});
    buscar(valor, () => true);
  };

  const refsDoAceite = [['email', refEmail], ['senha', refSenha], ['confirmar', refConfirmar]] as const;
  const aceitar = async () => {
    const locais: Record<string, string> = {};
    if (!email.trim()) locais.email = 'Informe seu e-mail.';
    if (senha.length < 8) locais.senha = 'A senha precisa ter pelo menos 8 caracteres.';
    else if (senha !== confirmar) locais.confirmar = 'As senhas não conferem.';
    setCampos(locais);
    setErro(null);
    if (Object.keys(locais).length) {
      focarPrimeiroComErro(locais, refsDoAceite);
      return;
    }
    setEnviando(true);
    try {
      await sessao.aceitarConvite(codigo.trim().toUpperCase(), email, senha);
      router.replace('/');
    } catch (e) {
      const senhaRecusada = erroDeSenhaNoCampo(e);
      if (senhaRecusada) {
        const locais = { senha: senhaRecusada };
        setCampos(locais);
        setErro(null);
        focarPrimeiroComErro(locais, refsDoAceite);
      } else {
        // O código não está mais na tela (passo do acesso): erro nele vai ao alerta.
        const separados = separarErros(e, refsDoAceite.map(([c]) => c));
        setCampos(separados.campos);
        setErro(separados.geral);
        focarPrimeiroComErro(separados.campos, refsDoAceite);
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <TelaPublica
      titulo={convite ? `Olá, ${convite.primeiroNomeAluno}!` : 'Convite de aluno'}
      subtitulo={convite ? 'Crie seu acesso para ver seus treinos e registrar suas cargas.' : 'Digite o código que seu treinador enviou.'}
      marca={convite?.consultoria}>
      {!convite ? (
        <Cartao>
          <Campo ref={refCodigo} rotulo="Código do convite" valor={codigo} aoMudar={setCodigo} erro={campos.codigo} autoCapitalize="characters"
            autoCorrect={false} maxLength={20} onSubmitEditing={() => consultar(codigo)} />
          {erro ? <MensagemErro texto={erro} /> : null}
          {/* O botão fica no lugar durante a consulta (só ganha o indicador), sem a tela pular. */}
          <BotaoPublico rotulo="Continuar" aoTocar={() => consultar(codigo)} carregando={carregando} />
        </Cartao>
      ) : (
        <Cartao>
          <Campo ref={refEmail} rotulo="Seu e-mail" valor={email} aoMudar={setEmail} erro={campos.email} autoCapitalize="none"
            keyboardType="email-address" inputMode="email" autoComplete="email" />
          <CampoSenha ref={refSenha} rotulo="Crie uma senha" valor={senha} aoMudar={setSenha} erro={campos.senha} autoComplete="new-password"
            ajuda="Mínimo de 8 caracteres." />
          <CampoSenha ref={refConfirmar} rotulo="Confirmar senha" valor={confirmar} aoMudar={setConfirmar} erro={campos.confirmar}
            autoComplete="new-password" onSubmitEditing={() => void aceitar()} returnKeyType="go" />
          {erro ? <MensagemErro texto={erro} /> : null}
          <BotaoPublico rotulo="Criar meu acesso" aoTocar={aceitar} carregando={enviando} cor={convite.consultoria.corPrimaria} />
        </Cartao>
      )}
      <View style={estilos.links}>
        {/* O convite da equipe da consultoria é outro (outro código e outra tela). */}
        {convite ? null : <LinkTexto href="/convite-equipe" texto="Sou da equipe da consultoria" />}
        <LinkTexto href="/aluno/entrar" texto="Já tenho conta" />
      </View>
    </TelaPublica>
  );
}

const estilos = StyleSheet.create({
  links: { alignItems: 'center' },
});
