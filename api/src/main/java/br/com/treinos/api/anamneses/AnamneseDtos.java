package br.com.treinos.api.anamneses;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import tools.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.UUID;

/** Contratos da anamnese. Respostas e motivo nunca vão para log nem para a auditoria (os resumos são fixos). */
public final class AnamneseDtos {

    private AnamneseDtos() { }

    public record AtribuirRequest(@NotNull UUID questionarioId) { }

    public record DispensarRequest(@NotBlank @Size(max = 300) String motivo, @NotNull Long versao) { }

    public record RevisarRequest(@NotNull Long versao) { }

    /** O aluno manda a versão que respondeu: é a da atribuição, que nunca muda. */
    public record EnviarRequest(@NotNull UUID questionarioVersaoId, @NotNull JsonNode respostas) { }

    /** Item da lista na ficha (sem respostas nem modelo). */
    public record AnamneseResumo(UUID id, String situacao, String questionarioNome, int questionarioVersaoNumero,
                                 Instant atribuidaEm, Instant enviadaEm, Instant revisadaEm, Instant dispensadaEm,
                                 String dispensaMotivo, Long versao) { }

    /**
     * Detalhe com o modelo (a versão respondida) e as respostas. Os nomes de quem atribuiu, revisou ou dispensou, o motivo
     * e o nome do questionário são da equipe: {@link #paraAluno()} os tira.
     */
    public record AnamneseDetalhe(UUID id, UUID alunoId, String nomeAluno, String situacao, UUID questionarioVersaoId,
                                  int questionarioVersaoNumero, String questionarioNome, JsonNode modelo,
                                  JsonNode respostas, Instant atribuidaEm, String atribuidaPorNome, Instant enviadaEm,
                                  Instant revisadaEm, String revisadaPorNome, Instant dispensadaEm,
                                  String dispensadaPorNome, String dispensaMotivo, Long versao) {

        public AnamneseDetalhe paraAluno() {
            return new AnamneseDetalhe(id, alunoId, null, situacao, questionarioVersaoId, questionarioVersaoNumero, null,
                    modelo, respostas, atribuidaEm, null, enviadaEm, revisadaEm, null, dispensadaEm, null, null, versao);
        }
    }

    /** Exportação do titular (LGPD): fotos só como metadados. */
    public record AnamneseExportada(UUID id, String situacao, UUID questionarioVersaoId, JsonNode respostas,
                                    Instant atribuidaEm, Instant enviadaEm, Instant revisadaEm, Instant dispensadaEm,
                                    String dispensaMotivo, java.util.List<br.com.treinos.api.fotos.FotoService.FotoExportada> fotos) { }
}
