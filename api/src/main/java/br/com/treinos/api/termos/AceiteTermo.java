package br.com.treinos.api.termos;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.TenantId;

import java.time.Instant;
import java.util.UUID;

/** Registro de que o usuário aceitou o termo de uso e o aviso de privacidade na versão indicada. */
@Entity
@Table(name = "aceite_termo")
public class AceiteTermo {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(name = "usuario_id", nullable = false, updatable = false)
    private UUID usuarioId;

    @Column(nullable = false, updatable = false)
    private String versao;

    @Column(name = "aceito_em", insertable = false, updatable = false)
    private Instant aceitoEm;

    protected AceiteTermo() {
    }

    public AceiteTermo(UUID usuarioId, String versao) {
        this.usuarioId = usuarioId;
        this.versao = versao;
    }

    public UUID getId() {
        return id;
    }

    public String getVersao() {
        return versao;
    }

    public Instant getAceitoEm() {
        return aceitoEm;
    }
}
