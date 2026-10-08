import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Tema } from '../api/tipos';
import { useSessao } from '../sessao/SessaoProvider';
import { useTema } from '../tema/TemaProvider';
import { espaco } from '../tema/tokens';
import { useAviso } from './Aviso';
import { Botao } from './Botao';
import { Campo } from './Campo';
import { Cartao } from './Cartao';
import { MensagemErro } from './Estados';
import { textoDoErro } from './erros';
import { PainelConfirmacao } from './PainelConfirmacao';
import { Texto } from './Texto';

interface Props {
  /** Aviso extra no painel de sair (ex.: "Há 3 registros não enviados"). */
  avisoAoSair?: string | null;
  /** Blocos próprios da área (ex.: sincronização do aluno). */
  children?: ReactNode;
}

/** Conta do usuário (treinador e aluno): tema, senha e sair. */
export function PainelConta({ avisoAoSair, children }: Props) {
  const sessao = useSessao();
  const { escolha, escolher, modo } = useTema();
  const { avisar } = useAviso();
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [senhaNova, setSenhaNova] = useState('');
  const [erroSenha, setErroSenha] = useState<string | null>(null);
  const [trocando, setTrocando] = useState(false);

  const opcoes: { rotulo: string; valor: Tema | null }[] = [
    { rotulo: 'Padrão da consultoria', valor: null },
    { rotulo: 'Escuro', valor: 'ESCURO' },
    { rotulo: 'Claro', valor: 'CLARO' },
  ];

  const trocarSenha = async () => {
    if (senhaNova.length < 8) {
      setErroSenha('A nova senha precisa ter pelo menos 8 caracteres.');
      return;
    }
    setTrocando(true);
    setErroSenha(null);
    try {
      await sessao.trocarSenha(senhaAtual, senhaNova);
      setSenhaAtual('');
      setSenhaNova('');
      avisar('Senha alterada. As outras sessões foram encerradas.', 'sucesso');
    } catch (e) {
      setErroSenha(textoDoErro(e));
    } finally {
      setTrocando(false);
    }
  };

  const sair = async () => {
    setSaindo(true);
    await sessao.sair();
    setSaindo(false);
    setConfirmandoSaida(false);
    router.replace('/entrar');
  };

  return (
    <View style={estilos.coluna}>
      <Cartao titulo="Conta">
        <Texto variante="subtitulo">{sessao.usuario?.nome}</Texto>
        <Texto cor="suave">{sessao.usuario?.email}</Texto>
      </Cartao>
      {children}
      <Cartao titulo="Tema">
        <Texto cor="suave">Agora: {modo === 'ESCURO' ? 'escuro' : 'claro'}.</Texto>
        <View style={estilos.linha}>
          {opcoes.map((o) => (
            <Botao key={o.rotulo} rotulo={o.rotulo} tipo={escolha === o.valor ? 'primario' : 'secundario'}
              aoTocar={() => escolher(o.valor)} />
          ))}
        </View>
      </Cartao>
      {!sessao.offline ? (
        <Cartao titulo="Trocar senha">
          <Campo rotulo="Senha atual" valor={senhaAtual} aoMudar={setSenhaAtual} secureTextEntry
            autoComplete="current-password" />
          <Campo rotulo="Nova senha" valor={senhaNova} aoMudar={setSenhaNova} secureTextEntry
            autoComplete="new-password" ajuda="Mínimo de 8 caracteres. As outras sessões são encerradas." />
          {erroSenha ? <MensagemErro texto={erroSenha} /> : null}
          <View style={estilos.linha}>
            <Botao rotulo="Trocar senha" tipo="secundario" aoTocar={trocarSenha} carregando={trocando}
              desabilitado={!senhaAtual || !senhaNova} />
          </View>
        </Cartao>
      ) : null}
      <Botao rotulo="Sair" tipo="secundario" aoTocar={() => setConfirmandoSaida(true)} />
      <PainelConfirmacao
        visivel={confirmandoSaida}
        titulo="Sair da conta?"
        mensagem={avisoAoSair ?? 'Você vai precisar entrar de novo com e-mail e senha.'}
        rotuloConfirmar="Sair"
        perigo={!!avisoAoSair}
        carregando={saindo}
        aoConfirmar={sair}
        aoCancelar={() => setConfirmandoSaida(false)}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  coluna: { gap: espaco(2) },
  linha: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
});
