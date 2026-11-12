import { useFocusEffect } from 'expo-router';
import { Lock } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { numerosDaConsultoria } from '../../api/rotas';
import { type LayoutChangeEvent, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SEM_DADO } from '../../dominio/formatos';
import { situacaoDoLimite } from '../../dominio/limiteDeAlunos';
import { escalar } from '../../dominio/preferencias';
import { alunosELimite, contagemParaTela, linhasDaEquipe, MARCA_PARCIAL, REGRA_ALUNOS_ATIVOS, REGRA_ATUALIZACOES, REGRA_DA_EQUIPE, REGRA_DA_EQUIPE_ATUALIZACOES, resumoDasAtualizacoes, rotuloDoMes, textoDoResumo, totalDoMes, type LinhaDaTabelaDaEquipe } from '../../dominio/numeros';
import { espaco, LARGURA_MENU_LATERAL } from '../../tema/tokens';
import { ICONE_DO_SELO } from '../../treinador/iconesDosSelos';
import { useTema } from '../../tema/TemaProvider';
import { Cabecalho } from '../../ui/Cabecalho';
import { Cartao } from '../../ui/Cartao';
import { Esqueleto } from '../../ui/Esqueleto';
import { corDoNumero } from '../../ui/indicador';
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
  const { width } = useWindowDimensions();
  const { bordas, fatorTexto } = useTema();
  // Texto maior pede tabela mais larga para os cabeçalhos não se encostarem.
  const larguraMinima = escalar(LARGURA_DA_TABELA, fatorTexto);
  // Medido no contêiner, não na janela: o menu lateral come parte da largura.
  const [larguraDasTabelas, setLarguraDasTabelas] = useState(0);
  const aoMedir = (e: LayoutChangeEvent) => setLarguraDasTabelas(e.nativeEvent.layout.width);
  const metade = (larguraDasTabelas - ESPACO_ENTRE) / 2;
  // Lado a lado só se cada tabela, tirados o recuo e a borda do cartão (os do `Cartao` no PC), ainda for tabela.
  const coluna = metade - 2 * (RECUO_DO_CARTAO + bordas.bloco) >= larguraMinima ? { width: metade } : null;

  return <Tela bordas={['top']} folga={width >= LARGURA_MENU_LATERAL ? espaco(3.5) : undefined}>
    <Cabecalho titulo="Números" mostrarMarca="celular"
      subtitulo={equipe ? 'Contagens da consultoria nos últimos 6 meses e da equipe hoje.' : 'Contagens da consultoria nos últimos 6 meses.'} />
    {numeros.erro ? <MensagemErro texto={textoDoErro(numeros.erro)} erro={numeros.erro} tentarDeNovo={recarregar} /> : null}
    {numeros.carregando && !meses ? <Esqueleto /> : null}
    {meses && meses.length === 0 ? <Vazio titulo="Sem números ainda" texto="Quando houver alunos e atualizações, as contagens aparecem aqui." /> : null}
    {/* A mesma árvore empilhada e lado a lado (só o estilo muda): as tabelas não remontam ao trocar de modo. */}
    {(meses && meses.length > 0) || equipe ? <View onLayout={aoMedir} style={[estilos.tabelas, coluna ? estilos.ladoALado : null]}>
    {meses && meses.length > 0 ? <>
      <Cartao style={coluna} titulo="Mês a mês" descricao={`Do mês atual para o mais antigo. ${LEGENDA}`}>
        <Tabela rotulo="Alunos ativos e atualizações de cada mês" larguraMinima={larguraMinima} linhas={linhas} chave={m => m.mes} colunas={[
          // O mês que ainda não terminou leva o selo neutro "até hoje" (com ícone, como os selos do estilo novo); o selo
          // desce para a linha de baixo, então a coluna do mês cede espaço a "Atualizações", a palavra mais longa.
          { chave: 'mes', titulo: 'Mês', principal: true, render: m => <View style={estilos.mes}>
            <Texto numerico>{rotuloDoMes(m.mes)}</Texto>
            {m.parcial ? <Selo texto={MARCA_PARCIAL} tipo="neutro" Icone={ICONE_DO_SELO.neutro} /> : null}
          </View> },
          { chave: 'ativos', titulo: 'Alunos ativos', alinhar: 'direita', render: m => <Contagem valor={m.alunosAtivos} /> },
          { chave: 'prazo', titulo: 'No prazo', alinhar: 'direita', render: m => <Contagem valor={m.atualizacoesNoPrazo} /> },
          { chave: 'atrasadas', titulo: 'Atrasadas', alinhar: 'direita', render: m => <Contagem valor={m.atualizacoesAtrasadas} /> },
          { chave: 'total', titulo: 'Atualizações', flex: 1.2, alinhar: 'direita', render: m => <Contagem valor={totalDoMes(m)} /> },
        ]} />
        {resumo ? <Texto variante="suave">{textoDoResumo(resumo)}</Texto> : null}
      </Cartao>
    </> : null}
    {equipe ? <Cartao style={coluna} titulo="Equipe hoje" descricao="Situação de hoje, não o histórico mês a mês: alunos ativos de cada membro, com o limite ao lado. Só contagens.">
      <Tabela rotulo="Alunos e atualizações de cada membro da equipe" larguraMinima={larguraMinima} linhas={equipe} chave={l => l.chave} colunas={[
        // A coluna do limite leva o selo "Acima do limite" ao lado do número: ela é a mais larga.
        { chave: 'nome', titulo: 'Membro', principal: true, flex: 1.4, render: l => <Texto>{l.nome}</Texto> },
        { chave: 'alunos', titulo: 'Alunos ativos / limite', flex: 1.6, alinhar: 'direita', render: l => <AlunosELimite linha={l} /> },
        { chave: 'atrasadas', titulo: 'Atrasadas', alinhar: 'direita', render: l => <Contagem valor={l.atrasadas} atraso /> },
        { chave: 'revisar', titulo: 'Para revisar', alinhar: 'direita', render: l => <Contagem valor={l.paraRevisar} /> },
      ]} />
    </Cartao> : null}
    </View> : null}
    {(meses && meses.length > 0) || equipe ? <Cartao titulo="Como contamos">
      {meses && meses.length > 0 ? <Texto variante="suave">{REGRA_ALUNOS_ATIVOS}</Texto> : null}
      {meses && meses.length > 0 ? <Texto variante="suave">{REGRA_ATUALIZACOES}</Texto> : null}
      {equipe ? <Texto variante="suave">{REGRA_DA_EQUIPE}</Texto> : null}
      {equipe ? <Texto variante="suave">{REGRA_DA_EQUIPE_ATUALIZACOES}</Texto> : null}
    </Cartao> : null}
  </Tela>;
}

