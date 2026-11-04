package br.com.treinos.api.push;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.TenantId;

import java.time.Instant;
import java.util.UUID;

/**
 * Token de push do aparelho do aluno (V056). Só leitura pela JPA (a exportação); quem grava e apaga é o
 * {@link PushRepositorio}, com a consultoria explícita. O valor do token NÃO tem getter nem {@code toString}: é dado do
 * aparelho, nunca vai a log, auditoria, mensagem de erro nem exportação.
 */
@Entity
@Table(name = "push_token")
public class PushToken {

    @Id
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(name = "usuario_id", nullable = false, updatable = false)
    private UUID usuarioId;

    @Column(nullable = false, updatable = false)
    @SuppressWarnings("unused")
    private String token;

    @Column(nullable = false, updatable = false)
    private String plataforma;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm;

    protected PushToken() {
    }

    public String getPlataforma() { return plataforma; }
    public Instant getCriadoEm() { return criadoEm; }

    @Override
    public String toString() {
        return "PushToken[" + id + "]";
    }
}
