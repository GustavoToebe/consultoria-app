import { FileDown } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { AvaliacaoFisica } from '../../api/avaliacaoFisicaTipos';
import type { MetaDoPeso } from '../../api/tipos';
import { medidasPreenchidas } from '../../dominio/avaliacaoFisica';
import { diferencaEntre, idsDasDuasUltimas, maisRecentesPrimeiro } from '../../dominio/comparacaoDeAvaliacoes';
import { dataParaTela } from '../../dominio/formatos';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes, LARGURA_FOLHA_LARGA } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Interruptor } from '../../ui/Campos';
import { OPCOES_PARA_BUSCAR } from '../../ui/EscolhaEmFolha';
import { EscolhaSuspensa } from '../../ui/EscolhaSuspensa';
import { Folha } from '../../ui/Folha';
import { NoPlano } from '../../ui/NoPlano';
import { Texto } from '../../ui/Texto';
import { corDaVariacao } from './apresentacao';

interface Props {
  avaliacoes: AvaliacaoFisica[];
  meta: MetaDoPeso | null | undefined;
  aoFechar: () => void;
  /** PDF do comparativo das duas datas; nulo quando não aparece (aluno sem internet ou sem a marca). */
  pdf: {
    gerando: boolean;
    aoBaixar: (ids: [string, string]) => void;
    /** Nome da medida que a Evolução mostra (vai no PDF se a pessoa ligar); nulo sem medida. */
    grafico: string | null;
    incluirGrafico: boolean;
    aoIncluirGrafico: (v: boolean) => void;
  } | null;
}

/**
 * "Comparar" do histórico (27/11): duas datas e só a diferença entre elas, medida por medida (a mais nova menos a mais
 * antiga, com a seta e a cor da meta nas colunas que a têm), com os dois valores embaixo para conferir. Abre nas duas
 * últimas; uma escolha nunca oferece a data da outra (duas iguais não existem). O "Baixar comparativo" leva exatamente essas
 * duas datas. Folha média (resultado, P1).
 */
export function FolhaComparar({ avaliacoes, meta, aoFechar, pdf }: Props) {
  const { cores } = useTema();
  const [inicial] = useState(() => idsDasDuasUltimas(avaliacoes));
  const [de, setDe] = useState(inicial[0] ?? '');
  const [ate, setAte] = useState(inicial[1] ?? '');
  const opcoes = maisRecentesPrimeiro(avaliacoes).map((a) => {
    const n = medidasPreenchidas(a.medidas);
    return { valor: a.id, rotulo: dataParaTela(a.data), detalhe: `${n} ${n === 1 ? 'medida' : 'medidas'}` };
  });
  const linhas = diferencaEntre(avaliacoes, de, ate, meta);
  const [antiga, nova] = avaliacoes.filter((a) => a.id === de || a.id === ate).sort((x, y) => x.data.localeCompare(y.data));
  const escolha = (rotulo: string, valor: string, outra: string, aoMudar: (v: string) => void) => {
    const daqui = opcoes.filter((o) => o.valor !== outra);
    return (
      <View style={estilos.escolha}>
        <EscolhaSuspensa rotulo={rotulo} valor={valor} opcoes={daqui} aoMudar={aoMudar} titulo={`${rotulo}: escolher a data`}
          semBusca={daqui.length <= OPCOES_PARA_BUSCAR} rotuloDaBusca="Buscar data" textoVazio="Nenhuma data encontrada." />
      </View>
    );
  };

  return (
    <Folha
      visivel
      largura={LARGURA_FOLHA_LARGA}
      titulo="Comparar avaliações"
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao rotulo="Fechar" tipo="secundario" aoTocar={aoFechar} />
          {pdf ? (
            <NoPlano funcionalidade="PDF">
              <Botao rotulo="Baixar comparativo" tipo="secundario" Icone={FileDown} carregando={pdf.gerando} aoTocar={() => pdf.aoBaixar([de, ate])} />
            </NoPlano>
          ) : null}
        </>
      }>
      <View style={estilos.escolhas}>
        {escolha('Primeira data', de, ate, setDe)}
        {escolha('Segunda data', ate, de, setAte)}
      </View>
      {antiga && nova ? <Texto variante="pequeno">Diferença = {dataParaTela(nova.data)} menos {dataParaTela(antiga.data)}.</Texto> : null}
      {linhas.length === 0 ? <Texto variante="suave">Nenhuma medida nas datas escolhidas.</Texto> : (

        <View accessibilityRole="list" accessibilityLabel="Diferença entre as datas" style={[estilos.lista, { borderColor: cores.divisor }]}>
          {linhas.map((l, i) => (
            <View key={l.chave} role="listitem" accessible
              accessibilityLabel={`${l.nome}: ${l.variacao.falado || 'sem variação calculada'}. ${l.valores.replace('→', 'para')}.`}
              style={[estilos.linha, i < linhas.length - 1 ? { borderBottomWidth: 1, borderColor: cores.divisor } : null]}>
              <Texto style={estilos.nome}>{l.nome}</Texto>
              <View style={estilos.numeros}>
                <Texto numerico cor={l.variacao.tom === 'neutro' ? cores.texto : corDaVariacao(l.variacao.tom, cores)} style={estilos.forte}>{l.variacao.texto}</Texto>
                <Texto variante="pequeno" numerico>{l.valores}</Texto>
              </View>
            </View>
          ))}
        </View>
      )}
      {pdf?.grafico ? (
        <NoPlano funcionalidade="PDF">
          <Interruptor rotulo="Incluir o gráfico da medida no PDF" valor={pdf.incluirGrafico} aoMudar={pdf.aoIncluirGrafico}
            ajuda={`O gráfico de ${pdf.grafico.toLowerCase()}, só com as duas datas.`} />
        </NoPlano>
      ) : null}
    </Folha>
  );
}

const estilos = StyleSheet.create({
  escolhas: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5) },
  escolha: { flexGrow: 1, flexBasis: 220, minWidth: 0 },
  lista: { borderTopWidth: 1, borderBottomWidth: 1 },
  linha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(2), paddingVertical: espaco(1), minHeight: 48 },
  nome: { flex: 1, minWidth: 0 },
  numeros: { alignItems: 'flex-end' },
  forte: { fontFamily: fontes.semi },
});
