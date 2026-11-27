package br.com.treinos.api.atencao;

import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/** Contrato da exceção por aluno (etapa 2, C8): {@code GET|PUT|DELETE /alunos/{id}/regras-de-atencao[/{regraId}]}. */
public final class ExcecoesDoAlunoDtos {

    private ExcecoesDoAlunoDtos() {
    }

    /** As regras ligadas da consultoria, cada uma com a exceção do aluno (nula = vale a regra geral). */
    public record RegrasDoAluno(List<RegraDoAluno> regras) { }

    /** {@code limite}: o número da regra geral. */
    public record RegraDoAluno(UUID regraId, String tipo, String perguntaId, BigDecimal limite, Excecao excecao) { }

    /** {@code ativa=false}: desligada só para o aluno (sem número); {@code ativa=true}: o número dele. */
    public record Excecao(boolean ativa, BigDecimal limite, long versao) { }

    /** Sem {@code versao} = criar; com ela = alterar a atual (senão 409). {@code limite} só com {@code ativa=true}. */
    public record ExcecaoRequest(@NotNull Boolean ativa, BigDecimal limite, Long versao) { }
}
