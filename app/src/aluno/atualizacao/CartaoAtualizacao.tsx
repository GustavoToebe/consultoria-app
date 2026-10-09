import { router } from 'expo-router';
import { linkCartaoAtualizacao, mostrarCartaoAtualizacao, statusAtualizacao } from '../../dominio/atualizacao';
import { Botao } from '../../ui/Botao';
import { Cartao } from '../../ui/Cartao';
import { LinkTexto } from '../../ui/LinkTexto';
import { Selo } from '../../ui/Selo';
import { useAtualizacao } from './useAtualizacao';
import { PermissaoLembrete } from './PermissaoLembrete';

export function CartaoAtualizacao() {
  const { dados } = useAtualizacao();
  if (!dados || !mostrarCartaoAtualizacao(dados)) return null;
  const status = statusAtualizacao(dados);
  const aberta = dados.fase === 'ABERTA' || dados.fase === 'ATRASADA';
  const abrir = () => router.push('/aluno/atualizacao');
  return <Cartao titulo="Sua atualização">
    <Selo {...status} />
    {aberta ? <Botao rotulo="Responder" aoTocar={abrir} /> :
      <LinkTexto texto={linkCartaoAtualizacao(dados)} href="/aluno/atualizacao" />}
    {aberta ? <LinkTexto texto="Vou atrasar" href="/aluno/atualizacao?atraso=sim" /> : null}
    <PermissaoLembrete atualizacao={dados} />
  </Cartao>;
}
