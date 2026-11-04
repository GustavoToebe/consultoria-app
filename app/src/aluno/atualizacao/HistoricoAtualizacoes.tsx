import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { atualizacoesAluno } from '../../api/rotas';
import { statusAtualizacao } from '../../dominio/atualizacao';
import { dataParaTela } from '../../dominio/formatos';
import { periodoDesdeOPrimeiro } from '../../dominio/historicoDoAluno';
import { Cartao } from '../../ui/Cartao';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { LinhaDaLista, ListaDeLinhas } from '../../ui/LinhaDaLista';
import { Esqueleto } from '../../ui/Esqueleto';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';

export function HistoricoAtualizacoes() {
  const historico = useCarregar('atualizacoes-aluno',atualizacoesAluno);
  const { recarregar } = historico;
  useFocusEffect(useCallback(() => { recarregar(); }, [recarregar]));
  return <Cartao titulo="Atualizações" periodo={historico.dados ? periodoDesdeOPrimeiro(historico.dados.map((a) => a.dataAtualizacao)) : undefined} recolhivel>
    {historico.erro ? <MensagemErro texto={textoDoErro(historico.erro)} /> : null}
    {historico.carregando ? <Esqueleto texto="Carregando atualizações" cartoes={1} /> : null}
    {historico.dados?.length === 0 ? <Texto variante="suave">Você ainda não enviou atualizações.</Texto> : null}
    {historico.dados?.length ? <ListaDeLinhas>
      {historico.dados.map(a => <LinhaDaLista key={a.id} titulo={`Atualização · ${dataParaTela(a.dataAtualizacao)}`} selos={[statusAtualizacao(a)]} href={`/aluno/atualizacao?id=${a.id}`} />)}
    </ListaDeLinhas> : null}
  </Cartao>;
}
