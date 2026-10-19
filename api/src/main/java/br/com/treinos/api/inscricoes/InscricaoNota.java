package br.com.treinos.api.inscricoes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.TenantId;

import java.time.Instant;
import java.util.UUID;

/** Nota interna da equipe sobre uma inscrição (andamento do contato). Só se acrescenta; sai junto com a inscrição. */
@Entity
@Table(name = "inscricao_nota")
public class InscricaoNota {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(name = "inscricao_id", nullable = false, updatable = false)
    private UUID inscricaoId;

    @Column(name = "autor_id", updatable = false)
    private UUID autorId;

    @Column(nullable = false, updatable = false)
    private String texto;

    @Column(name = "criada_em", nullable = false, updatable = false)
    private Instant criadaEm = Instant.now();

    protected InscricaoNota() {
    }

    InscricaoNota(UUID inscricaoId, UUID autorId, String texto) {
        this.inscricaoId = inscricaoId;
        this.autorId = autorId;
        this.texto = texto;
    }

    public UUID getId() { return id; }
    public UUID getConsultoriaId() { return consultoriaId; }
    public UUID getInscricaoId() { return inscricaoId; }
    public UUID getAutorId() { return autorId; }
    public String getTexto() { return texto; }
    public Instant getCriadaEm() { return criadaEm; }
}
