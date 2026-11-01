package br.com.treinos.api.auditoria;
import br.com.treinos.api.auth.*;
import br.com.treinos.api.consultoria.ConsultoriaRepository;
import br.com.treinos.api.security.UsuarioAutenticado;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.web.*;
import br.com.plataforma.comum.web.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.data.domain.PageRequest;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

@Service
public class Auditoria {
    private final AuditoriaGravacao gravacao;
    private final AuditoriaRepository eventos;
    private final UsuarioRepository usuarios;
    private final ConsultoriaRepository consultorias;
    public Auditoria(AuditoriaGravacao gravacao,AuditoriaRepository eventos,UsuarioRepository usuarios,ConsultoriaRepository consultorias) {
        this.gravacao=gravacao;this.eventos=eventos;this.usuarios=usuarios;this.consultorias=consultorias;
    }
    /** Não lê texto de argumentos nem DTOs: resumo é literal fixo da anotação. */
    public void registrar(Auditar evento,Object resultado,Object[] argumentos) {
        var auth=SecurityContextHolder.getContext().getAuthentication();
        UUID uid=null;
        if(auth!=null && auth.getPrincipal() instanceof UsuarioAutenticado eu) uid=eu.usuarioId();
        else if(resultado instanceof Usuario u) uid=u.getId();
        else if(resultado instanceof AuthService.Sessao s) uid=s.usuario().id();
        if(uid==null) return; // Seed e tarefas internas não representam uma ação de usuário.
        var usuario=usuarios.findById(uid).orElseThrow(() -> new IllegalStateException("Autor da ação não encontrado."));
        if(TenantContext.get()!=null && !TenantContext.get().equals(usuario.getConsultoriaId()))
            throw new IllegalStateException("Autor da ação fora da consultoria.");
        UUID entidadeId=idDoResultado(resultado);
        if(entidadeId==null && argumentos.length>0 && argumentos[0] instanceof UUID id) entidadeId=id;
        String acao=evento.acao();String entidade=evento.entidade();String resumo=evento.resumo();
        boolean publicou=acao.equals("PLANO_PUBLICADO");
        if((publicou || acao.equals("PLANO_COPIADO")) && resultado instanceof br.com.treinos.api.planos.dto.PlanoDtos.PlanoDetalhe<?> p) {
            String tipo=switch(p.rascunho()) {
                case br.com.treinos.api.treino.ConteudoTreino t -> "TREINO";
                case br.com.treinos.api.dieta.ConteudoDieta d -> "DIETA";
                case br.com.treinos.api.receitas.ConteudoMobilidade m -> "MOBILIDADE";
                default -> throw new IllegalStateException("Tipo de plano sem evento de auditoria.");
            };
            String nome=tipo.toLowerCase(java.util.Locale.ROOT);
            boolean masculino=tipo.equals("TREINO");
            entidade=tipo;
            if(publicou) {
                acao=tipo+(masculino?"_PUBLICADO":"_PUBLICADA");
                resumo="Publicou uma versão de "+nome+" (v"+p.plano().versaoPublicada()+").";
            } else {
                acao=tipo+(masculino?"_COPIADO":"_COPIADA");
                resumo="Copiou um plano de "+nome+" para outro aluno.";
            }
        }
        gravar(usuario,acao,entidade,entidadeId,resumo);
    }
    public void registrarEvento(String acao,String entidade,UUID id,String resumo) {
        var auth=SecurityContextHolder.getContext().getAuthentication();
        if(auth!=null && auth.getPrincipal() instanceof UsuarioAutenticado eu) {
            var autor=usuarios.findById(eu.usuarioId()).filter(u -> u.getConsultoriaId().equals(TenantContext.get()))
                    .orElseThrow(() -> new IllegalStateException("Autor da ação não encontrado."));
            gravar(autor,acao,entidade,id,resumo);
        }
    }
    /** Evento sem usuário (conciliação do provedor, tarefa interna): grava com autor nulo, na transação de quem chama. */
    public void registrarDoSistema(UUID consultoriaId,String acao,String entidade,UUID entidadeId,String resumo) {
        gravacao.gravar(consultoriaId,null,acao,entidade,entidadeId,resumo,null,null);
    }
    @Transactional
    public void bloqueioLogin(String email) {
        usuarios.buscarPorEmail(Emails.normalizar(email)).ifPresent(u -> gravar(u,"LOGIN_BLOQUEADO","USUARIO",u.getId(),"Login bloqueado por excesso de tentativas."));
    }
    /** Chamada dentro da transação da redefinição por link: se a troca desfaz, o evento também. */
    @Transactional
    public void senhaRedefinida(Usuario u) {
        gravar(u,"SENHA_REDEFINIDA","USUARIO",u.getId(),"Redefiniu a senha pelo link do e-mail.");
    }
    /** Troca da senha provisória no primeiro login (rota global, sem {@code TenantContext}): o autor é o próprio usuário. */
    @Transactional
    public void senhaDoPrimeiroAcesso(Usuario u) {
        gravar(u,"SENHA_ALTERADA","USUARIO",u.getId(),"Trocou a senha provisória no primeiro acesso.");
    }
    private void gravar(Usuario u,String acao,String entidade,UUID id,String resumo) {
        String ip=null;String agente=null;
        if(RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attrs) {
            ip=limitar(attrs.getRequest().getRemoteAddr(),45);agente=limitar(attrs.getRequest().getHeader("User-Agent"),200);
        }
        gravacao.gravar(u.getConsultoriaId(),u.getId(),acao,entidade,id,resumo,ip,agente);
    }
    private static String limitar(String texto,int tamanho) {
        if(texto==null) return null;String limpo=texto.replaceAll("[\\p{Cntrl}]","");return limpo.substring(0,Math.min(tamanho,limpo.length()));
    }
    private static UUID idDoResultado(Object resultado) {
        if(resultado instanceof Usuario u) return u.getId();
        if(resultado instanceof br.com.treinos.api.planos.dto.PlanoDtos.PlanoDetalhe<?> p) return p.plano().id();
        if(resultado!=null && resultado.getClass().isRecord()) {
            try { Object valor=resultado.getClass().getMethod("id").invoke(resultado);return valor instanceof UUID id?id:null; }
            catch(ReflectiveOperationException semId) { return null; }
        }
        return null;
    }
    public record Evento(UUID id,UUID usuarioId,String nomeUsuario,String acao,String entidade,UUID entidadeId,String resumo,Instant criadoEm) { }
    public record Pagina(List<Evento> itens,long total,int pagina) { }
    public record Pessoa(UUID id,String nome) { }
    @Transactional(readOnly=true)
    public List<Pessoa> pessoas() {
        return usuarios.findByConsultoriaIdAndPapelOrderByNomeAsc(TenantContext.get(),Papel.TREINADOR)
                .stream().map(u -> new Pessoa(u.getId(),u.getNome())).toList();
    }
    /** {@code usuarioId=sistema}: os eventos sem autor (do sistema, como a baixa confirmada pela InfinitePay). */
    public static final String SISTEMA = "sistema";
    private static final java.util.regex.Pattern ACAO = java.util.regex.Pattern.compile("[A-Z][A-Z0-9_]{0,79}");
    private static final UUID NINGUEM = new UUID(0L, 0L);

