import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useSessao } from '../sessao/SessaoProvider';
import { espaco } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { Campo } from '../ui/Campo';
import { CampoSenha } from '../ui/CampoSenha';
import { Cartao } from '../ui/Cartao';
import { MensagemErro } from '../ui/Estados';
import { errosPorCampo, textoDoErro } from '../ui/erros';
import { LinkTexto } from '../ui/LinkTexto';
import { Tela } from '../ui/Tela';
import { Texto } from '../ui/Texto';

/** Cadastro de treinador: cria a consultoria já com as receitas padrão. */
export default function Cadastro() {
  const sessao = useSessao();
  const [dados, setDados] = useState({ nomeConsultoria: '', nome: '', email: '', senha: '', confirmar: '' });
  const [erro, setErro] = useState<string | null>(null);
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);

  if (sessao.situacao === 'autenticado') {
    return <Redirect href="/" />;
  }

  const mudar = (campo: keyof typeof dados) => (valor: string) => setDados((d) => ({ ...d, [campo]: valor }));

  const enviar = async () => {
    const locais: Record<string, string> = {};
    if (!dados.nomeConsultoria.trim()) locais.nomeConsultoria = 'Informe o nome da consultoria.';
    if (!dados.nome.trim()) locais.nome = 'Informe seu nome.';
    if (!dados.email.trim()) locais.email = 'Informe o e-mail.';
    if (dados.senha.length < 8) locais.senha = 'A senha precisa ter pelo menos 8 caracteres.';
    if (dados.senha !== dados.confirmar) locais.confirmar = 'As senhas não conferem.';
    setCampos(locais);
    if (Object.keys(locais).length) return;
    setEnviando(true);
    setErro(null);
    try {
      await sessao.cadastrarTreinador({
        nomeConsultoria: dados.nomeConsultoria.trim(),
        nome: dados.nome.trim(),
        email: dados.email.trim(),
        senha: dados.senha,
      });
      router.replace('/');
    } catch (e) {
      setErro(textoDoErro(e));
      setCampos(errosPorCampo(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Tela largura={480}>
      <View style={estilos.topo}>
        <Texto variante="titulo" nivel={1}>Criar conta de treinador</Texto>
        <Texto variante="suave">Sua consultoria nasce com receitas de séries, semanas de treino e dieta prontas para editar.</Texto>
      </View>
      <Cartao>
        <Campo rotulo="Nome da consultoria" valor={dados.nomeConsultoria} aoMudar={mudar('nomeConsultoria')}
          erro={campos.nomeConsultoria} maxLength={120} />
        <Campo rotulo="Seu nome" valor={dados.nome} aoMudar={mudar('nome')} erro={campos.nome} maxLength={120}
          autoComplete="name" />
        <Campo rotulo="E-mail" valor={dados.email} aoMudar={mudar('email')} erro={campos.email} autoCapitalize="none"
          keyboardType="email-address" inputMode="email" autoComplete="email" />
        <CampoSenha rotulo="Senha" valor={dados.senha} aoMudar={mudar('senha')} erro={campos.senha}
          autoComplete="new-password" ajuda="Mínimo de 8 caracteres." />
        <CampoSenha rotulo="Confirmar senha" valor={dados.confirmar} aoMudar={mudar('confirmar')} erro={campos.confirmar}
          autoComplete="new-password" />
        {erro ? <MensagemErro texto={erro} /> : null}
        <Botao rotulo="Criar conta" aoTocar={enviar} carregando={enviando} cheio />
      </Cartao>
      <View style={estilos.links}>
        <LinkTexto href="/entrar" texto="Já tenho conta" />
      </View>
    </Tela>
  );
}

const estilos = StyleSheet.create({
  topo: { gap: espaco(0.5), marginTop: espaco(4) },
  links: { alignItems: 'center' },
});
