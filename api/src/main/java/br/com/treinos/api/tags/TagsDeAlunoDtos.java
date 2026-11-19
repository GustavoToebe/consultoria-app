package br.com.treinos.api.tags;

import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.UUID;

/** Contratos HTTP das tags de aluno. O nome da tag nunca vai a log nem a mensagem de erro. */
public final class TagsDeAlunoDtos {

    private TagsDeAlunoDtos() { }

    /** A tag como a ficha e a lista de alunos a mostram (só a equipe a recebe). */
    public record TagResumo(UUID id, String nome, CorDeTag cor) {
        @Override
        public String toString() {
            return "TagResumo[" + id + "]";
        }
    }

    /** A tag na lista da consultoria. {@code versao} é a do PUT e do DELETE; {@code totalAlunos} inclui alunos inativos. */
    public record TagDaConsultoria(UUID id, String nome, CorDeTag cor, long totalAlunos, Long versao) {
        @Override
        public String toString() {
            return "TagDaConsultoria[" + id + "]";
        }
    }

    /**
     * {@code cor} é o código de {@link CorDeTag}; {@code versao} só vale no PUT (lock otimista; ausente = 409). Tudo é conferido no
     * serviço (422 {@code TAG_INVALIDA} com o campo), para o erro nunca repetir o valor enviado.
     */
    public record TagRequest(String nome, String cor, Long versao) {
        @Override
        public String toString() {
            return "TagRequest[...]";
        }
    }

    /** Substitui as tags do aluno por estas (até 10, sem repetir; vazia tira todas). */
    public record TagsDoAlunoRequest(@NotNull List<@NotNull UUID> tagIds) {
    }
}
