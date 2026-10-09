package br.com.treinos.api.equipe;

import jakarta.persistence.*;
import org.hibernate.annotations.TenantId;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;

/** Permissões pertencem ao perfil da consultoria, nunca ao token. */
@Entity @Table(name="perfil")
public class Perfil {
    @Id @GeneratedValue(strategy=GenerationType.UUID) private UUID id;
    @TenantId @Column(name="consultoria_id",nullable=false,updatable=false) private UUID consultoriaId;
    @Column(nullable=false) private String nome;
    private String descricao;
    @Column(name="acesso_total",nullable=false) private boolean acessoTotal;
    @Column(nullable=false) private boolean sistema;
    @Column(nullable=false) private boolean ativo=true;
    @Version private Long versao;
    @Column(name="criado_em",insertable=false,updatable=false) private Instant criadoEm;
    @ElementCollection
    @CollectionTable(name="perfil_permissao",joinColumns=@JoinColumn(name="perfil_id"))
    @Column(name="codigo") private Set<String> permissoes=new LinkedHashSet<>();
    protected Perfil() { }
    public Perfil(String nome,String descricao,Set<String> permissoes) {
        this.nome=nome; this.descricao=descricao; this.permissoes=new LinkedHashSet<>(permissoes);
    }
    public UUID getId() { return id; }
    public UUID getConsultoriaId() { return consultoriaId; }
    public String getNome() { return nome; }
    public String getDescricao() { return descricao; }
    public boolean isAcessoTotal() { return acessoTotal; }
    public boolean isSistema() { return sistema; }
    public boolean isAtivo() { return ativo; }
    public Long getVersao() { return versao; }
    public Instant getCriadoEm() { return criadoEm; }
    public Set<String> getPermissoes() { return Set.copyOf(permissoes); }
    public void alterar(String nome,String descricao,boolean ativo,Set<String> permissoes) {
        this.nome=nome; this.descricao=descricao; this.ativo=ativo;
        this.permissoes.clear(); this.permissoes.addAll(permissoes);
    }
}
