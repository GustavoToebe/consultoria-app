import { useFocusEffect } from 'expo-router';
import { Lock } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { numerosDaConsultoria } from '../../api/rotas';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { percentualParaTela } from '../../dominio/financeiro';
import { SEM_DADO } from '../../dominio/formatos';
import { situacaoDoLimite } from '../../dominio/limiteDeAlunos';
import { rotuloDoMesNumerico } from '../../dominio/mesDaCompetencia';
import { escalar } from '../../dominio/preferencias';
import { alunosELimite, baseDoPercentualNoPrazo, contagemParaTela, linhasDaEquipe, MARCA_PARCIAL, mesAtual, paraRevisarDaEquipe, percentualNoPrazo, REGRA_ALUNOS_ATIVOS, REGRA_ATUALIZACOES, REGRA_DA_EQUIPE, REGRA_DA_EQUIPE_ATUALIZACOES, resumoDasAtualizacoes, textoDoResumo, totalDoMes, type LinhaDaTabelaDaEquipe } from '../../dominio/numeros';
import { espaco, LARGURA_FORMULARIO, LARGURA_MAXIMA, LARGURA_MENU_LATERAL } from '../../tema/tokens';
import { ICONE_DO_SELO } from '../../treinador/iconesDosSelos';
import { useTema } from '../../tema/TemaProvider';
import { Cabecalho } from '../../ui/Cabecalho';
import { CabecalhoDeGrupo } from '../../ui/CabecalhoDeGrupo';
import { Cartao } from '../../ui/Cartao';
import { CartaoDeIndicador, type EstadoDoIndicador } from '../../ui/CartaoDeIndicador';
import { Esqueleto } from '../../ui/Esqueleto';
import { corDoNumero } from '../../ui/indicador';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { GradeDeIndicadores } from '../../ui/GradeDeIndicadores';
import { Selo } from '../../ui/Selo';
import { Tabela } from '../../ui/Tabela';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { useFaixaDeLargura } from '../../ui/useFaixaDeLargura';

/**
 * Números da consultoria: só contagens dos últimos 6 meses (`GET /numeros`, `PAINEL_VER`, a guarda é `podeAcessarTela`).
 * Sem nome nem id de aluno. Valor que a API manda nulo aparece como "—" (nunca zero inventado); o mês corrente vem marcado
 * "até hoje" porque ainda não terminou. A tabela da equipe (supervisão, D1 e D16) só aparece quando a API a manda (com
 * `EQUIPE_LER`, D17): uma linha por membro ativo e "Sem responsável", só contagens, nunca nome nem id de aluno.
 * Números (19/11): indicadores no topo (só números que a tabela já mostra), duas colunas (à esquerda "Mês a mês", à
 * direita "Equipe hoje" e "Como contamos", recolhido) e mês em MM/AAAA.
 */
