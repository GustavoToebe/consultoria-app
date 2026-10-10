import { LARGURA_EDITOR } from '../../tema/tokens';
import { MeuPerfilEquipe } from '../../treinador/equipe/MeuPerfilEquipe';
import { Cabecalho } from '../../ui/Cabecalho';
import { PainelConta } from '../../ui/PainelConta';
import { Tela } from '../../ui/Tela';
import { Permitido } from '../../ui/Permitido';
import { LinkTexto } from '../../ui/LinkTexto';

export default function PerfilTreinador() {
  return (
    <Tela bordas={['top']} largura={LARGURA_EDITOR}>
      <Cabecalho titulo="Perfil" />
      <LinkTexto href="/treinador/ajuda" texto="Ajuda, primeiros passos e tutorial"/>
      <Permitido codigo="EQUIPE_LER"><LinkTexto href="/treinador/equipe" texto="Equipe"/></Permitido>
      <Permitido codigo="AUDITORIA_LER"><LinkTexto href="/treinador/auditoria" texto="Auditoria"/></Permitido>
      <PainelConta><MeuPerfilEquipe /></PainelConta>
    </Tela>
  );
}
