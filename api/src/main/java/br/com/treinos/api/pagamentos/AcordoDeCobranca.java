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
import java.util.UUID;

/**
 * Uma renegociação confirmada (V094, D14): guarda o pedido do app (idempotência), o que foi feito (contagens e total, para repetir
 * o mesmo corpo mesmo depois de desfeito) e quando foi desfeita. Não tem texto livre: o motivo do treinador mora no {@code motivo}
 * das cobranças originais.
 */
@Entity
@Table(name = "acordo_de_cobranca")
public class AcordoDeCobranca {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;
    @Column(name = "aluno_id", nullable = false, updatable = false)
    private UUID alunoId;
    @Column(name = "pedido_id", nullable = false, updatable = false)
    private UUID pedidoId;
    @Column(nullable = false, updatable = false)
    private short renegociadas;
    @Column(nullable = false, updatable = false)
    private short parcelas;
    @Column(name = "total_centavos", nullable = false, updatable = false)
    private long totalCentavos;
    /** V098: só o acordo de parcelas de um contrato fechado tem (e então {@code renegociadas} é 0); nulo nos de renegociação. */
    @Column(name = "contratacao_id", updatable = false)
    private UUID contratacaoId;
    @Column(name = "desfeito_em")
    private Instant desfeitoEm;
    @Column(name = "criado_em", insertable = false, updatable = false)
    private Instant criadoEm;
    @Version
    private Long versao;

    protected AcordoDeCobranca() {
    }

    AcordoDeCobranca(UUID alunoId, UUID pedidoId, int renegociadas, int parcelas, long totalCentavos) {
        this.alunoId = alunoId;
        this.pedidoId = pedidoId;
        this.renegociadas = (short) renegociadas;
        this.parcelas = (short) parcelas;
        this.totalCentavos = totalCentavos;
    }

    /** O acordo das parcelas de um contrato fechado: nada foi renegociado, as parcelas nascem ligadas à contratação. */
    static AcordoDeCobranca doContrato(UUID alunoId, UUID contratacaoId, int parcelas, long totalCentavos) {
        AcordoDeCobranca a = new AcordoDeCobranca(alunoId, UUID.randomUUID(), 0, parcelas, totalCentavos);
        a.contratacaoId = contratacaoId;
        return a;
    }

    void desfazer(Instant quando) {
        this.desfeitoEm = quando;
    }

    public UUID getId() { return id; }
    public UUID getAlunoId() { return alunoId; }
    public UUID getPedidoId() { return pedidoId; }
    public UUID getContratacaoId() { return contratacaoId; }
    public int getRenegociadas() { return renegociadas; }
    public int getParcelas() { return parcelas; }
    public long getTotalCentavos() { return totalCentavos; }
    public Instant getDesfeitoEm() { return desfeitoEm; }
    public Instant getCriadoEm() { return criadoEm; }

    @Override
    public String toString() {
        return "AcordoDeCobranca[" + id + "]";
    }
}
