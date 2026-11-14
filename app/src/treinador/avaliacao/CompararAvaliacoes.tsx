import { FileDown } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import type { AvaliacaoFisica } from '../../api/avaliacaoFisicaTipos';
import { COMPARAR_MAXIMO, diferenca, diferencaParaTela, pesoParaTela } from '../../dominio/avaliacaoFisica';
import {
  idsDasDuasUltimas, limparSelecao, TEXTO_INDISPONIVEL, textoDaSelecao, type ComparacaoDeAvaliacoes, type DirecaoDaVariacao,
} from '../../dominio/comparacaoDeAvaliacoes';
import { dataParaTela } from '../../dominio/formatos';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Interruptor } from '../../ui/Campos';
import { NoPlano } from '../../ui/NoPlano';
import { useDestaques } from '../../ui/NumeroDeDestaque';
import { Tabela, type ColunaDaTabela } from '../../ui/Tabela';
import { Texto } from '../../ui/Texto';

/** Abaixo disso (o cartão no celular) a tabela vira um bloco por medida, sem rolagem lateral. */
const LARGURA_DA_TABELA = 560;

/** Contador, "Comparar as duas últimas", "Limpar seleção" e, com 4 marcadas, por que a 5ª não entra. */
export function SelecaoDoComparar({ avaliacoes, marcadas, aoMudar }: { avaliacoes: AvaliacaoFisica[]; marcadas: string[]; aoMudar: (ids: string[]) => void }) {
  const duas = idsDasDuasUltimas(avaliacoes);
  const jaSaoAsDuas = marcadas.length === 2 && duas.every((id) => marcadas.includes(id));
  return (
    <View style={estilos.bloco}>
      <Texto variante="suave">Marque de 2 a {COMPARAR_MAXIMO} datas no histórico.</Texto>
      <View style={estilos.barra}>
        <Texto variante="rotulo" accessibilityLiveRegion="polite">{textoDaSelecao(marcadas.length)}</Texto>
        <View style={estilos.botoes}>
          <Botao rotulo="Comparar as duas últimas" tipo="secundario" aoTocar={() => aoMudar(duas)}
            desabilitado={jaSaoAsDuas} motivo={jaSaoAsDuas ? 'As duas últimas já estão selecionadas.' : undefined} />
          <Botao rotulo="Limpar seleção" tipo="fantasma" aoTocar={() => aoMudar(limparSelecao())}
            desabilitado={marcadas.length === 0} motivo={marcadas.length === 0 ? 'Nenhuma data selecionada.' : undefined} />
        </View>
      </View>
      {marcadas.length >= COMPARAR_MAXIMO ? (
        <Texto variante="pequeno">Compare no máximo {COMPARAR_MAXIMO} datas. Desmarque uma para escolher outra.</Texto>
      ) : null}
    </View>
  );
}

interface LinhaDaTabela {
  chave: string;
  rotulo: string;
  celulas: { texto: string; ausente: boolean }[];
  variacao: { texto: string; direcao: DirecaoDaVariacao };
}

interface PropsDoResultado {
  avaliacoes: AvaliacaoFisica[];
  comparacao: ComparacaoDeAvaliacoes;
  mostrarBaixar: boolean;
  gerando: boolean;
  aoBaixar: () => void;
  /** Nome da medida que a Evolução mostra (vai no PDF se a pessoa ligar); nulo sem medida. */
  graficoDoPdf: string | null;
  incluirGrafico: boolean;
  aoIncluirGrafico: (v: boolean) => void;
}

/**
 * Tabela medida × data das datas marcadas, agrupada em Tronco, Braços e Pernas, em ordem cronológica (a última, a mais
 * recente, em semi-negrito), e a "Variação" (última − primeira) com o sinal escrito, no azul de indicador quando muda. O
 * peso do dia fica à parte, informativo. No celular, um bloco por medida (a `Tabela` empilha abaixo da largura).
 */
