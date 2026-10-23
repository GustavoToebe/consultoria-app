package br.com.treinos.api.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * Login global (e-mail único entre todas as consultorias), por isso sem {@code @TenantId}: o login acontece antes de
 * saber a consultoria. É daqui que o filtro tira a consultoria da sessão.
 *
 * <p>{@code credenciaisVersao} vai no JWT (claim {@code cv}). Trocar senha ou desativar incrementa a versão: o Bearer
 * antigo é recusado na hora, sem esperar os 15 minutos.</p>
 */
@Entity
@Table(name = "usuario")
public class Usuario {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(nullable = false)
    private String email;

    @Column(nullable = false)
    private String nome;

    @Column(name = "senha_hash", nullable = false)
    private String senhaHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false)
    private Papel papel;

    @Column(name = "aluno_id", updatable = false)
    private UUID alunoId;

    @Column(name="perfil_id")
    private UUID perfilId;

    private String telefone;

    @Column(nullable = false)
    private boolean ativo = true;

    @Column(name = "credenciais_versao", nullable = false)
    private long credenciaisVersao;

    /** Senha provisória definida pelo treinador: o login só abre a sessão depois de o aluno escolher a dele. */
    @Column(name = "trocar_senha", nullable = false)
    private boolean trocarSenha;

    @Column(name = "criado_em", insertable = false, updatable = false)
    private Instant criadoEm;

    @Column(name = "ultimo_login_em")
    private Instant ultimoLoginEm;

    protected Usuario() {
    }

    private Usuario(UUID consultoriaId, String email, String nome, String senhaHash, Papel papel, UUID alunoId) {
        this.consultoriaId = consultoriaId;
        this.email = email;
        this.nome = nome;
        this.senhaHash = senhaHash;
        this.papel = papel;
        this.alunoId = alunoId;
    }

    public static Usuario treinador(UUID consultoriaId, String email, String nome, String senhaHash) {
        return new Usuario(consultoriaId, email, nome, senhaHash, Papel.TREINADOR, null);
    }

    public static Usuario aluno(UUID consultoriaId, UUID alunoId, String email, String nome, String senhaHash) {
        return new Usuario(consultoriaId, email, nome, senhaHash, Papel.ALUNO, alunoId);
    }

    public UUID getId() {
        return id;
    }

    public UUID getConsultoriaId() {
        return consultoriaId;
    }

    public String getEmail() {
        return email;
    }

    public String getNome() {
        return nome;
    }

    public String getSenhaHash() {
        return senhaHash;
    }

    public Papel getPapel() {
        return papel;
    }

    public void alterarNome(String nome) { this.nome=nome; }
    public void alterarTelefone(String telefone) { this.telefone=telefone; }
    public void alterarPerfil(UUID perfilId) {
        if (!java.util.Objects.equals(this.perfilId,perfilId)) { this.perfilId=perfilId; this.credenciaisVersao++; }
    }

    /** Sobe a versão das credenciais: os tokens de acesso já emitidos deixam de valer (quem chama também encerra as sessões de refresh). */
    public void invalidarCredenciais() { this.credenciaisVersao++; }
    public UUID getPerfilId() { return perfilId; }
    public String getTelefone() { return telefone; }

    public UUID getAlunoId() {
        return alunoId;
    }

    public boolean isAtivo() {
        return ativo;
    }

    public long getCredenciaisVersao() {
        return credenciaisVersao;
    }

    public Instant getCriadoEm() {
        return criadoEm;
    }

    public Instant getUltimoLoginEm() {
        return ultimoLoginEm;
    }

    public void registrarLogin(Instant quando) {
        this.ultimoLoginEm = quando;
    }

    /** Ativar ou desativar o MFA: os tokens de acesso emitidos antes deixam de valer. */
    public void subirVersaoDeCredenciais() {
        this.credenciaisVersao++;
    }

    public boolean isTrocarSenha() {
        return trocarSenha;
    }

    /** Toda troca de senha (a própria, pelo link do e-mail ou no primeiro acesso) desliga a senha provisória. */
    public void trocarSenha(String novoHash) {
        this.senhaHash = novoHash;
        this.trocarSenha = false;
        this.credenciaisVersao++;
    }

    /** Senha que o treinador definiu: vale só para o próximo login, que pede uma senha nova antes de abrir a sessão. */
    public void definirSenhaProvisoria(String hash) {
        this.senhaHash = hash;
        this.trocarSenha = true;
        this.credenciaisVersao++;
    }

    /** E-mail de login (o do cadastro do aluno é outro campo e não muda aqui). */
    public void alterarEmail(String email) {
        this.email = email;
        this.credenciaisVersao++;
    }

    /**
     * Anonimização do aluno (LGPD): troca nome, e-mail e senha, apaga o telefone e desativa. O e-mail é um marcador
     * único que não recebe mensagem; a senha é um hash de segredo aleatório que ninguém conhece.
     */
    public void anonimizar(String nome, String emailMarcador, String senhaHashInutil) {
        this.nome = nome;
        this.email = emailMarcador;
        this.telefone = null;
        this.senhaHash = senhaHashInutil;
        this.trocarSenha = false;
        this.ativo = false;
        this.credenciaisVersao++;
    }

    /** Desativar derruba o Bearer em uso (versão nova); reativar não devolve sessões antigas. */
    public void alterarAtivo(boolean ativo) {
        if (this.ativo != ativo) {
            this.ativo = ativo;
            this.credenciaisVersao++;
        }
    }
}
