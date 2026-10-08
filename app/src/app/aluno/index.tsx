import { useSessao } from '../../sessao/SessaoProvider';
import { Cabecalho } from '../../ui/Cabecalho';
import { Cartao } from '../../ui/Cartao';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';

/** Treino do aluno. O treino do dia, as séries e o registro offline entram na fase 6. */
export default function TreinoAluno() {
  const { usuario } = useSessao();
  return (
    <Tela bordas={['top']} largura={720}>
      <Cabecalho mostrarMarca="sempre" />
      <Cartao>
        <Texto variante="subtitulo">Olá, {usuario?.nome}</Texto>
      </Cartao>
    </Tela>
  );
}
