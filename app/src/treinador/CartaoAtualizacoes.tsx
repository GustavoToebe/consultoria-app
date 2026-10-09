import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';
import { atualizacaoDoAluno, atualizacoesDoAluno } from '../api/rotas';
import { caminhoAtualizacaoTreinador, statusAtualizacaoTreinador } from '../dominio/atualizacao';
import { dataParaTela } from '../dominio/formatos';
import { espaco } from '../tema/tokens';
import { Cartao } from '../ui/Cartao';
import { MensagemErro } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { LinkTexto } from '../ui/LinkTexto';
import { Selo } from '../ui/Selo';
import { Texto } from '../ui/Texto';
import { useCarregar } from '../ui/useCarregar';

export function CartaoAtualizacoes({alunoId}: {alunoId:string}) {
  const lista=useCarregar(`atualizacoes:${alunoId}`,async()=>{
    const [atual,historico]=await Promise.all([atualizacaoDoAluno(alunoId),atualizacoesDoAluno(alunoId)]);
    return {atual,historico};
  });
  const {recarregar}=lista;
  useFocusEffect(useCallback(()=>{recarregar();},[recarregar]));
  const atual=lista.dados?.atual;
  const antigas=lista.dados?.historico.filter(a=>a.id!==atual?.id);
  return <Cartao titulo="Atualizações">
    {lista.erro?<MensagemErro texto={textoDoErro(lista.erro)} tentarDeNovo={recarregar} />:null}
    {lista.carregando?<Texto>Carregando atualizações…</Texto>:null}
    {atual?.dataAtualizacao?<View style={{gap:espaco(1)}}>
      <LinkTexto texto={`Atualização do período · ${dataParaTela(atual.dataAtualizacao)}`} href={caminhoAtualizacaoTreinador(atual)} />
      <Selo {...statusAtualizacaoTreinador(atual)} />
      {atual.feedback?<Texto variante="pequeno">Com feedback</Texto>:null}
    </View>:lista.dados?<Texto variante="suave">Sem próxima atualização: não há pasta vigente com período.</Texto>:null}
    {antigas?.length?<>
      <Texto variante="secao">Anteriores</Texto>
      {antigas.map(a=><View key={a.id} style={{gap:espaco(1)}}>
        <LinkTexto texto={`Atualização · ${dataParaTela(a.dataAtualizacao)}`} href={caminhoAtualizacaoTreinador(a)} />
        <Selo {...statusAtualizacaoTreinador(a)} />
        {a.feedback?<Texto variante="pequeno">Com feedback</Texto>:null}
      </View>)}
    </>:lista.dados?<Texto variante="pequeno">Nenhuma atualização anterior.</Texto>:null}
  </Cartao>;
}
