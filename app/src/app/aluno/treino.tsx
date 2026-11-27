import { router, useLocalSearchParams } from 'expo-router';
import { FileDown, Play } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';

import { ExerciciosDoDia } from '../../aluno/ExerciciosDoDia';
import { CartaoDivisaoLeitura, LinhaDaDivisao } from '../../aluno/LinhaDaDivisao';
import { OrientacoesDoTreinador } from '../../aluno/OrientacoesDoTreinador';
import { SecaoDoInicio } from '../../aluno/SecaoDoInicio';
import { SeletorPlano } from '../../aluno/SeletorPlano';
import { TelaDoAluno } from '../../aluno/TelaDoAluno';
import { linhaDaSemana } from '../../aluno/treino/arranjoDoTreino';
import { DivisaoDaSemana } from '../../aluno/treino/DivisaoDaSemana';
import { OrientacoesAbertas } from '../../aluno/treino/OrientacoesAbertas';
import { caminhoDaSessao, useSessaoDoDia } from '../../aluno/useSessaoDoDia';
import type { Sessao } from '../../api/tipos';
import { apoioGruda, larguraDoApoioDaFaixa, TOPO_DO_APOIO, VAO_DA_PRINCIPAL } from '../../dominio/arranjoPrincipalComApoio';
import { contagemDeSeries } from '../../dominio/conclusaoDoTreino';
import { contagem } from '../../dominio/contagens';
import { colunasDoTreino, divisaoEscolhida, ondeFicaAMobilidade } from '../../dominio/divisaoDoTreino';
import { normalizarTreino } from '../../dominio/editorTreino';
import { dataParaTela, diaDaSemana, hojeIso } from '../../dominio/formatos';
import { dataParaAbrir, detalheDaDivisao, ehDeHoje, letraDaDivisao, TEXTO_PACOTE_RECUSADO } from '../../dominio/inicioDoAluno';
import { mobilidadeParaExibir, temAbaMobilidade } from '../../dominio/mobilidade';
import { periodoCurto } from '../../dominio/periodoCurto';
import { contagemDoExercicio, sessoesDaSemana } from '../../dominio/semana';
import { useAluno } from '../../offline/AlunoProvider';
import { imprimir } from '../../pdf/imprimir';
import { logoComoDataUri } from '../../pdf/logo';
import { documentoTreino } from '../../pdf/pdfTreino';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { Cartao } from '../../ui/Cartao';
import { EntradaEmCascata, usePrimeiraLista } from '../../ui/EntradaEmCascata';
import { textoDoErro } from '../../ui/erros';
import { Esqueleto } from '../../ui/Esqueleto';
import { Alerta, MensagemErro, Vazio } from '../../ui/Estados';
import { Grade } from '../../ui/Grade';
import { NoPlano } from '../../ui/NoPlano';
import { PrincipalComApoio } from '../../ui/PrincipalComApoio';
import { Selo } from '../../ui/Selo';
import { useFaixaDaTela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { useUnidadeDeCarga } from '../../ui/unidadeDeCargaEmUso';
import { ConteudoDaMobilidade } from './mobilidade';

/**
 * Aba Treino: as divisões da semana, as orientações, o PDF e a mobilidade. O seletor de outro plano fica aqui e é só
 * consulta; registrar série continua no plano em uso. Computador (pedido de 27/11, padrão do treinador; arranjo em
 * `dominio/divisaoDoTreino`): a lista das divisões à esquerda (hoje em destaque, descanso discreto) e o treino da divisão
 * escolhida à direita, preenchendo; a escolha fica no endereço (`?divisao=`, sobrevive ao voltar do exercício). Orientações
 * e PDF vão embaixo da lista (coluna de 380/420) na `normal` e na `larga` e viram a 3ª coluna (440) na `ultralarga`; a
 * mobilidade fica onde as colunas terminam juntas (`ondeFicaAMobilidade`: depois das duas colunas na `normal`, embaixo do
 * treino da `larga` em diante). Celular e faixa `compacta`: como antes.
 */
export default function TreinoAluno() {
  return (
    <TelaDoAluno bordas={['top']}>
      <ConteudoDoTreino />
    </TelaDoAluno>
  );
}

function ConteudoDoTreino() {
  const { pacote, escolhida, mobilidade, pacoteRecusado, carregando, erroPacote, tentarDeNovo } = useAluno();
  const { temFuncionalidade } = useSessao();
  const faixa = useFaixaDaTela();
  const colunas = colunasDoTreino(faixa);
  const { divisao: pedida } = useLocalSearchParams<{ divisao?: string }>();
  const animar = usePrimeiraLista(!!pacote);
  const { avisar } = useAviso();
  const unidade = useUnidadeDeCarga();
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const hoje = hojeIso();
  const somenteLeitura = !!escolhida;
  const treino = (escolhida ? escolhida.planos.treino : pacote?.pacote.treino) ?? null;
  const conteudo = treino ? normalizarTreino(treino.conteudo) : null;
  const periodo = treino ? periodoCurto(treino, hoje) : null;
  const versaoMobilidade = mobilidadeParaExibir(mobilidade, escolhida ? { mobilidade: escolhida.planos.mobilidade } : null);
  const mostrarMobilidade = temAbaMobilidade(mobilidade, escolhida ? { mobilidade: escolhida.planos.mobilidade } : null);

  const pdf = async () => {
    if (!treino || !pacote) return;
    setGerandoPdf(true);
    try {
      const marca = pacote.pacote.marca;
      await imprimir(
        documentoTreino({
          marca,
          logoDataUri: await logoComoDataUri(marca),
          aluno: pacote.pacote.aluno.nome,
          titulo: treino.titulo,
          inicio: treino.inicio,
          fim: treino.fim,
          versao: treino.numero,
          conteudo: normalizarTreino(treino.conteudo),
          instrucoesTreino: pacote.pacote.configuracao.instrucoesTreino ?? null,
          rodapePdf: null,
          emitidoEm: new Date(),
          unidade,
        }),
      );
    } catch (e) {
      avisar(textoDoErro(e), 'perigo');
    } finally {
      setGerandoPdf(false);
    }
  };

  const divisoes = conteudo ? sessoesDaSemana(conteudo) : [];
  const selecionada = colunas === 'pilha' ? null : divisaoEscolhida(divisoes, pedida, diaDaSemana());
  // Celular: cada divisão abre o dia, como antes.
  const divisaoDoCelular = (s: Sessao) => {
    if (somenteLeitura || !conteudo || !treino) return <CartaoDivisaoLeitura sessao={s} />;
    const destino = s.exercicios.length ? caminhoDaSessao(s.uid, dataParaAbrir(s, treino.inicio, treino.fim, hoje)) : null;
    return (
      <LinhaDaDivisao sessao={s} letra={letraDaDivisao(conteudo, s)} hoje={ehDeHoje(s, diaDaSemana())}
        href={destino ?? undefined} aoAbrir={destino ? () => router.push(destino) : undefined} />
    );
  };
  // Computador: a linha escolhe a divisão (o treino aparece ao lado); `setParams` troca o endereço sem empilhar histórico.
  const divisaoDoComputador = (s: Sessao) => conteudo ? (
    <DivisaoDaSemana sessao={s} letra={letraDaDivisao(conteudo, s)} tipo={linhaDaSemana(s, diaDaSemana())}
      selecionada={s.uid === selecionada?.uid} aoEscolher={s.exercicios.length ? () => router.setParams({ divisao: s.uid }) : undefined} />
  ) : null;
  const listaDeDivisoes = (linha: (s: Sessao) => ReactNode) => divisoes.map((s, i) => (
    <EntradaEmCascata key={s.uid} indice={i} animar={animar}>{linha(s)}</EntradaEmCascata>
  ));
  const botaoPdf = (cheio: boolean) => (
    <NoPlano funcionalidade="PDF">
      <Botao rotulo="Baixar PDF do treino" tipo="secundario" cheio={cheio} Icone={FileDown} carregando={gerandoPdf} aoTocar={() => void pdf()} />
    </NoPlano>
  );
  const secaoMobilidade = (largo: boolean) => mostrarMobilidade ? (
    <SecaoDoInicio titulo="Mobilidade">
      <Texto variante="suave">Mobilidade e alongamentos do seu treinador, com vídeo quando houver.</Texto>
      {versaoMobilidade ? <ConteudoDaMobilidade versao={versaoMobilidade} largo={largo} /> : <Vazio titulo="Sem mobilidade" texto="Este plano não tem mobilidade publicada." />}
    </SecaoDoInicio>
  ) : null;
  // A mobilidade depois das duas colunas (normal) ou embaixo do treino (larga em diante): `ondeFicaAMobilidade`.
  const mobilidadeAbaixo = ondeFicaAMobilidade(faixa) === 'abaixo';
  // O apoio só com o que existe: sem orientações e sem PDF, ficam só a lista e o treino.
  const temApoio = !!(conteudo?.objetivo || conteudo?.orientacoes) || temFuncionalidade('PDF');
  const rotuloDoApoio = 'Orientações e PDF do treino';
  const apoio = conteudo && temApoio ? (<>
    <OrientacoesAbertas objetivo={conteudo.objetivo} orientacoes={conteudo.orientacoes} />
    {botaoPdf(false)}
  </>) : null;
  const lista = (
    <SecaoDoInicio titulo="Divisões da semana">
      <View style={estilos.lista}>{listaDeDivisoes(divisaoDoComputador)}</View>
    </SecaoDoInicio>
  );
  const detalhe = (
    <View style={estilos.principal}>
      {selecionada && conteudo && treino ? (
        <View role="region" aria-label="Treino da divisão" style={estilos.detalhe}>
          {somenteLeitura
            ? <CartaoDivisaoLeitura sessao={selecionada} />
            : <TreinoDaDivisao key={selecionada.uid} sessao={selecionada} letra={letraDaDivisao(conteudo, selecionada)} inicio={treino.inicio} fim={treino.fim} animar={animar} />}
        </View>
      ) : <Vazio titulo="Sem dia de treino" texto="Este plano só tem dias de descanso." />}
      {/* Larga em diante: a mobilidade em grade, embaixo do treino (com a largura dele, as seções lado a lado). */}
      {mobilidadeAbaixo ? null : secaoMobilidade(true)}
    </View>
  );
  const largura = larguraDoApoioDaFaixa(faixa);

  return (<>
      <Cabecalho titulo="Treino" descricao="As divisões da semana, do jeito que o treinador montou." />
      {!pacote && pacoteRecusado ? <View testID="pacote-recusado"><Alerta tom="atencao" texto={TEXTO_PACOTE_RECUSADO} /></View> : null}
      {!pacote && !pacoteRecusado && carregando ? <Esqueleto texto="Carregando seu treino" cartoes={2} /> : null}
      {!pacote && !pacoteRecusado && !carregando && erroPacote ? (
        <MensagemErro texto={`${textoDoErro(erroPacote)} Conecte-se uma vez para baixar o treino; depois ele funciona sem internet.`} erro={erroPacote} tentarDeNovo={() => void tentarDeNovo()} />
      ) : null}
      {/* Sem o título do plano (nome de trabalho do treinador, 25/11): o seletor mostra a pasta pelo nome limpo da API e, sem ela, só o período. */}
      {pacote ? <SeletorPlano soComVarios rotulo={treino ? periodo : null} /> : null}
      {somenteLeitura ? <Texto variante="suave">Você está vendo outro plano. Para registrar uma série, volte ao plano em uso.</Texto> : null}
      {pacote && !treino ? <Vazio titulo="Sem treino" texto={somenteLeitura ? 'Este plano só tem dieta publicada.' : 'Seu treinador ainda não publicou um treino.'} /> : null}
      {conteudo && treino && colunas === 'duas' ? (
        <View style={estilos.colunas}>
          <ColunaQueGruda largura={largura}>
            {lista}
            {apoio ? <View role="complementary" aria-label={rotuloDoApoio} style={estilos.pilha}>{apoio}</View> : null}
          </ColunaQueGruda>
          {detalhe}
        </View>
      ) : null}
      {conteudo && treino && colunas === 'duas' && mobilidadeAbaixo ? secaoMobilidade(true) : null}
      {conteudo && treino && colunas === 'tres' ? (
        <PrincipalComApoio
          rotuloDoApoio={rotuloDoApoio}
          principal={<View style={estilos.colunas}><ColunaQueGruda largura={largura}>{lista}</ColunaQueGruda>{detalhe}</View>}
          apoio={apoio}
        />
      ) : null}
      {conteudo && treino && colunas === 'pilha' ? (
        <>
          <SecaoDoInicio titulo="Divisões da semana">
            <Grade>{listaDeDivisoes(divisaoDoCelular)}</Grade>
          </SecaoDoInicio>
          <OrientacoesDoTreinador objetivo={conteudo.objetivo} orientacoes={conteudo.orientacoes} />
          {botaoPdf(true)}
        </>
      ) : null}
      {colunas === 'pilha' || !conteudo || !treino ? secaoMobilidade(false) : null}
  </>);
}

/**
 * O treino da divisão escolhida, na coluna que preenche: o cartão com o nome, o dia que se registra e o "Começar treino"
 * (o primário da tela, que abre o primeiro exercício por fazer, como na tela do dia) e os exercícios, que abrem cada um.
 * Registros e cargas vêm do mesmo `useSessaoDoDia` da tela do dia, na data que o toque no celular abriria.
 */
function TreinoDaDivisao({ sessao, letra, inicio, fim, animar }: { sessao: Sessao; letra: string; inicio: string | null; fim: string | null; animar: boolean }) {
  const hoje = hojeIso();
  const dia = useSessaoDoDia(sessao.uid, dataParaAbrir(sessao, inicio, fim, hoje));
  const { data } = dia;
  const base = dia.sessao ?? sessao;
  const doDia = { ...base, exercicios: base.exercicios.map((e) => dia.diaDe(e)) };
  const { total, feitas } = contagemDeSeries(base, dia.estaFeita, dia.config.metodologia);
  const pendente = doDia.exercicios.find((e) => dia.feitas(e) < e.series.length);
  const abrir = (exercicioUid?: string) => router.push(caminhoDaSessao(sessao.uid, data, exercicioUid));
  return (<>
    <Cartao titulo={`Divisão ${letra} · ${sessao.nome}`} descricao={detalheDaDivisao(sessao)}>
      <View style={estilos.linhaDoDia}>
        <Selo texto={data === hoje ? `Hoje · ${dataParaTela(data)}` : `Próximo: ${dataParaTela(data)}`} tipo="neutro" />
        {total ? <Texto variante="suave" numerico>{feitas} de {contagem(total, 'série feita', 'séries feitas')}</Texto> : null}
      </View>
      {base.cardio ? <Texto>Cardio: {base.cardio}</Texto> : null}
      {base.observacao ? <Texto variante="suave">{base.observacao}</Texto> : null}
      <View style={estilos.acoes}>
        {pendente ? (
          <Botao rotulo={feitas ? `Continuar: ${pendente.nome}` : 'Começar treino'} Icone={Play} aoTocar={() => abrir(pendente.uid)} />
        ) : (
          <Botao rotulo="Abrir o treino" tipo="secundario" aoTocar={() => abrir()} />
        )}
      </View>
    </Cartao>
    <ExerciciosDoDia
      sessao={doDia}
      metodologia={dia.config.metodologia}
      tipoTrabalho={dia.config.tipoTrabalho}
      contagemDe={(e) => contagemDoExercicio(e, dia.estaFeita, dia.config.metodologia)}
      cargaDoDia={dia.cargaDoDia}
      ultimaCarga={(e) => dia.ultimaCarga(e.exercicioId)}
      href={(e) => caminhoDaSessao(sessao.uid, data, e.uid)}
      aoAbrir={(e) => abrir(e.uid)}
      animar={animar}
    />
  </>);
}

/** `position: sticky` existe no react-native-web (CSS), mas não no tipo do React Native (o mesmo de `PrincipalComApoio`). */
const grudada = (topo: number) => ({ position: 'sticky', top: topo }) as unknown as ViewStyle;

/** Coluna de largura fixa que gruda abaixo da barra ao rolar só se couber na janela (a regra do apoio, `apoioGruda`). */
function ColunaQueGruda({ largura, children }: { largura: number; children: ReactNode }) {
  const [altura, setAltura] = useState(0);
  const janela = useWindowDimensions();
  const gruda = Platform.OS === 'web' && apoioGruda(altura, janela.height - TOPO_DO_APOIO - espaco(2));
  return (
    <View style={[estilos.coluna, { width: largura }, gruda && grudada(TOPO_DO_APOIO)]}>
      <View style={estilos.pilha} onLayout={(e) => setAltura(e.nativeEvent.layout.height)}>{children}</View>
    </View>
  );
}

const estilos = StyleSheet.create({
  // O vão da `Grade` de antes (8): a lista da web tem o mesmo ritmo das divisões do celular.
  lista: { gap: espaco(1) },
  // `flex-start`: sem ele a coluna estica até a altura do treino e o `sticky` não tem para onde andar.
  colunas: { flexDirection: 'row', alignItems: 'flex-start', gap: VAO_DA_PRINCIPAL },
  coluna: { flexShrink: 0, alignSelf: 'flex-start' },
  pilha: { gap: espaco(3) },
  principal: { flex: 1, minWidth: 0, gap: espaco(4) },
  detalhe: { gap: espaco(2) },
  linhaDoDia: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1.5) },
  acoes: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
});
