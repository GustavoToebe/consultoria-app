package br.com.treinos.api.pagamentos;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.TenantId;

import java.time.Instant;
import java.util.UUID;

/** Mapeamento do aluno para {@code customer_id} na subconta Asaas da consultoria (V100). */
@Entity
@Table(name = "cliente_asaas_aluno")
public class ClienteAsaasAluno {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(name = "aluno_id", nullable = false, updatable = false)
    private UUID alunoId;

    @Column(name = "subconta_id", nullable = false, updatable = false)
    private UUID subcontaId;

    @Column(name = "asaas_customer_id", nullable = false, length = 60)
    private String asaasCustomerId;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm;

    protected ClienteAsaasAluno() {
    }

    public ClienteAsaasAluno(UUID alunoId, UUID subcontaId, String asaasCustomerId, Instant agora) {
        this.alunoId = alunoId;
        this.subcontaId = subcontaId;
        this.asaasCustomerId = asaasCustomerId;
        this.criadoEm = agora;
    }

    public UUID getId() { return id; }
    public UUID getConsultoriaId() { return consultoriaId; }
    public UUID getAlunoId() { return alunoId; }
    public UUID getSubcontaId() { return subcontaId; }
    public String getAsaasCustomerId() { return asaasCustomerId; }
    public Instant getCriadoEm() { return criadoEm; }

    @Override
    public String toString() {
        return "ClienteAsaasAluno[" + id + "]";
    }
}
