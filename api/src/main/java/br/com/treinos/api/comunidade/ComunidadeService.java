package br.com.treinos.api.comunidade;

import br.com.plataforma.comum.web.ApiError;
import br.com.plataforma.comum.web.BadRequestException;
import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.alunos.VotanteDaComunidade;
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
    private final ReacoesDoMuralService reacoes;
    private final EnquetesDoMuralService enquetes;
    private final CapasDaComunidadeService capas;
    private final XpService xp;
    private final PostsVisiveisDoMural visiveis;
    private final ComunidadePodRepository pods;
    private final PlaylistsService playlists;

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
                             ConfiguracaoDaComunidadeService configuracao,
                             ReacoesDoMuralService reacoes,
                             EnquetesDoMuralService enquetes,
                             CapasDaComunidadeService capas,
                             XpService xp,
                             PostsVisiveisDoMural visiveis,
                             ComunidadePodRepository pods,
                             PlaylistsService playlists) {
        this.playlists = playlists;
        this.visiveis = visiveis;
        this.pods = pods;
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
        this.reacoes = reacoes;
        this.enquetes = enquetes;
        this.capas = capas;
        this.xp = xp;
    }

    // ---- Aulões ----

    @Transactional(readOnly = true)
    public List<AulaResumo> listarAulasAluno(String busca) {
        return resumos(aulas.publicadasEmOrdem().stream().filter(a -> casaComABusca(a, busca)).toList());
    }

    @Transactional(readOnly = true)
    public List<AulaResumo> listarAulasEquipe(String busca) {
        return resumos(aulas.todasEmOrdem().stream().filter(a -> casaComABusca(a, busca)).toList());
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

    /**
     * A capa (se vier) tem de ser uma pendente da consultoria; senão 422 no campo {@code capaId} e o aulão não é criado. A playlist
     * do corpo ({@code playlistId}) tem de ser da consultoria (senão 422 no campo) e o aulão entra no fim dela.
     */
    public AulaResumo criarAula(CriarAulaRequest r) {
        String link = linkDaEntrada("videoUrl", r.videoUrl());
        ComunidadeAula a = new ComunidadeAula(r.titulo().trim(), r.descricao(), link, r.playlistId(),
                playlists.posicaoNoFim(r.playlistId()), r.publicada() == null || r.publicada());
        aulas.saveAndFlush(a);
        capas.definirDaAula(a.getId(), r.capaId());
        return resumo(a, 0, r.capaId());
    }

    /**
     * No {@code PUT}, {@code capaId} nulo ou ausente remove a capa; a mesma que já está ligada não muda. Trocar de playlist manda o
     * aulão para o fim da nova (ou para a posição 0 sem playlist); com a mesma playlist, a posição fica.
     */
    public AulaResumo alterarAula(UUID id, CriarAulaRequest r) {
        ComunidadeAula a = aulas.findById(id).orElseThrow(() -> new NaoEncontradoException("Aula não encontrada."));
        String link = linkDaEntrada("videoUrl", r.videoUrl());
        int ordem = Objects.equals(a.getPlaylistId(), r.playlistId()) ? a.getOrdem() : playlists.posicaoNoFim(r.playlistId());
        a.atualizar(r.titulo().trim(), r.descricao(), link, r.playlistId(), ordem, r.publicada() == null || r.publicada());
        aulas.saveAndFlush(a);
        capas.definirDaAula(a.getId(), r.capaId());
        return resumo(a, aulaComentarios.countByAulaIdAndOcultoFalse(a.getId()), r.capaId());
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
        Map<UUID, VotanteDaComunidade> autores = alunosAutores(pg.getContent().stream().map(ComunidadeAulaComentario::getAutorId));
        boolean paraAluno = souAluno(eu);
        return new PaginaDeComentarios(pg.getContent().stream()
                .map(c -> comentario(c.getId(), c.getAutorId(), c.getAutorNome(), c.getAutorFotoUrl(), c.getTexto(), c.getCriadoEm(),
                        c.isDaEquipe(), autores, paraAluno))
                .toList(), pg.getTotalElements());
    }

    /** Mesma convenção de GET /atualizacoes/pagina: base 0, 30 por padrão, entre 1 e 100; a ordem tem desempate por id. */
    static Pageable paginar(Integer pagina, Integer tamanho) {
        int tam = tamanho == null ? TAMANHO_DA_PAGINA : Math.max(1, Math.min(tamanho, TAMANHO_MAXIMO));
        // O deslocamento (pagina * tam) precisa caber num int: página além disso vira a última possível (lista vazia, total real).
        return PageRequest.of(Math.max(0, Math.min(pagina == null ? 0 : pagina, Integer.MAX_VALUE / tam)), tam);
    }

    public ComentarioResponse adicionarComentarioAula(UUID aulaId, String texto, UsuarioAutenticado eu) {
        exigirAula(aulaId, eu);
        exigirTextoPermitido(texto, eu);
        String nome = usuarios.findById(eu.usuarioId()).map(Usuario::getNome).orElse("Membro");
        ComunidadeAulaComentario c = new ComunidadeAulaComentario(aulaId, eu.usuarioId(), nome, null, texto.trim());
        if (!souAluno(eu)) {
            c.marcarDaEquipe();
        }
        aulaComentarios.saveAndFlush(c);
        return comentario(c.getId(), c.getAutorId(), c.getAutorNome(), c.getAutorFotoUrl(), c.getTexto(), c.getCriadoEm(), c.isDaEquipe(),
                alunosAutores(Stream.of(c.getAutorId())), souAluno(eu));
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

    /** Os aulões da lista com a contagem de comentários visíveis e a capa de cada um: uma consulta para cada, sem N+1. */
    private List<AulaResumo> resumos(List<ComunidadeAula> doLote) {
        if (doLote.isEmpty()) {
            return List.of();
        }
        List<UUID> ids = doLote.stream().map(ComunidadeAula::getId).toList();
        Map<UUID, UUID> capasDasAulas = capas.idsDasAulas(ids);
        Map<UUID, Long> totais = new HashMap<>();
        aulaComentarios.totaisVisiveis(ids).forEach(t -> totais.put(t.getAulaId(), t.getTotal()));
        return doLote.stream()
                .map(a -> resumo(a, totais.getOrDefault(a.getId(), 0L), capasDasAulas.get(a.getId())))
                .toList();
    }

    private static AulaResumo resumo(ComunidadeAula a, long totalComentarios, UUID capaId) {
        // Link guardado que não passa mais na regra (linha antiga) não vai ao app: abriria o que não deveria.
        return new AulaResumo(a.getId(), a.getTitulo(), a.getDescricao(), linkSeguro(a.getVideoUrl()), capaId, a.getPlaylistId(),
                a.getOrdem(), a.isPublicada(), a.getCriadaEm(), totalComentarios);
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
     * valem para a equipe. Fotos, capas, reações, comentários, enquetes, respostas da equipe e denúncias saem em consultas
     * agrupadas por página, sem N+1.
     * <p>Dois modos (V082): {@code podId} nulo = mural geral ({@code pod_id is null}); com ele, só o mural daquele pod. O aluno só
     * pode pedir o próprio pod (lido do banco; outro id = 404 igual ao de pod inexistente) e a equipe, qualquer pod da consultoria.
     * A fila {@code soDenunciados} da equipe atravessa todos os pods.
     */
    @Transactional(readOnly = true)
    public Page<MuralPostResponse> listarMural(Pageable pageable, UsuarioAutenticado eu, String tipo, String busca,
                                               boolean soDenunciados, UUID podId) {
        boolean equipe = !souAluno(eu);
        boolean todosOsPods = equipe && soDenunciados;
        UUID pod = todosOsPods ? null : exigirPodDoMural(eu, podId);
        // soDenunciados só vale para a equipe, e então é também "todos os pods".
        Page<ComunidadeMuralPost> page = muralPosts.mural(filtroDeTipo(tipo), Buscas.padraoSemAcento(busca), todosOsPods,
                todosOsPods, pod == null, pod == null ? SEM_POD : pod, pageable);
        List<UUID> ids = page.getContent().stream().map(ComunidadeMuralPost::getId).toList();
        Map<UUID, String> nomesDosPods = nomesDosPods(page.getContent().stream().map(ComunidadeMuralPost::getPodId));
        // Uma consulta de cada coisa por página, não por post.
        Map<UUID, VotanteDaComunidade> autores = alunosAutores(page.getContent().stream().map(ComunidadeMuralPost::getAutorId));
        Map<UUID, List<UUID>> fotosDosPosts = new HashMap<>();
        Map<UUID, Long> denunciasDosPosts = new HashMap<>();
        Set<UUID> respondidos = new HashSet<>();
        Map<UUID, Long> comentariosDosPosts = new HashMap<>();
        Map<UUID, UUID> capasDosPosts = Map.of();
        if (!ids.isEmpty()) {
            capasDosPosts = capas.idsDosPosts(page.getContent().stream()
                    .filter(p -> TipoDePost.VIDEO.name().equals(p.getTipo())).map(ComunidadeMuralPost::getId).toList());
            muralComentarios.totaisVisiveis(ids).forEach(c -> comentariosDosPosts.put(c.getPostId(), c.getTotal()));
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
        Map<UUID, Map<String, Long>> contagens = reacoes.contagens(ids);
        Map<UUID, List<String>> minhas = reacoes.minhas(ids, eu == null ? null : eu.usuarioId());
        Map<UUID, EnqueteResponse> enquetesDosPosts = eu == null ? Map.of() : enquetes.resumos(page.getContent(), eu);
        Map<UUID, UUID> capasDaPagina = capasDosPosts;
        return page.map(p -> {
            AutorNoMural autor = autorDe(autores, p.getAutorId(), p.getAutorNome(), !equipe);
            return new MuralPostResponse(p.getId(), p.getAutorId(), autor.nome(), autor.apelido(),
                    autor.ehAluno(), p.getAutorFotoUrl(), p.getTexto(), p.getTipo(), linkSeguro(p.getVideoUrl()),
                    capasDaPagina.get(p.getId()), fotosDosPosts.getOrDefault(p.getId(), List.of()), enquetesDosPosts.get(p.getId()),
                    respondidos.contains(p.getId()), p.isFixado(), p.getCriadoEm(), p.getPodId(), nomesDosPods.get(p.getPodId()),
                    contagens.getOrDefault(p.getId(), Map.of()),
                    minhas.getOrDefault(p.getId(), List.of()), comentariosDosPosts.getOrDefault(p.getId(), 0L),
                    equipe ? denunciasDosPosts.getOrDefault(p.getId(), 0L) : null);
        });
    }

    /** Sentinela do pod no JPQL do mural (UUID zero nunca é id de pod); o filtro usa {@code soGeral}, não este valor. */
    private static final UUID SEM_POD = new UUID(0L, 0L);

    /**
     * O pod do mural pedido ({@code null} = geral). Aluno: só o próprio, lido do banco; equipe: qualquer pod da consultoria
     * ({@code @TenantId}). Pod que não existe ou que não é dele = o mesmo 404.
     */
    private UUID exigirPodDoMural(UsuarioAutenticado eu, UUID podId) {
        if (podId == null) {
            return null;
        }
        boolean permitido = souAluno(eu) ? podId.equals(visiveis.podDoAluno(eu)) : pods.existsById(podId);
        if (!permitido) {
            throw new NaoEncontradoException("Pod não encontrado.");
        }
        return podId;
    }

    /** Nome de cada pod citado, numa consulta; mapa mutável (aceita chave nula). */
    private Map<UUID, String> nomesDosPods(Stream<UUID> podIds) {
        List<UUID> ids = podIds.filter(Objects::nonNull).distinct().toList();
        Map<UUID, String> nomes = new HashMap<>();
        if (!ids.isEmpty()) {
            pods.findAllById(ids).forEach(p -> nomes.put(p.getId(), p.getNome()));
        }
        return nomes;
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
     * {@code alunosPublicam} ligada (403 {@code PUBLICACAO_DESLIGADA}), e o texto passa pelo {@link FiltroDeConteudo}; equipe:
     * todos os tipos, sem filtro, com 0 a 4 fotos pendentes dela (C36, menos a enquete). {@code VIDEO} exige
     * {@code videoUrl} https e só ele a aceita (e a {@code capaId}, opcional); {@code ENQUETE} (só a equipe) exige {@code opcoes}
     * (2 a 6) e aceita {@code variasRespostas} e {@code encerraEm}, e recusa link, fotos e capa; os outros tipos recusam
     * {@code opcoes}, {@code variasRespostas}, {@code encerraEm} e (menos o vídeo) {@code capaId}; {@code AVISO} nasce fixado. Tipo,
     * link, fotos, capa ou enquete fora da regra = 422 {@code POST_INVALIDO} no campo, sem repetir o valor; as fotos se ligam num
     * UPDATE só e, se alguma falhar (ou a capa não estiver disponível), nada é publicado.
     */
    public MuralPostResponse criarPostMural(CriarPostRequest r, UsuarioAutenticado eu) {
        boolean aluno = souAluno(eu);
        if (aluno) {
            configuracao.exigirQueAlunosPublicam(eu);
        }
        // Aluno: só o próprio pod (do banco), senão 404; nulo = mural geral.
        UUID podDoPost = exigirPodDoMural(eu, r.podId());
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
            if (tipo == TipoDePost.ENQUETE) {
                erros.add(new ApiError.FieldError("fotoIds", "A enquete não leva fotos."));
            } else if (fotoIds.size() > MAXIMO_DE_FOTOS || fotoIds.stream().anyMatch(Objects::isNull)
                    || fotoIds.stream().distinct().count() != fotoIds.size()) {
                erros.add(new ApiError.FieldError("fotoIds", "Use de 1 a " + MAXIMO_DE_FOTOS + " fotos, sem repetir."));
            }
        }
        List<String> opcoesLimpas = List.of();
        if (tipo == TipoDePost.ENQUETE) {
            opcoesLimpas = EnquetesDoMuralService.opcoesLimpas(r.opcoes(), erros);
            EnquetesDoMuralService.conferirPrazo(r.encerraEm(), erros);
        } else if (tipo != null) {
            if (r.opcoes() != null && !r.opcoes().isEmpty()) {
                erros.add(new ApiError.FieldError("opcoes", "Só a enquete leva opções."));
            }
            if (r.variasRespostas() != null) {
                erros.add(new ApiError.FieldError("variasRespostas", "Só a enquete aceita várias respostas."));
            }
            if (r.encerraEm() != null) {
                erros.add(new ApiError.FieldError("encerraEm", "Só a enquete tem prazo."));
            }
        }
        if (r.capaId() != null && tipo != null && tipo != TipoDePost.VIDEO) {
            erros.add(new ApiError.FieldError("capaId", "Só a publicação de vídeo leva capa."));
        }
        if (aluno && FiltroDeConteudo.bloqueia(r.texto())) {
            erros.add(FiltroDeConteudo.ERRO);
        }
        if (!erros.isEmpty()) {
            throw new ValidacaoException("Confira a publicação.", "POST_INVALIDO", erros);
        }
        // A idade e a chave de fotos são regras do aluno; a equipe (COMUNIDADE_MODERAR, na rota) anexa sem elas.
        if (aluno && !fotoIds.isEmpty()) {
            configuracao.exigirQuePodeAnexarFoto(eu, alunos.findById(AlunoAppService.alunoDaSessao(eu))
                    .orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado.")));
        }
        String nome = usuarios.findById(eu.usuarioId()).map(Usuario::getNome).orElse("Membro");
        String texto = r.texto().trim();
        ComunidadeMuralPost post = new ComunidadeMuralPost(eu.usuarioId(), nome, null, texto, tipo, video, Buscas.semAcento(texto),
                podDoPost);
        if (tipo == TipoDePost.ENQUETE) {
            post.definirEnquete(Boolean.TRUE.equals(r.variasRespostas()), r.encerraEm());
        }
        muralPosts.saveAndFlush(post);
        if (tipo == TipoDePost.ENQUETE) {
            enquetes.criarOpcoes(post.getId(), opcoesLimpas, eu);
        }
        if (r.capaId() != null && !capas.ligarAoPost(r.capaId(), post.getId(), eu)) {
            // Capa inexistente, de outra consultoria ou já com dono: desfaz o post também (a exceção reverte a transação).
            throw new ValidacaoException("Confira a publicação.", "POST_INVALIDO", List.of(CapasDaComunidadeService.CAPA_INDISPONIVEL));
        }
        if (!fotoIds.isEmpty() && fotos.vincular(post.getId(), eu.usuarioId(), fotoIds) != fotoIds.size()) {
            // Foto de outro autor, inexistente ou já ligada: desfaz o post também (a exceção reverte a transação).
            throw new ValidacaoException("Confira a publicação.", "POST_INVALIDO",
                    List.of(new ApiError.FieldError("fotoIds", "Alguma foto não está disponível. Envie de novo.")));
        }
        AutorNoMural autor = autorDe(alunosAutores(Stream.of(post.getAutorId())), post.getAutorId(), post.getAutorNome(), aluno);
        EnqueteResponse enquete = tipo == TipoDePost.ENQUETE ? enquetes.resumos(List.of(post), eu).get(post.getId()) : null;
        return new MuralPostResponse(post.getId(), post.getAutorId(), autor.nome(), autor.apelido(),
                autor.ehAluno(), post.getAutorFotoUrl(), post.getTexto(), post.getTipo(),
                post.getVideoUrl(), r.capaId(), fotosDoPost(post.getId(), fotoIds), enquete, false, post.isFixado(), post.getCriadoEm(),
                post.getPodId(), nomesDosPods(Stream.of(post.getPodId())).get(post.getPodId()), Map.of(), List.of(), 0,
                aluno ? null : 0L);
    }

    /** Mesma ordem da lista do mural: a do envio das fotos (não a ordem do pedido). */
    private List<UUID> fotosDoPost(UUID postId, List<UUID> ligadas) {
        return ligadas.isEmpty() ? List.of() : fotos.idsDosPosts(List.of(postId)).stream().map(ComunidadeMuralFotoRepository.IdDaFoto::getId).toList();
    }

    /** Comentário de aluno com termo do filtro: 422 no campo {@code texto}, sem repetir o texto nem o termo. A equipe não é filtrada. */
    private static void exigirTextoPermitido(String texto, UsuarioAutenticado eu) {
        if (souAluno(eu) && FiltroDeConteudo.bloqueia(texto)) {
            throw new ValidacaoException("Confira o comentário.", "COMUNIDADE_INVALIDA", List.of(FiltroDeConteudo.ERRO));
        }
    }

    /** Falha fechada: só o papel de equipe EXPLÍCITO pega o caminho da equipe (nome completo, apelido, denúncias); sem usuário ou outro papel, o do aluno. */
    private static boolean souAluno(UsuarioAutenticado eu) {
        return !PostsVisiveisDoMural.equipe(eu);
    }

    @Transactional(readOnly = true)
    public PaginaDeComentarios listarComentariosMural(UUID postId, UsuarioAutenticado eu, Integer pagina, Integer tamanho) {
        ComunidadeMuralPost post = visiveis.exigirPostVisivel(postId, eu);
        // Dúvida: a resposta da equipe vem primeiro (C6); nos outros tipos, só por data.
        Pageable daPagina = paginar(pagina, tamanho);
        Page<ComunidadeMuralComentario> pg = TipoDePost.DUVIDA.name().equals(post.getTipo())
                ? muralComentarios.findByPostIdAndOcultoFalseOrderByDaEquipeDescCriadoEmAscIdAsc(postId, daPagina)
                : muralComentarios.findByPostIdAndOcultoFalseOrderByCriadoEmAscIdAsc(postId, daPagina);
        Map<UUID, VotanteDaComunidade> autores = alunosAutores(pg.getContent().stream().map(ComunidadeMuralComentario::getAutorId));
        boolean paraAluno = souAluno(eu);
        return new PaginaDeComentarios(pg.getContent().stream()
                .map(c -> comentario(c.getId(), c.getAutorId(), c.getAutorNome(), c.getAutorFotoUrl(), c.getTexto(), c.getCriadoEm(),
                        c.isDaEquipe(), autores, paraAluno))
                .toList(), pg.getTotalElements());
    }

    public ComentarioResponse adicionarComentarioMural(UUID postId, String texto, UsuarioAutenticado eu) {
        visiveis.exigirPostVisivel(postId, eu);
        exigirTextoPermitido(texto, eu);
        String nome = usuarios.findById(eu.usuarioId()).map(Usuario::getNome).orElse("Membro");
        ComunidadeMuralComentario c = new ComunidadeMuralComentario(postId, eu.usuarioId(), nome, null, texto.trim());
        if (!souAluno(eu)) {
            c.marcarDaEquipe();
        }
        muralComentarios.saveAndFlush(c);
        return comentario(c.getId(), c.getAutorId(), c.getAutorNome(), c.getAutorFotoUrl(), c.getTexto(), c.getCriadoEm(), c.isDaEquipe(),
                alunosAutores(Stream.of(c.getAutorId())), souAluno(eu));
    }

    public void moderarPost(UUID postId, UsuarioAutenticado eu) {
        ComunidadeMuralPost p = visiveis.exigirPostVisivel(postId, eu);
        // Post oculto não guarda foto (C7) nem capa (D7): os bytes saem do banco junto (a capa antes de ocultar: o funil recusa o
        // oculto). Os votos ficam, escondidos com o post.
        capas.apagarDoPost(postId, eu);
        fotos.apagarDoPost(postId);
        p.ocultar();
        muralPosts.saveAndFlush(p);
    }

    public void fixarPost(UUID postId, UsuarioAutenticado eu) {
        ComunidadeMuralPost p = visiveis.exigirPostVisivel(postId, eu);
        p.alternarFixado();
        muralPosts.saveAndFlush(p);
    }

    /** O comentário vale pelo post dele: post oculto ou de outro pod (ou de outra consultoria) = 404, como o comentário inexistente. */
    public void moderarComentarioMural(UUID comentarioId, UsuarioAutenticado eu) {
        ComunidadeMuralComentario c = muralComentarios.findById(comentarioId)
                .orElseThrow(() -> new NaoEncontradoException("Comentário não encontrado."));
        visiveis.exigirPostVisivel(c.getPostId(), eu, "Comentário não encontrado.");
        c.ocultar();
        muralComentarios.saveAndFlush(c);
    }

    /**
     * Quem dos autores é aluno (em qualquer situação) da consultoria, por id de usuário, numa consulta por lista; autor da equipe não
     * vem. O nome gravado no post é cópia do nome completo da hora da criação: para o aluno-visualizador ele nunca sai (ver
     * {@link #autorDe}).
     */
    private Map<UUID, VotanteDaComunidade> alunosAutores(Stream<UUID> autores) {
        List<UUID> ids = autores.distinct().toList();
        Map<UUID, VotanteDaComunidade> mapa = new HashMap<>();
        if (!ids.isEmpty()) {
            for (VotanteDaComunidade a : alunos.votantesDaComunidade(ids)) {
                mapa.putIfAbsent(a.usuarioId(), a);
            }
        }
        return mapa;
    }

    /** Nome e apelido como o visualizador vê; {@code ehAluno} = aluno ativo e não anonimizado (o perfil dele abre). */
    private record AutorNoMural(String nome, String apelido, boolean ehAluno) {}

    /**
     * Autor aluno: para a equipe, o nome gravado + o apelido atual (só ativo); para outro aluno, o nome montado por
     * {@link NomeExibido} a partir do aluno de hoje e {@code apelido} nulo (já entrou no nome). Autor da equipe: o nome gravado.
     */
    private static AutorNoMural autorDe(Map<UUID, VotanteDaComunidade> alunos, UUID autorId, String nomeGravado, boolean paraAluno) {
        VotanteDaComunidade a = alunos.get(autorId);
        if (a == null) {
            return new AutorNoMural(nomeGravado, null, false);
        }
        NomeExibido.Nome n = NomeExibido.doAluno(paraAluno, a, nomeGravado);
        return new AutorNoMural(n.nome(), n.apelido(), a.ativo() && a.anonimizadoEm() == null);
    }

    private static ComentarioResponse comentario(UUID id, UUID autorId, String nomeGravado, String fotoUrl, String texto,
                                                 java.time.Instant criadoEm, boolean daEquipe,
                                                 Map<UUID, VotanteDaComunidade> alunos, boolean paraAluno) {
        AutorNoMural a = autorDe(alunos, autorId, nomeGravado, paraAluno);
        return new ComentarioResponse(id, autorId, a.nome(), a.apelido(), a.ehAluno(), fotoUrl, texto, criadoEm, daEquipe);
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
     * A posição do próprio aluno entre os ativos da consultoria (empate divide a posição) e quantos são, mais o XP e o nível dele.
     * Não há apelido público nem opt-in, então nada de outro aluno (nome, id, contagem) sai daqui. O ranking de força saiu: carga
     * nunca se inventa. Grava as conquistas devidas antes (como {@code GET /conquistas}), porque o XP conta as já gravadas.
     */
    public RankingResponse obterRanking(UUID alunoId) {
        if (alunos.findById(alunoId).isEmpty()) {
            throw new NaoEncontradoException("Aluno não encontrado.");
        }
        avaliarConquistas(alunoId);
        long treinos = sessoes.countByAlunoIdAndSituacaoAndConcluidaTrue(alunoId, "ACEITO");
        long adiante = alunos.contarAtivosComMaisTreinosConcluidos(treinos);
        RegrasXp.Xp pontos = xp.doAluno(alunoId);
        return new RankingResponse((int) (adiante + 1), (int) treinos, (int) treinos * 10, alunos.countByAtivoTrue(),
                pontos.nivel(), pontos.xp(), pontos.xpNoNivel(), pontos.faltam());
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
                aluno.getPerfilMoldura() == null ? null : aluno.getPerfilMoldura().name(),
                aluno.getExibicaoDoNome() == null ? null : aluno.getExibicaoDoNome().name());
        // Só o nome do próprio pod; a lista de membros é dado de terceiros e nunca sai.
        PodExportado pod = aluno.getPodId() == null ? null
                : pods.findById(aluno.getPodId()).map(p -> new PodExportado(p.getNome())).orElse(null);
        UUID usuarioId = aluno.getUsuarioId();
        if (usuarioId == null) {
            return new ComunidadeExportada(aluno.getApelido(), perfil, pod, List.of(), List.of(), List.of(), List.of(), List.of(), List.of(),
                    List.of(), minhasConquistas, false);
        }
        var posts = muralPosts.findTop5000ByAutorIdOrderByCriadoEmDesc(usuarioId).stream()
                .map(p -> new PostExportado(p.getId(), p.getTipo(), p.getTexto(), p.getVideoUrl(), p.isFixado(), p.isOculto(), p.getCriadoEm(),
                        p.getPodId()))
                .toList();
        var deAulas = aulaComentarios.findTop5000ByAutorIdOrderByCriadoEmDesc(usuarioId).stream()
                .map(c -> new ComentarioExportado(c.getId(), c.getAulaId(), c.getTexto(), c.isOculto(), c.getCriadoEm()))
                .toList();
        var doMural = muralComentarios.findTop5000ByAutorIdOrderByCriadoEmDesc(usuarioId).stream()
                .map(c -> new ComentarioExportado(c.getId(), c.getPostId(), c.getTexto(), c.isOculto(), c.getCriadoEm()))
                .toList();
        var reacoesDadas = muralReacoes.findTop5000ByUsuarioIdOrderByCriadoEmDesc(usuarioId).stream()
                .map(r -> new ReacaoExportada(r.getPostId(), r.getCodigo(), r.getCriadoEm()))
                .toList();
        var votos = enquetes.exportar(usuarioId);
        // Só metadados da foto (a imagem não sai) e as denúncias que ele fez; as feitas contra ele não são dele.
        var fotosEnviadas = fotos.findTop5000ByAutorIdOrderByCriadoEmDesc(usuarioId).stream()
                .map(f -> new FotoExportada(f.getId(), f.getPostId(), f.getTamanho(), f.getCriadoEm()))
                .toList();
        var denunciasFeitas = denuncias.findTop5000ByUsuarioIdOrderByCriadoEmDesc(usuarioId).stream()
                .map(d -> new DenunciaExportada(d.getPostId(), d.getMotivo(), d.getCriadoEm()))
                .toList();
        boolean truncado = fotosEnviadas.size() == LIMITE_DA_EXPORTACAO || denunciasFeitas.size() == LIMITE_DA_EXPORTACAO
                || posts.size() == LIMITE_DA_EXPORTACAO || deAulas.size() == LIMITE_DA_EXPORTACAO
                || doMural.size() == LIMITE_DA_EXPORTACAO || reacoesDadas.size() == LIMITE_DA_EXPORTACAO
                || votos.size() == LIMITE_DA_EXPORTACAO;
        return new ComunidadeExportada(aluno.getApelido(), perfil, pod, posts, deAulas, doMural, reacoesDadas, votos, fotosEnviadas,
                denunciasFeitas, minhasConquistas, truncado);
    }
}
