import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import * as rotas from '../api/rotas';
import type { ConvitePublico } from '../api/tipos';
import { useSessao } from '../sessao/SessaoProvider';
import { espaco } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { Campo } from '../ui/Campo';
import { Cartao } from '../ui/Cartao';
import { Carregando, MensagemErro } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { LinkTexto } from '../ui/LinkTexto';
import { MarcaTitulo } from '../ui/MarcaTitulo';
import { Tela } from '../ui/Tela';
import { Texto } from '../ui/Texto';

/**
 * Convite do aluno: abre pelo link (`/convite?codigo=...`) ou digitando o código. Mostra a marca do treinador e cria
 * a conta do aluno. O código vale uma vez só.
 */
export default function Convite() {
  const params = useLocalSearchParams<{ codigo?: string }>();
  const sessao = useSessao();
  const [codigo, setCodigo] = useState(params.codigo ?? '');
  const [convite, setConvite] = useState<ConvitePublico | null>(null);
  const [carregando, setCarregando] = useState(!!params.codigo);
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

  // Aberto pelo link do convite: consulta direto.
  useEffect(() => {
    if (!params.codigo) return;
    let ativo = true;
    buscar(params.codigo, () => ativo);
    return () => {
      ativo = false;
    };
  }, [params.codigo, buscar]);

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
    <Tela largura={480}>
      {!convite ? (
        <>
          <View style={estilos.topo}>
            <Texto variante="titulo">Convite</Texto>
            <Texto variante="suave">Digite o código que seu treinador enviou.</Texto>
          </View>
          <Cartao>
            <Campo rotulo="Código do convite" valor={codigo} aoMudar={setCodigo} autoCapitalize="characters"
              autoCorrect={false} maxLength={20} onSubmitEditing={() => consultar(codigo)} />
            {erro ? <MensagemErro texto={erro} /> : null}
            {carregando ? <Carregando /> : <Botao rotulo="Continuar" aoTocar={() => consultar(codigo)} cheio />}
          </Cartao>
        </>
      ) : (
        <>
          <View style={estilos.topo}>
            <MarcaTitulo marca={convite.consultoria} tamanho="grande" />
            <Texto variante="subtitulo">Olá, {convite.primeiroNomeAluno}!</Texto>
            <Texto variante="suave">Crie seu acesso para ver seus treinos e registrar suas cargas.</Texto>
          </View>
          <Cartao>
            <Campo rotulo="Seu e-mail" valor={email} aoMudar={setEmail} autoCapitalize="none"
              keyboardType="email-address" inputMode="email" autoComplete="email" />
            <Campo rotulo="Crie uma senha" valor={senha} aoMudar={setSenha} secureTextEntry autoComplete="new-password"
              ajuda="Mínimo de 8 caracteres." />
            <Campo rotulo="Confirmar senha" valor={confirmar} aoMudar={setConfirmar} secureTextEntry
              autoComplete="new-password" />
            {erro ? <MensagemErro texto={erro} /> : null}
            <Botao rotulo="Criar meu acesso" aoTocar={aceitar} carregando={enviando} cheio />
          </Cartao>
        </>
      )}
      <View style={estilos.links}>
        <LinkTexto href="/entrar" texto="Já tenho conta" />
      </View>
    </Tela>
  );
}

const estilos = StyleSheet.create({
  topo: { gap: espaco(1), marginTop: espaco(4) },
  links: { alignItems: 'center' },
});
