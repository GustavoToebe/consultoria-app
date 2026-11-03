import { EntradaEmCascata, usePrimeiraLista } from '../ui/EntradaEmCascata';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { dataParaTela } from '../dominio/formatos';
import { letraDaDivisaoNoHistorico, letrasDasDivisoes } from '../dominio/historicoDoAluno';
import { partesDaDivisao, textoDoVolume, ultimoRegistroDaDivisao, type DivisaoRelatorio, type LinhaCarga } from '../dominio/relatorio';
import { textoCarga } from '../pdf/pdfCargas';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../tema/tokens';
import { larguraDaData } from '../ui/larguraDaData';
import { Tabela } from '../ui/Tabela';
import { Texto } from '../ui/Texto';
import { BlocoDaDivisao } from './BlocoDaDivisao';

/** Quatro colunas curtas cabem no celular; só abaixo disso a tabela vira cartões. */
const LARGURA_MINIMA_TABELA = 280;

/**
 * Cargas por divisão (treinador e aluno): um bloco por divisão, com a letra e a cor dela (A azul, B magenta, C ciano…,
 * Frente G, D13) e, para cada exercício, uma tabela com a data, a carga de trabalho, as repetições e as séries feitas.
 * Observação do aluno embaixo da linha. Carga na cor do texto, nunca da marca nem do tipo de série. `letras` vem da tela
 * quando a visão por semana precisa das mesmas letras; sem ela, a ordem das divisões dá a letra.
 */
export function CargasPorDivisao({ divisoes, letras: dadas }: { divisoes: DivisaoRelatorio[]; letras?: ReadonlyMap<string, string> }) {
  const letras = dadas ?? letrasDasDivisoes(divisoes.map((d) => d.nome));
  const { cores, fatorTexto } = useTema();
  // "—" na carga quer dizer que não houve série de trabalho com carga naquele dia (só aquecimento ou preparação):
  // sem explicar, parecia que o registro sumiu.
  // A série por etapa sem carga comum mostra os blocos ("carga variável" ou "—"): não é só preparação.
  const temSoPreparacao = divisoes.some((d) => d.exercicios.some((e) => e.linhas.some((l) => l.carga === null && !l.semCarga && l.etapas === null)));
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
        <EntradaEmCascata indice={i} animar={animar} key={d.chave}>
          <FaixaDaDivisao divisao={d} letra={letraDaDivisaoNoHistorico(letras, d.nome)} aberta={!recolhidas.has(d.chave)} aoAlternar={() => alternar(d.chave)}>
          {d.exercicios.map((e) => (
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
                    { chave: 'reps', titulo: 'Reps', flex: 1.3, alinhar: 'direita', render: (l) => <Texto numerico>{l.etapas ?? l.repeticoes ?? '—'}</Texto> },
                    { chave: 'series', titulo: 'Séries', flex: 0.8, alinhar: 'direita', render: (l) => <Texto numerico variante="suave">{l.series}</Texto> },
                  ]}
                  detalhe={(l) => detalheDaLinha(l, cores.atencao)}
                />
              </View>
            </View>
          ))}
          </FaixaDaDivisao>
        </EntradaEmCascata>
      ))}
    </View>
  );
}

/** Embaixo da linha: o volume de carga do exercício no dia (o do histórico) e a observação do aluno; sem nenhum, nada. */
function detalheDaLinha(l: LinhaCarga, corDaObservacao: string) {
  const volume = textoDoVolume(l.volume);
  if (!volume && !l.observacoes.length) return null;
  return (
    <View style={estilos.detalhes}>
      {volume ? <Texto numerico variante="suave">{volume}</Texto> : null}
      {l.observacoes.length ? (
        <View style={[estilos.obs, { borderLeftColor: corDaObservacao }]}>
          <Texto numerico variante="suave" style={estilos.obsTexto}>{l.observacoes.join(' · ')}</Texto>
        </View>
      ) : null}
    </View>
  );
}

/**
 * A divisão: o dia em cima, pequeno (como no PDF do Saraiva), o nome da divisão como título e o resumo embaixo, com a
 * letra e a cor da divisão (nunca a da marca, que não agrupa). Recolhe e abre pela faixa.
 */
function FaixaDaDivisao({ divisao, letra, aberta, aoAlternar, children }: { divisao: DivisaoRelatorio; letra: string | null; aberta: boolean; aoAlternar: () => void; children: ReactNode }) {
  const { dia, titulo } = partesDaDivisao(divisao.nome);
  const n = divisao.exercicios.length;
  const ultimo = ultimoRegistroDaDivisao(divisao);
  const resumo = `${n} ${n === 1 ? 'exercício' : 'exercícios'}${ultimo ? ` · último em ${dataParaTela(ultimo)}` : ''}`;
  return (
    <BlocoDaDivisao letra={letra} titulo={titulo} dia={dia} resumo={resumo} aberto={aberta} aoAlternar={aoAlternar}>
      {children}
    </BlocoDaDivisao>
  );
}

const estilos = StyleSheet.create({
  lista: { gap: espaco(2.5) },
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
  detalhes: { gap: espaco(0.5), width: '100%' },
  obs: { borderLeftWidth: 3, paddingLeft: espaco(1), width: '100%' },
  obsTexto: { fontStyle: 'italic' },
});
