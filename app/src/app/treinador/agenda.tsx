import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { listarAtualizacoes, painelTreinador } from '../../api/rotas';
import { agruparPorDia, hojeDoServidor, resumoDeAtrasadas } from '../../dominio/agenda';
import { caminhoAtualizacaoTreinador, caminhoListaAtualizacoes, statusAtualizacaoTreinador } from '../../dominio/atualizacao';
import { hojeIso } from '../../dominio/formatos';
import { EscolhaResponsabilidade } from '../../treinador/EscolhaResponsabilidade';
import { espaco, LARGURA_LISTA } from '../../tema/tokens';
import { Cabecalho } from '../../ui/Cabecalho';
import { Cartao } from '../../ui/Cartao';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Grade } from '../../ui/Grade';
import { ItemDeLista } from '../../ui/ItemDeLista';
import { LinkTexto } from '../../ui/LinkTexto';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { useSessao } from '../../sessao/SessaoProvider';

/**
 * Agenda do treinador: as atualizações dos próximos 7 dias (`PROXIMAS`) agrupadas por dia. Mesmas permissões das
 * Atualizações (a guarda é `podeAcessarTela`) e o mesmo "Todos / Meus" no endereço (`?meus=true`).
 */
export default function AgendaDoTreinador() {
  const { meus: meusParam } = useLocalSearchParams<{ meus?: string }>();
  const meus = meusParam === 'true';
  // O resultado leva o recorte com que foi buscado: ao trocar Todos/Meus os dados antigos ficam no hook até a resposta
  // nova chegar e não podem aparecer como se fossem do recorte novo.
  const lista = useCarregar(`agenda:${meus}`, async () => ({ meus, itens: await listarAtualizacoes('PROXIMAS', meus) }));
  const { recarregar } = lista;
  // O resumo de atrasadas vem do painel (PAINEL_VER); sem a permissão ou se falhar, a linha simplesmente não aparece.
  const { pode } = useSessao();
  const painel = useCarregar(pode('PAINEL_VER') ? `agenda-painel:${meus}` : null, () => painelTreinador(meus));
  const recarregarPainel = painel.recarregar;
  useFocusEffect(useCallback(() => { recarregar(); recarregarPainel(); }, [recarregar, recarregarPainel]));

  // Os dias só existem com a lista na mão: carregando ou com erro, nada de "Sem atualizações" que a API não disse.
  // "Hoje" é o do servidor (Brasília), deduzido dos próprios itens; sem item, o do aparelho.
  const itens = lista.dados?.meus === meus ? lista.dados.itens : undefined;
  const { dias, hoje } = useMemo(() => {
    const dia = itens ? hojeDoServidor(itens) ?? hojeIso() : hojeIso();
    return { dias: itens ? agruparPorDia(itens, dia) : null, hoje: dia };
  }, [itens]);
  const atrasadas = resumoDeAtrasadas(painel.dados?.atualizacoesAtrasadas);

  return <Tela largura={LARGURA_LISTA} bordas={['top']}>
    <Cabecalho titulo="Agenda" mostrarMarca="celular" />
    <Texto variante="suave">As atualizações que vencem nos próximos 7 dias, dia a dia. Toque numa para abrir.</Texto>
    <EscolhaResponsabilidade valor={meus ? 'meus' : 'todos'} aoMudar={v => router.replace({ pathname: '/treinador/agenda', params: v === 'meus' ? { meus: 'true' } : {} })} />
    {atrasadas ? <LinkTexto texto={`${atrasadas}: ver na lista de Atualizações`} href={caminhoListaAtualizacoes('ATRASADAS', meus)} /> : null}
    {lista.erro ? <MensagemErro texto={textoDoErro(lista.erro)} erro={lista.erro} tentarDeNovo={recarregar} /> : null}
    {lista.carregando && !dias ? <Esqueleto /> : null}
    {dias ? dias.map(dia => <Cartao key={dia.data ?? 'sem-data'} titulo={dia.titulo}>
      {dia.itens.length === 0
        ? <Texto variante="suave">Sem atualizações</Texto>
        : <Grade gap={espaco(2)}>{dia.itens.map(a => {
          const selo = statusAtualizacaoTreinador(a, hoje);
          const nome = a.nomeAluno ?? 'Aluno';
          // O dia já está no título do cartão: o selo só entra quando diz algo a mais (adiada, atrasada).
          return <ItemDeLista key={a.pastaId} titulo={nome} selo={selo.tipo === 'neutro' ? undefined : { texto: selo.curto, tipo: selo.tipo }}
            href={caminhoAtualizacaoTreinador(a, { situacao: 'PROXIMAS', meus })} rotulo={`Abrir atualização de ${nome}, ${dia.titulo}${selo.tipo === 'neutro' ? '' : `, ${selo.curto}`}`} />;
        })}</Grade>}
    </Cartao>) : null}
  </Tela>;
}