export function ResultadoDaComparacao(p: PropsDoResultado) {
  const { cores } = useTema();
  const azul = useDestaques().azul.cor;
  const c = p.comparacao;
  if (c.estado !== 'ok') return <Texto variante="suave">{c.mensagem}</Texto>;
  const ultima = c.colunas.length - 1;

  const colunas: ColunaDaTabela<LinhaDaTabela>[] = [
    { chave: 'medida', titulo: 'Medida', flex: 1.4, principal: true, render: (l) => <Texto style={estilos.forte}>{l.rotulo}</Texto> },
    ...c.colunas.map((col, i): ColunaDaTabela<LinhaDaTabela> => ({
      chave: `data-${col.id}`,
      titulo: dataParaTela(col.data),
      alinhar: 'direita',
      render: (l) => (
        <Texto numerico cor={l.celulas[i].ausente ? cores.textoSuave : cores.texto} style={i === ultima ? estilos.forte : undefined}>{l.celulas[i].texto}</Texto>
      ),
    })),
    {
      chave: 'variacao', titulo: 'Variação', alinhar: 'direita',
      render: (l) => {
        const muda = l.variacao.direcao === 'aumento' || l.variacao.direcao === 'reducao';
        return <Texto numerico style={estilos.forte} cor={muda ? azul : l.variacao.direcao === 'igual' ? cores.texto : cores.textoSuave}>{l.variacao.texto}</Texto>;
      },
    },
  ];
  const tabela = (rotulo: string, linhas: LinhaDaTabela[]) => (
    <Tabela rotulo={rotulo} linhas={linhas} chave={(l) => l.chave} colunas={colunas} larguraMinima={LARGURA_DA_TABELA} />
  );

  // Peso do registro da mesma data (valor do dia ou "—"): só informativo, fora dos grupos; a variação só com as duas
  // pontas, como no PDF.
  const pesos = c.colunas.map((col) => p.avaliacoes.find((a) => a.id === col.id)?.pesoKg ?? null);
  const difDoPeso = diferenca(pesos[0], pesos[ultima], 2);
  const linhaDoPeso: LinhaDaTabela | null = pesos.some((v) => v !== null) ? {
    chave: 'peso',
    rotulo: 'Peso',
    celulas: pesos.map((v) => ({ texto: pesoParaTela(v), ausente: v === null })),
    variacao: difDoPeso === null
      ? { texto: TEXTO_INDISPONIVEL, direcao: 'indisponivel' }
      : { texto: diferencaParaTela(difDoPeso, 'kg'), direcao: difDoPeso === 0 ? 'igual' : difDoPeso > 0 ? 'aumento' : 'reducao' },
  } : null;

  return (
    <View style={estilos.bloco}>
      <Texto variante="secao" nivel={3}>Comparativo de circunferências (cm)</Texto>
      <Texto variante="pequeno">{c.referencia}</Texto>
      <View accessibilityLabel="Comparativo da avaliação física" style={estilos.bloco}>
        {c.grupos.map((g) => (
          <View key={g.id} style={estilos.grupo}>
            <Texto variante="subtitulo">{g.titulo}</Texto>
            {tabela(`${g.titulo}: circunferências por data`, g.itens.map((i) => ({
              chave: i.chave, rotulo: i.rotulo, celulas: i.celulas.map((x) => ({ texto: x.texto, ausente: x.valor === null })), variacao: i.variacao,
            })))}
          </View>
        ))}
        {c.grupos.length === 0 ? <Texto variante="suave">Nenhuma medida nas datas escolhidas.</Texto> : null}
        {linhaDoPeso ? (
          <View style={estilos.grupo}>
            <Texto variante="subtitulo">Peso do dia (informativo)</Texto>
            {tabela('Peso do registro da mesma data', [linhaDoPeso])}
            <Texto variante="pequeno">O peso é o registro de peso da mesma data; não é medido na avaliação.</Texto>
          </View>
        ) : null}
      </View>
      {p.mostrarBaixar ? (
        <NoPlano funcionalidade="PDF">
          <View style={estilos.bloco}>
            {p.graficoDoPdf ? (
              <Interruptor rotulo="Incluir o gráfico da medida no PDF" valor={p.incluirGrafico} aoMudar={p.aoIncluirGrafico}
                ajuda={`O gráfico de ${p.graficoDoPdf.toLowerCase()}, como na Evolução por medida.`} />
            ) : null}
            <View style={estilos.botoes}>
              <Botao rotulo="Baixar comparativo" tipo="secundario" Icone={FileDown} carregando={p.gerando} aoTocar={p.aoBaixar} />
            </View>
          </View>
        </NoPlano>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(1.5) },
  grupo: { gap: espaco(1) },
  barra: { gap: espaco(1) },
  botoes: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
  forte: { fontFamily: fontes.semi },
});
