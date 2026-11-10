package br.com.treinos.api.comunidade;

import br.com.plataforma.comum.web.ApiError;
import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.alunos.ApelidoDoAutor;
import br.com.treinos.api.auth.Usuario;
import br.com.treinos.api.auth.UsuarioRepository;
import br.com.treinos.api.comunidade.dto.ComunidadeDtos.*;
import br.com.treinos.api.security.UsuarioAutenticado;
import br.com.treinos.api.sessoesconcluidas.SessaoConcluidaRepository;
import br.com.treinos.api.web.LinksExternos;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
@Transactional
public class ComunidadeService {

    /** Teto de cada lista da exportação; é o mesmo dos {@code findTop5000By...} dos repositórios. */
    private static final int LIMITE_DA_EXPORTACAO = 5000;

    private final ComunidadeAulaRepository aulas;
    private final ComunidadeAulaComentarioRepository aulaComentarios;
    private final ComunidadeMuralPostRepository muralPosts;
    private final ComunidadeMuralReacaoRepository muralReacoes;
    private final ComunidadeMuralComentarioRepository muralComentarios;
    private final ConquistaAlunoRepository conquistas;
    private final AlunoRepository alunos;
    private final SessaoConcluidaRepository sessoes;
    private final UsuarioRepository usuarios;

    public ComunidadeService(ComunidadeAulaRepository aulas,
                             ComunidadeAulaComentarioRepository aulaComentarios,
                             ComunidadeMuralPostRepository muralPosts,
                             ComunidadeMuralReacaoRepository muralReacoes,
                             ComunidadeMuralComentarioRepository muralComentarios,
                             ConquistaAlunoRepository conquistas,
                             AlunoRepository alunos,
                             SessaoConcluidaRepository sessoes,
                             UsuarioRepository usuarios) {
        this.aulas = aulas;
        this.aulaComentarios = aulaComentarios;
        this.muralPosts = muralPosts;
        this.muralReacoes = muralReacoes;
        this.muralComentarios = muralComentarios;
        this.conquistas = conquistas;
        this.alunos = alunos;
        this.sessoes = sessoes;
        this.usuarios = usuarios;
    }

    // ---- Aulões ----

