import { History } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { progressoAluno } from '../api/rotas';
import type { AnteriorDoExercicio, ExercicioPlano, UltimaCarga } from '../api/tipos';
import { dataCurta, dataParaTela, SEM_DADO } from '../dominio/formatos';
import { linhasDosRecordes } from '../dominio/historicoDoExercicio';
import { avisoDoGrafico, linhasDaTabela, pontosDoGrafico, resumoDoProgresso, textoDoResumo } from '../dominio/progresso';
import { anteriorDaSerie, textoDoAnterior } from '../dominio/seriesAnteriores';
import { kgParaTela, textoDaCarga } from '../dominio/unidadeDeCarga';
import { useAluno } from '../offline/AlunoProvider';
import { useSessao } from '../sessao/SessaoProvider';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { Esqueleto } from '../ui/Esqueleto';
import { MensagemErro } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { Folha } from '../ui/Folha';
import { GraficoLinha } from '../ui/GraficoLinha';
import { larguraDaData } from '../ui/larguraDaData';
import { Texto } from '../ui/Texto';
import { useUnidadeDeCarga } from '../ui/unidadeDeCargaEmUso';
import { useCarregar } from '../ui/useCarregar';

/** Datas mostradas antes de "Ver todos os registros" (as mesmas do Progresso). */
const DATAS_RECENTES = 5;

/**
 * "Histórico" do exercício (plano `docs/planos/treino-do-aluno-lacunas-cbum.md`, item 2 e D2): ícone na linha do "Como
 * fazer" que abre uma folha com a última vez e os recordes que já vêm no pacote (funcionam sem internet) e, com
 * internet, a carga por data da API. Segue o `exercicioId` do dia: no dia trocado, é o histórico da alternativa. Só o
 * que foi registrado; o que falta é "—". Sem exercício da biblioteca ou em cardio (não há carga para mostrar), não aparece.
 */
export function HistoricoDoExercicio(p: {
  exercicio: ExercicioPlano;
  ultimaVez: AnteriorDoExercicio | null;
  ultima: UltimaCarga | null;
  cardio: boolean;
}) {
  const [aberta, setAberta] = useState(false);
  if (!p.exercicio.exercicioId || p.cardio) return null;
  return (
    <>
      <Botao rotulo="Histórico" rotuloAcessivel={`Histórico de ${p.exercicio.nome}`} tipo="fantasma" Icone={History} aoTocar={() => setAberta(true)} />
      {aberta ? (
        <Folha visivel titulo="Histórico" aoFechar={() => setAberta(false)}>
          <ConteudoDoHistorico {...p} exercicioId={p.exercicio.exercicioId} />
        </Folha>
      ) : null}
    </>
  );
}

function ConteudoDoHistorico({ exercicio: e, exercicioId, ultimaVez, ultima }: { exercicio: ExercicioPlano; exercicioId: string; ultimaVez: AnteriorDoExercicio | null; ultima: UltimaCarga | null }) {
  const { cores } = useTema();
  const unidade = useUnidadeDeCarga();
  const { online, pacote } = useAluno();
  const { retornoHabilitado } = useSessao();
  const semCarga = e.unidade === 'nenhuma';
  // O pacote só traz os recordes com "Concluir treino" ligado; a seção some sem ele (como a medalha das séries).
  const recordes = retornoHabilitado ? pacote?.pacote.recordes : undefined;

  return (
    <View style={estilos.secoes}>
      <Texto variante="bloco" numerico>{e.nome}</Texto>
      <View style={estilos.secao}>
        <Texto variante="rotulo" cor={cores.texto}>{ultimaVez ? `Última vez · ${dataParaTela(ultimaVez.data)}` : 'Última vez'}</Texto>
        {ultimaVez ? (
          <View style={[estilos.tabela, { borderColor: cores.borda, backgroundColor: cores.superficie }]}>
            {e.series.map((s, i) => (
              <View key={s.uid} style={[estilos.linha, i > 0 && estilos.linhaDeDados, { borderColor: cores.borda }]}>
                <Texto numerico variante="suave" style={estilos.flex}>Série {i + 1}</Texto>
                <Texto numerico style={estilos.forte}>{textoDoAnterior(anteriorDaSerie(ultimaVez, e, i), semCarga, unidade)}</Texto>
              </View>
            ))}
          </View>
        ) : ultima ? (
          <Texto numerico>
            Carga de trabalho: {textoDaCarga(ultima.carga, unidade)} × {ultima.repeticoes ?? SEM_DADO} em {dataParaTela(ultima.data)}
          </Texto>
        ) : (
          <Texto variante="suave">Sem registro anterior deste exercício.</Texto>
        )}
      </View>
      {recordes ? (
        <View style={estilos.secao}>
          <Texto variante="rotulo" cor={cores.texto}>Recordes</Texto>
          <Texto variante="pequeno">Séries sem técnica, feitas antes de {dataParaTela(recordes.ate)}.</Texto>
          <View style={[estilos.tabela, { borderColor: cores.borda, backgroundColor: cores.superficie }]}>
            {linhasDosRecordes(recordes.exercicios[exercicioId], unidade).map((l, i) => (
              <View key={l.rotulo} style={[estilos.linha, i > 0 && estilos.linhaDeDados, { borderColor: cores.borda }]}>
                <Texto variante="suave" style={estilos.flex}>{l.rotulo}</Texto>
                <Texto numerico style={estilos.forte}>{l.valor}</Texto>
              </View>
            ))}
          </View>
        </View>
      ) : null}
      <View style={estilos.secao}>
        <Texto variante="rotulo" cor={cores.texto}>Por data</Texto>
        {online ? <PorData exercicioId={exercicioId} nome={e.nome} /> : (
          <Texto variante="suave">Sem conexão. A carga por data aparece quando você estiver conectado à internet.</Texto>
        )}
      </View>
    </View>
  );
}

