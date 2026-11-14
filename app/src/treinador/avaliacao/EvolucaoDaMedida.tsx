import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { AvaliacaoFisica, CampoDaMedida } from '../../api/avaliacaoFisicaTipos';
import { cmParaTela, graficoDaMedida, serieDaMedida, type OpcaoDeMedida } from '../../dominio/avaliacaoFisica';
import { resumoDaMedida, type ResumoDaMedida } from '../../dominio/comparacaoDeAvaliacoes';
import { dataCurta, dataParaTela } from '../../dominio/formatos';
import { TEXTO_GRAFICOS_DESLIGADOS, TEXTO_GRAFICOS_DESLIGADOS_ALUNO } from '../../dominio/relatorio';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Interruptor } from '../../ui/Campos';
import { OPCOES_PARA_BUSCAR } from '../../ui/EscolhaEmFolha';
import { EscolhaSuspensa } from '../../ui/EscolhaSuspensa';
import { GraficoLinha } from '../../ui/GraficoLinha';
import { useDestaques } from '../../ui/NumeroDeDestaque';
import { Tabela, type ColunaDaTabela } from '../../ui/Tabela';
import { Texto } from '../../ui/Texto';
import { escalaDoGrafico, linhasDaDica, textoDaEscala, type SeriesDaEvolucao } from './apresentacao';

/** Datas da lista de uma medida antes de "Mostrar todas". */
const DATAS_DA_MEDIDA = 6;

interface Props {
  avaliacoes: AvaliacaoFisica[];
  daEquipe: boolean;
  opcoes: OpcaoDeMedida[];
  campo: CampoDaMedida;
  aoEscolher: (c: CampoDaMedida) => void;
  series: SeriesDaEvolucao;
  verPar: boolean;
  aoVerPar: (v: boolean) => void;
}

/**
 * Uma medida por vez ao longo das datas: resumo (última medida e variação), gráfico de segmentos retos sem área (só os
 * pontos medidos, nunca interpolado) e a lista de todas as datas ("—" na que não teve a medida). Braço, coxa e
 * panturrilha podem mostrar direito (linha contínua, azul) e esquerdo (tracejada, violeta) juntos. Valores no azul de
 * indicador; títulos neutros; nada de verde ou vermelho (a variação é só dado).
 */
export function EvolucaoDaMedida({ avaliacoes, daEquipe, opcoes, campo, aoEscolher, series, verPar, aoVerPar }: Props) {
  const { preferencias, identificacao } = useTema();
  const azul = useDestaques().azul.cor;
  const violeta = identificacao.VIOLETA.cor;
  const { a, b, par, nome } = series;
  const grafico = graficoDaMedida(Math.max(a.pontos.length, b?.pontos.length ?? 0), preferencias.graficos);
  const escala = escalaDoGrafico([...a.pontos, ...(b?.pontos ?? [])].map((p) => p.valor));
  const legenda = textoDaEscala(escala);
  const qtd = (n: number) => (n === 1 ? '1 data' : `${n} datas`);
  const descricao = b
    ? `Gráfico de ${a.rotulo} (${qtd(a.pontos.length)}) e ${b.rotulo.toLowerCase()} (${qtd(b.pontos.length)}). ${legenda}`
    : `Gráfico de ${nome} com ${qtd(a.pontos.length)}. ${legenda}`;
  const comoPontos = (ps: { data: string; valor: number }[]) => ps.map((p) => ({ rotulo: dataCurta(p.data), valor: p.valor, data: p.data }));

  return (
    <View style={estilos.bloco}>
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
      {series.semOutroLado ? <Texto variante="pequeno">{series.semOutroLado}</Texto> : null}

      {/* Anuncia a troca de medida sem mover o foco (WCAG 4.1.3). */}
      <View accessibilityLiveRegion="polite" style={estilos.resumos}>
        {b ? (
          <>
            <Resumo titulo={a.rotulo} resumo={resumoDaMedida(avaliacoes, par?.direita.campo ?? campo)} azul={azul} />
            <Resumo titulo={b.rotulo} resumo={resumoDaMedida(avaliacoes, par?.esquerda.campo ?? campo)} azul={azul} />
          </>
        ) : (
          <Resumo titulo={nome} resumo={resumoDaMedida(avaliacoes, campo)} azul={azul} />
        )}
      </View>

      {grafico === 'linha' || grafico === 'ponto' ? (
        <GraficoLinha
          // Medida ou modo par novos montam o gráfico de novo: o balão e o ponto ativo não passam de uma medida para outra.
          key={`${campo}-${b ? 'par' : 'um'}`}
          pontos={comoPontos(a.pontos)}
          unidade="cm"
          cor={azul}
          descricao={descricao}
          semUltimo
          segmentos="retos"
          semArea
          destacarUltimo
          escala={escala}
          legendaDaEscala={legenda}
          rotuloA={b ? a.rotulo : undefined}
          serieB={b ? { pontos: comoPontos(b.pontos), cor: violeta, rotulo: b.rotulo } : undefined}
          textoDaDica={(_p, i, s) => (s === 'B' && b ? linhasDaDica(b.pontos, i, b.rotulo) : linhasDaDica(a.pontos, i, b ? a.rotulo : undefined))}
        />
      ) : null}
      {grafico === 'ponto' ? <Texto variante="pequeno">Com uma data só, o gráfico mostra o ponto; a linha aparece a partir de duas datas.</Texto> : null}
      {grafico === 'desligado' ? <Texto variante="pequeno">{daEquipe ? TEXTO_GRAFICOS_DESLIGADOS : TEXTO_GRAFICOS_DESLIGADOS_ALUNO}</Texto> : null}

      <DatasDaMedida key={campo} avaliacoes={avaliacoes} series={series} campo={campo} azul={azul} />
    </View>
  );
}

