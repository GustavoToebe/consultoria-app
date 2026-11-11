import { Redirect, router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';

import { mensagemDaVerificacao, MOTIVO_VERIFICANDO, rotuloDoEnvio } from '../dominio/verificacaoHumana';
import { useSessao } from '../sessao/SessaoProvider';
import { Campo } from '../ui/Campo';
import { CampoSenha } from '../ui/CampoSenha';
import { Cartao } from '../ui/Cartao';
import { MensagemErro } from '../ui/Estados';
import { erroDeSenhaNoCampo, focarPrimeiroComErro, separarErros, textoDoErro } from '../ui/erros';
import { LinkTexto } from '../ui/LinkTexto';
import { BotaoPublico, TelaPublica } from '../ui/TelaPublica';
import { useVerificacaoHumana } from '../ui/useVerificacaoHumana';
import { VerificacaoHumana } from '../ui/VerificacaoHumana';

/** Cadastro de treinador: cria a consultoria já com as receitas padrão. */
export default function Cadastro() {
  const sessao = useSessao();
  const verificacao = useVerificacaoHumana();
  const [dados, setDados] = useState({ nomeConsultoria: '', nome: '', email: '', senha: '', confirmar: '' });
  const [erro, setErro] = useState<string | null>(null);
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const refConsultoria = useRef<TextInput>(null);
  const refNome = useRef<TextInput>(null);
  const refEmail = useRef<TextInput>(null);
  const refSenha = useRef<TextInput>(null);
  const refConfirmar = useRef<TextInput>(null);

  if (sessao.situacao === 'autenticado') {
    return <Redirect href="/" />;
  }

  const mudar = (campo: keyof typeof dados) => (valor: string) => setDados((d) => ({ ...d, [campo]: valor }));
  // Erro do campo fica embaixo dele e o foco vai ao primeiro (C6, como nos convites); o alerta só para o resto.
  const refs = [['nomeConsultoria', refConsultoria], ['nome', refNome], ['email', refEmail], ['senha', refSenha], ['confirmar', refConfirmar]] as const;
  const mostrar = (locais: Record<string, string>, geral: string | null) => {
    setCampos(locais);
    setErro(geral);
    focarPrimeiroComErro(locais, refs);
  };

  const enviar = async () => {
    const locais: Record<string, string> = {};
    if (!dados.nomeConsultoria.trim()) locais.nomeConsultoria = 'Informe o nome da consultoria.';
    if (!dados.nome.trim()) locais.nome = 'Informe seu nome.';
    if (!dados.email.trim()) locais.email = 'Informe o e-mail.';
    if (dados.senha.length < 8) locais.senha = 'A senha precisa ter pelo menos 8 caracteres.';
    if (dados.senha !== dados.confirmar) locais.confirmar = 'As senhas não conferem.';
    if (Object.keys(locais).length) {
      mostrar(locais, null);
      return;
    }
    setCampos({});
    // O Enter nos campos chama `enviar` sem passar pelo botão desabilitado.
    if (verificacao.aguardando) return;
    setEnviando(true);
    setErro(null);
    let falha: unknown;
    try {
      await sessao.cadastrarTreinador({
        nomeConsultoria: dados.nomeConsultoria.trim(),
        nome: dados.nome.trim(),
        email: dados.email.trim(),
        senha: dados.senha,
        turnstileToken: verificacao.token ?? undefined,
      });
      router.replace('/');
    } catch (e) {
      falha = e;
      const senhaRecusada = erroDeSenhaNoCampo(e);
      if (senhaRecusada) {
        mostrar({ senha: senhaRecusada }, null);
      } else {
        const separados = separarErros(e, refs.map(([c]) => c), mensagemDaVerificacao(e) ?? textoDoErro(e));
        mostrar(separados.campos, separados.geral);
      }
    } finally {
      setEnviando(false);
      // Token de uso único: gasto com a tentativa (sucesso ou erro).
      verificacao.depoisDoEnvio(falha);
    }
  };

  return (
    <TelaPublica titulo="Criar conta de treinador" subtitulo="Sua consultoria nasce com receitas de séries, semanas de treino e dieta prontas para editar.">
      <Cartao>
        <Campo ref={refConsultoria} rotulo="Nome da consultoria" valor={dados.nomeConsultoria} aoMudar={mudar('nomeConsultoria')}
          erro={campos.nomeConsultoria} maxLength={120} />
        <Campo ref={refNome} rotulo="Seu nome" valor={dados.nome} aoMudar={mudar('nome')} erro={campos.nome} maxLength={120}
          autoComplete="name" />
        <Campo ref={refEmail} rotulo="E-mail" valor={dados.email} aoMudar={mudar('email')} erro={campos.email} autoCapitalize="none"
          keyboardType="email-address" inputMode="email" autoComplete="email" />
        <CampoSenha ref={refSenha} rotulo="Senha" valor={dados.senha} aoMudar={mudar('senha')} erro={campos.senha}
          autoComplete="new-password" ajuda="Mínimo de 8 caracteres." />
        <CampoSenha ref={refConfirmar} rotulo="Confirmar senha" valor={dados.confirmar} aoMudar={mudar('confirmar')} erro={campos.confirmar}
          autoComplete="new-password" />
        {erro ? <MensagemErro texto={erro} /> : null}
        {verificacao.exigida ? (
          <VerificacaoHumana siteKey={verificacao.siteKey} onToken={verificacao.aoReceberToken} chave={verificacao.chave} aoReconferir={verificacao.reconferir} />
        ) : null}
        <BotaoPublico rotulo={rotuloDoEnvio('Criar conta', verificacao.aguardando, enviando)} aoTocar={enviar} carregando={enviando}
          desabilitado={verificacao.aguardando} motivo={MOTIVO_VERIFICANDO} />
      </Cartao>
      <View style={estilos.links}>
        <LinkTexto href="/treinador/entrar" texto="Já tenho conta" />
      </View>
    </TelaPublica>
  );
}

const estilos = StyleSheet.create({
  links: { alignItems: 'center' },
});