/** A maior carga de trabalho por data (`GET /aluno/progresso`), como no Progresso: resumo, gráfico e as datas mais recentes. */
function PorData({ exercicioId, nome }: { exercicioId: string; nome: string }) {
  const { cores, preferencias, fatorTexto } = useTema();
  const unidade = useUnidadeDeCarga();
  const colData = { width: larguraDaData(fatorTexto), flexShrink: 0 } as const;
  const { dados, erro, carregando, recarregar } = useCarregar(`historico:${exercicioId}`, () => progressoAluno(exercicioId));
  const [todas, setTodas] = useState(false);
  if (erro) return <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} />;
  if (carregando && !dados) return <Esqueleto texto="Carregando o histórico" cartoes={1} />;
  if (!dados) return null;
  if (!dados.length) return <Texto variante="suave">Nenhum registro deste exercício ainda.</Texto>;
  const resumo = textoDoResumo(resumoDoProgresso(dados), unidade);
  const pontos = pontosDoGrafico(dados);
  const aviso = avisoDoGrafico(pontos.length, preferencias.graficos, 'ALUNO');
  return (
    <>
      <Texto variante="suave" numerico>{resumo ?? 'Sem registros com carga.'}</Texto>
      {preferencias.graficos && pontos.length >= 2 ? (
        <GraficoLinha
          pontos={pontos.map((x) => ({ rotulo: dataCurta(x.data), valor: kgParaTela(x.carga, unidade) ?? x.carga, data: x.data }))}
          unidade={unidade}
          descricao={`Maior carga de trabalho de ${nome} por data`}
          semUltimo
        />
      ) : null}
      {aviso ? <Texto variante="pequeno">{aviso}</Texto> : null}
      <View style={[estilos.tabela, { borderColor: cores.borda, backgroundColor: cores.superficie }]}>
        <View style={[estilos.linha, { backgroundColor: cores.superficie3 }]}>
          <Texto variante="secao" style={colData}>Data</Texto>
          <Texto variante="secao" style={estilos.colNumero}>Carga</Texto>
          <Texto variante="secao" style={estilos.colNumero}>Reps</Texto>
        </View>
        {linhasDaTabela(dados, todas ? null : DATAS_RECENTES).map((x) => (
          <View key={x.data} style={[estilos.linha, estilos.linhaDeDados, { borderColor: cores.borda }]}>
            <Texto numerico style={[colData, estilos.forte]}>{dataParaTela(x.data)}</Texto>
            <Texto numerico style={[estilos.colNumero, estilos.forte]}>
              {x.maiorCargaTrabalho === null ? SEM_DADO : textoDaCarga(x.maiorCargaTrabalho, unidade)}
            </Texto>
            <Texto numerico style={estilos.colNumero}>{x.repeticoes ?? SEM_DADO}</Texto>
          </View>
        ))}
      </View>
      {dados.length > DATAS_RECENTES ? (
        <Botao rotulo={todas ? 'Mostrar menos' : `Ver todos os registros (${dados.length})`} tipo="fantasma" aoTocar={() => setTodas(!todas)} />
      ) : null}
    </>
  );
}

const estilos = StyleSheet.create({
  // 24 px entre as seções, 8 px dentro delas (o grupo se lê pelo espaço, não por borda).
  secoes: { gap: espaco(3) },
  secao: { gap: espaco(1) },
  tabela: { borderWidth: 1, borderRadius: RAIO, overflow: 'hidden' },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), paddingHorizontal: espaco(1.5), paddingVertical: espaco(1) },
  linhaDeDados: { borderTopWidth: StyleSheet.hairlineWidth },
  colNumero: { flex: 1, minWidth: 0, textAlign: 'right' },
  flex: { flex: 1, minWidth: 0 },
  forte: { fontFamily: fontes.semi },
});