/** "Última medida" e "Variação" de uma série; com um registro só, diz isso em vez de inventar variação. */
function Resumo({ titulo, resumo, azul }: { titulo: string; resumo: ResumoDaMedida; azul: string }) {
  const { cores } = useTema();
  const { ultima, variacao } = resumo;
  if (!ultima) return null;
  const corDaVariacao = !variacao ? cores.textoSuave : variacao.direcao === 'aumento' || variacao.direcao === 'reducao' ? azul : variacao.direcao === 'igual' ? cores.texto : cores.textoSuave;
  return (
    <View style={estilos.resumo}>
      <Texto variante="rotulo" cor={cores.texto}>{titulo}</Texto>
      <View style={estilos.numeros}>
        <View style={estilos.numero}>
          <Texto variante="pequeno">Última medida</Texto>
          <Texto variante="numero" numerico cor={azul}>{ultima.texto}</Texto>
          <Texto variante="pequeno">em {ultima.dataCompleta}</Texto>
        </View>
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

interface LinhaDeData { id: string; data: string; a: number | null; b: number | null }

/** Todas as datas, da mais nova à mais antiga; a que não teve a medida mostra "—" (texto suave). */
function DatasDaMedida({ avaliacoes, series, campo, azul }: { avaliacoes: AvaliacaoFisica[]; series: SeriesDaEvolucao; campo: CampoDaMedida; azul: string }) {
  const { cores } = useTema();
  const [todas, setTodas] = useState(false);
  const { b, par } = series;
  const campoA = b && par ? par.direita.campo : campo;
  const linhasA = serieDaMedida(avaliacoes, campoA).linhas;
  const linhasB = b && par ? serieDaMedida(avaliacoes, par.esquerda.campo).linhas : null;
  const linhas: LinhaDeData[] = linhasA.map((l, i) => ({ id: l.id, data: l.data, a: l.valor, b: linhasB?.[i]?.valor ?? null }));
  const visiveis = todas ? linhas : linhas.slice(0, DATAS_DA_MEDIDA);
  const celula = (v: number | null) => (
    <Texto numerico style={estilos.forte} cor={v === null ? cores.textoSuave : azul}>{v === null ? '—' : `${cmParaTela(v)} cm`}</Texto>
  );
  const colunas: ColunaDaTabela<LinhaDeData>[] = [
    { chave: 'data', titulo: 'Data', principal: true, render: (l) => <Texto numerico style={estilos.forte}>{dataParaTela(l.data)}</Texto> },
    { chave: 'a', titulo: series.a.rotulo, alinhar: 'direita', render: (l) => celula(l.a) },
    ...(b ? [{ chave: 'b', titulo: b.rotulo, alinhar: 'direita' as const, render: (l: LinhaDeData) => celula(l.b) }] : []),
  ];
  return (
    <>
      <Tabela rotulo={`${b ? `${series.a.rotulo} e ${b.rotulo.toLowerCase()}` : series.nome} por data`} linhas={visiveis} chave={(l) => l.id} colunas={colunas} larguraMinima={b ? 420 : 320} />
      {linhas.length > DATAS_DA_MEDIDA ? (
        <Botao rotulo={todas ? 'Mostrar só as últimas' : `Mostrar todas as datas (${linhas.length})`} tipo="fantasma" aoTocar={() => setTodas((v) => !v)} />
      ) : null}
    </>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(1.5) },
  resumos: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(2) },
  resumo: { flexGrow: 1, flexBasis: 260, minWidth: 0, gap: espaco(0.5) },
  numeros: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(2) },
  numero: { flexGrow: 1, flexBasis: 120, minWidth: 0, gap: 2 },
  forte: { fontFamily: fontes.semi },
});
