import { Redirect } from 'expo-router';

import { entradaDoPublico } from '../dominio/entradaPorPublico';
import { useSessao } from '../sessao/SessaoProvider';
import { Cartao } from '../ui/Cartao';
import { LinhaDaLista, ListaDeLinhas } from '../ui/LinhaDaLista';
import { LinksDosTermos } from '../ui/LinksDosTermos';
import { TelaPublica } from '../ui/TelaPublica';

/**
 * Entrada genérica (`/entrar`), para quem não recebeu o link de uma área: duas opções, cada uma abre o formulário do
 * seu público. A escolha só leva ao formulário; o papel continua vindo do login.
 */
export default function Entrar() {
  const sessao = useSessao();
  if (sessao.situacao === 'autenticado') return <Redirect href="/" />;
  return (
    <TelaPublica titulo="Entrar" subtitulo="Escolha onde você quer entrar.">
      <Cartao>
        <ListaDeLinhas>
          <LinhaDaLista href={entradaDoPublico('ALUNO')} titulo="Área do aluno" descricao="Treinos, alimentação e acompanhamento." />
          <LinhaDaLista href={entradaDoPublico('TREINADOR')} titulo="Painel da consultoria" descricao="Treinador e equipe: planejamentos e alunos." />
        </ListaDeLinhas>
      </Cartao>
      <LinksDosTermos />
    </TelaPublica>
  );
}
