import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { atualizacoesAluno } from '../../api/rotas';
import { statusAtualizacao } from '../../dominio/atualizacao';
import { dataParaTela } from '../../dominio/formatos';
import { Cartao } from '../../ui/Cartao';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { LinkTexto } from '../../ui/LinkTexto';
import { Esqueleto } from '../../ui/Esqueleto';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';

export function HistoricoAtualizacoes() {
  const historico = useCarregar('atualizacoes-aluno',atualizacoesAluno);
  const { recarregar } = historico;
  useFocusEffect(useCallback(() => { recarregar(); }, [recarregar]));
  return <Cartao titulo="Atualizações" recolhivel>
    {historico.erro ? <MensagemErro texto={textoDoErro(historico.erro)} /> : null}
    {historico.carregando ? <Esqueleto texto="Carregando atualizações" cartoes={1} /> : null}
    {historico.dados?.length === 0 ? <Texto variante="suave">Você ainda não enviou atualizações.</Texto> : null}
    {historico.dados?.map(a => <Cartao key={a.id}>
      <LinkTexto texto={`Atualização · ${dataParaTela(a.dataAtualizacao)}`} href={`/aluno/atualizacao?id=${a.id}`} />
      <Selo {...statusAtualizacao(a)} />
    </Cartao>)}
  </Cartao>;
}