export default function NumerosDoTreinador() {
  const numeros = useCarregar('numeros', () => numerosDaConsultoria());
  const { recarregar } = numeros;
  useFocusEffect(useCallback(() => { recarregar(); }, [recarregar]));
  const [regrasAbertas, setRegrasAbertas] = useState(false);

  const meses = numeros.dados?.meses;
  const temMeses = !!meses && meses.length > 0;
  const resumo = meses ? resumoDasAtualizacoes(meses) : null;
  // Uma tabela só, um mês por linha e o mais recente em cima (antes eram duas tabelas com a coluna do mês repetida).
  const linhas = meses ? [...meses].reverse() : [];
  const equipe = linhasDaEquipe(numeros.dados);
  const atual = meses ? mesAtual(meses) : null;
  const { width } = useWindowDimensions();
  const { bordas, fatorTexto } = useTema();
  // Texto maior pede tabela mais larga para os cabeçalhos não se encostarem.
  const minimoDosMeses = escalar(LARGURA_DA_TABELA, fatorTexto);
  const minimoDaEquipe = escalar(LARGURA_DA_EQUIPE, fatorTexto);
  // Medido no contêiner, não na janela: o menu lateral come parte da largura.
  const { largura: larguraDasColunas, aoMedir } = useFaixaDeLargura();
  // A largura da tabela da equipe, para saber se ela está em cartões (o mesmo limite da `Tabela`): no cartão o nome quebra
  // em linhas (no celular não há a dica do mouse); na tabela fica numa linha só, com reticências.
  const [larguraDaEquipe, setLarguraDaEquipe] = useState(0);
  const equipeEmCartoes = larguraDaEquipe > 0 && larguraDaEquipe < minimoDaEquipe;
  // Lado a lado só se as duas colunas, tirados o recuo e a borda de cada cartão (os do `Cartao` no PC), ainda forem
  // tabela; a esquerda leva a parte da largura proporcional ao mínimo dela, e a direita fica com o resto.
  const folga = 2 * (RECUO_DO_CARTAO + bordas.bloco);
  const minimoDaDireita = equipe ? minimoDaEquipe : escalar(LARGURA_DO_TEXTO, fatorTexto);
  const livre = larguraDasColunas - ESPACO_ENTRE;
  const ladoALado = temMeses && livre >= minimoDosMeses + minimoDaDireita + 2 * folga;
  const esquerda = ladoALado ? { width: Math.floor(livre * (minimoDosMeses + folga) / (minimoDosMeses + minimoDaDireita + 2 * folga)) } : null;

  const percentual = atual ? percentualNoPrazo(atual) : null;
  const paraRevisar = paraRevisarDaEquipe(equipe);
  const semAtualizacoesNoMes = atual !== null && totalDoMes(atual) === 0;

  return <Tela bordas={['top']} folga={width >= LARGURA_MENU_LATERAL ? espaco(3.5) : undefined}>
    <Cabecalho titulo="Números" mostrarMarca="celular"
      descricao={equipe ? 'Contagens da consultoria nos últimos 6 meses e da equipe hoje.' : 'Contagens da consultoria nos últimos 6 meses.'} />
    {numeros.erro ? <MensagemErro texto={textoDoErro(numeros.erro)} erro={numeros.erro} tentarDeNovo={recarregar} /> : null}
    {numeros.carregando && !meses ? <Esqueleto /> : null}
    {meses && meses.length === 0 ? <Vazio titulo="Sem números ainda" texto="Quando houver alunos e atualizações, as contagens aparecem aqui." /> : null}
    {/* Quatro por linha, 2 + 2 ou 1 (a mesma grade da Visão geral do Financeiro); "Para revisar" só existe com a equipe. */}
    {/* Tela larga: revisão (24/11): no mesmo teto das colunas de baixo (`LARGURA_MAXIMA`), para as bordas direitas
        coincidirem; antes os indicadores iam até o fim da área e as tabelas paravam em 1800 px. */}
    {temMeses ? <View style={estilos.teto}><GradeDeIndicadores minimo={211}>
      <CartaoDeIndicador rotulo="Alunos ativos hoje" valor={contagemParaTela(atual?.alunosAtivos)} estado={estadoDe(atual?.alunosAtivos)} />
      <CartaoDeIndicador rotulo="No prazo no mês atual" valor={percentualParaTela(percentual)} tom="sucesso"
        estado={percentual === null ? 'indisponivel' : percentual === 0 ? 'zero' : 'valor'}
        motivo={semAtualizacoesNoMes ? 'Nenhuma atualização no mês' : undefined}
        detalhe={atual ? baseDoPercentualNoPrazo(atual) : null} />
      <CartaoDeIndicador rotulo="Atrasadas" valor={contagemParaTela(atual?.atualizacoesAtrasadas)} tom="perigo"
        estado={estadoDe(atual?.atualizacoesAtrasadas)} detalhe="No mês atual" />
      {equipe ? <CartaoDeIndicador rotulo="Para revisar" valor={contagemParaTela(paraRevisar)} tom="atencao"
        estado={estadoDe(paraRevisar)} detalhe="Hoje, somando a equipe" /> : null}
    </GradeDeIndicadores></View> : null}
    {/* A mesma árvore empilhada e lado a lado (só o estilo muda): as tabelas não remontam ao trocar de modo. Empilhado, a
        ordem é Mês a mês, Equipe hoje, Como contamos. */}
    {temMeses || equipe ? <View onLayout={aoMedir} style={[estilos.colunas, ladoALado ? estilos.ladoALado : null]}>
      {temMeses ? <View style={[estilos.coluna, esquerda]}>
        <Cartao titulo="Mês a mês" descricao={`Do mês atual para o mais antigo. ${LEGENDA}`}>
          <Tabela rotulo="Alunos ativos e atualizações de cada mês" larguraMinima={minimoDosMeses} linhas={linhas} chave={m => m.mes} colunas={[
            // O mês que ainda não terminou leva o selo neutro "até hoje" (com ícone, como os selos do estilo novo); o selo
            // desce para a linha de baixo, então a coluna do mês cede espaço a "Atualizações", a palavra mais longa.
            { chave: 'mes', titulo: 'Mês', principal: true, render: m => <View style={estilos.mes}>
              <Texto numerico>{rotuloDoMesNumerico(m.mes)}</Texto>
              {m.parcial ? <Selo texto={MARCA_PARCIAL} tipo="neutro" Icone={ICONE_DO_SELO.neutro} /> : null}
            </View> },
            { chave: 'ativos', titulo: 'Alunos ativos', alinhar: 'direita', render: m => <Contagem valor={m.alunosAtivos} /> },
            { chave: 'prazo', titulo: 'No prazo', alinhar: 'direita', render: m => <Contagem valor={m.atualizacoesNoPrazo} /> },
            { chave: 'atrasadas', titulo: 'Atrasadas', alinhar: 'direita', render: m => <Contagem valor={m.atualizacoesAtrasadas} /> },
            { chave: 'total', titulo: 'Atualizações', flex: 1.2, alinhar: 'direita', render: m => <Contagem valor={totalDoMes(m)} /> },
          ]} />
          {resumo ? <Texto variante="suave">{textoDoResumo(resumo)}</Texto> : null}
        </Cartao>
      </View> : null}
      <View style={[estilos.coluna, ladoALado ? estilos.direita : null]}>
        {equipe ? <Cartao titulo="Equipe hoje" descricao="Situação de hoje, não o histórico mês a mês: alunos ativos de cada membro, com o limite ao lado. Só contagens.">
          {/* As colunas das tabelas do Financeiro: o nome com flex 2 e mínimo, os números com flex 1 à direita, vão de 24. */}
          <View onLayout={(e) => setLarguraDaEquipe(e.nativeEvent.layout.width)}>
          <Tabela rotulo="Alunos e atualizações de cada membro da equipe" larguraMinima={minimoDaEquipe} vao={VAO} alinharLinhas="topo"
            linhas={equipe} chave={l => l.chave} colunas={[
              { chave: 'nome', titulo: 'Membro', principal: true, flex: 2, minimo: MINIMO_DO_NOME, render: l => <NomeDoMembro nome={l.nome} umaLinha={!equipeEmCartoes} /> },
              // O selo "Acima do limite" desce para baixo do número quando a coluna aperta.
              { chave: 'alunos', titulo: 'Alunos ativos / limite', alinhar: 'direita', minimo: MINIMO_DO_LIMITE, render: l => <AlunosELimite linha={l} /> },
              { chave: 'atrasadas', titulo: 'Atrasadas', alinhar: 'direita', render: l => <Contagem valor={l.atrasadas} atraso /> },
              { chave: 'revisar', titulo: 'Para revisar', alinhar: 'direita', render: l => <Contagem valor={l.paraRevisar} /> },
            ]} />
          </View>
        </Cartao> : null}
        {/* Texto de consulta: nasce fechado (seção recolhível do app, a mesma faixa da Ajuda, com `aria-expanded`). */}
        <Cartao cabecalho={<CabecalhoDeGrupo titulo="Como contamos" aberto={regrasAbertas} aoAlternar={() => setRegrasAbertas(v => !v)} acoesJuntas />}>
          {regrasAbertas ? <View style={estilos.regras}>
            {temMeses ? <Texto variante="suave">{REGRA_ALUNOS_ATIVOS}</Texto> : null}
            {temMeses ? <Texto variante="suave">{REGRA_ATUALIZACOES}</Texto> : null}
            {equipe ? <Texto variante="suave">{REGRA_DA_EQUIPE}</Texto> : null}
            {equipe ? <Texto variante="suave">{REGRA_DA_EQUIPE_ATUALIZACOES}</Texto> : null}
          </View> : null}
        </Cartao>
      </View>
    </View> : null}
  </Tela>;
}

