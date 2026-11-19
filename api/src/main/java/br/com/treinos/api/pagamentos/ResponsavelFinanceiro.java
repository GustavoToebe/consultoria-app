package br.com.treinos.api.pagamentos;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import org.hibernate.annotations.TenantId;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * O responsável financeiro do aluno (V092, D15): no máximo um por aluno, quem recebe os lembretes de cobrança. É dado pessoal
 * de terceiro: nunca em log, auditoria, mensagem de erro nem {@code toString}. Os valores chegam já normalizados
 * ({@code Formatos.cpf}/{@code Formatos.telefone}, e-mail conferido, textos com strip).
 */
@Entity
@Table(name = "responsavel_financeiro")
public class ResponsavelFinanceiro {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;
    @Column(name = "aluno_id", nullable = false, updatable = false)
    private UUID alunoId;
    @Column(nullable = false, length = 120)
    private String nome;
    @Column(length = 30)
    private String parentesco;
    @Column(length = 14)
    private String cpf;
    @Column(length = 20)
    private String telefone;
    @Column(length = 254)
    private String email;
    @Version
    private Long versao;
    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm;
    @Column(name = "atualizado_em", nullable = false)
    private Instant atualizadoEm;

    protected ResponsavelFinanceiro() {
    }

    ResponsavelFinanceiro(UUID alunoId, Dados dados, Instant agora) {
        this.alunoId = alunoId;
        this.criadoEm = agora;
        alterar(dados, agora);
    }

    /** Os dados já validados que o PUT grava. */
    record Dados(String nome, String parentesco, String cpf, String telefone, String email) {
        @Override
        public String toString() {
            return "Dados[]";
        }
    }

    /** Substitui tudo (o PUT é por inteiro). Devolve se algo mudou; só então {@code atualizadoEm} anda. */
    boolean alterar(Dados d, Instant agora) {
        boolean mudou = !Objects.equals(nome, d.nome()) || !Objects.equals(parentesco, d.parentesco())
                || !Objects.equals(cpf, d.cpf()) || !Objects.equals(telefone, d.telefone()) || !Objects.equals(email, d.email());
        this.nome = d.nome();
        this.parentesco = d.parentesco();
        this.cpf = d.cpf();
        this.telefone = d.telefone();
        this.email = d.email();
        if (mudou) {
            this.atualizadoEm = agora;
        }
        return mudou;
    }

    public UUID getId() { return id; }
    public UUID getAlunoId() { return alunoId; }
    public String getNome() { return nome; }
    public String getParentesco() { return parentesco; }
    public String getCpf() { return cpf; }
    public String getTelefone() { return telefone; }
    public String getEmail() { return email; }
    public Long getVersao() { return versao; }
    public Instant getAtualizadoEm() { return atualizadoEm; }

    @Override
    public boolean equals(Object o) {
        return o instanceof ResponsavelFinanceiro r && id != null && Objects.equals(id, r.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }

    @Override
    public String toString() {
        return "ResponsavelFinanceiro[" + id + "]";
    }
}
