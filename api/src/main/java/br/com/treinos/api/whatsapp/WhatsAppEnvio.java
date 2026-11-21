package br.com.treinos.api.whatsapp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.Immutable;
import org.hibernate.annotations.TenantId;

import java.time.Instant;
import java.util.UUID;

/**
 * Um aviso da fila, só para leitura pela JPA (a exportação do aluno): quem grava e muda a situação é o
 * {@link WhatsAppRepositorio}. Não guarda texto, telefone nem nome.
 */
@Entity
@Immutable
@Table(name = "whatsapp_envio")
public class WhatsAppEnvio {

    public enum Situacao { PENDENTE, ENVIADO, ENTREGUE, LIDO, FALHOU, CANCELADO }

    @Id
    private UUID id;
    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;
    @Column(name = "aluno_id", nullable = false)
    private UUID alunoId;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TipoDeAviso tipo;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Situacao situacao;
    @Column(name = "enviado_em")
    private Instant enviadoEm;
    @Column(name = "entregue_em")
    private Instant entregueEm;
    @Column(name = "lido_em")
    private Instant lidoEm;
    @Column(name = "criado_em", nullable = false)
    private Instant criadoEm;

    protected WhatsAppEnvio() {
    }

    public UUID getId() { return id; }
    public TipoDeAviso getTipo() { return tipo; }
    public Situacao getSituacao() { return situacao; }
    public Instant getEnviadoEm() { return enviadoEm; }
    public Instant getEntregueEm() { return entregueEm; }
    public Instant getLidoEm() { return lidoEm; }
    public Instant getCriadoEm() { return criadoEm; }
}