    /**
     * Lista paginada, mais recentes primeiro. Filtros opcionais e combinados com E: período (dias de Brasília),
     * {@code usuarioId} repetível (ids de usuários desta consultoria, senão 404, e/ou {@value #SISTEMA}) e {@code acao}
     * repetível (códigos em maiúsculas; outro formato = 400 {@code FILTRO_INVALIDO}, sem repetir o valor).
     */
    @Transactional(readOnly=true)
    public Pagina listar(LocalDate de,LocalDate ate,List<String> usuarioId,List<String> acao,int pagina) {
        if(de!=null && ate!=null && ate.isBefore(de)) throw new BadRequestException("Período inválido.");
        java.util.Set<UUID> ids=new java.util.LinkedHashSet<>();
        boolean sistema=false;
        for(String v:FiltrosDeLista.valores(usuarioId,"usuarioId")) {
            if(SISTEMA.equalsIgnoreCase(v)) sistema=true; else ids.add(FiltrosDeLista.uuid(v,"usuarioId"));
        }
        java.util.Set<String> acoes=new java.util.LinkedHashSet<>();
        for(String v:FiltrosDeLista.valores(acao,"acao")) {
            if(!ACAO.matcher(v).matches()) throw FiltrosDeLista.invalido("acao");
            acoes.add(v);
        }
        if(!ids.isEmpty()) {
            long daConsultoria=usuarios.findAllById(ids).stream().filter(u -> TenantContext.get().equals(u.getConsultoriaId())).count();
            if(daConsultoria!=ids.size()) throw new NaoEncontradoException("Usuário não encontrado.");
        }
        Instant inicio=de==null?Instant.EPOCH:de.atStartOfDay(Fuso.BRASILIA).toInstant();
        Instant fim=ate==null?Instant.now().plus(1,ChronoUnit.DAYS):ate.plusDays(1).atStartOfDay(Fuso.BRASILIA).toInstant();
        boolean filtraUsuarios=!ids.isEmpty()||sistema;
        // As coleções nunca vão vazias à consulta: sem filtro a flag desliga o trecho.
        var lista=eventos.buscar(inicio,fim,filtraUsuarios,ids.isEmpty()?java.util.Set.of(NINGUEM):ids,sistema,
                !acoes.isEmpty(),acoes.isEmpty()?java.util.Set.of(""):acoes,PageRequest.of(Math.max(0,pagina),50));
        return new Pagina(lista.stream().map(a -> new Evento(a.getId(),a.getUsuarioId(),nomeDoAutor(a.getUsuarioId()),
                a.getAcao(),a.getEntidade(),a.getEntidadeId(),a.getResumo(),a.getCriadoEm())).toList(),lista.getTotalElements(),Math.max(0,pagina));
    }
    /** Sem usuário é evento do sistema (ver {@link #registrarDoSistema}). */
    private String nomeDoAutor(UUID usuarioId) {
        if(usuarioId==null) return "Sistema";
        return usuarios.findById(usuarioId).filter(u -> u.getConsultoriaId().equals(TenantContext.get())).map(Usuario::getNome).orElse("—");
    }
    @Scheduled(cron="0 20 3 * * *",zone="America/Sao_Paulo") @Transactional
    public void limparAntigos() {
        Instant limite=LocalDate.now(Fuso.BRASILIA).minusYears(1).atStartOfDay(Fuso.BRASILIA).toInstant();
        consultorias.findAll().forEach(c -> gravacao.limpar(c.getId(),limite));
    }
}
