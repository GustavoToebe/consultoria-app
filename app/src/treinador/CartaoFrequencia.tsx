import { StyleSheet } from 'react-native';

import { execucoesDoAluno, listarPastas, listarPlanos, mobilidadeFeitaDoAluno, pastaVigenteDoAluno, versaoPlano } from '../api/rotas';
import type { ConteudoTreino, PastaResumo } from '../api/tipos';
import { hojeIso } from '../dominio/formatos';
import { frequenciaDe, planejarFrequencia, resumoDaFrequencia, treinosPrevistosNaSemana, type Frequencia } from '../dominio/frequencia';
import { diasComAlgoFeito } from '../dominio/mobilidadeFeita';
import { useSessao } from '../sessao/SessaoProvider';
import { Cartao } from '../ui/Cartao';
import { CartaoDeIndicador } from '../ui/CartaoDeIndicador';
import { Esqueleto } from '../ui/Esqueleto';
import { MensagemErro } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { GradeDeIndicadores } from '../ui/GradeDeIndicadores';
import { useDestaques } from '../ui/NumeroDeDestaque';
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
 * treinos da semana, da semana passada e da pasta (e o último registro da semana e da pasta), mais a lista de pastas. `geracao` muda quando a ficha altera as pastas.
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

/**
 * Frequência e mobilidade na ficha (24/11): dois indicadores neutros lado a lado, "Treinos esta semana" (com a bolinha
 * azul do treino, 25/11; treinos com
 * registro; "1 de 4 treinos" quando o plano de treino da pasta vigente diz quantos por semana) e "Mobilidade esta semana"
 * (dias com algum item marcado), cada um com "Semana passada: N" embaixo. O formato vem de `resumoDaFrequencia`; a pasta
 * fica na pílula do cartão e, sem pasta vigente, a nota uma linha abaixo dos indicadores. Quem renderiza já checou
 * `REGISTRO_LER`; `comMobilidade` (`mostraMobilidade`: também `TREINO_LER`) liga o indicador e a busca da mobilidade; o
 * previsto pede `TREINO_LER` e, se falhar, o valor fica só a contagem.
 */
export function CartaoFrequencia({ alunoId, acompanhamento, comMobilidade }: {
  alunoId: string; acompanhamento: ReturnType<typeof useAcompanhamentoDoAluno>; comMobilidade: boolean;
}) {
  const { pode } = useSessao();
  const destaques = useDestaques();
  const { dados, erro, recarregar } = acompanhamento;
  const f = dados?.frequencia ?? null;
  const vigente = dados?.pasta ?? null;
  const hoje = hojeIso();
  // Sem permissão, sem o resumo da ficha (o erro dele já aparece aqui) ou sem pasta vigente, nada a buscar.
  const mob = useCarregar(
    comMobilidade && vigente && !erro ? `mobilidade-feita:${alunoId}:${vigente.id}:${hoje}` : null,
    async () => {
      const planos = await listarPlanos('mobilidade', alunoId);
      if (!planos.some((p) => p.pastaId === vigente?.id && p.ativo && p.versaoPublicada > 0)) return null;
      const { semana, semanaPassada } = planejarFrequencia(hoje, null);
      const marcas = await mobilidadeFeitaDoAluno(alunoId, semanaPassada.de, hoje);
      return { naSemana: diasComAlgoFeito(marcas, semana.de, semana.ate), semanaPassada: diasComAlgoFeito(marcas, semanaPassada.de, semanaPassada.ate) };
    },
  );
  const prev = useCarregar(
    pode('TREINO_LER') && vigente && !erro ? `treinos-previstos:${alunoId}:${vigente.id}` : null,
    async () => {
      const ativo = (await listarPlanos('treino', alunoId)).find((p) => p.pastaId === vigente?.id && p.ativo && p.versaoPublicada > 0);
      if (!ativo) return null;
      const versao = await versaoPlano<ConteudoTreino>('treino', ativo.id, ativo.versaoPublicada);
      return treinosPrevistosNaSemana(versao.conteudo?.sessoes ?? []);
    },
  );
  const esperando = (c: { dados?: unknown; erro?: unknown }, ligado: boolean) => ligado && !!vigente && c.dados === undefined && !c.erro;
  // Espera as três buscas para os números não trocarem na frente da pessoa; com o resumo da ficha em erro, só a mensagem dele.
  const resumo = f && !erro && !esperando(mob, comMobilidade) && !esperando(prev, pode('TREINO_LER'))
    ? resumoDaFrequencia(f, vigente, comMobilidade && !mob.erro && mob.dados !== undefined ? mob.dados : 'oculta', prev.dados ?? null)
    : null;
  return (
    <Cartao titulo="Frequência e mobilidade" descricao="Treinos com registro e dias de mobilidade do aluno. Só contagem."
      periodo={resumo?.comPasta ? resumo.pasta : undefined} style={estilos.esticar}>
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {!resumo && !erro ? <Esqueleto cartoes={1} /> : null}
      {resumo ? (
        <GradeDeIndicadores minimo={MINIMO_DO_INDICADOR}>
          {resumo.indicadores.map((i) => (
            <CartaoDeIndicador key={i.rotulo} rotulo={i.rotulo} valor={i.valor} estado={i.estado} detalhe={i.detalhe} motivo={i.motivo}
              corDoMarcador={i.marcador ? destaques[i.marcador].cor : null} tamanho="medio" lugar="cartao" nivelDoRotulo={3} textual />
          ))}
        </GradeDeIndicadores>
      ) : null}
      {resumo && !resumo.comPasta ? <Texto variante="suave">{resumo.pasta}</Texto> : null}
      {mob.erro && !erro ? <MensagemErro texto={textoDoErro(mob.erro)} erro={mob.erro} tentarDeNovo={mob.recarregar} /> : null}
    </Cartao>
  );
}

/** Célula mínima dos dois indicadores: cabem lado a lado no cartão de ~470 px de 1280 (ao lado da Água) e empilham no celular. */
const MINIMO_DO_INDICADOR = 180;

const estilos = StyleSheet.create({
  // Na linha das contagens os dois cartões têm a mesma altura (a ficha estica a linha).
  esticar: { flexGrow: 1 },
});
