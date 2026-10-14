import { EntradaEmCascata, usePrimeiraLista } from '../../ui/EntradaEmCascata';
import { HistoricoAtualizacoes } from '../../aluno/atualizacao/HistoricoAtualizacoes';
import { FileDown } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ErroApi } from '../../api/cliente';
import { historicoAluno, pastasDoAluno, pesosAluno } from '../../api/rotas';
import type { ExercicioPlano, Sessao } from '../../api/tipos';
import { normalizarTreino } from '../../dominio/editorTreino';
import { dataParaTela, hojeIso, numeroParaTela } from '../../dominio/formatos';
import { cargasPorDivisao, intervaloDeRegistros } from '../../dominio/relatorio';
import { useAluno } from '../../offline/AlunoProvider';
import type { RegistroLocal } from '../../offline/repositorioLocal';
import { imprimir } from '../../pdf/imprimir';
import { logoComoDataUri } from '../../pdf/logo';
import { documentoCargas } from '../../pdf/pdfCargas';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes } from '../../tema/tokens';
import { CargasPorDivisao } from '../../treinador/CargasPorDivisao';
import { CartaoProgresso } from '../../treinador/CartaoProgresso';
import { DiaRegistros, textoSerie, VISOES, type VisaoRegistros } from '../../treinador/CartaoRegistros';
import { Abas } from '../../ui/Abas';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { Cartao } from '../../ui/Cartao';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';

const DIAS = 30;

/**
 * Histórico: o que ainda está só no aparelho, os treinos registrados no período do plano em uso (sem plano com período,
 * os últimos 30 dias), o progresso por exercício e o peso.
 */
export default function HistoricoAluno() {
  const { registros, pacote, escolhida, falhas, tentarDeNovo } = useAluno();
  const { avisar } = useAviso();
  const animar = usePrimeiraLista(true);
  const [visao, setVisao] = useState<VisaoRegistros>('divisao');
  const [gerando, setGerando] = useState(false);
  const hoje = hojeIso();
  // Plano em uso (o escolhido para consulta ou o vigente), como no seletor de plano. O período é o da pasta; sem
  // conexão ou sem período, valem os últimos 30 dias. A busca espera a lista de pastas para não consultar duas vezes.
  const pastas = useCarregar(`pastas-aluno:${pacote?.pacote.geradoEm ?? ''}`, () => pastasDoAluno());
  const pasta = escolhida?.pasta ?? pastas.dados?.find((p) => p.atual) ?? null;
  const daPasta = !!pasta?.inicio && !!pasta.fim;
  const { de, ate } = intervaloDeRegistros(hoje, DIAS, pasta ?? undefined);
  const aguardandoPastas = pastas.carregando && !pastas.dados;
  const historico = useCarregar(aguardandoPastas ? null : `hist:${de}:${ate}`, () => historicoAluno(de, ate));
  const pesos = useCarregar('pesos-aluno', () => pesosAluno());
  const naoEnviados = registros.filter((r) => r.situacao !== 'ENVIADO' && r.concluida);

  // Nomes vêm do plano salvo (o registro guarda só os uids).
  const nomes = new Map<string, { sessao: Sessao; exercicio: ExercicioPlano }>();
  const treinoEmUso = escolhida ? escolhida.planos.treino : pacote?.pacote.treino;
  if (treinoEmUso) {
    for (const s of normalizarTreino(treinoEmUso.conteudo).sessoes) {
      for (const e of s.exercicios) nomes.set(e.uid, { sessao: s, exercicio: e });
    }
  }
  const semConexao = historico.erro instanceof ErroApi && historico.erro.semConexao;
  const sessoes = new Map<string, Sessao>();
  for (const { sessao } of nomes.values()) sessoes.set(sessao.uid, sessao);
  const divisoes = historico.dados ? cargasPorDivisao(historico.dados, sessoes) : [];

  const pdf = () => {
    if (!pacote) return;
    const marca = pacote.pacote.marca;
    setGerando(true);
    logoComoDataUri(marca)
      .then((logoDataUri) =>
        imprimir(
          documentoCargas({
            marca,
            logoDataUri,
            aluno: pacote.pacote.aluno.nome,
            de,
            ate,
            divisoes,
            rodapePdf: null,
            emitidoEm: new Date(),
          }),
        ),
      )
      .catch((e: unknown) => avisar(textoDoErro(e), 'perigo'))
      .finally(() => setGerando(false));
  };

  return (
    <Tela bordas={['top']} largura={720}>
      <Cabecalho titulo="Histórico" />
      <HistoricoAtualizacoes />
      {naoEnviados.length ? (
        <Cartao titulo="Ainda não enviados">
          <Texto numerico variante="suave">Salvos neste aparelho. Vão para o seu treinador quando houver internet.</Texto>
          {agrupar(naoEnviados).map(([chave, lista]) => {
            const info = nomes.get(lista[0].exercicioUid);
            return (
              <View key={chave} style={estilos.linha}>
                <Texto numerico style={estilos.forte}>
                  {dataParaTela(lista[0].data)} · {info?.exercicio.nome ?? 'Exercício de outra versão do plano'}
                </Texto>
                <Texto numerico variante="suave">
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
          {falhas.length ? <Botao rotulo="Tentar enviar de novo" tipo="secundario" cheio aoTocar={() => void tentarDeNovo()} /> : null}
        </Cartao>
      ) : null}

      <Cartao
        titulo={daPasta ? 'Registros e cargas' : `Treinos dos últimos ${DIAS} dias`}
        acoes={divisoes.length ? <Botao rotulo="PDF" tipo="secundario" Icone={FileDown} carregando={gerando} aoTocar={pdf} /> : null}>
        {daPasta ? <Texto numerico variante="suave">Período do plano: {dataParaTela(de)} a {dataParaTela(ate)}</Texto> : null}
        <Abas abas={VISOES} ativa={visao} aoMudar={setVisao} />
        {semConexao ? <Texto numerico variante="suave">Sem conexão: o histórico do servidor aparece quando voltar a internet.</Texto> : null}
        {historico.erro && !semConexao ? <MensagemErro texto={textoDoErro(historico.erro)} erro={historico.erro} tentarDeNovo={historico.recarregar} /> : null}
        {!historico.dados && historico.carregando ? <Esqueleto /> : null}
        {historico.dados && historico.dados.length === 0 ? <Vazio titulo="Sem treinos no período" texto="Os treinos registrados aparecem aqui." /> : null}
        {historico.dados && visao === 'divisao' ? <CargasPorDivisao divisoes={divisoes} /> : null}
        {historico.dados && visao === 'dia'
          ? [...historico.dados].sort((a, b) => b.data.localeCompare(a.data)).map((d, i) => <EntradaEmCascata key={d.data} indice={i} animar={animar}><DiaRegistros dia={d} /></EntradaEmCascata>)
          : null}
      </Cartao>

      <CartaoProgresso />

      <Cartao titulo="Peso">
        {pesos.dados?.length ? (
          [...pesos.dados].reverse().map((p) => (
            <LinhaPeso key={p.id} data={p.data} peso={p.pesoKg} variacao={p.variacao} />
          ))
        ) : (
          <Texto numerico variante="suave">{pesos.carregando ? 'Carregando…' : pesos.erro ? 'Sem conexão.' : 'Nenhum registro de peso.'}</Texto>
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
      <Texto numerico>{dataParaTela(data)}</Texto>
      <Texto numerico style={estilos.forte}>{numeroParaTela(peso)} kg</Texto>
      <Texto numerico variante="suave">
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
