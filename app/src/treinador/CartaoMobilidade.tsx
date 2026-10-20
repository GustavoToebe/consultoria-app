import { listarPlanos, mobilidadeFeitaDoAluno } from '../api/rotas';
import type { useAcompanhamentoDoAluno } from './CartaoFrequencia';
import { hojeIso, somarDias } from '../dominio/formatos';
import { contagemDaMobilidadeNoTreinador, textoDaMobilidade } from '../dominio/mobilidadeFeita';
import { periodoDaSemana } from '../dominio/progressoSemana';
import { Cartao } from '../ui/Cartao';
import { CampoLeitura } from '../ui/CampoLeitura';
import { Esqueleto } from '../ui/Esqueleto';
import { MensagemErro } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { useCarregar } from '../ui/useCarregar';

/** A API recusa período acima de 366 dias; a pasta muito antiga é cortada aqui, como no cartão de frequência. */
const DIAS_PARA_TRAS = 364;

/**
 * Mobilidade na ficha: só a contagem de dias em que o aluno marcou algo como feito, na semana corrente e na pasta vigente.
 * Não compara com meta nem interpreta. Sem plano de mobilidade publicado na pasta, "—"; com zero, "Nenhum registro".
 * Quem renderiza já checou `REGISTRO_LER` e `TREINO_LER` e passa o resultado de `useAcompanhamentoDoAluno`.
 */
export function CartaoMobilidade({ alunoId, acompanhamento }: { alunoId: string; acompanhamento: ReturnType<typeof useAcompanhamentoDoAluno> }) {
  const pasta = acompanhamento.dados?.pasta ?? null;
  const hoje = hojeIso();
  const { dados, erro, recarregar } = useCarregar(
    acompanhamento.dados ? `mobilidade-feita:${alunoId}:${pasta?.id ?? 'sem-pasta'}:${hoje}` : null,
    async () => {
      const planos = pasta ? await listarPlanos('mobilidade', alunoId) : [];
      const temMobilidade = !!pasta && planos.some((p) => p.pastaId === pasta.id && p.ativo && p.versaoPublicada > 0);
      const semana = periodoDaSemana(hoje);
      if (!temMobilidade) return contagemDaMobilidadeNoTreinador([], semana, pasta, false);
      const limite = somarDias(hoje, -DIAS_PARA_TRAS);
      const comeco = [semana.inicio, pasta?.inicio ?? semana.inicio].reduce((a, b) => (a < b ? a : b));
      const marcas = await mobilidadeFeitaDoAluno(alunoId, comeco < limite ? limite : comeco, hoje);
      return contagemDaMobilidadeNoTreinador(marcas, semana, pasta, true);
    },
  );
  return (
    <Cartao titulo="Mobilidade" descricao="Dias em que o aluno marcou algo como feito. Só contagem.">
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {dados === undefined && !erro ? <Esqueleto /> : null}
      {dados !== undefined ? <CampoLeitura rotulo="Mobilidade" valor={textoDaMobilidade(dados)} numerico /> : null}
    </Cartao>
  );
}
