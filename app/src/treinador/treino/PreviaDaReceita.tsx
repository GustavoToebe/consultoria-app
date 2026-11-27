import { useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import type { Configuracao, Receita } from '../../api/tipos';
import { agrupar, descreverGrupo, tituloDoGrupoDeSeries } from '../../dominio/agrupamento';
import { corDoTipoDeSerie } from '../../dominio/corDaSerie';
import { blocosESeries, resumoDoBloco, textoDeBlocosESeries } from '../../dominio/editorDeTreino';
import { seriesDaReceita } from '../../dominio/editorTreino';
import { nomeDoTipo, papelDe } from '../../dominio/metodologia';
import { CONFIGURACAO_PADRAO } from '../../dominio/metodologiaPadrao';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { corDaSerie } from '../../ui/pinturaDaSerie';
import { Texto } from '../../ui/Texto';
import { useUnidadeDeCarga } from '../../ui/unidadeDeCargaEmUso';
import { cargaDoBloco } from './cargaDaSerie';
import { LARGURA_DAS_COLUNAS, TabelaDeBlocos, type LinhaDoBloco } from './TabelaDeBlocos';

/**
 * A prévia da receita escolhida na folha "Usar receita" (27/11): nome, descrição (uma vez só), a sequência e a coleção (só
 * quando a receita tem uma). A sequência é a mesma tabela das séries do editor (`TabelaDeBlocos`: cartão pintado na cor
 * do tipo com a faixa reta, pela preferência "Cor das séries"), só leitura: sem alça nem ⋯; abrir uma linha mostra a
 * prescrição do grupo por extenso. Os uids das séries nascem aqui e não vão ao plano.
 */
export function PreviaDaReceita({ receita: r, config, colecao }: {
  receita: Receita;
  config: Configuracao | null;
  /** Nome da coleção da receita; nulo = sem coleção (ou as coleções não carregaram): a linha some. */
  colecao: string | null;
}) {
  const { cores, identificacao, preferencias } = useTema();
  const unidade = useUnidadeDeCarga();
  const cfg = config ?? CONFIGURACAO_PADRAO;
  const series = useMemo(() => seriesDaReceita(r.conteudo), [r.conteudo]);
  const grupos = useMemo(() => agrupar(series), [series]);
  const [aberta, setAberta] = useState<string | null>(null);
  const [largura, setLargura] = useState<number | null>(null);
  const medir = (e: LayoutChangeEvent) => setLargura(e.nativeEvent.layout.width);
  // Mesma montagem das linhas do `EditorSeries` (sem a validação, que é do exercício e não da receita).
  const linhas: LinhaDoBloco[] = grupos.map((g, i) => {
    const s = g.series[0];
    const tipo = s.cardio ? undefined : nomeDoTipo(cfg, s.tipo) || undefined;
    const c = corDaSerie(preferencias?.corDasSeries ?? 'TIPO', s.cardio ? null : corDoTipoDeSerie(s.tipo, papelDe(cfg, s.tipo)), identificacao, cores);
    return {
      valor: s.uid,
      rotulo: `Série ${i + 1}${tipo ? ` · ${tipo}` : ''}`,
      serie: `Série ${i + 1}`,
      tipo,
      cor: c.cor,
      categoria: c.categoria ?? undefined,
      carga: s.cardio ? '—' : cargaDoBloco(g, cfg, unidade),
      resumo: resumoDoBloco(g, cfg),
      edicao: `Série ${i + 1}${s.cardio ? '' : `, ${tituloDoGrupoDeSeries(g, cfg)}`}`,
    };
  });
  const grupoAberto = grupos.find((g) => g.series[0].uid === aberta);
  return (
    <View style={estilos.previa} onLayout={medir}>
      <View style={estilos.cabeca}>
        <Texto variante="bloco" nivel={3}>{r.nome}</Texto>
        {r.descricao ? <Texto variante="suave">{r.descricao}</Texto> : null}
      </View>
      {grupos.length ? (
        <View style={estilos.sequencia}>
          <Texto variante="secao">Sequência</Texto>
          <TabelaDeBlocos linhas={linhas} ativa={aberta} aoMudar={setAberta} empilhado={largura !== null && largura < LARGURA_DAS_COLUNAS}
            detalhe={grupoAberto ? <Texto numerico style={estilos.detalhe}>{descreverGrupo(grupoAberto, config, { unidade })}</Texto> : undefined} />
          <Texto variante="pequeno" numerico>{`Esta receita: ${textoDeBlocosESeries(blocosESeries(series))}`}</Texto>
        </View>
      ) : <Texto variante="suave">Esta receita não tem séries.</Texto>}
      {colecao ? <Texto variante="pequeno">{`Coleção: ${colecao}`}</Texto> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  previa: { gap: espaco(2) },
  cabeca: { gap: espaco(0.5) },
  sequencia: { gap: espaco(1) },
  detalhe: { paddingHorizontal: espaco(1.5), paddingBottom: espaco(1.25) },
});