/**
 * Abaixo desta largura (da própria tabela, no texto padrão) as linhas de "Mês a mês" viram cartões. Com 480,
 * "Atualizações" e "Atrasadas" ainda não se encostam no cabeçalho.
 */
const LARGURA_DA_TABELA = 480;
/** Membro: flex 2 e no mínimo 220 px (o nome corta com reticências), como o nome do aluno nas tabelas do Financeiro. */
const MINIMO_DO_NOME = 220;
/** "Alunos ativos / limite" não encolhe abaixo disto: "4 / sem limite" cabe numa linha. */
const MINIMO_DO_LIMITE = 140;
/** Vão entre as colunas da equipe (o das tabelas do Financeiro). */
const VAO = 24;
/**
 * Abaixo desta largura a tabela da equipe vira cartões: o nome e o limite nos mínimos, "Atrasadas" e "Para revisar" com
 * 100, os três vãos e os 24 de recuo da linha. Lado a lado com "Mês a mês" precisa de um contêiner de uns 1245 px
 * (480 + 656, os recuos e bordas dos dois cartões e o vão; janela de uns 1550 com o menu aberto): 1920 e 1600 ficam em
 * duas colunas, 1440 e 1280 empilham.
 */
const LARGURA_DA_EQUIPE = MINIMO_DO_NOME + MINIMO_DO_LIMITE + 2 * 100 + 3 * VAO + 24;
/** Sem a equipe, a coluna da direita só tem "Como contamos": o mínimo de uma coluna de texto legível. */
const LARGURA_DO_TEXTO = 360;
/** O mesmo espaço entre blocos da `Tela`. */
const ESPACO_ENTRE = espaco(3);
/** Recuo interno do `Cartao` a partir de 768 px de janela (lado a lado só acontece no PC). */
const RECUO_DO_CARTAO = espaco(2.5);

