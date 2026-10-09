import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { atualizacaoAluno } from '../../api/rotas';
import { statusAtualizacao } from '../../dominio/atualizacao';
import { hojeIso } from '../../dominio/formatos';
import { Botao } from '../../ui/Botao';
import { Cartao } from '../../ui/Cartao';
import { LinkTexto } from '../../ui/LinkTexto';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';

export function CartaoAtualizacao() {
  const { dados, recarregar } = useCarregar(`atualizacao:${hojeIso()}`,atualizacaoAluno);
  useFocusEffect(useCallback(() => { recarregar(); }, [recarregar]));
  if (!dados || dados.fase === 'NENHUMA' || (dados.fase === 'REVISADA' && !dados.feedback?.naoLido)) return null;
  const status = statusAtualizacao(dados);
  const aberta = dados.fase === 'ABERTA' || dados.fase === 'ATRASADA';
  const abrir = () => router.push('/aluno/atualizacao');
  return <Cartao titulo="Sua atualização">
    <Selo {...status} />
    <Texto>{status.texto}</Texto>
    {aberta ? <Botao rotulo="Responder" aoTocar={abrir} /> :
      <LinkTexto texto={dados.fase === 'AVISO' ? 'Ver o que vou responder' : dados.feedback ? 'Ler' : 'Ver respostas'} href="/aluno/atualizacao" />}
    {aberta ? <LinkTexto texto="Vou atrasar" href="/aluno/atualizacao?atraso=sim" /> : null}
  </Cartao>;
}
