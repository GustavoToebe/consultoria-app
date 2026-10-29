package br.com.treinos.api.agenda;

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
 * Agenda pessoal de um membro da equipe (D2): nome até 40 e cor de uma paleta fixa. Só o dono a vê e altera; o dono vem
 * sempre da sessão, nunca do corpo. O nome é texto livre do membro: nunca em log nem na auditoria.
 */
@Entity
@Table(name = "agenda_pessoal")
public class AgendaPessoal {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(name = "dono_id", nullable = false, updatable = false)
    private UUID donoId;

    @Column(nullable = false)
    private String nome;

    @Column(nullable = false)
    private String cor;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm = Instant.now();

    @Version
    private Long versao;

    protected AgendaPessoal() {
    }

    AgendaPessoal(UUID donoId, String nome, String cor) {
        this.donoId = donoId;
        this.nome = nome;
        this.cor = cor;
    }

    public UUID getId() { return id; }
    public UUID getConsultoriaId() { return consultoriaId; }
    public UUID getDonoId() { return donoId; }
    public String getNome() { return nome; }
    public String getCor() { return cor; }
    public Instant getCriadoEm() { return criadoEm; }
    public Long getVersao() { return versao; }

    void alterar(String nome, String cor) {
        this.nome = nome;
        this.cor = cor;
    }
}
