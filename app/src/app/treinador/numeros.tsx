import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { numerosDaConsultoria } from '../../api/rotas';
import { contagemParaTela, REGRA_ALUNOS_ATIVOS, REGRA_ATUALIZACOES, resumoDasAtualizacoes, rotuloDoMesCompleto, textoDoResumo, totalDoMes } from '../../dominio/numeros';
import { LARGURA_EDITOR } from '../../tema/tokens';
import { Cabecalho } from '../../ui/Cabecalho';
import { Cartao } from '../../ui/Cartao';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Tabela } from '../../ui/Tabela';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';

/**
 * Números da consultoria: só contagens dos últimos 6 meses (`GET /numeros`, `PAINEL_VER`, a guarda é `podeAcessarTela`).
 * Sem nomes de pessoas. Valor que a API manda nulo aparece como "—" (nunca zero inventado); o mês corrente vem marcado
 * "até hoje" porque ainda não terminou.
 */
export default function NumerosDoTreinador() {
  const numeros = useCarregar('numeros', () => numerosDaConsultoria());
  const { recarregar } = numeros;
  useFocusEffect(useCallback(() => { recarregar(); }, [recarregar]));

  const meses = numeros.dados?.meses;
  const resumo = meses ? resumoDasAtualizacoes(meses) : null;

  return <Tela largura={LARGURA_EDITOR} bordas={['top']}>
    <Cabecalho titulo="Números" mostrarMarca="celular" />
    <Texto variante="suave">Contagens da consultoria nos últimos 6 meses. Onde aparece “—”, o número não está disponível.</Texto>
    {numeros.erro ? <MensagemErro texto={textoDoErro(numeros.erro)} erro={numeros.erro} tentarDeNovo={recarregar} /> : null}
    {numeros.carregando && !meses ? <Esqueleto /> : null}
    {meses && meses.length === 0 ? <Vazio titulo="Sem números ainda" texto="Quando houver alunos e atualizações, as contagens aparecem aqui." /> : null}
    {meses && meses.length > 0 ? <>
      <Cartao titulo="Alunos ativos no fim do mês" descricao={REGRA_ALUNOS_ATIVOS}>
        <Tabela rotulo="Alunos ativos no fim de cada mês" larguraMinima={760} linhas={meses} chave={m => m.mes} colunas={[
          { chave: 'mes', titulo: 'Mês', principal: true, flex: 1.4, render: m => <Texto>{rotuloDoMesCompleto(m)}</Texto> },
          { chave: 'ativos', titulo: 'Alunos ativos', alinhar: 'direita', render: m => <Texto numerico>{contagemParaTela(m.alunosAtivos)}</Texto> },
        ]} />
      </Cartao>
      <Cartao titulo="Atualizações do mês" descricao={REGRA_ATUALIZACOES}>
        <Tabela rotulo="Atualizações de cada mês, no prazo e atrasadas" larguraMinima={760} linhas={meses} chave={m => m.mes} colunas={[
          { chave: 'mes', titulo: 'Mês', principal: true, flex: 1.4, render: m => <Texto>{rotuloDoMesCompleto(m)}</Texto> },
          { chave: 'prazo', titulo: 'No prazo', alinhar: 'direita', render: m => <Texto numerico>{contagemParaTela(m.atualizacoesNoPrazo)}</Texto> },
          { chave: 'atrasadas', titulo: 'Atrasadas', alinhar: 'direita', render: m => <Texto numerico>{contagemParaTela(m.atualizacoesAtrasadas)}</Texto> },
          { chave: 'total', titulo: 'Total', alinhar: 'direita', render: m => <Texto numerico>{contagemParaTela(totalDoMes(m))}</Texto> },
        ]} />
        {resumo ? <Texto variante="suave">{textoDoResumo(resumo)}</Texto> : null}
      </Cartao>
    </> : null}
  </Tela>;
}
