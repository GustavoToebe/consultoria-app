import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useSessao } from '../sessao/SessaoProvider';
import { espaco } from '../tema/tokens';
import { useAviso } from './Aviso';
import { Botao } from './Botao';
import { CampoSenha } from './CampoSenha';
import { Cartao } from './Cartao';
import { MensagemErro } from './Estados';
import { textoDoErro } from './erros';

/** Cartão de trocar a senha (some sem conexão). Encerra as outras sessões. */
export function TrocarSenha() {
  const sessao = useSessao();
  const { avisar } = useAviso();
  const [senhaAtual, setSenhaAtual] = useState('');
  const [senhaNova, setSenhaNova] = useState('');
  const [erroSenha, setErroSenha] = useState<string | null>(null);
  const [trocando, setTrocando] = useState(false);

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

  if (sessao.offline) return null;
  return (
    <Cartao titulo="Trocar senha">
      <CampoSenha rotulo="Senha atual" valor={senhaAtual} aoMudar={setSenhaAtual}
        autoComplete="current-password" />
      <CampoSenha rotulo="Nova senha" valor={senhaNova} aoMudar={setSenhaNova}
        autoComplete="new-password" ajuda="Mínimo de 8 caracteres. As outras sessões são encerradas." />
      {erroSenha ? <MensagemErro texto={erroSenha} /> : null}
      <View style={estilos.linha}>
        <Botao rotulo="Trocar senha" tipo="secundario" cheio aoTocar={trocarSenha} carregando={trocando}
          desabilitado={!senhaAtual || !senhaNova} motivo="Preencha a senha atual e a nova." />
      </View>
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
});
