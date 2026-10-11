import { useWindowDimensions } from 'react-native';

import { LARGURA_EDITOR, LARGURA_MENU_LATERAL } from '../../tema/tokens';
import { voltarDasTelasDaConta } from '../../dominio/menuDoUsuario';
import { Cabecalho } from '../../ui/Cabecalho';
import { PreferenciasDoApp } from '../../ui/PreferenciasDoApp';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';

/** Ajustes: preferências pessoais de tema, contraste, tamanho do texto, animações e vibração. */
export default function Ajustes() {
  const { width } = useWindowDimensions();
  return (
    <Tela bordas={['top']} largura={LARGURA_EDITOR}>
      <Cabecalho titulo="Ajustes" voltar={voltarDasTelasDaConta(width, LARGURA_MENU_LATERAL)} />
      <Texto variante="suave">Valem só neste aparelho e para a sua conta.</Texto>
      <PreferenciasDoApp comTitulo={false} />
    </Tela>
  );
}
