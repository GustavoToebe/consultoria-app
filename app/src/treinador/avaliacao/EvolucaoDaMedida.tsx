import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { AvaliacaoFisica, CampoDaMedida } from '../../api/avaliacaoFisicaTipos';
import type { MetaDoPeso } from '../../api/tipos';
import { cmParaTela, graficoDaMedida, serieDaMedida, type OpcaoDeMedida } from '../../dominio/avaliacaoFisica';
import { formatadorDeDatas, resumoDaMedida, type ResumoDaMedida } from '../../dominio/comparacaoDeAvaliacoes';
import { corDoTom } from '../../dominio/corDaVariacaoDoPeso';
import { dataParaTela } from '../../dominio/formatos';
import { deslocamentoDosLados, ladosIguaisEmTodas, linhasDaDicaDosDoisLados, TEXTO_LADOS_IGUAIS } from '../../dominio/ladosDoGrafico';
import { escalar } from '../../dominio/preferencias';
import { TEXTO_GRAFICOS_DESLIGADOS, TEXTO_GRAFICOS_DESLIGADOS_ALUNO } from '../../dominio/relatorio';
import { ROTULO_DESDE_A_ANTERIOR, ROTULO_DESDE_A_PRIMEIRA, variacoesDaMedida, type VariacoesDaMedida } from '../../dominio/variacaoDaMedida';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes, LARGURA_FORMULARIO, RAIO } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Interruptor } from '../../ui/Campos';
import { DicaDeTexto } from '../../ui/DicaDeTexto';
import { OPCOES_PARA_BUSCAR } from '../../ui/EscolhaEmFolha';
import { EscolhaSuspensa } from '../../ui/EscolhaSuspensa';
import { GraficoLinha } from '../../ui/GraficoLinha';
import { useDestaques } from '../../ui/NumeroDeDestaque';
import { Texto } from '../../ui/Texto';
import { corDaVariacao, escalaDoGrafico, linhasDaDica, textoDaEscala, type SeriesDaEvolucao } from './apresentacao';

/** Datas da lista de uma medida antes de "Mostrar todas". */
const DATAS_DA_MEDIDA = 6;
/** A partir desta largura do bloco, o gráfico e a tabela das datas ficam lado a lado (o Histórico do aluno na largura toda). */
const LARGURA_LADO_A_LADO = 960;
/**
 * Colunas da tabela das datas: cada valor ("100,0 cm" em mono cabe; no par o cabeçalho é só "Direito"/"Esquerdo", para os
 * dois caberem em 390 junto da data), a medida sozinha (o nome inteiro no cabeçalho) e o teto da data (data e ⓘ).
 */
const LARGURA_DO_LADO = 84;
const LARGURA_DO_VALOR = 120;
const LARGURA_DA_DATA = 160;

interface Props {
  avaliacoes: AvaliacaoFisica[];
  daEquipe: boolean;
  opcoes: OpcaoDeMedida[];
  campo: CampoDaMedida;
  aoEscolher: (c: CampoDaMedida) => void;
  series: SeriesDaEvolucao;
  verPar: boolean;
  aoVerPar: (v: boolean) => void;
  /** Meta efetiva do peso (a cor da variação do aluno em cintura, abdômen e quadril); sem ela, neutro. */
  meta?: MetaDoPeso | null;
}

/**
 * Uma medida por vez ao longo das datas: resumo (última medida e variação), gráfico de segmentos retos sem área (só os
 * pontos medidos, nunca interpolado) e a lista de todas as datas ("—" na que não teve a medida). Braço, coxa e
 * panturrilha podem mostrar direito (linha contínua, azul) e esquerdo (tracejada, violeta) juntos; onde os dois lados
 * coincidem, os marcadores se afastam um pouco e o balão traz os dois valores (`dominio/ladosDoGrafico`). Valores no azul
 * de indicador. No Histórico do aluno (28/11), sem o bloco "Histórico" da equipe: a variação segue a regra do Peso ("Desde
 * a anterior" e, pequeno, "Desde a primeira", com a cor da meta só onde a avaliação a tem) e a observação de cada data é o
 * ⓘ na linha da tabela. Bloco largo: gráfico e tabela lado a lado.
 */
