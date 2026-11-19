package br.com.treinos.api.pagamentos;

import java.time.Instant;

/**
 * Contratos HTTP do responsável financeiro do aluno (D15). É dado pessoal de terceiro: os {@code toString} dos records o
 * escondem e nada daqui vai a log, auditoria ou mensagem de erro.
 */
public final class ResponsavelFinanceiroDtos {

    private ResponsavelFinanceiroDtos() { }

    /**
     * O corpo do PUT (substitui tudo; campo opcional ausente, nulo ou em branco apaga). {@code versao} nula só na criação;
     * na alteração é obrigatória e conferida. Tudo é texto e sem anotação de validação: a conferência é do serviço, que
     * responde 422 {@code RESPONSAVEL_INVALIDO} por campo, sem repetir o valor. {@code cpf} sem {@code ALUNO_SENSIVEL_LER} é
     * ignorado (o gravado fica).
     */
    public record ResponsavelFinanceiroRequest(String nome, String parentesco, String cpf, String telefone, String email,
                                               Long versao) {
        @Override
        public String toString() {
            return "ResponsavelFinanceiroRequest[]";
        }
    }

    /**
     * {@code versao} nula = o aluno não tem responsável (o GET responde 200 com os demais campos nulos). {@code cpf} só vem
     * com {@code ALUNO_SENSIVEL_LER} (senão nulo).
     */
    public record ResponsavelFinanceiroResponse(String nome, String parentesco, String cpf, String telefone, String email,
                                                Long versao, Instant atualizadoEm) {
        static final ResponsavelFinanceiroResponse NENHUM =
                new ResponsavelFinanceiroResponse(null, null, null, null, null, null, null);

        @Override
        public String toString() {
            return "ResponsavelFinanceiroResponse[]";
        }
    }

    /** O responsável na exportação do aluno (seção financeiro); {@code cpf} só com {@code ALUNO_SENSIVEL_LER}. */
    public record ResponsavelExportado(String nome, String parentesco, String cpf, String telefone, String email,
                                       Instant atualizadoEm) {
        @Override
        public String toString() {
            return "ResponsavelExportado[]";
        }
    }
}
