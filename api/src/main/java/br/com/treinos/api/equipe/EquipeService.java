package br.com.treinos.api.equipe;
import br.com.treinos.api.auth.*;
import br.com.treinos.api.consultoria.ConsultoriaRepository;
import br.com.treinos.api.equipe.EquipeDtos.*;
import br.com.treinos.api.security.OpaqueTokenGenerator;
import br.com.treinos.api.security.UsuarioAutenticado;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.web.*;
import br.com.plataforma.comum.web.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.beans.factory.annotation.Value;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/** Toda mutação da equipe trava a consultoria: dois administradores não conseguem remover ambos ao mesmo tempo. */
@Service
public class EquipeService {
    private final PerfilRepository perfis;
    private final UsuarioRepository usuarios;
    private final UsuarioConviteRepository convites;
    private final ConsultoriaRepository consultorias;
    private final RefreshTokenService refresh;
    private final PasswordEncoder senhas;
    private final String appUrl;
    private final br.com.treinos.api.auditoria.Auditoria auditoria;
    private final PermissoesDoUsuario permissoesDoUsuario;
    public EquipeService(PerfilRepository perfis,UsuarioRepository usuarios,UsuarioConviteRepository convites,
                        ConsultoriaRepository consultorias,RefreshTokenService refresh,
                        PasswordEncoder senhas,@Value("${treinos.app-url}") String appUrl,br.com.treinos.api.auditoria.Auditoria auditoria,PermissoesDoUsuario permissoesDoUsuario) {
        this.auditoria=auditoria;this.permissoesDoUsuario=permissoesDoUsuario;
        this.perfis=perfis;this.usuarios=usuarios;this.convites=convites;this.consultorias=consultorias;
        this.refresh=refresh;this.senhas=senhas;this.appUrl=appUrl.replaceAll("/+$","");
    }
    @Transactional(readOnly=true)
    public List<PerfilResponse> perfis() { return perfis.findAllByOrderByNomeAsc().stream().map(this::perfilResponse).toList(); }
    @Transactional
    @br.com.treinos.api.auditoria.Auditar(acao="PERFIL_CRIADO",entidade="PERFIL",resumo="Criou um perfil.")
    public PerfilResponse criarPerfil(PerfilRequest r) {
        travar();var permissoes=CatalogoPermissoes.validar(r.permissoes());
        exigirDentroDoTeto(ator(),permissoes);
        nomeDisponivel(r.nome(),null);
        var p=new Perfil(r.nome().trim(),Buscas.opcional(r.descricao()),permissoes);
        p.alterar(p.getNome(),p.getDescricao(),r.ativo()==null || r.ativo(),permissoes);
        return perfilResponse(perfis.saveAndFlush(p));
    }
    @Transactional
    @br.com.treinos.api.auditoria.Auditar(acao="PERFIL_ALTERADO",entidade="PERFIL",resumo="Editou um perfil.")
    public PerfilResponse alterarPerfil(UUID id,PerfilRequest r) {
        travar();var p=perfil(id);exigirEditavel(p);
        var permissoes=CatalogoPermissoes.validar(r.permissoes());
        var ator=ator();
        exigirDentroDoTeto(ator,permissoes);
        exigirDentroDoTeto(ator,permissoesDoPerfil(p));
        if(!ator.administrador() && p.getId().equals(ator.perfilId())) throw negada("Você não pode editar o perfil que você mesmo usa.");
        if(r.versao()==null || !r.versao().equals(p.getVersao())) throw new ConflictException("Outra pessoa alterou; recarregue.","CONFLITO_EDICAO");
        nomeDisponivel(r.nome(),id);
        p.alterar(r.nome().trim(),Buscas.opcional(r.descricao()),r.ativo()==null || r.ativo(),permissoes);
        return perfilResponse(perfis.saveAndFlush(p));
    }
    @Transactional
    @br.com.treinos.api.auditoria.Auditar(acao="PERFIL_DUPLICADO",entidade="PERFIL",resumo="Duplicou um perfil.")
    public PerfilResponse duplicarPerfil(UUID id) {
        travar();var original=perfil(id);
        exigirDentroDoTeto(ator(),permissoesDoPerfil(original));
        String base=original.getNome();if(base.length()>100) base=base.substring(0,100);
        String nome=base+" (cópia)";for(int n=2;nomeExiste(nome,null);n++) nome=base+" (cópia "+n+")";
        var p=new Perfil(nome,original.getDescricao(),original.isAcessoTotal()?CatalogoPermissoes.CODIGOS:original.getPermissoes());
        return perfilResponse(perfis.saveAndFlush(p));
    }
    @Transactional
    @br.com.treinos.api.auditoria.Auditar(acao="PERFIL_APAGADO",entidade="PERFIL",resumo="Apagou um perfil.")
    public void apagarPerfil(UUID id) {
        travar();var p=perfil(id);exigirEditavel(p);
        if(usuarios.countByConsultoriaIdAndPerfilId(TenantContext.get(),id)>0 || convites.countByPerfilIdAndUsadoEmIsNullAndExpiraEmAfter(id,Instant.now())>0)
            throw new ConflictException("Este perfil está vinculado a um membro ou convite.","PERFIL_EM_USO");
        convites.deleteByPerfilId(id);convites.flush();
        perfis.delete(p);perfis.flush();
    }
    @Transactional(readOnly=true)
    public List<UsuarioResponse> usuarios() {
        List<UsuarioResponse> lista=new ArrayList<>();
        for(var u:usuarios.findByConsultoriaIdAndPapelOrderByNomeAsc(TenantContext.get(),Papel.TREINADOR)) lista.add(usuarioResponse(u));
        for(var c:convites.findByUsadoEmIsNullOrderByCriadoEmDesc()) {
            var p=perfil(c.getPerfilId());lista.add(new UsuarioResponse(c.getId(),c.getNome(),c.getEmail(),p.getId(),p.getNome(),false,true,c.getExpiraEm(),null));
        }
        return List.copyOf(lista);
    }
    public record Responsavel(UUID id,String nome) { }
    @Transactional(readOnly=true)
    public List<Responsavel> responsaveis() {
        return usuarios.findByConsultoriaIdAndPapelOrderByNomeAsc(TenantContext.get(),Papel.TREINADOR).stream()
                .filter(Usuario::isAtivo).map(u -> new Responsavel(u.getId(),u.getNome())).toList();
    }
    @Transactional
    @br.com.treinos.api.auditoria.Auditar(acao="USUARIO_CONVIDADO",entidade="USUARIO",resumo="Gerou um convite de equipe.")
    public ConviteResponse convidar(ConviteRequest r,UUID criadoPor) {
        travar();var p=perfil(r.perfilId());
        exigirPodeAtribuir(ator(),p);
        if(!p.isAtivo()) throw new BadRequestException("Escolha um perfil ativo.");
        String email=Emails.normalizar(r.email());if(usuarios.existeEmail(email)) throw new ConflictException("Este e-mail já tem uma conta.","EMAIL_EM_USO");
        convites.deleteByEmailAndUsadoEmIsNull(email);convites.flush();
        String codigo=OpaqueTokenGenerator.gerar();Instant expira=Instant.now().plus(7,ChronoUnit.DAYS);
        convites.saveAndFlush(new UsuarioConvite(r.nome().trim(),email,p.getId(),OpaqueTokenGenerator.hash(codigo),expira,criadoPor));
        return new ConviteResponse(codigo,appUrl+"/convite-equipe#"+codigo,expira);
    }
    /** Cancela convite ainda não aceito (vencido ou não), com o mesmo teto de quem convida; de outra consultoria ou já aceito = 404. */
    @Transactional
    @br.com.treinos.api.auditoria.Auditar(acao="CONVITE_EQUIPE_CANCELADO",entidade="USUARIO",resumo="Cancelou um convite de equipe.")
    public void cancelarConvite(UUID id) {
        travar();var c=convites.findById(id).filter(v -> v.getUsadoEm()==null).orElseThrow(EquipeService::naoEncontrado);
        exigirPodeAtribuir(ator(),perfil(c.getPerfilId()));
        convites.delete(c);convites.flush();
    }
    @Transactional
    @br.com.treinos.api.auditoria.Auditar(acao="USUARIO_ALTERADO",entidade="USUARIO",resumo="Editou nome, perfil ou situação de um membro.")
    public UsuarioResponse alterarUsuario(UUID id,UsuarioRequest r) {
        travar();var u=usuario(id);var p=perfil(r.perfilId());
        var anterior=perfil(u.getPerfilId());
        var ator=ator();
        if(!ator.administrador()) {
            if(anterior.isAcessoTotal()) throw negada("Somente administradores podem alterar administradores.");
            if(!u.getPerfilId().equals(p.getId())) {
                exigirPodeAtribuir(ator,p);
                if(u.getId().equals(ator.usuarioId())) throw negada("Você não pode trocar o seu próprio perfil.");
            }
        }
        if(!p.isAtivo()) throw new BadRequestException("Escolha um perfil ativo.");
        if(u.isAtivo() && anterior.isAcessoTotal() && (!r.ativo() || !p.isAcessoTotal()) && administradoresAtivos()<=1)
            throw new ConflictException("A consultoria precisa de pelo menos um administrador ativo.","ULTIMO_ADMINISTRADOR");
        boolean troca=!u.getPerfilId().equals(p.getId());boolean desativar=u.isAtivo() && !r.ativo();
        u.alterarNome(r.nome().trim());u.alterarPerfil(p.getId());u.alterarAtivo(r.ativo());
        if(troca || desativar) refresh.encerrarTodas(u.getId());
        if(troca) auditoria.registrarEvento("USUARIO_PERFIL_ALTERADO","USUARIO",u.getId(),"Trocou o perfil de um membro.");
        if(desativar) auditoria.registrarEvento("USUARIO_DESATIVADO","USUARIO",u.getId(),"Desativou um membro.");
        usuarios.saveAndFlush(u);return usuarioResponse(u);
    }
    @Transactional
    @br.com.treinos.api.auditoria.Auditar(acao="CONVITE_EQUIPE_ACEITO",entidade="USUARIO",resumo="Aceitou um convite de equipe.")
    public Usuario aceitar(String hash,String senha) {
        travar();var c=convites.travarPorHash(hash).filter(v -> v.getUsadoEm()==null && v.getExpiraEm().isAfter(Instant.now())).orElseThrow(EquipeService::conviteInvalido);
        var p=perfil(c.getPerfilId());if(!p.isAtivo() || usuarios.existeEmail(c.getEmail())) throw conviteInvalido();
        RegrasSenha.validar(senha,c.getEmail());
        var u=Usuario.treinador(TenantContext.get(),c.getEmail(),c.getNome(),senhas.encode(senha));u.alterarPerfil(p.getId());
        usuarios.saveAndFlush(u);c.consumir();convites.saveAndFlush(c);return u;
    }
    @Transactional
    public void meuPerfil(UUID id,MeuPerfilRequest r) {
        var u=usuarios.buscarParaAlterar(id).filter(v -> v.getConsultoriaId().equals(TenantContext.get())).orElseThrow(EquipeService::naoEncontrado);
        u.alterarNome(r.nome().trim());u.alterarTelefone(Formatos.telefone(r.telefone()));usuarios.saveAndFlush(u);
    }
    /** Quem age: lido do banco a cada chamada, nunca do token. Sem usuário autenticado nada é permitido. */
    private record Ator(UUID usuarioId,UUID perfilId,boolean administrador,Set<String> permissoes) { }
    private Ator ator() {
        var auth=SecurityContextHolder.getContext().getAuthentication();
        if(auth==null || !(auth.getPrincipal() instanceof UsuarioAutenticado eu)) throw negada(MENSAGEM_TETO);
        var u=usuarios.findById(eu.usuarioId()).filter(v -> v.getConsultoriaId().equals(TenantContext.get())).orElseThrow(() -> negada(MENSAGEM_TETO));
        var p=u.getPerfilId()==null?null:perfis.buscar(u.getPerfilId(),TenantContext.get()).filter(Perfil::isAtivo).orElse(null);
        if(p==null) throw negada(MENSAGEM_TETO);
        return new Ator(u.getId(),p.getId(),p.isAcessoTotal(),permissoesDoUsuario.codigos(u));
    }
    private static Set<String> permissoesDoPerfil(Perfil p) { return p.isAcessoTotal()?CatalogoPermissoes.CODIGOS:p.getPermissoes(); }
    private static void exigirDentroDoTeto(Ator ator,Set<String> permissoes) {
        if(!ator.administrador() && !ator.permissoes().containsAll(permissoes)) throw negada(MENSAGEM_TETO);
    }
    /** Perfil de acesso total só um administrador atribui; os demais só os que cabem nas permissões de quem atribui. */
    private static void exigirPodeAtribuir(Ator ator,Perfil perfil) {
        if(ator.administrador()) return;
        if(perfil.isAcessoTotal()) throw negada(MENSAGEM_TETO);
        exigirDentroDoTeto(ator,permissoesDoPerfil(perfil));
    }
    private static final String MENSAGEM_TETO="Você não pode dar permissões que não tem.";
    private static ForbiddenException negada(String mensagem) { return new ForbiddenException(mensagem,"PERMISSAO_NEGADA"); }
    private long administradoresAtivos() {
        return usuarios.findByConsultoriaIdAndPapelOrderByNomeAsc(TenantContext.get(),Papel.TREINADOR).stream()
            .filter(Usuario::isAtivo).filter(u -> { var p=perfil(u.getPerfilId());return p.isAtivo() && p.isAcessoTotal(); }).count();
    }
    private Perfil perfil(UUID id) { return perfis.buscar(id,TenantContext.get()).orElseThrow(EquipeService::naoEncontrado); }
    private Usuario usuario(UUID id) { return usuarios.buscarParaAlterar(id).filter(u -> u.getConsultoriaId().equals(TenantContext.get()) && u.getPapel()==Papel.TREINADOR).orElseThrow(EquipeService::naoEncontrado); }
    private void travar() { Exigir.existe(consultorias.travar(TenantContext.get()),EquipeService::naoEncontrado); }
    private PerfilResponse perfilResponse(Perfil p) { return new PerfilResponse(p.getId(),p.getNome(),p.getDescricao(),p.isAcessoTotal(),p.isSistema(),p.isAtivo(),p.isAcessoTotal()?CatalogoPermissoes.CODIGOS:p.getPermissoes(),usuarios.countByConsultoriaIdAndPerfilId(TenantContext.get(),p.getId()),p.getVersao()); }
    private UsuarioResponse usuarioResponse(Usuario u) { var p=perfil(u.getPerfilId());return new UsuarioResponse(u.getId(),u.getNome(),u.getEmail(),p.getId(),p.getNome(),u.isAtivo(),false,null,u.getUltimoLoginEm()); }
    private boolean nomeExiste(String nome,UUID exceto) { return perfis.findAllByOrderByNomeAsc().stream().anyMatch(p -> !p.getId().equals(exceto) && p.getNome().equalsIgnoreCase(nome.trim())); }
    private void nomeDisponivel(String nome,UUID exceto) { if(nomeExiste(nome,exceto)) throw new ConflictException("Já existe um perfil com este nome.","NOME_EM_USO"); }
    private static void exigirEditavel(Perfil p) { if(p.isSistema()) throw new ConflictException("O perfil Administrador é do sistema.","PERFIL_DE_SISTEMA"); }
    private static NaoEncontradoException naoEncontrado() { return new NaoEncontradoException("Recurso não encontrado."); }
    public static NaoEncontradoException conviteInvalido() { return new NaoEncontradoException("Convite inválido ou expirado."); }
}
