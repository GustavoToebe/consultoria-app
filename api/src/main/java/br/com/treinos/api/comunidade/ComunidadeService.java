package br.com.treinos.api.comunidade;

import br.com.plataforma.comum.web.ApiError;
import br.com.plataforma.comum.web.BadRequestException;
import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.alunos.ApelidoDoAutor;
import br.com.treinos.api.auth.Usuario;
import br.com.treinos.api.auth.UsuarioRepository;
import br.com.treinos.api.comunidade.dto.ComunidadeDtos.*;
import br.com.treinos.api.execucao.AlunoAppService;
import br.com.treinos.api.security.UsuarioAutenticado;
import br.com.treinos.api.sessoesconcluidas.SessaoConcluidaRepository;
import br.com.treinos.api.web.Buscas;
import br.com.treinos.api.web.LinksExternos;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
@Transactional
public class ComunidadeService {

    /** Teto de cada lista da exportação; é o mesmo dos {@code findTop5000By...} dos repositórios. */
    private static final int LIMITE_DA_EXPORTACAO = 5000;
    private static final int TAMANHO_DA_PAGINA = 30;
    private static final int TAMANHO_MAXIMO = 100;
    private static final int MAXIMO_DE_FOTOS = 4;

    private final ComunidadeAulaRepository aulas;
    private final ComunidadeAulaComentarioRepository aulaComentarios;
    private final ComunidadeMuralPostRepository muralPosts;
    private final ComunidadeMuralReacaoRepository muralReacoes;
    private final ComunidadeMuralComentarioRepository muralComentarios;
    private final ConquistaAlunoRepository conquistas;
    private final AlunoRepository alunos;
    private final SessaoConcluidaRepository sessoes;
    private final UsuarioRepository usuarios;
    private final ComunidadeMuralFotoRepository fotos;
    private final ComunidadeMuralDenunciaRepository denuncias;
    private final ConfiguracaoDaComunidadeService configuracao;

    public ComunidadeService(ComunidadeAulaRepository aulas,
                             ComunidadeAulaComentarioRepository aulaComentarios,
                             ComunidadeMuralPostRepository muralPosts,
                             ComunidadeMuralReacaoRepository muralReacoes,
                             ComunidadeMuralComentarioRepository muralComentarios,
                             ConquistaAlunoRepository conquistas,
                             AlunoRepository alunos,
                             SessaoConcluidaRepository sessoes,
                             UsuarioRepository usuarios,
                             ComunidadeMuralFotoRepository fotos,
                             ComunidadeMuralDenunciaRepository denuncias,
                             ConfiguracaoDaComunidadeService configuracao) {
        this.aulas = aulas;
        this.aulaComentarios = aulaComentarios;
        this.muralPosts = muralPosts;
        this.muralReacoes = muralReacoes;
        this.muralComentarios = muralComentarios;
        this.conquistas = conquistas;
        this.alunos = alunos;
        this.sessoes = sessoes;
        this.usuarios = usuarios;
        this.fotos = fotos;
        this.denuncias = denuncias;
        this.configuracao = configuracao;
    }

    // ---- Aulões ----