/**
 * Abaixo desta largura (da própria tabela, no texto padrão) as linhas viram cartões. Com 480, "Atualizações" e
 * "Atrasadas" ainda não se encostam no cabeçalho e o selo "Acima do limite" cabe na coluna dele. Lado a lado precisa de
 * um contêiner de uns 1070 px (janela de uns 1375 com o menu aberto, 1210 com ele recolhido): a barra de rolagem do
 * Windows numa tela de 1440 ainda deixa folga.
 */
const LARGURA_DA_TABELA = 480;
/** O mesmo espaço entre blocos da `Tela`. */
const ESPACO_ENTRE = espaco(3);
/** Recuo interno do `Cartao` a partir de 768 px de janela (lado a lado só acontece no PC). */
const RECUO_DO_CARTAO = espaco(2.5);

/** Legenda da tabela mensal (no próprio grupo, P5): o mês corrente é parcial e "—" não é zero. */
const LEGENDA = `Mês atual: dados até hoje. ${SEM_DADO} = indisponível.`;

/**
 * Contagem tabular: "—" (sem dado) e zero em tom secundário, o resto em `texto`; com `atraso`, o número acima de zero vai
 * em `perigo` (`corDoNumero`), só na tabela de hoje: o histórico mensal é número geral e fica neutro.
 */
function Contagem({ valor, atraso = false }: { valor: number | null | undefined; atraso?: boolean }) {
  const { cores } = useTema();
  const texto = contagemParaTela(valor);
  const situacao = texto === SEM_DADO || texto === '0' ? 'zero' : atraso ? 'atraso' : 'geral';
  return <Texto numerico cor={corDoNumero(cores, situacao)}>{texto}</Texto>;
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
  tabelas: { gap: ESPACO_ENTRE },
  // Lado a lado cada cartão termina junto com o seu conteúdo (sem esticar até a altura do vizinho); sem a equipe, "Mês a mês" fica numa coluna, à esquerda.
  ladoALado: { flexDirection: 'row', alignItems: 'flex-start' },
  mes: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1) },
  alunos: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: espaco(1) },
});
