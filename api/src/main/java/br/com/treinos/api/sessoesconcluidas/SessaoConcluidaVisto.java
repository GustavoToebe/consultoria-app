package br.com.treinos.api.sessoesconcluidas;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.TenantId;

import java.time.Instant;
import java.util.UUID;

/**
 * "Visto" do treinador num treino concluído (Engajamento 0.5, P4): a única reação, sem texto. Uma linha por sessão
 * concluída; desfazer apaga a linha. Fica fora da {@link SessaoConcluida} porque aquela é gravada pelo upsert do aparelho.
 */
@Entity
@Table(name = "sessao_concluida_visto")
public class SessaoConcluidaVisto {

    @Id
    @Column(name = "sessao_concluida_id")
    private UUID sessaoConcluidaId;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(name = "aluno_id", nullable = false, updatable = false)
    private UUID alunoId;

    @Column(name = "usuario_id", nullable = false, updatable = false)
    private UUID usuarioId;

    @Column(name = "visto_em", nullable = false, updatable = false)
    private Instant vistoEm;

    protected SessaoConcluidaVisto() {
    }

    SessaoConcluidaVisto(UUID sessaoConcluidaId, UUID alunoId, UUID usuarioId, Instant vistoEm) {
        this.sessaoConcluidaId = sessaoConcluidaId;
        this.alunoId = alunoId;
        this.usuarioId = usuarioId;
        this.vistoEm = vistoEm;
    }

    public UUID getSessaoConcluidaId() { return sessaoConcluidaId; }
    public UUID getAlunoId() { return alunoId; }
    public UUID getUsuarioId() { return usuarioId; }
    public Instant getVistoEm() { return vistoEm; }
}
