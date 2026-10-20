import { X } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { progressoAluno, progressoDoAluno } from '../api/rotas';
import { dataCurta, dataParaTela, numeroParaTela, SEM_DADO } from '../dominio/formatos';
import { linhasDaTabela, pontosDoGrafico, resumoDoProgresso, textoDoResumo } from '../dominio/progresso';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { Esqueleto } from '../ui/Esqueleto';
import { MensagemErro } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { GraficoLinha } from '../ui/GraficoLinha';
import { IconeBotao } from '../ui/IconeBotao';
import { larguraDaData } from '../ui/larguraDaData';
import { Texto } from '../ui/Texto';
import { useCarregar } from '../ui/useCarregar';

/** Datas mostradas antes de "Ver todos os registros". */
const DATAS_RECENTES = 5;

/**
 * Um exercício do Progresso: nome e grupo, resumo do primeiro e do último registro com carga, gráfico (2 pontos ou
 * mais) e tabela das 5 datas mais recentes. Mostra só o que foi registrado; o que falta é "—". Cargas na cor do texto
 * (a marca não é dado); o "Último…" aparece uma vez só, no resumo.
 * O × só tira o exercício da comparação; não apaga nada.
 */
export function ProgressoDoExercicio({ alunoId, exercicioId, nome, grupo, aoTirar }: {
  /** Treinador: o aluno da ficha. Ausente = o próprio aluno logado (app do aluno). */
  alunoId?: string; exercicioId: string; nome: string; grupo: string; aoTirar: () => void;
}) {
  const { cores, preferencias, fatorTexto } = useTema();
  const colData = { width: larguraDaData(fatorTexto), flexShrink: 0 } as const;
  const { dados, erro, carregando, recarregar } = useCarregar(`prog:${alunoId ?? 'eu'}:${exercicioId}`, () =>
    alunoId ? progressoDoAluno(alunoId, exercicioId) : progressoAluno(exercicioId));
  const [todas, setTodas] = useState(false);
  const resumo = dados ? textoDoResumo(resumoDoProgresso(dados)) : null;
  const pontos = dados ? pontosDoGrafico(dados) : [];
  const linhas = dados ? linhasDaTabela(dados, todas ? null : DATAS_RECENTES) : [];
  return (
    <View style={[estilos.bloco, { backgroundColor: cores.superficie2, borderColor: cores.borda }]}>
      <View style={estilos.topo}>
        <View style={estilos.nomes}>
          <Texto variante="bloco">{nome}</Texto>
          <Texto variante="pequeno">{grupo}</Texto>
        </View>
        <IconeBotao Icone={X} rotulo={`Tirar ${nome} do progresso`} aoTocar={aoTirar} />
      </View>
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {carregando && !dados && !erro ? <Esqueleto /> : null}
      {dados && !resumo ? <Texto variante="suave">Sem registros com carga.</Texto> : null}
      {resumo ? <Texto variante="suave" numerico>{resumo}</Texto> : null}
      {preferencias.graficos && pontos.length >= 2 ? (
        <GraficoLinha
          pontos={pontos.map((p) => ({ rotulo: dataCurta(p.data), valor: p.carga }))}
          unidade="kg"
          descricao={`Maior carga de trabalho de ${nome} por data`}
          semUltimo
        />
      ) : null}
      {dados && dados.length > 0 ? (
        <View style={[estilos.tabela, { borderColor: cores.borda, backgroundColor: cores.superficie }]}>
          <View style={[estilos.linha, { backgroundColor: cores.superficie3 }]}>
            <Texto variante="secao" style={colData}>Data</Texto>
            <Texto variante="secao" style={estilos.colNumero}>Carga</Texto>
            <Texto variante="secao" style={estilos.colNumero}>Reps</Texto>
          </View>
          {linhas.map((p) => (
            <View key={p.data} style={[estilos.linha, estilos.linhaDeDados, { borderColor: cores.borda }]}>
              <Texto numerico style={[colData, estilos.forte]}>{dataParaTela(p.data)}</Texto>
              <Texto numerico style={[estilos.colNumero, estilos.carga]}>
                {p.maiorCargaTrabalho === null ? SEM_DADO : `${numeroParaTela(p.maiorCargaTrabalho)} kg`}
              </Texto>
              <Texto numerico style={estilos.colNumero}>{p.repeticoes ?? SEM_DADO}</Texto>
            </View>
          ))}
        </View>
      ) : null}
      {dados && dados.length > DATAS_RECENTES ? (
        <Botao rotulo={todas ? 'Mostrar menos' : `Ver todos os registros (${dados.length})`} tipo="fantasma" aoTocar={() => setTodas(!todas)} />
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { borderWidth: 1, borderRadius: RAIO, padding: espaco(2), gap: espaco(1.5) },
  topo: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: espaco(1) },
  nomes: { flexShrink: 1, flexGrow: 1, gap: 2 },
  tabela: { borderWidth: 1, borderRadius: RAIO, overflow: 'hidden' },
  linha: { flexDirection: 'row', gap: espaco(1), paddingHorizontal: espaco(1.5), paddingVertical: espaco(1) },
  linhaDeDados: { borderTopWidth: StyleSheet.hairlineWidth },
  colNumero: { flex: 1, minWidth: 0, textAlign: 'right' },
  forte: { fontFamily: fontes.semi },
  carga: { fontFamily: fontes.negrito },
});