export function EvolucaoDaMedida({ avaliacoes, daEquipe, opcoes, campo, aoEscolher, series, verPar, aoVerPar, meta }: Props) {
  const { preferencias, identificacao } = useTema();
  const azul = useDestaques().azul.cor;
  const violeta = identificacao.VIOLETA.cor;
  const [largura, setLargura] = useState(0);
  const { a, b, par, nome } = series;
  const grafico = graficoDaMedida(Math.max(a.pontos.length, b?.pontos.length ?? 0), preferencias.graficos);
  const escala = escalaDoGrafico([...a.pontos, ...(b?.pontos ?? [])].map((p) => p.valor));
  const legenda = textoDaEscala(escala);
  const qtd = (n: number) => (n === 1 ? '1 data' : `${n} datas`);
  const descricao = b
    ? `Gráfico de ${a.rotulo} (${qtd(a.pontos.length)}) e ${b.rotulo.toLowerCase()} (${qtd(b.pontos.length)}). ${legenda}`
    : `Gráfico de ${nome} com ${qtd(a.pontos.length)}. ${legenda}`;
  // Uma regra de data para o eixo e o balão: dd/mm, com o ano quando as datas do gráfico (as duas séries) abrangem mais de um.
  const formatar = formatadorDeDatas([...a.pontos, ...(b?.pontos ?? [])].map((p) => p.data));
  const comoPontos = (ps: { data: string; valor: number }[]) => ps.map((p) => ({ rotulo: formatar(p.data), valor: p.valor, data: p.data }));
  const deslocamento = b ? deslocamentoDosLados(a.pontos, b.pontos) : null;
  const iguais = b ? ladosIguaisEmTodas(a.pontos, b.pontos) : false;
  // No ponto em que os dois lados coincidem, o balão (de qualquer dos dois marcadores) traz os dois valores.
  const dicaDoPar = (s: 'A' | 'B', i: number) => {
    if (!b || !deslocamento || ((s === 'A' ? deslocamento.a[i] : deslocamento.b[i]) ?? 0) === 0) return null;
    const ponto = (s === 'A' ? a.pontos : b.pontos)[i];
    const outro = (s === 'A' ? b.pontos : a.pontos).find((p) => p.data === ponto.data);
    if (!outro) return null;
    const [direito, esquerdo] = s === 'A' ? [ponto, outro] : [outro, ponto];
    return linhasDaDicaDosDoisLados(ponto.data, { rotulo: a.rotulo, valor: direito.valor }, { rotulo: b.rotulo, valor: esquerdo.valor });
  };
  const lado = largura >= LARGURA_LADO_A_LADO;
  const resumo = (titulo: string, c: CampoDaMedida) => (daEquipe
    ? <Resumo titulo={titulo} resumo={resumoDaMedida(avaliacoes, c)} azul={azul} />
    : <ResumoDoAluno titulo={titulo} resumo={resumoDaMedida(avaliacoes, c)} variacoes={variacoesDaMedida(avaliacoes, c, meta)} azul={azul} />);

  return (
    <View style={estilos.bloco} onLayout={(e) => setLargura(e.nativeEvent.layout.width)}>
      {/* Campo e interruptor não esticam na tela larga (4.10): param na largura de formulário. */}
      <View style={estilos.escolha}>
        {opcoes.length > 1 ? (
          <EscolhaSuspensa rotulo="Medida" valor={campo} opcoes={opcoes} aoMudar={aoEscolher} titulo="Escolher a medida"
            semBusca={opcoes.length <= OPCOES_PARA_BUSCAR} rotuloDaBusca="Buscar medida" textoVazio="Nenhuma medida encontrada." />
        ) : (
          <Texto variante="bloco">{nome}</Texto>
        )}
        {par ? (
          <Interruptor rotulo={`${par.direita.rotulo} e ${par.esquerda.rotulo.toLowerCase()} juntos`} valor={verPar} aoMudar={aoVerPar}
            ajuda="Direito em linha contínua, esquerdo em linha tracejada, na mesma escala." />
        ) : null}
      </View>
      {series.semOutroLado ? <Texto variante="pequeno">{series.semOutroLado}</Texto> : null}

      {/* Anuncia a troca de medida sem mover o foco (WCAG 4.1.3). */}
      <View accessibilityLiveRegion="polite" style={estilos.resumos}>
        {b ? (
          <>
            {resumo(a.rotulo, par?.direita.campo ?? campo)}
            {resumo(b.rotulo, par?.esquerda.campo ?? campo)}
          </>
        ) : (
          resumo(nome, campo)
        )}
      </View>

      <View style={lado ? estilos.ladoALado : estilos.bloco}>
        <View style={lado ? estilos.colunaDoGrafico : estilos.bloco}>
          {grafico === 'linha' || grafico === 'ponto' ? (
            <GraficoLinha
              // Medida ou modo par novos montam o gráfico de novo: o balão e o ponto ativo não passam de uma medida para outra.
              key={`${campo}-${b ? 'par' : 'um'}`}
              pontos={comoPontos(a.pontos)}
              unidade="cm"
              cor={azul}
              descricao={iguais ? `${descricao} ${TEXTO_LADOS_IGUAIS}.` : descricao}
              semUltimo
              segmentos="retos"
              semArea
              destacarUltimo
              escala={escala}
              legendaDaEscala={legenda}
              rotuloA={b ? a.rotulo : undefined}
              serieB={b ? { pontos: comoPontos(b.pontos), cor: violeta, rotulo: b.rotulo } : undefined}
              deslocamentoDoPonto={deslocamento ? (s, i) => (s === 'A' ? deslocamento.a[i] : deslocamento.b[i]) ?? 0 : undefined}
              textoDaDica={(_p, i, s) => dicaDoPar(s, i)
                ?? (s === 'B' && b ? linhasDaDica(b.pontos, i, b.rotulo, formatar) : linhasDaDica(a.pontos, i, b ? a.rotulo : undefined, formatar))}
            />
          ) : null}
          {iguais && grafico !== 'desligado' ? <Texto variante="pequeno">{TEXTO_LADOS_IGUAIS}.</Texto> : null}
          {grafico === 'ponto' ? <Texto variante="pequeno">Com uma data só, o gráfico mostra o ponto; a linha aparece a partir de duas datas.</Texto> : null}
          {grafico === 'desligado' ? <Texto variante="pequeno">{daEquipe ? TEXTO_GRAFICOS_DESLIGADOS : TEXTO_GRAFICOS_DESLIGADOS_ALUNO}</Texto> : null}
        </View>
        <View style={lado ? estilos.colunaDaTabela : estilos.bloco}>
          <DatasDaMedida key={campo} avaliacoes={avaliacoes} series={series} campo={campo} azul={azul} comObservacao={!daEquipe} />
        </View>
      </View>
    </View>
  );
}

