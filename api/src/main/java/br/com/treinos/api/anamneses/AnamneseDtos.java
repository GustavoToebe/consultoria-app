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

    /** Item da lista na ficha (sem respostas nem modelo). {@code alteracoesParaRevisar}: pendências abertas do cadastro. */
    public record AnamneseResumo(UUID id, String situacao, String questionarioNome, int questionarioVersaoNumero,
                                 Instant atribuidaEm, Instant enviadaEm, Instant revisadaEm, Instant dispensadaEm,
                                 String dispensaMotivo, Long versao, long alteracoesParaRevisar) { }

    /**
     * Campo do cadastro alimentado pela anamnese: {@code PENDENTE} (o cadastro tinha outro valor; {@code valorAtual} é o
     * de agora), {@code APLICADA} ({@code automatica} = preenchida no envio porque estava vazia) ou {@code DESCARTADA}.
     * {@code valor} e {@code valorAtual} (o mesmo formato; {@code valorAtual} é nulo se o campo do cadastro está vazio ou a
     * alteração já foi resolvida):
     * <ul>
     *   <li>{@code OBJETIVO}, {@code CPF}, {@code TELEFONE}: {@code {"texto": "..."}} (CPF {@code 123.456.789-09},
     *       telefone {@code (45) 99999-8888}, já normalizados);</li>
     *   <li>{@code PESO}: {@code {"pesoKg": 80.5, "data": "AAAA-MM-DD"}};</li>
     *   <li>{@code ENDERECO}: {@code {"endereco": {"cep", "logradouro", "numero", "complemento", "bairro", "cidade", "uf"}}},
     *       sempre as sete chaves; endereço completo (CEP, logradouro, número, cidade e UF preenchidos), complemento e bairro texto ou nulo (CEP {@code 85800-000}, UF em maiúsculas).</li>
     * </ul>
     * Só para a equipe (a rota exige {@code ANAMNESE_LER}, que depende de {@code ALUNO_SENSIVEL_LER}).
     */
    public record AlteracaoDoCadastro(UUID id, String destino, String perguntaId, JsonNode valor, JsonNode valorAtual,
                                      String situacao, boolean automatica, Instant criadaEm, Instant resolvidaEm,
                                      String resolvidaPorNome) { }

    /** Exportação do titular: o que a anamnese propôs ou preencheu no cadastro. */
    public record AlteracaoExportada(String destino, String perguntaId, JsonNode valor, String situacao, boolean automatica,
                                     Instant criadaEm, Instant resolvidaEm) { }

    /**
     * Detalhe com o modelo (a versão respondida) e as respostas. Os nomes de quem atribuiu, revisou ou dispensou, o motivo
     * e o nome do questionário são da equipe, como as alterações do cadastro: {@link #paraAluno()} os tira.
     */
    public record AnamneseDetalhe(UUID id, UUID alunoId, String nomeAluno, String situacao, UUID questionarioVersaoId,
                                  int questionarioVersaoNumero, String questionarioNome, JsonNode modelo,
                                  JsonNode respostas, Instant atribuidaEm, String atribuidaPorNome, Instant enviadaEm,
                                  Instant revisadaEm, String revisadaPorNome, Instant dispensadaEm,
                                  String dispensadaPorNome, String dispensaMotivo, Long versao,
                                  java.util.List<AlteracaoDoCadastro> alteracoes) {

        public AnamneseDetalhe paraAluno() {
            return new AnamneseDetalhe(id, alunoId, null, situacao, questionarioVersaoId, questionarioVersaoNumero, null,
                    modelo, respostas, atribuidaEm, null, enviadaEm, revisadaEm, null, dispensadaEm, null, null, versao, null);
        }
    }

    /** Exportação do titular (LGPD): fotos só como metadados. */
    public record AnamneseExportada(UUID id, String situacao, UUID questionarioVersaoId, JsonNode respostas,
                                    Instant atribuidaEm, Instant enviadaEm, Instant revisadaEm, Instant dispensadaEm,
                                    String dispensaMotivo, java.util.List<br.com.treinos.api.fotos.FotoService.FotoExportada> fotos,
                                    java.util.List<AlteracaoExportada> alteracoesDoCadastro) { }
}
