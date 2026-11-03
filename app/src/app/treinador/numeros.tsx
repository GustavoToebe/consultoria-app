import { useFocusEffect } from 'expo-router';
import { Lock } from 'lucide-react-native';
import { useCallback } from 'react';
import { numerosDaConsultoria } from '../../api/rotas';
import { StyleSheet, View } from 'react-native';
import { situacaoDoLimite } from '../../dominio/limiteDeAlunos';
import { alunosELimite, contagemParaTela, linhasDaEquipe, MARCA_PARCIAL, REGRA_ALUNOS_ATIVOS, REGRA_ATUALIZACOES, REGRA_DA_EQUIPE, REGRA_DA_EQUIPE_ATUALIZACOES, resumoDasAtualizacoes, rotuloDoMes, textoDoResumo, totalDoMes, type LinhaDaTabelaDaEquipe } from '../../dominio/numeros';
import { espaco, LARGURA_EDITOR } from '../../tema/tokens';
import { ICONE_DO_SELO } from '../../treinador/iconesDosSelos';
import { Cabecalho } from '../../ui/Cabecalho';
import { Cartao } from '../../ui/Cartao';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Selo } from '../../ui/Selo';
import { Tabela } from '../../ui/Tabela';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';

/**
 * Números da consultoria: só contagens dos últimos 6 meses (`GET /numeros`, `PAINEL_VER`, a guarda é `podeAcessarTela`).
 * Sem nome nem id de aluno. Valor que a API manda nulo aparece como "—" (nunca zero inventado); o mês corrente vem marcado
 * "até hoje" porque ainda não terminou. A tabela da equipe (supervisão, D1 e D16) só aparece quando a API a manda (com
 * `EQUIPE_LER`, D17): uma linha por membro ativo e "Sem responsável", só contagens, nunca nome nem id de aluno.
 */
export default function NumerosDoTreinador() {
  const numeros = useCarregar('numeros', () => numerosDaConsultoria());
  const { recarregar } = numeros;
  useFocusEffect(useCallback(() => { recarregar(); }, [recarregar]));

  const meses = numeros.dados?.meses;
  const resumo = meses ? resumoDasAtualizacoes(meses) : null;
  // Uma tabela só, um mês por linha e o mais recente em cima (antes eram duas tabelas com a coluna do mês repetida).
  const linhas = meses ? [...meses].reverse() : [];
  const equipe = linhasDaEquipe(numeros.dados);

  return <Tela largura={LARGURA_EDITOR} bordas={['top']}>
    <Cabecalho titulo="Números" mostrarMarca="celular" />
    <Texto variante="suave">{equipe ? 'Contagens da consultoria nos últimos 6 meses e da equipe hoje.' : 'Contagens da consultoria nos últimos 6 meses.'} Onde aparece “—”, o número não está disponível.</Texto>
    {numeros.erro ? <MensagemErro texto={textoDoErro(numeros.erro)} erro={numeros.erro} tentarDeNovo={recarregar} /> : null}
    {numeros.carregando && !meses ? <Esqueleto /> : null}
    {meses && meses.length === 0 ? <Vazio titulo="Sem números ainda" texto="Quando houver alunos e atualizações, as contagens aparecem aqui." /> : null}
    {meses && meses.length > 0 ? <>
      <Cartao titulo="Mês a mês" descricao="Do mês atual para o mais antigo.">
        <Tabela rotulo="Alunos ativos e atualizações de cada mês" larguraMinima={640} linhas={linhas} chave={m => m.mes} colunas={[
          // O mês que ainda não terminou leva o selo neutro "até hoje" (com ícone, como os selos do estilo novo).
          { chave: 'mes', titulo: 'Mês', principal: true, flex: 1.4, render: m => <View style={estilos.mes}>
            <Texto numerico>{rotuloDoMes(m.mes)}</Texto>
            {m.parcial ? <Selo texto={MARCA_PARCIAL} tipo="neutro" Icone={ICONE_DO_SELO.neutro} /> : null}
          </View> },
          { chave: 'ativos', titulo: 'Alunos ativos', alinhar: 'direita', render: m => <Texto numerico>{contagemParaTela(m.alunosAtivos)}</Texto> },
          { chave: 'prazo', titulo: 'No prazo', alinhar: 'direita', render: m => <Texto numerico>{contagemParaTela(m.atualizacoesNoPrazo)}</Texto> },
          { chave: 'atrasadas', titulo: 'Atrasadas', alinhar: 'direita', render: m => <Texto numerico>{contagemParaTela(m.atualizacoesAtrasadas)}</Texto> },
          { chave: 'total', titulo: 'Atualizações', alinhar: 'direita', render: m => <Texto numerico>{contagemParaTela(totalDoMes(m))}</Texto> },
        ]} />
        {resumo ? <Texto variante="suave">{textoDoResumo(resumo)}</Texto> : null}
      </Cartao>
    </> : null}
    {equipe ? <Cartao titulo="Equipe" descricao="Alunos ativos de cada membro hoje, com o limite ao lado. Só contagens.">
      {equipe.length ? <Tabela rotulo="Alunos e atualizações de cada membro da equipe" larguraMinima={640} linhas={equipe} chave={l => l.chave} colunas={[
        { chave: 'nome', titulo: 'Membro', principal: true, flex: 1.6, render: l => <Texto>{l.nome}</Texto> },
        { chave: 'alunos', titulo: 'Alunos ativos / limite', flex: 1.4, alinhar: 'direita', render: l => <AlunosELimite linha={l} /> },
        { chave: 'atrasadas', titulo: 'Atrasadas', alinhar: 'direita', render: l => <Texto numerico>{contagemParaTela(l.atrasadas)}</Texto> },
        { chave: 'revisar', titulo: 'Para revisar', alinhar: 'direita', render: l => <Texto numerico>{contagemParaTela(l.paraRevisar)}</Texto> },
      ]} /> : <Vazio titulo="Ninguém na equipe" texto="Quando houver membros ativos, cada um aparece aqui." />}
    </Cartao> : null}
    {(meses && meses.length > 0) || equipe ? <Cartao titulo="Como contamos">
      {meses && meses.length > 0 ? <Texto variante="suave">{REGRA_ALUNOS_ATIVOS}</Texto> : null}
      {meses && meses.length > 0 ? <Texto variante="suave">{REGRA_ATUALIZACOES}</Texto> : null}
      {equipe ? <Texto variante="suave">{REGRA_DA_EQUIPE}</Texto> : null}
      {equipe ? <Texto variante="suave">{REGRA_DA_EQUIPE_ATUALIZACOES}</Texto> : null}
    </Cartao> : null}
  </Tela>;
}

/** "12 / 30" e, quando passa ou bate no limite, o selo com texto (D4: quem passou não perde aluno; status nunca na cor da marca). */
function AlunosELimite({ linha }: { linha: LinhaDaTabelaDaEquipe }) {
  const situacao = linha.limite === undefined ? 'sem-limite' : situacaoDoLimite(linha.alunosAtivos, linha.limite);
  return <View style={estilos.alunos}>
    <Texto numerico>{alunosELimite(linha)}</Texto>
    {situacao === 'acima' ? <Selo texto="Acima do limite" tipo="atencao" Icone={ICONE_DO_SELO.atencao} /> : null}
    {situacao === 'cheio' ? <Selo texto="No limite" tipo="neutro" Icone={Lock} /> : null}
  </View>;
}

const estilos = StyleSheet.create({
  mes: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1) },
  alunos: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: espaco(1) },
});