function UltimaMedida({ ultima, azul }: { ultima: NonNullable<ResumoDaMedida['ultima']>; azul: string }) {
  return (
    <View style={estilos.numero}>
      <Texto variante="pequeno">Última medida</Texto>
      <Texto variante="numero" numerico cor={azul}>{ultima.texto}</Texto>
      <Texto variante="pequeno">em {ultima.dataCompleta}</Texto>
    </View>
  );
}

/** Equipe: "Última medida" e "Variação" desde a primeira data; com um registro só, diz isso em vez de inventar variação. */
function Resumo({ titulo, resumo, azul }: { titulo: string; resumo: ResumoDaMedida; azul: string }) {
  const { cores } = useTema();
  const { ultima, variacao } = resumo;
  if (!ultima) return null;
  const corDaVariacao = !variacao ? cores.textoSuave : variacao.direcao === 'aumento' || variacao.direcao === 'reducao' ? azul : variacao.direcao === 'igual' ? cores.texto : cores.textoSuave;
  return (
    <View style={estilos.resumo}>
      <Texto variante="rotulo" cor={cores.texto}>{titulo}</Texto>
      <View style={estilos.numeros}>
        <UltimaMedida ultima={ultima} azul={azul} />
        <View style={estilos.numero}>
          <Texto variante="pequeno">Variação</Texto>
          {variacao ? (
            <>
              <Texto variante="numero" numerico cor={corDaVariacao}>{variacao.texto}</Texto>
              <Texto variante="pequeno">{resumo.desde}</Texto>
            </>
          ) : (
            <Texto variante="suave">Um registro só: a variação aparece a partir de duas datas.</Texto>
          )}
        </View>
      </View>
    </View>
  );
}

