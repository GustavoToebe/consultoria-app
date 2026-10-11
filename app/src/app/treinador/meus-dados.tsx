import { useWindowDimensions, View } from 'react-native';

import { espaco, LARGURA_FORMULARIO, LARGURA_MENU_LATERAL } from '../../tema/tokens';
import { MeuPerfilEquipe } from '../../treinador/equipe/MeuPerfilEquipe';
import { useSessao } from '../../sessao/SessaoProvider';
import { voltarDasTelasDaConta } from '../../dominio/menuDoUsuario';
import { Cabecalho } from '../../ui/Cabecalho';
import { Cartao } from '../../ui/Cartao';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { TrocarSenha } from '../../ui/TrocarSenha';

/** Meus dados: e-mail, nome e telefone (perfil pessoal na equipe) e troca de senha. Aberta pelo cartão do usuário. */
export default function MeusDados() {
  const { usuario } = useSessao();
  const { width } = useWindowDimensions();
  return (
    <Tela bordas={['top']} largura={LARGURA_FORMULARIO}>
      <Cabecalho titulo="Meus dados" voltar={voltarDasTelasDaConta(width, LARGURA_MENU_LATERAL)} />
      <View style={{ gap: espaco(3) }}>
        <Cartao titulo="Conta">
          <Texto variante="bloco">{usuario?.nome}</Texto>
          <Texto variante="suave">{usuario?.email}</Texto>
        </Cartao>
        <MeuPerfilEquipe />
        <TrocarSenha />
      </View>
    </Tela>
  );
}
