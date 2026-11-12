import { StyleSheet, View } from 'react-native';

import { execucoesDoAluno, listarPastas, listarPlanos, mobilidadeFeitaDoAluno, pastaVigenteDoAluno } from '../api/rotas';
import type { PastaResumo } from '../api/tipos';
import { hojeIso, somarDias } from '../dominio/formatos';
import { frequenciaDe, planejarFrequencia, resumoDaFrequencia, type Frequencia } from '../dominio/frequencia';
import { contagemDaMobilidadeNoTreinador } from '../dominio/mobilidadeFeita';
import { periodoDaSemana } from '../dominio/progressoSemana';
import { useSessao } from '../sessao/SessaoProvider';
import { espaco } from '../tema/tokens';
import { Cartao } from '../ui/Cartao';
import { Esqueleto } from '../ui/Esqueleto';
import { MensagemErro } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { Texto } from '../ui/Texto';
import { useCarregar } from '../ui/useCarregar';

export interface AcompanhamentoDoAluno {
  alunoId: string;
  /** Pasta vigente (a do treino ativo, senão a da dieta ativa); nula = nenhuma. */
  pasta: PastaResumo | null;
  /** Todas as pastas do aluno (o resumo só sugere renovar quando a do próximo ciclo ainda não existe). */
  pastas: PastaResumo[];
  /** Nula sem `REGISTRO_LER` (a rota de execuções exige). */
  frequencia: Frequencia | null;
}

/**
 * Uma busca só para o resumo do topo da ficha e o cartão Frequência e mobilidade: a pasta vigente e, com `REGISTRO_LER`, os
 * treinos da semana e da pasta (e o último registro entre eles), mais a lista de pastas. `geracao` muda quando a ficha altera as pastas.
 */
export function useAcompanhamentoDoAluno(alunoId: string, geracao = 0) {
  const { pode } = useSessao();
  const lerRegistros = pode('REGISTRO_LER');
  const hoje = hojeIso();
  const carga = useCarregar(`acompanhamento:${alunoId}:${hoje}:${lerRegistros}:${geracao}`, async (): Promise<AcompanhamentoDoAluno> => {
    const [{ pasta }, pastas] = await Promise.all([pastaVigenteDoAluno(alunoId), listarPastas(alunoId)]);
    if (!lerRegistros) return { alunoId, pasta, pastas, frequencia: null };
    const plano = planejarFrequencia(hoje, pasta);
    const dias = await execucoesDoAluno(alunoId, plano.consulta.de, plano.consulta.ate);
    return { alunoId, pasta, pastas, frequencia: frequenciaDe(dias, plano) };
  });
  // A busca anterior continua na tela até a nova chegar: só vale a do aluno em tela.
  return { ...carga, dados: carga.dados?.alunoId === alunoId ? carga.dados : undefined };
}

/** A API recusa período acima de 366 dias; a pasta muito antiga é cortada aqui, como a frequência. */
const DIAS_PARA_TRAS = 364;

/**
 * Frequência e mobilidade na ficha, num cartão só: treinos com registro e dias com algum item de mobilidade marcado, na
 * semana corrente (segunda até hoje) e na pasta vigente (do início até hoje). Só contagem: não compara com meta nem
 * interpreta. O formato (linhas, rótulo da pasta, frases) vem de `resumoDaFrequencia`. Quem renderiza já checou
 * `REGISTRO_LER`; `comMobilidade` (`mostraMobilidade`: também `TREINO_LER`) liga a linha e a busca da mobilidade.
 */
