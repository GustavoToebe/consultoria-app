package br.com.treinos.api.pagamentos;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.Immutable;
import org.hibernate.annotations.TenantId;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Um lembrete de cobrança planejado, só para leitura pela JPA (a folha da cobrança e a exportação): quem grava e muda a
 * situação é a fila do job ({@link LembretesRepositorio}). Não guarda endereço, nome, valor nem texto do e-mail.
 */
@Entity
@Immutable
@Table(name = "lembrete_cobranca")
public class LembreteDeCobranca {

    public enum Situacao { PENDENTE, ENVIADO, FALHOU, CANCELADO }

    @Id
    private UUID id;
    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;
    @Column(name = "cobranca_id", nullable = false)
    private UUID cobrancaId;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TipoDeLembrete tipo;
    @Column(name = "data_prevista", nullable = false)
    private LocalDate dataPrevista;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Situacao situacao;
    private String motivo;
    @Column(nullable = false)
    private int tentativas;
    @Column(name = "enviado_em")
    private Instant enviadoEm;
    @Column(name = "atualizado_em", nullable = false)
    private Instant atualizadoEm;

    protected LembreteDeCobranca() {
    }

    public UUID getId() { return id; }
    public UUID getCobrancaId() { return cobrancaId; }
    public TipoDeLembrete getTipo() { return tipo; }
    public LocalDate getDataPrevista() { return dataPrevista; }
    public Situacao getSituacao() { return situacao; }
    public String getMotivo() { return motivo; }
    public int getTentativas() { return tentativas; }
    public Instant getEnviadoEm() { return enviadoEm; }
    public Instant getAtualizadoEm() { return atualizadoEm; }

    @Override
    public String toString() {
        return "LembreteDeCobranca[" + id + "]";
    }
}
