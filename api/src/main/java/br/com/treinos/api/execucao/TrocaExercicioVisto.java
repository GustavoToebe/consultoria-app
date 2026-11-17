package br.com.treinos.api.execucao;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.TenantId;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * "Visto" do treinador numa troca de exercício (alertas-de-troca, V080): sem texto, uma linha por troca vista. A troca é
 * derivada das séries (não há tabela dela); a chave natural é aluno + dia + versão + exercício do plano + alternativa usada.
 */
@Entity
@Table(name = "troca_exercicio_visto")
public class TrocaExercicioVisto {

    @Id
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(name = "aluno_id", nullable = false, updatable = false)
    private UUID alunoId;

    @Column(nullable = false, updatable = false)
    private LocalDate data;

    @Column(name = "plano_versao_id", nullable = false, updatable = false)
    private UUID planoVersaoId;

    @Column(name = "exercicio_uid", nullable = false, updatable = false)
    private UUID exercicioUid;

    @Column(name = "alternativa_exercicio_id", nullable = false, updatable = false)
    private UUID alternativaId;

    @Column(name = "usuario_id", nullable = false, updatable = false)
    private UUID usuarioId;

    @Column(name = "visto_em", nullable = false, updatable = false)
    private Instant vistoEm;

    protected TrocaExercicioVisto() {
    }

    TrocaExercicioVisto(UUID alunoId, LocalDate data, UUID planoVersaoId, UUID exercicioUid, UUID alternativaId,
                        UUID usuarioId, Instant vistoEm) {
        this.id = UUID.randomUUID();
        this.alunoId = alunoId;
        this.data = data;
        this.planoVersaoId = planoVersaoId;
        this.exercicioUid = exercicioUid;
        this.alternativaId = alternativaId;
        this.usuarioId = usuarioId;
        this.vistoEm = vistoEm;
    }

    public UUID getAlunoId() { return alunoId; }
    public LocalDate getData() { return data; }
    public UUID getPlanoVersaoId() { return planoVersaoId; }
    public UUID getExercicioUid() { return exercicioUid; }
    public UUID getAlternativaId() { return alternativaId; }
    public Instant getVistoEm() { return vistoEm; }
}
