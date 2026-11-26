import { router } from 'expo-router';
import { FileDown } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CartaoDivisaoLeitura, LinhaDaDivisao } from '../../aluno/LinhaDaDivisao';
import { OrientacoesDoTreinador } from '../../aluno/OrientacoesDoTreinador';
import { SecaoDoInicio } from '../../aluno/SecaoDoInicio';
import { SeletorPlano } from '../../aluno/SeletorPlano';
import { linhaDaSemana, temColunasDoAluno } from '../../aluno/treino/arranjoDoTreino';
import { DivisaoDaSemana } from '../../aluno/treino/DivisaoDaSemana';
import { OrientacoesAbertas } from '../../aluno/treino/OrientacoesAbertas';
import { caminhoDaSessao } from '../../aluno/useSessaoDoDia';
import type { Sessao } from '../../api/tipos';
import { normalizarTreino } from '../../dominio/editorTreino';
import { diaDaSemana, hojeIso } from '../../dominio/formatos';
import { dataParaAbrir, ehDeHoje, letraDaDivisao, TEXTO_PACOTE_RECUSADO } from '../../dominio/inicioDoAluno';
import { mobilidadeParaExibir, temAbaMobilidade } from '../../dominio/mobilidade';
import { periodoCurto } from '../../dominio/periodoCurto';
import { sessoesDaSemana } from '../../dominio/semana';
import { useAluno } from '../../offline/AlunoProvider';
import { imprimir } from '../../pdf/imprimir';
import { logoComoDataUri } from '../../pdf/logo';
import { documentoTreino } from '../../pdf/pdfTreino';
import { useSessao } from '../../sessao/SessaoProvider';
import { EntradaEmCascata, usePrimeiraLista } from '../../ui/EntradaEmCascata';
import { useAviso } from '../../ui/Aviso';
import { useUnidadeDeCarga } from '../../ui/unidadeDeCargaEmUso';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { textoDoErro } from '../../ui/erros';
import { Alerta, MensagemErro, Vazio } from '../../ui/Estados';
import { Esqueleto } from '../../ui/Esqueleto';
import { Grade } from '../../ui/Grade';
import { NoPlano } from '../../ui/NoPlano';
import { PrincipalComApoio } from '../../ui/PrincipalComApoio';
import { useFaixaDaTela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { TelaDoAluno } from '../../aluno/TelaDoAluno';
import { espaco } from '../../tema/tokens';
import { ConteudoDaMobilidade } from './mobilidade';

/**
 * Aba Treino: as divisões da semana, as orientações, o PDF e a mobilidade. O seletor de outro plano fica aqui e é só
 * consulta; registrar série continua no plano em uso, pelo cartão Hoje do Início. A mobilidade só entra quando há
 * plano publicado. Web, da faixa `normal` em diante (`docs/planos/orientacoes-de-design-26-11.md`, 1.2): as divisões numa
 * lista só, na ordem da semana, com a mobilidade abaixo, e a coluna de apoio (orientações abertas e PDF) ao lado; celular como antes.
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
  const largo = temColunasDoAluno(useFaixaDaTela());
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
  const divisao = (s: Sessao) => {
    if (somenteLeitura || !conteudo || !treino) return <CartaoDivisaoLeitura sessao={s} />;
    const destino = s.exercicios.length ? caminhoDaSessao(s.uid, dataParaAbrir(s, treino.inicio, treino.fim, hoje)) : null;
    const comum = { sessao: s, letra: letraDaDivisao(conteudo, s), href: destino ?? undefined, aoAbrir: destino ? () => router.push(destino) : undefined };
    return largo
      ? <DivisaoDaSemana {...comum} tipo={linhaDaSemana(s, diaDaSemana())} />
      : <LinhaDaDivisao {...comum} hoje={ehDeHoje(s, diaDaSemana())} />;
  };
  const listaDeDivisoes = divisoes.map((s, i) => (
    <EntradaEmCascata key={s.uid} indice={i} animar={animar}>{divisao(s)}</EntradaEmCascata>
  ));
  // No apoio, o botão fica do tamanho do rótulo; no celular, cheio como antes.
  const botaoPdf = (cheio: boolean) => (
    <NoPlano funcionalidade="PDF">
      <Botao rotulo="Baixar PDF do treino" tipo="secundario" cheio={cheio} Icone={FileDown} carregando={gerandoPdf} aoTocar={() => void pdf()} />
    </NoPlano>
  );
  // Na coluna principal da web, `largo`: as seções em colunas de 360 no mínimo e o PDF do tamanho do rótulo; no celular, como antes.
  const secaoMobilidade = (naWeb: boolean) => mostrarMobilidade ? (
    <SecaoDoInicio titulo="Mobilidade">
      <Texto variante="suave">Mobilidade e alongamentos do seu treinador, com vídeo quando houver.</Texto>
      {versaoMobilidade ? <ConteudoDaMobilidade versao={versaoMobilidade} largo={naWeb} /> : <Vazio titulo="Sem mobilidade" texto="Este plano não tem mobilidade publicada." />}
    </SecaoDoInicio>
  ) : null;
  // Coluna de apoio só com o que existe: sem orientações e sem PDF no plano, a lista fica sozinha. A Mobilidade vai na
  // principal, abaixo das divisões: no apoio ela passava da altura da janela (0.2 de `orientacoes-de-design-26-11.md`).
  const temApoio = !!(conteudo?.objetivo || conteudo?.orientacoes) || temFuncionalidade('PDF');
  const listaLarga = !!(conteudo && treino && largo);

  return (<>
      <Cabecalho titulo="Treino" subtitulo="As divisões da semana, do jeito que o treinador montou." />
      {!pacote && pacoteRecusado ? <View testID="pacote-recusado"><Alerta tom="atencao" texto={TEXTO_PACOTE_RECUSADO} /></View> : null}
      {!pacote && !pacoteRecusado && carregando ? <Esqueleto texto="Carregando seu treino" cartoes={2} /> : null}
      {!pacote && !pacoteRecusado && !carregando && erroPacote ? (
        <MensagemErro texto={`${textoDoErro(erroPacote)} Conecte-se uma vez para baixar o treino; depois ele funciona sem internet.`} erro={erroPacote} tentarDeNovo={() => void tentarDeNovo()} />
      ) : null}
      {/* Sem o título do plano (nome de trabalho do treinador, 25/11): o seletor mostra a pasta pelo nome limpo da API e, sem ela, só o período. */}
      {pacote ? <SeletorPlano soComVarios rotulo={treino ? periodo : null} /> : null}
      {somenteLeitura ? <Texto variante="suave">Você está vendo outro plano. Para registrar uma série, volte ao plano em uso.</Texto> : null}
      {pacote && !treino ? <Vazio titulo="Sem treino" texto={somenteLeitura ? 'Este plano só tem dieta publicada.' : 'Seu treinador ainda não publicou um treino.'} /> : null}
      {conteudo && listaLarga ? (
        <PrincipalComApoio
          rotuloDoApoio="Orientações e PDF do treino"
          apoioNoTopo
          principal={(<>
            <SecaoDoInicio titulo="Divisões da semana"><View style={estilos.lista}>{listaDeDivisoes}</View></SecaoDoInicio>
            {secaoMobilidade(true)}
          </>)}
          apoio={temApoio ? (<>
            <OrientacoesAbertas objetivo={conteudo.objetivo} orientacoes={conteudo.orientacoes} />
            {botaoPdf(false)}
          </>) : null}
        />
      ) : conteudo && treino ? (
        <>
          <SecaoDoInicio titulo="Divisões da semana">
            <Grade>{listaDeDivisoes}</Grade>
          </SecaoDoInicio>
          <OrientacoesDoTreinador objetivo={conteudo.objetivo} orientacoes={conteudo.orientacoes} />
          {botaoPdf(true)}
        </>
      ) : null}
      {listaLarga ? null : secaoMobilidade(false)}
  </>);
}

// O vão da `Grade` de antes (8): a lista da web tem o mesmo ritmo das divisões do celular.
const estilos = StyleSheet.create({ lista: { gap: espaco(1) } });
