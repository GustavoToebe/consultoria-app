import { LARGURA_EDITOR } from '../../tema/tokens';
import { MeuPerfilEquipe } from '../../treinador/equipe/MeuPerfilEquipe';
import { Cabecalho } from '../../ui/Cabecalho';
import { PainelConta } from '../../ui/PainelConta';
import { Tela } from '../../ui/Tela';
import { Permitido } from '../../ui/Permitido';
import { Cartao } from '../../ui/Cartao';
import { LinkTexto } from '../../ui/LinkTexto';
import { Texto } from '../../ui/Texto';

export default function PerfilTreinador() {
  return (
    <Tela bordas={['top']} largura={LARGURA_EDITOR}>
      <Cabecalho titulo="Perfil" />
      <Texto variante="suave">Sua conta, suas preferências e atalhos para ajuda, equipe e auditoria.</Texto>
      <Cartao titulo="Atalhos" descricao="Páginas de apoio e de gestão da consultoria.">
        <LinkTexto href="/treinador/ajuda" texto="Ajuda, primeiros passos e tutorial"/>
        <Permitido codigo="EQUIPE_LER"><LinkTexto href="/treinador/equipe" texto="Equipe"/></Permitido>
        <Permitido codigo="AUDITORIA_LER"><LinkTexto href="/treinador/auditoria" texto="Auditoria"/></Permitido>
      </Cartao>
      <PainelConta><MeuPerfilEquipe /></PainelConta>
    </Tela>
  );
}
