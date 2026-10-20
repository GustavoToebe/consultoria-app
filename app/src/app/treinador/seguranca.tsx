import { View } from 'react-native';

import { espaco, LARGURA_EDITOR } from '../../tema/tokens';
import { VerificacaoEmDuasEtapas } from '../../treinador/seguranca/VerificacaoEmDuasEtapas';
import { Cabecalho } from '../../ui/Cabecalho';
import { Tela } from '../../ui/Tela';

/** Segurança da conta: verificação em duas etapas (a troca de senha fica em Meus dados). */
export default function Seguranca() {
  return (
    <Tela bordas={['top']} largura={LARGURA_EDITOR}>
      <Cabecalho titulo="Segurança" subtitulo="Verificação em duas etapas para entrar." />
      <View style={{ gap: espaco(3) }}>
        <VerificacaoEmDuasEtapas />
      </View>
    </Tela>
  );
}
