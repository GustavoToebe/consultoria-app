package br.com.treinos.api.planos.liberacao;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.TenantId;

import java.time.Instant;
import java.util.UUID;

/**
 * Aviso dentro do app de que o plano novo do aluno foi liberado (V105), no padrão de {@code AvisoCompromisso}. Não guarda texto,
 * plano nem nome: o app diz a frase fixa. Só {@code visto_em} muda depois de criado (pelo repositório, sem sobrescrever).
 */
@Entity
@Table(name = "aviso_plano_liberado")
public class AvisoPlanoLiberado {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(name = "aluno_id", nullable = false, updatable = false)
    private UUID alunoId;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm = Instant.now();

    @Column(name = "visto_em")
    private Instant vistoEm;

    protected AvisoPlanoLiberado() {
    }

    AvisoPlanoLiberado(UUID alunoId) {
        this.alunoId = alunoId;
    }

    public UUID getId() { return id; }
    public UUID getConsultoriaId() { return consultoriaId; }
    public UUID getAlunoId() { return alunoId; }
    public Instant getCriadoEm() { return criadoEm; }
    public Instant getVistoEm() { return vistoEm; }
}