    @Transactional(readOnly = true)
    public List<AulaResumo> listarAulasAluno(String busca) {
        return aulas.findByPublicadaTrueOrderByOrdemAscCriadaEmDesc().stream()
                .filter(a -> casaComABusca(a, busca))
                .map(a -> resumo(a, aulaComentarios.countByAulaIdAndOcultoFalse(a.getId())))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<AulaResumo> listarAulasEquipe(String busca) {
        return aulas.findAllByOrderByOrdemAscCriadaEmDesc().stream()
                .filter(a -> casaComABusca(a, busca))
                .map(a -> resumo(a, aulaComentarios.countByAulaIdAndOcultoFalse(a.getId())))
                .toList();
    }

    /**
     * Título e descrição, sem acento. shortcut: filtro em memória (a lista de aulas não é paginada nem passa de algumas dezenas);
     * trocar por coluna de busca como a do post se a lista crescer.
     */
    private static boolean casaComABusca(ComunidadeAula a, String busca) {
        String termo = Buscas.semAcento(busca);
        return termo.isEmpty() || Buscas.semAcento(a.getTitulo()).contains(termo)
                || Buscas.semAcento(a.getDescricao()).contains(termo);
    }

    public AulaResumo criarAula(CriarAulaRequest r) {
        ComunidadeAula a = new ComunidadeAula(r.titulo().trim(), r.descricao(), linkDaEntrada("videoUrl", r.videoUrl()),
                linkDaEntrada("miniaturaUrl", r.miniaturaUrl()), categoriaLimpa(r.categoria()), r.ordem() == null ? 0 : r.ordem(),
                r.publicada() == null || r.publicada());
        aulas.saveAndFlush(a);
        return resumo(a, 0);
    }

    public AulaResumo alterarAula(UUID id, CriarAulaRequest r) {
        ComunidadeAula a = aulas.findById(id).orElseThrow(() -> new NaoEncontradoException("Aula não encontrada."));
        a.atualizar(r.titulo().trim(), r.descricao(), linkDaEntrada("videoUrl", r.videoUrl()),
                linkDaEntrada("miniaturaUrl", r.miniaturaUrl()), categoriaLimpa(r.categoria()),
                r.ordem() == null ? 0 : r.ordem(), r.publicada() == null || r.publicada());
        aulas.saveAndFlush(a);
        return resumo(a, aulaComentarios.countByAulaIdAndOcultoFalse(a.getId()));
    }

    public void excluirAula(UUID id) {
        // findById passa pelo @TenantId: aula de outra consultoria dá 404 (deleteById responderia 204 sem avisar).
        aulas.delete(aulas.findById(id).orElseThrow(() -> new NaoEncontradoException("Aula não encontrada.")));
    }

    @Transactional(readOnly = true)
    public PaginaDeComentarios listarComentariosAula(UUID aulaId, UsuarioAutenticado eu, Integer pagina, Integer tamanho) {
        exigirAula(aulaId, eu);
        Page<ComunidadeAulaComentario> pg = aulaComentarios.findByAulaIdAndOcultoFalseOrderByCriadoEmAscIdAsc(aulaId,
                paginar(pagina, tamanho));
        Map<UUID, String> apelidos = apelidosDe(pg.getContent().stream().map(ComunidadeAulaComentario::getAutorId));
        return new PaginaDeComentarios(pg.getContent().stream()
                .map(c -> new ComentarioResponse(c.getId(), c.getAutorId(), c.getAutorNome(), apelidos.get(c.getAutorId()),
                        apelidos.containsKey(c.getAutorId()), c.getAutorFotoUrl(), c.getTexto(), c.getCriadoEm(), c.isDaEquipe()))
                .toList(), pg.getTotalElements());
    }

    /** Mesma convenção de GET /atualizacoes/pagina: base 0, 30 por padrão, entre 1 e 100; a ordem tem desempate por id. */
    private static Pageable paginar(Integer pagina, Integer tamanho) {
        int tam = tamanho == null ? TAMANHO_DA_PAGINA : Math.max(1, Math.min(tamanho, TAMANHO_MAXIMO));
        // O deslocamento (pagina * tam) precisa caber num int: página além disso vira a última possível (lista vazia, total real).
        return PageRequest.of(Math.max(0, Math.min(pagina == null ? 0 : pagina, Integer.MAX_VALUE / tam)), tam);
    }

    public ComentarioResponse adicionarComentarioAula(UUID aulaId, String texto, UsuarioAutenticado eu) {
        exigirAula(aulaId, eu);
        String nome = usuarios.findById(eu.usuarioId()).map(Usuario::getNome).orElse("Membro");
        ComunidadeAulaComentario c = new ComunidadeAulaComentario(aulaId, eu.usuarioId(), nome, null, texto.trim());
        if (!souAluno(eu)) {
            c.marcarDaEquipe();
        }
        aulaComentarios.saveAndFlush(c);
        Map<UUID, String> autor = apelidosDe(Stream.of(c.getAutorId()));
        return new ComentarioResponse(c.getId(), c.getAutorId(), c.getAutorNome(), autor.get(c.getAutorId()),
                autor.containsKey(c.getAutorId()), c.getAutorFotoUrl(), c.getTexto(), c.getCriadoEm(), c.isDaEquipe());
    }

    public void excluirComentarioAula(UUID id) {
        ComunidadeAulaComentario c = aulaComentarios.findById(id)
                .orElseThrow(() -> new NaoEncontradoException("Comentário não encontrado."));
        c.ocultar();
        aulaComentarios.saveAndFlush(c);
    }

    /** Aula da consultoria da sessão (de outra consultoria, 404); o aluno só enxerga as publicadas. */
    private void exigirAula(UUID aulaId, UsuarioAutenticado eu) {
        boolean aluno = souAluno(eu);
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

    /**
     * O mural visível (fixados primeiro, depois os mais novos), filtrado por {@code tipo} (400 {@code FILTRO_INVALIDO} se
     * desconhecido) e {@code busca} (sem acento, sobre {@code texto_busca}). {@code soDenunciados} e a contagem de denúncias só
     * valem para a equipe. Fotos, respostas da equipe e denúncias saem em consultas agrupadas por página, sem N+1.
     */
    @Transactional(readOnly = true)
    public Page<MuralPostResponse> listarMural(Pageable pageable, UsuarioAutenticado eu, String tipo, String busca,
                                               boolean soDenunciados) {
        boolean equipe = !souAluno(eu);
        Page<ComunidadeMuralPost> page = muralPosts.mural(filtroDeTipo(tipo), Buscas.padraoSemAcento(busca),
                equipe && soDenunciados, pageable);
        List<UUID> ids = page.getContent().stream().map(ComunidadeMuralPost::getId).toList();
        // Uma consulta de cada coisa por página, não por post.
        Map<UUID, String> apelidos = apelidosDe(page.getContent().stream().map(ComunidadeMuralPost::getAutorId));
        Map<UUID, List<UUID>> fotosDosPosts = new HashMap<>();
        Map<UUID, Long> denunciasDosPosts = new HashMap<>();
        Set<UUID> respondidos = new HashSet<>();
        if (!ids.isEmpty()) {
            fotos.idsDosPosts(ids).forEach(f -> fotosDosPosts.computeIfAbsent(f.getPostId(), k -> new ArrayList<>()).add(f.getId()));
            List<UUID> duvidas = page.getContent().stream().filter(p -> TipoDePost.DUVIDA.name().equals(p.getTipo()))
                    .map(ComunidadeMuralPost::getId).toList();
            if (!duvidas.isEmpty()) {
                respondidos.addAll(muralComentarios.comRespostaDaEquipe(duvidas));
            }
            if (equipe) {
                denuncias.contagens(ids).forEach(c -> denunciasDosPosts.put(c.getPostId(), c.getTotal()));
            }
        }
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
                    apelidos.containsKey(p.getAutorId()), p.getAutorFotoUrl(), p.getTexto(), p.getTipo(), linkSeguro(p.getVideoUrl()),
                    fotosDosPosts.getOrDefault(p.getId(), List.of()), respondidos.contains(p.getId()), p.isFixado(), p.getCriadoEm(),
                    contagem, minhas, totalComentarios, equipe ? denunciasDosPosts.getOrDefault(p.getId(), 0L) : null);
        });
    }

    /** Vazio = todos os tipos; desconhecido = 400 sem repetir o valor. */
    private static String filtroDeTipo(String tipo) {
        if (tipo == null || tipo.isBlank()) {
            return "";
        }
        return TipoDePost.de(tipo.trim()).orElseThrow(
                () -> new BadRequestException("Filtro tipo com valor desconhecido.", "FILTRO_INVALIDO")).name();
    }

    /**
     * Publica no mural. Aluno: só {@code CONVERSA}, {@code DUVIDA} e {@code RESULTADO}, com 0 a 4 fotos pendentes dele e a chave
     * {@code alunosPublicam} ligada (403 {@code PUBLICACAO_DESLIGADA}); equipe: todos os tipos, sem fotos. {@code VIDEO} exige
     * {@code videoUrl} https e só ele a aceita; {@code AVISO} nasce fixado. Tipo, link ou fotos fora da regra = 422
     * {@code POST_INVALIDO} no campo, sem repetir o valor; as fotos se ligam num UPDATE só e, se alguma falhar, nada é publicado.
     */
    public MuralPostResponse criarPostMural(CriarPostRequest r, UsuarioAutenticado eu) {
        boolean aluno = souAluno(eu);
        if (aluno) {
            configuracao.exigirQueAlunosPublicam(eu);
        }
        List<ApiError.FieldError> erros = new ArrayList<>();
        TipoDePost tipo = r.tipo() == null || r.tipo().isBlank() ? TipoDePost.CONVERSA : TipoDePost.de(r.tipo().trim()).orElse(null);
        if (tipo == null) {
            erros.add(new ApiError.FieldError("tipo", "Tipo de publicação desconhecido."));
        } else if (aluno && !tipo.doAluno()) {
            erros.add(new ApiError.FieldError("tipo", "Este tipo só a equipe publica."));
        }
        String video = null;
        boolean temLink = r.videoUrl() != null && !r.videoUrl().isBlank();
        if (tipo == TipoDePost.VIDEO) {
            if (!temLink) {
                erros.add(new ApiError.FieldError("videoUrl", "Informe o link do vídeo."));
            } else if (!LinksExternos.valido(r.videoUrl().trim())) {
                erros.add(new ApiError.FieldError("videoUrl", LinksExternos.MENSAGEM));
            } else {
                video = r.videoUrl().trim();
            }
        } else if (tipo != null && temLink) {
            erros.add(new ApiError.FieldError("videoUrl", "Só a publicação de vídeo leva link."));
        }
        List<UUID> fotoIds = r.fotoIds() == null ? List.of() : r.fotoIds();
        if (!fotoIds.isEmpty()) {
            if (!aluno) {
                erros.add(new ApiError.FieldError("fotoIds", "A equipe não anexa fotos."));
            } else if (fotoIds.size() > MAXIMO_DE_FOTOS || fotoIds.stream().anyMatch(Objects::isNull)
                    || fotoIds.stream().distinct().count() != fotoIds.size()) {
                erros.add(new ApiError.FieldError("fotoIds", "Use de 1 a " + MAXIMO_DE_FOTOS + " fotos, sem repetir."));
            }
        }
        if (!erros.isEmpty()) {
            throw new ValidacaoException("Confira a publicação.", "POST_INVALIDO", erros);
        }
        if (!fotoIds.isEmpty()) {
            configuracao.exigirQuePodeAnexarFoto(eu, alunos.findById(AlunoAppService.alunoDaSessao(eu))
                    .orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado.")));
        }
        String nome = usuarios.findById(eu.usuarioId()).map(Usuario::getNome).orElse("Membro");
        String texto = r.texto().trim();
        ComunidadeMuralPost post = new ComunidadeMuralPost(eu.usuarioId(), nome, null, texto, tipo, video, Buscas.semAcento(texto));
        muralPosts.saveAndFlush(post);
        if (!fotoIds.isEmpty() && fotos.vincular(post.getId(), eu.usuarioId(), fotoIds) != fotoIds.size()) {
            // Foto de outro autor, inexistente ou já ligada: desfaz o post também (a exceção reverte a transação).
            throw new ValidacaoException("Confira a publicação.", "POST_INVALIDO",
                    List.of(new ApiError.FieldError("fotoIds", "Alguma foto não está disponível. Envie de novo.")));
        }
        Map<UUID, String> autor = apelidosDe(Stream.of(post.getAutorId()));
        return new MuralPostResponse(post.getId(), post.getAutorId(), post.getAutorNome(), autor.get(post.getAutorId()),
                autor.containsKey(post.getAutorId()), post.getAutorFotoUrl(), post.getTexto(), post.getTipo(),
                post.getVideoUrl(), fotosDoPost(post.getId(), fotoIds), false, post.isFixado(), post.getCriadoEm(), Map.of(), List.of(), 0,
                aluno ? null : 0L);
    }

    /** Mesma ordem da lista do mural: a do envio das fotos (não a ordem do pedido). */
    private List<UUID> fotosDoPost(UUID postId, List<UUID> ligadas) {
        return ligadas.isEmpty() ? List.of() : fotos.idsDosPosts(List.of(postId)).stream().map(ComunidadeMuralFotoRepository.IdDaFoto::getId).toList();
    }

    private static boolean souAluno(UsuarioAutenticado eu) {
        return eu != null && "ALUNO".equals(eu.papel());
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
    public PaginaDeComentarios listarComentariosMural(UUID postId, Integer pagina, Integer tamanho) {
        ComunidadeMuralPost post = exigirPostVisivel(postId);
        // Dúvida: a resposta da equipe vem primeiro (C6); nos outros tipos, só por data.
        Pageable daPagina = paginar(pagina, tamanho);
        Page<ComunidadeMuralComentario> pg = TipoDePost.DUVIDA.name().equals(post.getTipo())
                ? muralComentarios.findByPostIdAndOcultoFalseOrderByDaEquipeDescCriadoEmAscIdAsc(postId, daPagina)
                : muralComentarios.findByPostIdAndOcultoFalseOrderByCriadoEmAscIdAsc(postId, daPagina);
        Map<UUID, String> apelidos = apelidosDe(pg.getContent().stream().map(ComunidadeMuralComentario::getAutorId));
        return new PaginaDeComentarios(pg.getContent().stream()
                .map(c -> new ComentarioResponse(c.getId(), c.getAutorId(), c.getAutorNome(), apelidos.get(c.getAutorId()),
                        apelidos.containsKey(c.getAutorId()), c.getAutorFotoUrl(), c.getTexto(), c.getCriadoEm(), c.isDaEquipe()))
                .toList(), pg.getTotalElements());
    }

    public ComentarioResponse adicionarComentarioMural(UUID postId, String texto, UsuarioAutenticado eu) {
        exigirPostVisivel(postId);
        String nome = usuarios.findById(eu.usuarioId()).map(Usuario::getNome).orElse("Membro");
        ComunidadeMuralComentario c = new ComunidadeMuralComentario(postId, eu.usuarioId(), nome, null, texto.trim());
        if (!souAluno(eu)) {
            c.marcarDaEquipe();
        }
        muralComentarios.saveAndFlush(c);
        Map<UUID, String> autor = apelidosDe(Stream.of(c.getAutorId()));
        return new ComentarioResponse(c.getId(), c.getAutorId(), c.getAutorNome(), autor.get(c.getAutorId()),
                autor.containsKey(c.getAutorId()), c.getAutorFotoUrl(), c.getTexto(), c.getCriadoEm(), c.isDaEquipe());
    }

    public void moderarPost(UUID postId) {
        ComunidadeMuralPost p = muralPosts.findById(postId).orElseThrow(() -> new NaoEncontradoException("Post não encontrado."));
        p.ocultar();
        muralPosts.saveAndFlush(p);
        // Post oculto não guarda foto (C7): os bytes saem do banco junto.
        fotos.apagarDoPost(postId);
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
        var perfil = new PerfilExportado(aluno.getPerfilReservado(), aluno.getPerfilDestaques(),
                aluno.getPerfilCor() == null ? null : aluno.getPerfilCor().name(),
                aluno.getPerfilMoldura() == null ? null : aluno.getPerfilMoldura().name());
        UUID usuarioId = aluno.getUsuarioId();
        if (usuarioId == null) {
            return new ComunidadeExportada(aluno.getApelido(), perfil, List.of(), List.of(), List.of(), List.of(), List.of(), List.of(),
                    minhasConquistas, false);
        }
        var posts = muralPosts.findTop5000ByAutorIdOrderByCriadoEmDesc(usuarioId).stream()
                .map(p -> new PostExportado(p.getId(), p.getTipo(), p.getTexto(), p.getVideoUrl(), p.isFixado(), p.isOculto(), p.getCriadoEm()))
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
        // Só metadados da foto (a imagem não sai) e as denúncias que ele fez; as feitas contra ele não são dele.
        var fotosEnviadas = fotos.findTop5000ByAutorIdOrderByCriadoEmDesc(usuarioId).stream()
                .map(f -> new FotoExportada(f.getId(), f.getPostId(), f.getTamanho(), f.getCriadoEm()))
                .toList();
        var denunciasFeitas = denuncias.findTop5000ByUsuarioIdOrderByCriadoEmDesc(usuarioId).stream()
                .map(d -> new DenunciaExportada(d.getPostId(), d.getMotivo(), d.getCriadoEm()))
                .toList();
        boolean truncado = fotosEnviadas.size() == LIMITE_DA_EXPORTACAO || denunciasFeitas.size() == LIMITE_DA_EXPORTACAO
                || posts.size() == LIMITE_DA_EXPORTACAO || deAulas.size() == LIMITE_DA_EXPORTACAO
                || doMural.size() == LIMITE_DA_EXPORTACAO || reacoes.size() == LIMITE_DA_EXPORTACAO;
        return new ComunidadeExportada(aluno.getApelido(), perfil, posts, deAulas, doMural, reacoes, fotosEnviadas, denunciasFeitas,
                minhasConquistas, truncado);
    }

    /** Categoria é texto livre opcional: sem espaços nas pontas nem repetidos no meio; vazio vira nulo (nunca "" no banco). */
    static String categoriaLimpa(String categoria) {
        if (categoria == null) return null;
        String limpa = categoria.strip().replaceAll("\\s+", " ");
        return limpa.isEmpty() ? null : limpa;
    }
}