    @Transactional(readOnly = true)
    public List<AulaResumo> listarAulasAluno() {
        return aulas.findByPublicadaTrueOrderByOrdemAscCriadaEmDesc().stream()
                .map(a -> resumo(a, aulaComentarios.countByAulaIdAndOcultoFalse(a.getId())))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<AulaResumo> listarAulasEquipe() {
        return aulas.findAllByOrderByOrdemAscCriadaEmDesc().stream()
                .map(a -> resumo(a, aulaComentarios.countByAulaIdAndOcultoFalse(a.getId())))
                .toList();
    }

    public AulaResumo criarAula(CriarAulaRequest r) {
        ComunidadeAula a = new ComunidadeAula(r.titulo().trim(), r.descricao(), linkDaEntrada("videoUrl", r.videoUrl()),
                linkDaEntrada("miniaturaUrl", r.miniaturaUrl()), r.categoria(), r.ordem() == null ? 0 : r.ordem(),
                r.publicada() == null || r.publicada());
        aulas.saveAndFlush(a);
        return resumo(a, 0);
    }

    public AulaResumo alterarAula(UUID id, CriarAulaRequest r) {
        ComunidadeAula a = aulas.findById(id).orElseThrow(() -> new NaoEncontradoException("Aula não encontrada."));
        a.atualizar(r.titulo().trim(), r.descricao(), linkDaEntrada("videoUrl", r.videoUrl()),
                linkDaEntrada("miniaturaUrl", r.miniaturaUrl()), r.categoria(),
                r.ordem() == null ? 0 : r.ordem(), r.publicada() == null || r.publicada());
        aulas.saveAndFlush(a);
        return resumo(a, aulaComentarios.countByAulaIdAndOcultoFalse(a.getId()));
    }

    public void excluirAula(UUID id) {
        // findById passa pelo @TenantId: aula de outra consultoria dá 404 (deleteById responderia 204 sem avisar).
        aulas.delete(aulas.findById(id).orElseThrow(() -> new NaoEncontradoException("Aula não encontrada.")));
    }

    @Transactional(readOnly = true)
    public List<ComentarioResponse> listarComentariosAula(UUID aulaId, UsuarioAutenticado eu) {
        exigirAula(aulaId, eu);
        List<ComunidadeAulaComentario> lista = aulaComentarios.findByAulaIdAndOcultoFalseOrderByCriadoEmAsc(aulaId);
        Map<UUID, String> apelidos = apelidosDe(lista.stream().map(ComunidadeAulaComentario::getAutorId));
        return lista.stream()
                .map(c -> new ComentarioResponse(c.getId(), c.getAutorId(), c.getAutorNome(), apelidos.get(c.getAutorId()),
                        apelidos.containsKey(c.getAutorId()), c.getAutorFotoUrl(), c.getTexto(), c.getCriadoEm()))
                .toList();
    }

    public ComentarioResponse adicionarComentarioAula(UUID aulaId, String texto, UsuarioAutenticado eu) {
        exigirAula(aulaId, eu);
        String nome = usuarios.findById(eu.usuarioId()).map(Usuario::getNome).orElse("Membro");
        ComunidadeAulaComentario c = new ComunidadeAulaComentario(aulaId, eu.usuarioId(), nome, null, texto.trim());
        aulaComentarios.saveAndFlush(c);
        Map<UUID, String> autor = apelidosDe(Stream.of(c.getAutorId()));
        return new ComentarioResponse(c.getId(), c.getAutorId(), c.getAutorNome(), autor.get(c.getAutorId()),
                autor.containsKey(c.getAutorId()), c.getAutorFotoUrl(), c.getTexto(), c.getCriadoEm());
    }

    public void excluirComentarioAula(UUID id) {
        ComunidadeAulaComentario c = aulaComentarios.findById(id)
                .orElseThrow(() -> new NaoEncontradoException("Comentário não encontrado."));
        c.ocultar();
        aulaComentarios.saveAndFlush(c);
    }

    /** Aula da consultoria da sessão (de outra consultoria, 404); o aluno só enxerga as publicadas. */
    private void exigirAula(UUID aulaId, UsuarioAutenticado eu) {
        boolean aluno = "ALUNO".equals(eu.papel());
        if (aulas.findById(aulaId).filter(a -> !aluno || a.isPublicada()).isEmpty()) {
            throw new NaoEncontradoException("Aula não encontrada.");
        }
    }

    private static AulaResumo resumo(ComunidadeAula a, long totalComentarios) {
        // Link guardado que não passa mais na regra (linha antiga) não vai ao app: abriria o que não deveria.
        return new AulaResumo(a.getId(), a.getTitulo(), a.getDescricao(), linkSeguro(a.getVideoUrl()),
                linkSeguro(a.getMiniaturaUrl()), a.getCategoria(), a.getOrdem(), a.isPublicada(), a.getCriadaEm(),
                totalComentarios);
    }

    /** Vazio vira nulo; só https sem credenciais, senão 422 no campo (sem repetir o valor). */
    private static String linkDaEntrada(String campo, String url) {
        if (url == null || url.isBlank()) {
            return null;
        }
        String limpo = url.trim();
        if (!LinksExternos.valido(limpo)) {
            throw new ValidacaoException("Dados inválidos.", "COMUNIDADE_INVALIDA",
                    List.of(new ApiError.FieldError(campo, LinksExternos.MENSAGEM)));
        }
        return limpo;
    }

    private static String linkSeguro(String url) {
        return url != null && LinksExternos.valido(url) ? url : null;
    }

    // ---- Mural ----

    @Transactional(readOnly = true)
    public Page<MuralPostResponse> listarMural(Pageable pageable, UsuarioAutenticado eu) {
        Page<ComunidadeMuralPost> page = muralPosts.findByOcultoFalseOrderByFixadoDescCriadoEmDesc(pageable);
        // Uma consulta de apelidos por página, não por post.
        Map<UUID, String> apelidos = apelidosDe(page.getContent().stream().map(ComunidadeMuralPost::getAutorId));
        return page.map(p -> {
            List<ComunidadeMuralReacao> reacoes = muralReacoes.findByPostId(p.getId());
            Map<String, Long> contagem = reacoes.stream()
                    .collect(Collectors.groupingBy(ComunidadeMuralReacao::getEmoji, Collectors.counting()));
            List<String> minhas = eu == null ? List.of() : reacoes.stream()
                    .filter(r -> r.getUsuarioId().equals(eu.usuarioId()))
                    .map(ComunidadeMuralReacao::getEmoji)
                    .toList();
            long totalComentarios = muralComentarios.countByPostIdAndOcultoFalse(p.getId());
            return new MuralPostResponse(p.getId(), p.getAutorId(), p.getAutorNome(), apelidos.get(p.getAutorId()),
                    apelidos.containsKey(p.getAutorId()), p.getAutorFotoUrl(), p.getTexto(), linkSeguro(p.getImagemUrl()), p.isFixado(), p.getCriadoEm(), contagem, minhas,
                    totalComentarios);
        });
    }

    public MuralPostResponse criarPostMural(CriarPostRequest r, UsuarioAutenticado eu) {
        String imagem = linkDaEntrada("imagemUrl", r.imagemUrl());
        String nome = usuarios.findById(eu.usuarioId()).map(Usuario::getNome).orElse("Membro");
        ComunidadeMuralPost post = new ComunidadeMuralPost(eu.usuarioId(), nome, null, r.texto().trim(), imagem);
        muralPosts.saveAndFlush(post);
        Map<UUID, String> autor = apelidosDe(Stream.of(post.getAutorId()));
        return new MuralPostResponse(post.getId(), post.getAutorId(), post.getAutorNome(), autor.get(post.getAutorId()),
                autor.containsKey(post.getAutorId()), post.getAutorFotoUrl(), post.getTexto(), post.getImagemUrl(), post.isFixado(), post.getCriadoEm(), Map.of(), List.of(), 0);
    }

    public void alternarReacaoMural(UUID postId, String emoji, UsuarioAutenticado eu) {
        exigirPostVisivel(postId);
        var existente = muralReacoes.findByPostIdAndUsuarioIdAndEmoji(postId, eu.usuarioId(), emoji);
        if (existente.isPresent()) {
            muralReacoes.delete(existente.get());
        } else {
            muralReacoes.saveAndFlush(new ComunidadeMuralReacao(postId, eu.usuarioId(), emoji));
        }
    }

    @Transactional(readOnly = true)
    public List<ComentarioResponse> listarComentariosMural(UUID postId) {
        exigirPostVisivel(postId);
        List<ComunidadeMuralComentario> lista = muralComentarios.findByPostIdAndOcultoFalseOrderByCriadoEmAsc(postId);
        Map<UUID, String> apelidos = apelidosDe(lista.stream().map(ComunidadeMuralComentario::getAutorId));
        return lista.stream()
                .map(c -> new ComentarioResponse(c.getId(), c.getAutorId(), c.getAutorNome(), apelidos.get(c.getAutorId()),
                        apelidos.containsKey(c.getAutorId()), c.getAutorFotoUrl(), c.getTexto(), c.getCriadoEm()))
                .toList();
    }

    public ComentarioResponse adicionarComentarioMural(UUID postId, String texto, UsuarioAutenticado eu) {
        exigirPostVisivel(postId);
        String nome = usuarios.findById(eu.usuarioId()).map(Usuario::getNome).orElse("Membro");
        ComunidadeMuralComentario c = new ComunidadeMuralComentario(postId, eu.usuarioId(), nome, null, texto.trim());
        muralComentarios.saveAndFlush(c);
        Map<UUID, String> autor = apelidosDe(Stream.of(c.getAutorId()));
        return new ComentarioResponse(c.getId(), c.getAutorId(), c.getAutorNome(), autor.get(c.getAutorId()),
                autor.containsKey(c.getAutorId()), c.getAutorFotoUrl(), c.getTexto(), c.getCriadoEm());
    }

    public void moderarPost(UUID postId) {
        ComunidadeMuralPost p = muralPosts.findById(postId).orElseThrow(() -> new NaoEncontradoException("Post não encontrado."));
        p.ocultar();
        muralPosts.saveAndFlush(p);
    }

    public void fixarPost(UUID postId) {
        ComunidadeMuralPost p = exigirPostVisivel(postId);
        p.alternarFixado();
        muralPosts.saveAndFlush(p);
    }

    public void moderarComentarioMural(UUID comentarioId) {
        ComunidadeMuralComentario c = muralComentarios.findById(comentarioId)
                .orElseThrow(() -> new NaoEncontradoException("Comentário não encontrado."));
        c.ocultar();
        muralComentarios.saveAndFlush(c);
    }

    /** Post da consultoria da sessão e não oculto; de outra consultoria (ou oculto), 404. */
    private ComunidadeMuralPost exigirPostVisivel(UUID postId) {
        return muralPosts.findById(postId).filter(p -> !p.isOculto())
                .orElseThrow(() -> new NaoEncontradoException("Post não encontrado."));
    }

    /**
     * Autores que são aluno ativo (a chave existe) e o apelido atual de cada um, lido do aluno na hora (não é cópia no post);
     * o valor é nulo sem apelido. Autor da equipe, inativo ou anonimizado não entra, então {@code containsKey} diz se o perfil
     * abre. Uma consulta por lista; aluno de outra consultoria nem aparece (o filtro de tenant).
     */
    private Map<UUID, String> apelidosDe(Stream<UUID> autores) {
        List<UUID> ids = autores.distinct().toList();
        Map<UUID, String> mapa = new HashMap<>();
        if (!ids.isEmpty()) {
            for (ApelidoDoAutor a : alunos.autoresAlunosDosUsuarios(ids)) {
                mapa.putIfAbsent(a.usuarioId(), a.apelido());
            }
        }
        return mapa;
    }

    // ---- Perfil do colega ----

    /**
     * Perfil de um aluno ativo da mesma consultoria, a partir do id de usuário que o mural expõe. Equipe, inexistente, inativo,
     * anonimizado e de outra consultoria dão o mesmo 404. Só dado público da comunidade: as conquistas são as já desbloqueadas
     * (nenhuma é gravada numa leitura de GET) e os treinos concluídos são a contagem que o ranking já usa.
     */
    @Transactional(readOnly = true)
    public PerfilResponse perfilDoColega(UUID autorId, UsuarioAutenticado eu) {
        Aluno aluno = alunos.findByUsuarioId(autorId).filter(a -> a.isAtivo() && !a.isAnonimizado())
                .orElseThrow(() -> new NaoEncontradoException("Perfil não encontrado."));
        int treinos = (int) sessoes.countByAlunoIdAndSituacaoAndConcluidaTrue(aluno.getId(), "ACEITO");
        List<ConquistaResponse> deles = conquistas.findByAlunoIdOrderByConquistadaEmDesc(aluno.getId()).stream()
                .map(c -> new ConquistaResponse(c.getId(), c.getTipo(), c.getTitulo(), c.getDescricao(), c.getIcone(), c.getConquistadaEm()))
                .toList();
        return new PerfilResponse(autorId, aluno.getNome(), aluno.getApelido(), treinos, deles, autorId.equals(eu.usuarioId()));
    }

    // ---- Conquistas ----

    public List<ConquistaResponse> minhasConquistas(UUID alunoId) {
        avaliarConquistas(alunoId);
        return conquistas.findByAlunoIdOrderByConquistadaEmDesc(alunoId).stream()
                .map(c -> new ConquistaResponse(c.getId(), c.getTipo(), c.getTitulo(), c.getDescricao(), c.getIcone(), c.getConquistadaEm()))
                .toList();
    }

    public void avaliarConquistas(UUID alunoId) {
        long concluidos = sessoes.countByAlunoIdAndSituacaoAndConcluidaTrue(alunoId, "ACEITO");
        if (concluidos >= 1) desbloquear(alunoId, TipoConquista.PRIMEIRO_TREINO);
        if (concluidos >= 10) desbloquear(alunoId, TipoConquista.TREINOS_10);
        if (concluidos >= 25) desbloquear(alunoId, TipoConquista.TREINOS_25);
        if (concluidos >= 50) desbloquear(alunoId, TipoConquista.TREINOS_50);
        if (concluidos >= 100) desbloquear(alunoId, TipoConquista.TREINOS_100);
    }

    private void desbloquear(UUID alunoId, TipoConquista t) {
        if (!conquistas.existsByAlunoIdAndTipo(alunoId, t.name())) {
            conquistas.saveAndFlush(new ConquistaAluno(alunoId, t.name(), t.titulo(), t.descricao(), t.icone()));
        }
    }

    // ---- Ranking ----

    /**
     * A posição do próprio aluno entre os ativos da consultoria (empate divide a posição) e quantos são. Não há apelido público
     * nem opt-in, então nada de outro aluno (nome, id, contagem) sai daqui. O ranking de força saiu: carga nunca se inventa.
     */
    @Transactional(readOnly = true)
    public RankingResponse obterRanking(UUID alunoId) {
        if (alunos.findById(alunoId).isEmpty()) {
            throw new NaoEncontradoException("Aluno não encontrado.");
        }
        long treinos = sessoes.countByAlunoIdAndSituacaoAndConcluidaTrue(alunoId, "ACEITO");
        long adiante = alunos.contarAtivosComMaisTreinosConcluidos(treinos);
        return new RankingResponse((int) (adiante + 1), (int) treinos, (int) treinos * 10, alunos.countByAtivoTrue());
    }

    // ---- Exportação LGPD ----

    /** O que o aluno escreveu e marcou na comunidade, mais as conquistas; quem nunca teve acesso (sem usuário) só tem as conquistas. */
    @Transactional(readOnly = true)
    public ComunidadeExportada exportarDoAluno(UUID alunoId) {
        Aluno aluno = alunos.findById(alunoId).orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado."));
        var minhasConquistas = conquistas.findByAlunoIdOrderByConquistadaEmDesc(alunoId).stream()
                .map(c -> new ConquistaResponse(c.getId(), c.getTipo(), c.getTitulo(), c.getDescricao(), c.getIcone(), c.getConquistadaEm()))
                .toList();
        UUID usuarioId = aluno.getUsuarioId();
        if (usuarioId == null) {
            return new ComunidadeExportada(aluno.getApelido(), List.of(), List.of(), List.of(), List.of(), minhasConquistas, false);
        }
        var posts = muralPosts.findTop5000ByAutorIdOrderByCriadoEmDesc(usuarioId).stream()
                .map(p -> new PostExportado(p.getId(), p.getTexto(), p.getImagemUrl(), p.isFixado(), p.isOculto(), p.getCriadoEm()))
                .toList();
        var deAulas = aulaComentarios.findTop5000ByAutorIdOrderByCriadoEmDesc(usuarioId).stream()
                .map(c -> new ComentarioExportado(c.getId(), c.getAulaId(), c.getTexto(), c.isOculto(), c.getCriadoEm()))
                .toList();
        var doMural = muralComentarios.findTop5000ByAutorIdOrderByCriadoEmDesc(usuarioId).stream()
                .map(c -> new ComentarioExportado(c.getId(), c.getPostId(), c.getTexto(), c.isOculto(), c.getCriadoEm()))
                .toList();
        var reacoes = muralReacoes.findTop5000ByUsuarioIdOrderByCriadoEmDesc(usuarioId).stream()
                .map(r -> new ReacaoExportada(r.getPostId(), r.getEmoji(), r.getCriadoEm()))
                .toList();
        boolean truncado = posts.size() == LIMITE_DA_EXPORTACAO || deAulas.size() == LIMITE_DA_EXPORTACAO
                || doMural.size() == LIMITE_DA_EXPORTACAO || reacoes.size() == LIMITE_DA_EXPORTACAO;
        return new ComunidadeExportada(aluno.getApelido(), posts, deAulas, doMural, reacoes, minhasConquistas, truncado);
    }
}
