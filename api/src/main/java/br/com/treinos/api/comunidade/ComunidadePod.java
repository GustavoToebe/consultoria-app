package br.com.treinos.api.comunidade;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.TenantId;

import java.time.Instant;
import java.util.UUID;

/** Grupo pequeno da comunidade (V082). O nome é texto livre da equipe: nunca vai a log nem à auditoria. */
@Entity
@Table(name = "comunidade_pod")
public class ComunidadePod {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(nullable = false, length = 40)
    private String nome;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm = Instant.now();

    protected ComunidadePod() {}

    public ComunidadePod(String nome) {
        this.nome = nome;
    }

    public void renomear(String nome) { this.nome = nome; }

    public UUID getId() { return id; }
    public UUID getConsultoriaId() { return consultoriaId; }
    public String getNome() { return nome; }
    public Instant getCriadoEm() { return criadoEm; }
}
