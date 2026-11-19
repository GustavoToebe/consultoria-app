package br.com.treinos.api.tags;

import br.com.treinos.api.web.Buscas;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import org.hibernate.annotations.TenantId;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * Tag da consultoria (V093): rótulo livre para achar e filtrar alunos. O nome é texto digitado pelo treinador e pode identificar
 * alguém: nunca em log, auditoria nem mensagem de erro. Chega já com strip e NFC; {@code nomeNormalizado} (sem acento, minúsculas,
 * espaços simples, {@link Buscas#semAcento}) é o que a unicidade confere.
 */
@Entity
@Table(name = "tag_aluno")
public class TagAluno {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;
    @Column(nullable = false, length = 30)
    private String nome;
    @Column(name = "nome_normalizado", nullable = false, length = 60)
    private String nomeNormalizado;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CorDeTag cor;
    @Version
    private Long versao;
    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm;
    @Column(name = "atualizado_em", nullable = false)
    private Instant atualizadoEm;

    protected TagAluno() {
    }

    TagAluno(String nome, CorDeTag cor, Instant agora) {
        this.criadoEm = agora;
        this.atualizadoEm = agora;
        this.nome = nome;
        this.nomeNormalizado = Buscas.semAcento(nome);
        this.cor = cor;
    }

    /** Devolve se algo mudou; só então {@code atualizadoEm} anda (e a versão, pelo Hibernate). */
    boolean alterar(String novoNome, CorDeTag novaCor, Instant agora) {
        boolean mudou = !nome.equals(novoNome) || cor != novaCor;
        if (mudou) {
            this.nome = novoNome;
            this.nomeNormalizado = Buscas.semAcento(novoNome);
            this.cor = novaCor;
            this.atualizadoEm = agora;
        }
        return mudou;
    }

    public UUID getId() { return id; }
    public String getNome() { return nome; }
    public String getNomeNormalizado() { return nomeNormalizado; }
    public CorDeTag getCor() { return cor; }
    public Long getVersao() { return versao; }

    @Override
    public boolean equals(Object o) {
        return o instanceof TagAluno t && id != null && Objects.equals(id, t.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }

    @Override
    public String toString() {
        return "TagAluno[" + id + "]";
    }
}
