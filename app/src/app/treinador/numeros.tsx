import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { numerosDaConsultoria } from '../../api/rotas';
import { View } from 'react-native';
import { contagemParaTela, MARCA_PARCIAL, REGRA_ALUNOS_ATIVOS, REGRA_ATUALIZACOES, resumoDasAtualizacoes, rotuloDoMes, textoDoResumo, totalDoMes } from '../../dominio/numeros';
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
  // Uma tabela só, um mês por linha e o mais recente em cima (antes eram duas tabelas com a coluna do mês repetida).
  const linhas = meses ? [...meses].reverse() : [];

  return <Tela largura={LARGURA_EDITOR} bordas={['top']}>
    <Cabecalho titulo="Números" mostrarMarca="celular" />
    <Texto variante="suave">Contagens da consultoria nos últimos 6 meses. Onde aparece “—”, o número não está disponível.</Texto>
    {numeros.erro ? <MensagemErro texto={textoDoErro(numeros.erro)} erro={numeros.erro} tentarDeNovo={recarregar} /> : null}
    {numeros.carregando && !meses ? <Esqueleto /> : null}
    {meses && meses.length === 0 ? <Vazio titulo="Sem números ainda" texto="Quando houver alunos e atualizações, as contagens aparecem aqui." /> : null}
    {meses && meses.length > 0 ? <>
      <Cartao titulo="Mês a mês" descricao="Do mês atual para o mais antigo.">
        <Tabela rotulo="Alunos ativos e atualizações de cada mês" larguraMinima={640} linhas={linhas} chave={m => m.mes} colunas={[
          { chave: 'mes', titulo: 'Mês', principal: true, flex: 1.4, render: m => <View>
            <Texto numerico>{rotuloDoMes(m.mes)}</Texto>
            {m.parcial ? <Texto variante="pequeno">{MARCA_PARCIAL}</Texto> : null}
          </View> },
          { chave: 'ativos', titulo: 'Alunos ativos', alinhar: 'direita', render: m => <Texto numerico>{contagemParaTela(m.alunosAtivos)}</Texto> },
          { chave: 'prazo', titulo: 'No prazo', alinhar: 'direita', render: m => <Texto numerico>{contagemParaTela(m.atualizacoesNoPrazo)}</Texto> },
          { chave: 'atrasadas', titulo: 'Atrasadas', alinhar: 'direita', render: m => <Texto numerico>{contagemParaTela(m.atualizacoesAtrasadas)}</Texto> },
          { chave: 'total', titulo: 'Atualizações', alinhar: 'direita', render: m => <Texto numerico>{contagemParaTela(totalDoMes(m))}</Texto> },
        ]} />
        {resumo ? <Texto variante="suave">{textoDoResumo(resumo)}</Texto> : null}
      </Cartao>
      <Cartao titulo="Como contamos">
        <Texto variante="suave">{REGRA_ALUNOS_ATIVOS}</Texto>
        <Texto variante="suave">{REGRA_ATUALIZACOES}</Texto>
      </Cartao>
    </> : null}
  </Tela>;
}
