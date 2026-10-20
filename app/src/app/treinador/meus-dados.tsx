import { View } from 'react-native';

import { espaco, LARGURA_EDITOR } from '../../tema/tokens';
import { MeuPerfilEquipe } from '../../treinador/equipe/MeuPerfilEquipe';
import { useSessao } from '../../sessao/SessaoProvider';
import { Cabecalho } from '../../ui/Cabecalho';
import { Cartao } from '../../ui/Cartao';
import { CampoLeitura } from '../../ui/CampoLeitura';
import { Tela } from '../../ui/Tela';
import { TrocarSenha } from '../../ui/TrocarSenha';

/**
 * Meus dados: acesso (e-mail de entrada), seus dados na equipe (nome e telefone) e troca de senha. Aberta pelo cartão
 * do usuário. "Conta" ficou só para a assinatura ("Minha conta"); aqui o cartão do e-mail se chama "Acesso".
 */
export default function MeusDados() {
  const { usuario } = useSessao();
  return (
    <Tela bordas={['top']} largura={LARGURA_EDITOR}>
      <Cabecalho titulo="Meus dados" subtitulo="Seu acesso, seu nome na equipe e sua senha." />
      <View style={{ gap: espaco(3) }}>
        <Cartao titulo="Acesso">
          <CampoLeitura rotulo="E-mail de entrada" valor={usuario?.email} />
        </Cartao>
        <MeuPerfilEquipe />
        <TrocarSenha />
      </View>
    </Tela>
  );
}
