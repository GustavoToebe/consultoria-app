import { useWindowDimensions, View } from 'react-native';

import { voltarDasTelasDaConta } from '../../dominio/menuDoUsuario';
import { espaco, LARGURA_FORMULARIO, LARGURA_MENU_LATERAL } from '../../tema/tokens';
import { VerificacaoEmDuasEtapas } from '../../treinador/seguranca/VerificacaoEmDuasEtapas';
import { Cabecalho } from '../../ui/Cabecalho';
import { Tela } from '../../ui/Tela';

/** Segurança da conta: verificação em duas etapas (a troca de senha fica em Meus dados). */
export default function Seguranca() {
  const { width } = useWindowDimensions();
  return (
    <Tela bordas={['top']} largura={LARGURA_FORMULARIO}>
      <Cabecalho titulo="Segurança" voltar={voltarDasTelasDaConta(width, LARGURA_MENU_LATERAL)} />
      <View style={{ gap: espaco(3) }}>
        <VerificacaoEmDuasEtapas />
      </View>
    </Tela>
  );
}
