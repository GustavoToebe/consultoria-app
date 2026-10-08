import { useSessao } from '../../sessao/SessaoProvider';
import { Cabecalho } from '../../ui/Cabecalho';
import { Cartao } from '../../ui/Cartao';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';

/** Início do treinador. O painel (alunos, registros, planos terminando) entra na fase 5. */
export default function InicioTreinador() {
  const { usuario, marca } = useSessao();
  return (
    <Tela bordas={['top']}>
      <Cabecalho mostrarMarca="celular" />
      <Cartao>
        <Texto variante="subtitulo">Olá, {usuario?.nome}</Texto>
        <Texto variante="suave">Você está na consultoria {marca?.nome}.</Texto>
      </Cartao>
    </Tela>
  );
}
