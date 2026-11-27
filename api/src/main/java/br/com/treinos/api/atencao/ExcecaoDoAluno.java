package br.com.treinos.api.atencao;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import org.hibernate.annotations.TenantId;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Exceção de uma regra de atenção para um aluno (V112, etapa 2): {@code ativa=false} desliga a regra só para ele (sem número);
 * {@code ativa=true} troca o número (com {@code limite}). Vale a partir do próximo envio; nunca liga regra que a consultoria desligou.
 */
@Entity
@Table(name = "regra_de_atencao_aluno")
public class ExcecaoDoAluno {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;
    @Column(name = "regra_id", nullable = false, updatable = false)
    private UUID regraId;
    @Column(name = "aluno_id", nullable = false, updatable = false)
    private UUID alunoId;
    @Column(nullable = false)
    private boolean ativa;
    @Column(precision = 4, scale = 1)
    private BigDecimal limite;
    @Version
    private Long versao;
    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm;
    @Column(name = "alterado_em", nullable = false)
    private Instant alteradoEm;

    protected ExcecaoDoAluno() {
    }

    ExcecaoDoAluno(UUID regraId, UUID alunoId, boolean ativa, BigDecimal limite, Instant agora) {
        this.regraId = regraId;
        this.alunoId = alunoId;
        this.ativa = ativa;
        this.limite = limite;
        this.criadoEm = agora;
        this.alteradoEm = agora;
    }

    /** Devolve se algo mudou; só então {@code alteradoEm} anda (e a versão, pelo Hibernate). */
    boolean alterar(boolean novaAtiva, BigDecimal novoLimite, Instant agora) {
        boolean mudou = ativa != novaAtiva || !RegraDeAtencao.mesmoNumero(limite, novoLimite);
        if (mudou) {
            this.ativa = novaAtiva;
            this.limite = novoLimite;
            this.alteradoEm = agora;
        }
        return mudou;
    }

    public UUID getRegraId() { return regraId; }
    public UUID getAlunoId() { return alunoId; }
    public boolean isAtiva() { return ativa; }
    public BigDecimal getLimite() { return limite; }
    public Long getVersao() { return versao; }
}