export function CartaoFrequencia({ alunoId, acompanhamento, comMobilidade }: {
  alunoId: string; acompanhamento: ReturnType<typeof useAcompanhamentoDoAluno>; comMobilidade: boolean;
}) {
  const { dados, erro, recarregar } = acompanhamento;
  const f = dados?.frequencia ?? null;
  const vigente = dados?.pasta ?? null;
  const hoje = hojeIso();
  // Sem permissão, sem o resumo da ficha (o erro dele já aparece aqui) ou sem pasta vigente, nada a buscar.
  const mob = useCarregar(
    comMobilidade && vigente && !erro ? `mobilidade-feita:${alunoId}:${vigente.id}:${hoje}` : null,
    async () => {
      const planos = await listarPlanos('mobilidade', alunoId);
      const temMobilidade = planos.some((p) => p.pastaId === vigente?.id && p.ativo && p.versaoPublicada > 0);
      const semana = periodoDaSemana(hoje);
      if (!temMobilidade) return contagemDaMobilidadeNoTreinador([], semana, vigente, false);
      const limite = somarDias(hoje, -DIAS_PARA_TRAS);
      const comeco = [semana.inicio, vigente?.inicio ?? semana.inicio].reduce((a, b) => (a < b ? a : b));
      const marcas = await mobilidadeFeitaDoAluno(alunoId, comeco < limite ? limite : comeco, hoje);
      return contagemDaMobilidadeNoTreinador(marcas, semana, vigente, true);
    },
  );
  const esperandoMobilidade = comMobilidade && !!vigente && mob.dados === undefined && !mob.erro;
  // Com o resumo da ficha em erro, só a mensagem dele (a mobilidade depende da pasta que ele traz).
  const resumo = f && !erro && !esperandoMobilidade
    ? resumoDaFrequencia(f, vigente, comMobilidade && !mob.erro && mob.dados !== undefined ? mob.dados : 'oculta')
    : null;
  return (
    <Cartao titulo="Frequência e mobilidade" descricao="Treinos com registro e dias de mobilidade do aluno. Só contagem."
      periodo={resumo?.comColunaDaPasta ? resumo.pasta : undefined}>
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {!resumo && !erro ? <Esqueleto cartoes={1} /> : null}
      {resumo ? (
        <View role="table" accessibilityLabel="Frequência e mobilidade" style={estilos.tabela}>
          <View role="row" style={estilos.linha}>
            <View style={estilos.rotulo} />
            <View role="columnheader" style={estilos.valor}><Texto variante="rotulo">Esta semana</Texto></View>
            {resumo.comColunaDaPasta ? <View role="columnheader" style={estilos.valor}><Texto variante="rotulo">Na pasta</Texto></View> : null}
          </View>
          {resumo.linhas.map((l) => (
            <View key={l.rotulo} role="row" style={estilos.linha}>
              <View role="rowheader" style={estilos.rotulo}><Texto variante="rotulo">{l.rotulo}</Texto></View>
              {'aviso' in l ? (
                <View role="cell" style={estilos.aviso}><Texto variante="suave">{l.aviso}</Texto></View>
              ) : (
                <>
                  <View role="cell" style={estilos.valor}><Texto numerico>{l.semana}</Texto></View>
                  {l.naPasta !== null ? <View role="cell" style={estilos.valor}><Texto numerico>{l.naPasta}</Texto></View> : null}
                </>
              )}
            </View>
          ))}
        </View>
      ) : null}
      {resumo && !resumo.comColunaDaPasta ? <Texto variante="suave">{resumo.pasta}</Texto> : null}
      {mob.erro && !erro ? <MensagemErro texto={textoDoErro(mob.erro)} erro={mob.erro} tentarDeNovo={mob.recarregar} /> : null}
    </Cartao>
  );
}

// Rótulo da linha na largura de "Mobilidade" e as duas colunas de número iguais: em 390 px "Nenhum registro" cabe numa
// linha. Sem a Água ao lado, a tabela não estica pela largura toda.
const estilos = StyleSheet.create({
  tabela: { gap: espaco(1.5), maxWidth: 480 },
  linha: { flexDirection: 'row', alignItems: 'baseline', gap: espaco(1) },
  rotulo: { width: 72 },
  valor: { flex: 1, minWidth: 0 },
  aviso: { flex: 2, minWidth: 0 },
});
