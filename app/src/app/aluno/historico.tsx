import { StyleSheet, View } from 'react-native';

import { SeloSincronizacao } from '../../aluno/SeloSincronizacao';
import { ErroApi } from '../../api/cliente';
import { historicoAluno, pesosAluno } from '../../api/rotas';
import type { ExercicioPlano, Sessao } from '../../api/tipos';
import { normalizarTreino } from '../../dominio/editorTreino';
import { dataParaTela, hojeIso, numeroParaTela, somarDias } from '../../dominio/formatos';
import { useAluno } from '../../offline/AlunoProvider';
import type { RegistroLocal } from '../../offline/repositorioLocal';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes } from '../../tema/tokens';
import { DiaRegistros, textoSerie } from '../../treinador/CartaoRegistros';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { Cartao } from '../../ui/Cartao';
import { Carregando, MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';

const DIAS = 30;

/** Histórico: o que ainda está só no aparelho, os treinos registrados nos últimos 30 dias e o peso. */
export default function HistoricoAluno() {
  const { registros, pacote, falhas, tentarDeNovo } = useAluno();
  const hoje = hojeIso();
  const historico = useCarregar(`hist:${hoje}`, () => historicoAluno(somarDias(hoje, -(DIAS - 1)), hoje));
  const pesos = useCarregar('pesos-aluno', () => pesosAluno());
  const naoEnviados = registros.filter((r) => r.situacao !== 'ENVIADO' && r.concluida);

  // Nomes vêm do plano salvo (o registro guarda só os uids).
  const nomes = new Map<string, { sessao: Sessao; exercicio: ExercicioPlano }>();
  if (pacote?.pacote.treino) {
    for (const s of normalizarTreino(pacote.pacote.treino.conteudo).sessoes) {
      for (const e of s.exercicios) nomes.set(e.uid, { sessao: s, exercicio: e });
    }
  }
  const semConexao = historico.erro instanceof ErroApi && historico.erro.semConexao;

  return (
    <Tela bordas={['top']} largura={720}>
      <Cabecalho titulo="Histórico" acoes={<SeloSincronizacao />} />
      {naoEnviados.length ? (
        <Cartao titulo="Ainda não enviados">
          <Texto variante="pequeno">Salvos neste aparelho. Vão para o seu treinador quando houver internet.</Texto>
          {agrupar(naoEnviados).map(([chave, lista]) => {
            const info = nomes.get(lista[0].exercicioUid);
            return (
              <View key={chave} style={estilos.linha}>
                <Texto style={estilos.forte}>
                  {dataParaTela(lista[0].data)} · {info?.exercicio.nome ?? 'Exercício de outra versão do plano'}
                </Texto>
                <Texto variante="suave">
                  {lista
                    .map((r) => {
                      const serie = info?.exercicio.series.find((s) => s.uid === r.serieUid);
                      return textoSerie({ ...r, tipo: serie?.tipo ?? 'Série', unidade: info?.exercicio.unidade ?? 'kg' });
                    })
                    .join(' · ')}
                </Texto>
              </View>
            );
          })}
          {falhas.length ? <Botao rotulo="Tentar enviar de novo" tipo="secundario" aoTocar={() => void tentarDeNovo()} /> : null}
        </Cartao>
      ) : null}

      <Cartao titulo={`Treinos dos últimos ${DIAS} dias`}>
        {semConexao ? <Texto variante="suave">Sem conexão: o histórico do servidor aparece quando voltar a internet.</Texto> : null}
        {historico.erro && !semConexao ? <MensagemErro texto={textoDoErro(historico.erro)} erro={historico.erro} tentarDeNovo={historico.recarregar} /> : null}
        {!historico.dados && historico.carregando ? <Carregando /> : null}
        {historico.dados && historico.dados.length === 0 ? <Texto variante="suave">Nenhum treino registrado no período.</Texto> : null}
        {[...(historico.dados ?? [])].sort((a, b) => b.data.localeCompare(a.data)).map((d) => (
          <DiaRegistros key={d.data} dia={d} />
        ))}
      </Cartao>

      <Cartao titulo="Peso">
        {pesos.dados?.length ? (
          [...pesos.dados].reverse().map((p) => (
            <LinhaPeso key={p.id} data={p.data} peso={p.pesoKg} variacao={p.variacao} />
          ))
        ) : (
          <Texto variante="suave">{pesos.carregando ? 'Carregando…' : pesos.erro ? 'Sem conexão.' : 'Nenhum registro de peso.'}</Texto>
        )}
      </Cartao>
    </Tela>
  );
}

function agrupar(lista: RegistroLocal[]): [string, RegistroLocal[]][] {
  const grupos = new Map<string, RegistroLocal[]>();
  for (const r of [...lista].sort((a, b) => b.data.localeCompare(a.data))) {
    const chave = `${r.data}|${r.exercicioUid}`;
    grupos.set(chave, [...(grupos.get(chave) ?? []), r]);
  }
  return [...grupos];
}

function LinhaPeso({ data, peso, variacao }: { data: string; peso: number; variacao: number | null }) {
  const { cores } = useTema();
  return (
    <View style={[estilos.peso, { borderColor: cores.borda }]}>
      <Texto>{dataParaTela(data)}</Texto>
      <Texto style={estilos.forte}>{numeroParaTela(peso)} kg</Texto>
      <Texto variante="suave">
        {variacao === null ? '—' : `${variacao > 0 ? '+' : variacao < 0 ? '−' : ''}${numeroParaTela(Math.abs(variacao))} kg`}
      </Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { gap: 2 },
  forte: { fontFamily: fontes.semi },
  peso: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, paddingTop: espaco(1), gap: espaco(1) },
});