/**
 * Aluno, a regra do Peso: "Desde a anterior" com seta, sinal e a data da anterior ("▼ −20,0 cm (11/11)") e, em texto
 * pequeno, "Desde a primeira"; a cor é a da meta só em cintura, abdômen e quadril (neutro no resto, no zero e sem meta).
 * Uma data só: "Primeira", pequeno e secundário.
 */
function ResumoDoAluno({ titulo, resumo, variacoes, azul }: { titulo: string; resumo: ResumoDaMedida; variacoes: VariacoesDaMedida; azul: string }) {
  const { cores } = useTema();
  const { ultima } = resumo;
  if (!ultima || variacoes.tipo === 'semMedida') return null;
  const anterior = variacoes.tipo === 'comAnterior' ? variacoes.anterior : null;
  const primeira = variacoes.tipo === 'comAnterior' ? variacoes.primeira : null;
  const falado = anterior
    ? `${ROTULO_DESDE_A_ANTERIOR}: ${anterior.falado}.${primeira ? ` ${ROTULO_DESDE_A_PRIMEIRA}: ${primeira.falado}.` : ''}`
    : `${ROTULO_DESDE_A_ANTERIOR}: primeira medida.`;
  return (
    <View style={estilos.resumo}>
      <Texto variante="rotulo" cor={cores.texto}>{titulo}</Texto>
      <View style={estilos.numeros}>
        <UltimaMedida ultima={ultima} azul={azul} />
        <View style={estilos.numero} accessible accessibilityLabel={falado}>
          <Texto variante="pequeno">{ROTULO_DESDE_A_ANTERIOR}</Texto>
          {anterior ? (
            <View style={estilos.comData}>
              <Texto variante="numero" numerico cor={corDoTom(anterior.tom, cores)}>{anterior.texto}</Texto>
              <Texto variante="pequeno" numerico>({anterior.data})</Texto>
            </View>
          ) : (
            <Texto variante="pequeno">{variacoes.tipo === 'primeira' ? variacoes.texto : ''}</Texto>
          )}
          {primeira ? (
            <Texto variante="pequeno">
              {`${ROTULO_DESDE_A_PRIMEIRA}: `}
              <Texto variante="pequeno" numerico cor={corDaVariacao(primeira.tom, cores)} style={estilos.forte}>{primeira.texto}</Texto>
              {` (${primeira.data})`}
            </Texto>
          ) : null}
        </View>
      </View>
    </View>
  );
}

interface LinhaDeData { id: string; data: string; a: number | null; b: number | null; observacao: string | null }

/**
 * Todas as datas, da mais nova à mais antiga; a que não teve a medida mostra "—" (texto suave). Tabela compacta (28/11): os
 * valores em mono, à direita, em colunas de largura fixa junto da data, em vez de espalhados pela largura do cartão. Não é a
 * `ui/Tabela`: ela recorta o conteúdo (`overflow: hidden`) e o balão da observação sairia cortado; a linha com o balão
 * aberto sobe de camada (cada View da web empilha e as linhas de baixo pintariam por cima). A observação só aparece no
 * Histórico do aluno (`comObservacao`); na ficha ela já está no histórico da equipe.
 */
