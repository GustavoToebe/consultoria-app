import { LARGURA_EDITOR } from '../../tema/tokens';
import { Cabecalho } from '../../ui/Cabecalho';
import { PreferenciasDoApp } from '../../ui/PreferenciasDoApp';
import { Tela } from '../../ui/Tela';

/** Ajustes: preferências pessoais de tema, contraste, tamanho do texto, animações e vibração. */
export default function Ajustes() {
  return (
    <Tela bordas={['top']} largura={LARGURA_EDITOR}>
      <Cabecalho titulo="Ajustes" subtitulo="Valem só neste aparelho e para a sua conta." />
      <PreferenciasDoApp comTitulo={false} />
    </Tela>
  );
}