/** Legenda da tabela mensal (no próprio grupo, P5): o mês corrente é parcial e "—" não é zero. */
const LEGENDA = `Mês atual: dados até hoje. ${SEM_DADO} = indisponível.`;

/** Estado do cartão de indicador: sem dado é indisponível ("—", nunca zero), zero fica sem tom. */
function estadoDe(v: number | null | undefined): EstadoDoIndicador {
  return typeof v !== 'number' ? 'indisponivel' : v === 0 ? 'zero' : 'valor';
}

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

/**
 * Na tabela, o nome numa linha só, com reticências; o leitor de tela lê o texto inteiro e, na web, o nome completo fica
 * também na dica do mouse (o react-native-web não repassa `title`, então vai direto no elemento). No cartão, inteiro.
 */
function NomeDoMembro({ nome, umaLinha }: { nome: string; umaLinha: boolean }) {
  const comDica = (el: View | null) => {
    if (Platform.OS === 'web' && el && 'setAttribute' in el && typeof el.setAttribute === 'function') el.setAttribute('title', nome);
  };
  return <View ref={comDica}><Texto numberOfLines={umaLinha ? 1 : undefined}>{nome}</Texto></View>;
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
  teto: { width: '100%', maxWidth: LARGURA_MAXIMA },
  colunas: { gap: ESPACO_ENTRE, width: '100%', maxWidth: LARGURA_MAXIMA },
  // Lado a lado cada coluna termina junto com o seu conteúdo (sem esticar até a altura da vizinha): "Como contamos" fica
  // logo abaixo de "Equipe hoje", sem buraco.
  ladoALado: { flexDirection: 'row', alignItems: 'flex-start' },
  coluna: { gap: ESPACO_ENTRE },
  direita: { flex: 1, minWidth: 0 },
  regras: { gap: espaco(1), maxWidth: LARGURA_FORMULARIO },
  mes: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1) },
  // O número e o selo à direita da célula; na coluna apertada o selo quebra para baixo, também à direita.
  alunos: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: espaco(1) },
});