function DatasDaMedida({ avaliacoes, series, campo, azul, comObservacao }: {
  avaliacoes: AvaliacaoFisica[]; series: SeriesDaEvolucao; campo: CampoDaMedida; azul: string; comObservacao: boolean;
}) {
  const { cores, bordas, fatorTexto } = useTema();
  const [todas, setTodas] = useState(false);
  const [comDica, setComDica] = useState<string | null>(null);
  const { b, par } = series;
  const campoA = b && par ? par.direita.campo : campo;
  const linhasA = serieDaMedida(avaliacoes, campoA).linhas;
  const linhasB = b && par ? serieDaMedida(avaliacoes, par.esquerda.campo).linhas : null;
  const observacoes = new Map(avaliacoes.map((av) => [av.id, av.observacao]));
  const linhas: LinhaDeData[] = linhasA.map((l, i) => ({
    id: l.id, data: l.data, a: l.valor, b: linhasB?.[i]?.valor ?? null, observacao: comObservacao ? (observacoes.get(l.id) ?? null) : null,
  }));
  const visiveis = todas ? linhas : linhas.slice(0, DATAS_DA_MEDIDA);
  // No par, "Direito"/"Esquerdo" no cabeçalho e o nome inteiro para o leitor de tela.
  const titulos = b ? [{ curto: 'Direito', nome: series.a.rotulo }, { curto: 'Esquerdo', nome: b.rotulo }] : [{ curto: series.nome, nome: series.nome }];
  const valor = { width: escalar(b ? LARGURA_DO_LADO : LARGURA_DO_VALOR, fatorTexto), alignItems: 'flex-end' as const };
  const data = { width: escalar(LARGURA_DA_DATA, fatorTexto), flexShrink: 1, minWidth: 0 };
  const celula = (v: number | null) => (
    <Texto numerico style={[estilos.forte, estilos.textoADireita]} cor={v === null ? cores.textoSuave : azul}>{v === null ? '—' : `${cmParaTela(v)} cm`}</Texto>
  );
  return (
    <>
      <View role="table" accessibilityLabel={`${b ? `${series.a.rotulo} e ${b.rotulo.toLowerCase()}` : series.nome} por data`}
        style={[estilos.tabela, { borderWidth: bordas.bloco, borderColor: cores.divisor }, comDica ? estilos.porCima : null]}>
        <View role="row" style={[estilos.linha, estilos.cabecalho, { backgroundColor: cores.superficie3, borderColor: cores.bordaCampo, borderTopLeftRadius: RAIO - bordas.bloco, borderTopRightRadius: RAIO - bordas.bloco }]}>
          <View role="columnheader" style={data}><Texto variante="secao">Data</Texto></View>
          {titulos.map((t) => (
            <View key={t.nome} role="columnheader" aria-label={`${t.nome} (cm)`} style={valor}>
              <Texto variante="secao" style={estilos.textoADireita}>{t.curto}</Texto>
            </View>
          ))}
        </View>
        {visiveis.map((l, i) => (
          <View key={l.id} role="row"
            style={[estilos.linha, i < visiveis.length - 1 ? { borderBottomWidth: 1, borderColor: cores.divisor } : null, comDica === l.id ? estilos.porCima : null]}>
            <View role="cell" style={[data, estilos.data]}>
              <Texto numerico style={estilos.forte}>{dataParaTela(l.data)}</Texto>
              {l.observacao ? (
                <DicaDeTexto rotulo={`Observação de ${dataParaTela(l.data)}`} texto={l.observacao}
                  aoMudar={(aberta) => setComDica((atual) => (aberta ? l.id : atual === l.id ? null : atual))} />
              ) : null}
            </View>
            <View role="cell" style={valor}>{celula(l.a)}</View>
            {b ? <View role="cell" style={valor}>{celula(l.b)}</View> : null}
          </View>
        ))}
      </View>
      {linhas.length > DATAS_DA_MEDIDA ? (
        <Botao rotulo={todas ? 'Mostrar só as últimas' : `Mostrar todas as datas (${linhas.length})`} tipo="fantasma" aoTocar={() => setTodas((v) => !v)} />
      ) : null}
    </>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(1.5) },
  escolha: { gap: espaco(1.5), maxWidth: LARGURA_FORMULARIO },
  resumos: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(2) },
  resumo: { flexGrow: 1, flexBasis: 260, minWidth: 0, gap: espaco(0.5) },
  numeros: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(2) },
  numero: { flexGrow: 1, flexBasis: 120, minWidth: 0, gap: 2 },
  comData: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: espaco(0.75) },
  forte: { fontFamily: fontes.semi },
  ladoALado: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(3) },
  colunaDoGrafico: { flex: 1, minWidth: 0, gap: espaco(1.5) },
  colunaDaTabela: { flexShrink: 0, gap: espaco(1.5) },
  // Sem `overflow: hidden` (cortaria o balão da observação): o cabeçalho arredonda sozinho os cantos de cima.
  tabela: { alignSelf: 'flex-start', maxWidth: '100%', borderRadius: RAIO },
  porCima: { zIndex: 10 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5), paddingHorizontal: espaco(1.5), minHeight: 48 },
  cabecalho: { alignItems: 'flex-end', borderBottomWidth: 1, paddingVertical: espaco(1) },
  data: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: espaco(0.5) },
  textoADireita: { textAlign: 'right' },
});
