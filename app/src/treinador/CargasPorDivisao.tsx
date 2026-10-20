import { EntradaEmCascata, usePrimeiraLista } from '../ui/EntradaEmCascata';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { dataParaTela } from '../dominio/formatos';
import { partesDaDivisao, ultimoRegistroDaDivisao, type DivisaoRelatorio } from '../dominio/relatorio';
import { textoCarga } from '../pdf/pdfCargas';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../tema/tokens';
import { larguraDaData } from '../ui/larguraDaData';
import { Tabela } from '../ui/Tabela';
import { sobre } from '../ui/sobre';
import { Texto } from '../ui/Texto';

/** Quatro colunas curtas cabem no celular; só abaixo disso a tabela vira cartões. */
const LARGURA_MINIMA_TABELA = 280;

/**
 * Cargas por divisão (treinador e aluno): faixa com o nome da divisão e, para cada exercício, uma tabela com a data,
 * a carga de trabalho, as repetições e as séries feitas. Observação do aluno embaixo da linha. Carga na cor do texto,
 * nunca da marca.
 */
export function CargasPorDivisao({ divisoes }: { divisoes: DivisaoRelatorio[] }) {
  const { cores, fatorTexto } = useTema();
  // "—" na carga quer dizer que não houve série de trabalho com carga naquele dia (só aquecimento ou preparação):
  // sem explicar, parecia que o registro sumiu.
  const temSoPreparacao = divisoes.some((d) => d.exercicios.some((e) => e.linhas.some((l) => l.carga === null && !l.semCarga)));
  const larguraData = larguraDaData(fatorTexto);
  const animar = usePrimeiraLista(divisoes.length > 0, divisoes.map((d) => d.chave).join('|'));
  const [recolhidas, setRecolhidas] = useState<ReadonlySet<string>>(new Set());
  const alternar = (chave: string) =>
    setRecolhidas((atual) => {
      const novo = new Set(atual);
      if (!novo.delete(chave)) novo.add(chave);
      return novo;
    });
  return (
    <View style={estilos.lista}>
      {temSoPreparacao ? (
        <Texto variante="suave">Carga e reps contam só as séries de trabalho. “—” = nesse dia só houve aquecimento ou preparação.</Texto>
      ) : null}
      {divisoes.map((d, i) => (
        <EntradaEmCascata indice={i} animar={animar} key={d.chave} style={estilos.divisao}>
          <FaixaDaDivisao divisao={d} aberta={!recolhidas.has(d.chave)} aoAlternar={() => alternar(d.chave)} />
          {recolhidas.has(d.chave) ? null : d.exercicios.map((e) => (
            <View key={e.chave} style={[estilos.exercicio, { borderColor: cores.borda }]}>
              <View style={[estilos.cabecalho, { backgroundColor: cores.superficie2 }]}>
                <Texto numerico style={estilos.nomeExercicio}>{e.nome}</Texto>
                <Texto numerico variante="pequeno">
                  {e.linhas.length} {e.linhas.length === 1 ? 'sessão' : 'sessões'}
                </Texto>
              </View>
              <View style={estilos.tabela}>
                <Tabela
                  rotulo={`Cargas de ${e.nome}`}
                  linhas={[...e.linhas].reverse().map((l, i) => ({ ...l, chave: `${l.data}-${i}` }))}
                  chave={(l) => l.chave}
                  larguraMinima={LARGURA_MINIMA_TABELA}
                  colunas={[
                    { chave: 'data', titulo: 'Data', largura: larguraData, principal: true, render: (l) => <Texto numerico style={estilos.forte}>{dataParaTela(l.data)}</Texto> },
                    { chave: 'carga', titulo: 'Carga', flex: 1.8, alinhar: 'direita', render: (l) => <Texto numerico style={estilos.carga}>{textoCarga(l)}</Texto> },
                    { chave: 'reps', titulo: 'Reps', flex: 0.7, alinhar: 'direita', render: (l) => <Texto numerico>{l.repeticoes ?? '—'}</Texto> },
                    { chave: 'series', titulo: 'Séries', flex: 0.9, alinhar: 'direita', render: (l) => <Texto numerico variante="suave">{l.series}</Texto> },
                  ]}
                  detalhe={(l) => l.observacoes.length ? (
                    <View style={[estilos.obs, { borderLeftColor: cores.atencao }]}>
                      <Texto numerico variante="suave" style={estilos.obsTexto}>{l.observacoes.join(' · ')}</Texto>
                    </View>
                  ) : null}
                />
              </View>
            </View>
          ))}
        </EntradaEmCascata>
      ))}
    </View>
  );
}

/**
 * Faixa da divisão: o dia em cima, pequeno (como no PDF do Saraiva), o nome da divisão como título, sem caixa alta
 * forçada, e o resumo embaixo. Sem a cor da marca (ela não diz status nem agrupa).
 */
function FaixaDaDivisao({ divisao, aberta, aoAlternar }: { divisao: DivisaoRelatorio; aberta: boolean; aoAlternar: () => void }) {
  const { cores } = useTema();
  const { dia, titulo } = partesDaDivisao(divisao.nome);
  const n = divisao.exercicios.length;
  const ultimo = ultimoRegistroDaDivisao(divisao);
  const resumo = `${n} ${n === 1 ? 'exercício' : 'exercícios'}${ultimo ? ` · último em ${dataParaTela(ultimo)}` : ''}`;
  const Seta = aberta ? ChevronUp : ChevronDown;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${divisao.nome}, ${resumo}, ${aberta ? 'aberta' : 'recolhida'}`}
      accessibilityState={{ expanded: aberta }}
      onPress={aoAlternar}
      style={(estado) => [estilos.faixa, { backgroundColor: sobre(estado) ? cores.superficie3 : cores.superficie2, borderColor: cores.borda }]}>
      <View style={estilos.textosFaixa}>
        {dia ? <Texto variante="pequeno" style={estilos.dia}>{dia}</Texto> : null}
        <Texto variante="bloco" style={estilos.nomeDivisao}>{titulo}</Texto>
        <Texto variante="suave" numerico>{resumo}</Texto>
      </View>
      <Seta size={20} color={cores.textoSuave} />
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  lista: { gap: espaco(2.5) },
  divisao: { gap: espaco(1) },
  faixa: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco(1.5),
    borderWidth: 1,
    borderRadius: RAIO,
    minHeight: ALVO_TOQUE,
    paddingVertical: espaco(1.5),
    paddingHorizontal: espaco(2),
  },
  textosFaixa: { flex: 1, gap: 2 },
  dia: { fontFamily: fontes.semi, textTransform: 'uppercase', letterSpacing: 0.6 },
  nomeDivisao: { fontSize: 17, lineHeight: 22 },
  exercicio: { borderWidth: 1, borderRadius: RAIO, overflow: 'hidden' },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: espaco(1),
    paddingVertical: espaco(1),
    paddingHorizontal: espaco(1.5),
  },
  nomeExercicio: { fontFamily: fontes.semi, flexShrink: 1 },
  // A tabela já tem a própria borda; dentro do bloco do exercício fica só com o recuo.
  tabela: { padding: espaco(1) },
  forte: { fontFamily: fontes.semi },
  carga: { fontFamily: fontes.negrito },
  obs: { borderLeftWidth: 3, paddingLeft: espaco(1), width: '100%' },
  obsTexto: { fontStyle: 'italic' },
});
