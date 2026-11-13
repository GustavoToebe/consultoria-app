package br.com.treinos.api.comunidade;

import br.com.plataforma.comum.web.ApiError;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.alunos.VotanteDaComunidade;
import br.com.treinos.api.auth.Usuario;
import br.com.treinos.api.auth.UsuarioRepository;
import br.com.treinos.api.comunidade.dto.ComunidadeDtos.EnqueteResponse;
import br.com.treinos.api.comunidade.dto.ComunidadeDtos.OpcaoComVotos;
import br.com.treinos.api.comunidade.dto.ComunidadeDtos.OpcaoDaEnquete;
import br.com.treinos.api.comunidade.dto.ComunidadeDtos.PaginaDeVotantes;
import br.com.treinos.api.comunidade.dto.ComunidadeDtos.Votante;
import br.com.treinos.api.comunidade.dto.ComunidadeDtos.VotanteDaAmostra;
import br.com.treinos.api.comunidade.dto.ComunidadeDtos.VotoExportado;
import br.com.treinos.api.comunidade.dto.ComunidadeDtos.VotosDaEnquete;
import br.com.treinos.api.security.UsuarioAutenticado;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.data.domain.Page;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Enquete do mural com voto identificado (D1 a D5). A enquete é um post {@code ENQUETE} imutável: pergunta no {@code texto},
 * 2 a 6 opções, escolha única ou várias, prazo opcional. Votar substitui o conjunto de opções do usuário sob trava da linha do
 * post: opção mantida conserva o {@code votado_em}, opção nova recebe o instante da alteração, retirada é apagada, e reenviar o
 * mesmo conjunto não escreve nada. Nenhum histórico de votos anteriores, de acesso ou de navegação é guardado. Texto de pergunta,
 * opção e voto nunca vão a log.
 */
@Service
@Transactional
public class EnquetesDoMuralService {

    static final int MINIMO_DE_OPCOES = 2;
    static final int MAXIMO_DE_OPCOES = 6;
    static final int TEXTO_MAXIMO = 80;
    static final int AMOSTRA = 3;

    private final ComunidadeMuralPostRepository posts;
    private final ComunidadeEnqueteOpcaoRepository opcoes;
    private final ComunidadeEnqueteVotoRepository votos;
    private final AlunoRepository alunos;
    private final UsuarioRepository usuarios;
    private final ColegasDaComunidadeService colegas;

    public EnquetesDoMuralService(ComunidadeMuralPostRepository posts, ComunidadeEnqueteOpcaoRepository opcoes,
                                  ComunidadeEnqueteVotoRepository votos, AlunoRepository alunos, UsuarioRepository usuarios,
                                  ColegasDaComunidadeService colegas) {
        this.posts = posts;
        this.opcoes = opcoes;
        this.votos = votos;
        this.alunos = alunos;
        this.usuarios = usuarios;
        this.colegas = colegas;
    }

    // ---- criação ----

    /**
     * Confere as opções (2 a 6, 1 a 80 caracteres depois do strip, sem repetir, ignorando maiúsculas) e devolve-as já limpas;
     * o que estiver fora da regra entra em {@code erros} no campo {@code opcoes}, sem repetir o texto. O limite usa
     * {@code String.length()}, nunca mais frouxo que o {@code char_length} do banco.
     */
    static List<String> opcoesLimpas(List<String> pedidas, List<ApiError.FieldError> erros) {
        if (pedidas == null || pedidas.size() < MINIMO_DE_OPCOES || pedidas.size() > MAXIMO_DE_OPCOES) {
            erros.add(new ApiError.FieldError("opcoes", "Use de " + MINIMO_DE_OPCOES + " a " + MAXIMO_DE_OPCOES + " opções."));
            return List.of();
        }
        List<String> limpas = new ArrayList<>();
        Set<String> vistas = new HashSet<>();
        for (String o : pedidas) {
            String limpa = o == null ? "" : o.strip();
            if (limpa.isEmpty() || limpa.length() > TEXTO_MAXIMO) {
                erros.add(new ApiError.FieldError("opcoes", "Cada opção tem de 1 a " + TEXTO_MAXIMO + " caracteres."));
                return List.of();
            }
            if (!vistas.add(limpa.toLowerCase(Locale.ROOT))) {
                erros.add(new ApiError.FieldError("opcoes", "Não repita opções."));
                return List.of();
            }
            limpas.add(limpa);
        }
        return limpas;
    }

    /** O prazo, se vier, é um instante futuro e no máximo 1 ano à frente. */
    static void conferirPrazo(Instant encerraEm, List<ApiError.FieldError> erros) {
        Instant agora = Instant.now();
        if (encerraEm != null && (!encerraEm.isAfter(agora) || encerraEm.isAfter(agora.atZone(ZoneOffset.UTC).plusYears(1).toInstant()))) {
            erros.add(new ApiError.FieldError("encerraEm", "O prazo tem de ser daqui para frente e em até 1 ano."));
        }
    }

    /** Grava as opções do post recém-criado (já validadas por {@link #opcoesLimpas}), na ordem recebida. */
    public void criarOpcoes(UUID postId, List<String> textos) {
        List<ComunidadeEnqueteOpcao> novas = new ArrayList<>();
        for (int i = 0; i < textos.size(); i++) {
            novas.add(new ComunidadeEnqueteOpcao(postId, i, textos.get(i)));
        }
        opcoes.saveAllAndFlush(novas);
    }

    // ---- votar ----

    /**
     * Substitui o conjunto de opções do usuário (vazio retira o voto). Ordem das recusas: 404 (post de outra consultoria, oculto
     * ou que não é enquete), 409 {@code ENQUETE_ENCERRADA} (também para retirar), 422 {@code VOTO_INVALIDO}. A linha do post é
     * travada primeiro e o voto atual só é lido depois, então dois pedidos do mesmo usuário se serializam e o último vale.
     * Devolve a enquete como o mural a mostra.
     */
    public EnqueteResponse votar(UUID postId, List<UUID> pedidas, UsuarioAutenticado eu) {
        ComunidadeMuralPost post = posts.travar(postId).filter(EnquetesDoMuralService::eEnqueteVisivel)
                .orElseThrow(() -> new NaoEncontradoException("Post não encontrado."));
        Instant agora = Instant.now().truncatedTo(ChronoUnit.MICROS);
        if (encerrada(post, agora)) {
            throw new ConflictException("A enquete foi encerrada.", "ENQUETE_ENCERRADA");
        }
        List<UUID> escolhidas = pedidas == null ? List.of() : pedidas;
        Set<UUID> doPost = opcoes.findByPostIdOrderByOrdemAsc(postId).stream().map(ComunidadeEnqueteOpcao::getId)
                .collect(Collectors.toSet());
        boolean varias = Boolean.TRUE.equals(post.getEnqueteVariasRespostas());
        if (pedidas == null || escolhidas.size() > MAXIMO_DE_OPCOES || escolhidas.stream().anyMatch(Objects::isNull)
                || new HashSet<>(escolhidas).size() != escolhidas.size() || (!varias && escolhidas.size() > 1)
                || !doPost.containsAll(escolhidas)) {
            throw new ValidacaoException("Confira o voto.", "VOTO_INVALIDO",
                    List.of(new ApiError.FieldError("opcaoIds", "Escolha as opções desta enquete.")));
        }
        // Diferença de conjuntos: só escreve o que mudou, então o horário de quem não mudou fica como estava.
        List<ComunidadeEnqueteVoto> atuais = votos.findByPostIdAndUsuarioId(postId, eu.usuarioId());
        Set<UUID> pedidasSet = new HashSet<>(escolhidas);
        Set<UUID> jaTem = atuais.stream().map(ComunidadeEnqueteVoto::getOpcaoId).collect(Collectors.toSet());
        List<ComunidadeEnqueteVoto> retirar = atuais.stream().filter(v -> !pedidasSet.contains(v.getOpcaoId())).toList();
        List<ComunidadeEnqueteVoto> novos = escolhidas.stream().filter(o -> !jaTem.contains(o))
                .map(o -> new ComunidadeEnqueteVoto(postId, o, eu.usuarioId(), agora)).toList();
        if (!retirar.isEmpty()) {
            votos.deleteAll(retirar);
        }
        if (!novos.isEmpty()) {
            votos.saveAll(novos);
        }
        votos.flush();
        return resumos(List.of(post), eu).get(postId);
    }

    // ---- leitura ----

    /**
     * A enquete de cada post {@code ENQUETE} da lista, em consultas agrupadas por página (opções, contagens, participantes, meus
     * votos e a amostra), sem N+1; os outros tipos não entram no mapa.
     * shortcut: a amostra de votantes carrega todos os votos das enquetes da página e corta 3 por opção em memória; trocar por
     * {@code row_number()} na consulta quando uma enquete passar de alguns milhares de votos.
     */
    @Transactional(readOnly = true)
    public Map<UUID, EnqueteResponse> resumos(List<ComunidadeMuralPost> doMural, UsuarioAutenticado eu) {
        List<ComunidadeMuralPost> enquetes = doMural.stream().filter(p -> TipoDePost.ENQUETE.name().equals(p.getTipo())).toList();
        if (enquetes.isEmpty()) {
            return Map.of();
        }
        List<UUID> ids = enquetes.stream().map(ComunidadeMuralPost::getId).toList();
        Map<UUID, List<ComunidadeEnqueteOpcao>> opcoesDosPosts = opcoes.findByPostIdInOrderByPostIdAscOrdemAsc(ids).stream()
                .collect(Collectors.groupingBy(ComunidadeEnqueteOpcao::getPostId, LinkedHashMap::new, Collectors.toList()));
        Map<UUID, Long> votosDasOpcoes = new HashMap<>();
        votos.contagensDasOpcoes(ids).forEach(c -> votosDasOpcoes.put(c.getOpcaoId(), c.getTotal()));
        Map<UUID, Long> participantes = new HashMap<>();
        votos.participantes(ids).forEach(c -> participantes.put(c.getPostId(), c.getTotal()));
        Set<UUID> meus = votos.doUsuario(ids, eu.usuarioId()).stream()
                .map(ComunidadeEnqueteVotoRepository.VotoDoUsuario::getOpcaoId).collect(Collectors.toSet());
        Map<UUID, List<UUID>> amostraDasOpcoes = new HashMap<>();
        for (var v : votos.recentes(ids)) {
            List<UUID> amostra = amostraDasOpcoes.computeIfAbsent(v.getOpcaoId(), k -> new ArrayList<>());
            if (amostra.size() < AMOSTRA) {
                amostra.add(v.getUsuarioId());
            }
        }
        Map<UUID, Identidade> quem = identidades(amostraDasOpcoes.values().stream().flatMap(List::stream).collect(Collectors.toSet()),
                eu.usuarioId());
        Instant agora = Instant.now();
        Map<UUID, EnqueteResponse> respostas = new HashMap<>();
        for (ComunidadeMuralPost p : enquetes) {
            List<ComunidadeEnqueteOpcao> doPost = opcoesDosPosts.getOrDefault(p.getId(), List.of());
            List<OpcaoDaEnquete> opcoesDaResposta = doPost.stream()
                    .map(o -> new OpcaoDaEnquete(o.getId(), o.getTexto(), votosDasOpcoes.getOrDefault(o.getId(), 0L),
                            amostraDasOpcoes.getOrDefault(o.getId(), List.of()).stream()
                                    .map(u -> quem.getOrDefault(u, Identidade.DESCONHECIDA).daAmostra(u)).toList()))
                    .toList();
            respostas.put(p.getId(), new EnqueteResponse(Boolean.TRUE.equals(p.getEnqueteVariasRespostas()), encerrada(p, agora),
                    p.getEnqueteEncerraEm(), opcoesDaResposta,
                    doPost.stream().map(ComunidadeEnqueteOpcao::getId).filter(meus::contains).toList(),
                    participantes.getOrDefault(p.getId(), 0L)));
        }
        return respostas;
    }

    /**
     * "Mostrar votos": a pergunta, os participantes únicos, a contagem por opção e uma página de votantes (um item por voto,
     * {@code votado_em desc, id}), filtrada por {@code opcaoId} se vier. Post de outra consultoria, oculto, que não é enquete ou
     * opção que não é do post = 404.
     */
    @Transactional(readOnly = true)
    public VotosDaEnquete votos(UUID postId, UUID opcaoId, Integer pagina, Integer tamanho, UsuarioAutenticado eu) {
        ComunidadeMuralPost post = posts.findById(postId).filter(EnquetesDoMuralService::eEnqueteVisivel)
                .orElseThrow(() -> new NaoEncontradoException("Post não encontrado."));
        List<ComunidadeEnqueteOpcao> doPost = opcoes.findByPostIdOrderByOrdemAsc(postId);
        if (opcaoId != null && doPost.stream().noneMatch(o -> o.getId().equals(opcaoId))) {
            throw new NaoEncontradoException("Opção não encontrada.");
        }
        var daPagina = ComunidadeService.paginar(pagina, tamanho);
        Page<ComunidadeEnqueteVoto> pg = opcaoId == null
                ? votos.findByPostIdOrderByVotadoEmDescIdAsc(postId, daPagina)
                : votos.findByPostIdAndOpcaoIdOrderByVotadoEmDescIdAsc(postId, opcaoId, daPagina);
        Map<UUID, Identidade> quem = identidades(pg.getContent().stream().map(ComunidadeEnqueteVoto::getUsuarioId)
                .collect(Collectors.toSet()), eu.usuarioId());
        Map<UUID, Long> votosDasOpcoes = new HashMap<>();
        votos.contagensDasOpcoes(List.of(postId)).forEach(c -> votosDasOpcoes.put(c.getOpcaoId(), c.getTotal()));
        long participantes = votos.participantes(List.of(postId)).stream().mapToLong(c -> c.getTotal()).sum();
        List<Votante> itens = pg.getContent().stream().map(v -> {
            Identidade i = quem.getOrDefault(v.getUsuarioId(), Identidade.DESCONHECIDA);
            return new Votante(v.getUsuarioId(), v.getOpcaoId(), i.nome(), i.apelido(), i.temFoto(), v.getVotadoEm(),
                    v.getUsuarioId().equals(eu.usuarioId()));
        }).toList();
        return new VotosDaEnquete(post.getTexto(), participantes,
                doPost.stream().map(o -> new OpcaoComVotos(o.getId(), o.getTexto(), votosDasOpcoes.getOrDefault(o.getId(), 0L))).toList(),
                new PaginaDeVotantes(itens, pg.getTotalElements()));
    }

    // ---- exportação ----

    /** Os votos do próprio usuário (a opção e o horário em que a escolheu), do mais novo ao mais antigo. */
    @Transactional(readOnly = true)
    public List<VotoExportado> exportar(UUID usuarioId) {
        List<ComunidadeEnqueteVoto> doUsuario = votos.findTop5000ByUsuarioIdOrderByVotadoEmDesc(usuarioId);
        Map<UUID, String> textos = opcoes.findAllById(doUsuario.stream().map(ComunidadeEnqueteVoto::getOpcaoId).collect(Collectors.toSet()))
                .stream().collect(Collectors.toMap(ComunidadeEnqueteOpcao::getId, ComunidadeEnqueteOpcao::getTexto));
        return doUsuario.stream()
                .map(v -> new VotoExportado(v.getPostId(), v.getOpcaoId(), textos.get(v.getOpcaoId()), v.getVotadoEm())).toList();
    }

    // ---- ajudantes ----

    private static boolean eEnqueteVisivel(ComunidadeMuralPost p) {
        return !p.isOculto() && TipoDePost.ENQUETE.name().equals(p.getTipo());
    }

    /** Encerrada = tem prazo e ele já chegou ({@code encerra_em <= agora}). */
    private static boolean encerrada(ComunidadeMuralPost p, Instant agora) {
        return p.getEnqueteEncerraEm() != null && !p.getEnqueteEncerraEm().isAfter(agora);
    }

    /** Nome, apelido e foto de quem votou, como o votante aparece para {@code quemPede}. */
    private record Identidade(String nome, String apelido, boolean temFoto) {
        static final Identidade DESCONHECIDA = new Identidade("Membro", null, false);

        VotanteDaAmostra daAmostra(UUID autorId) {
            return new VotanteDaAmostra(autorId, nome, apelido, temFoto);
        }
    }

    /**
     * Aluno = {@code aluno.nome} com o apelido atual (aluno inativo aparece com o nome, sem apelido e sem foto); equipe =
     * {@code usuario.nome}, sem foto. A foto segue exatamente {@code ColegasDaComunidadeService.foto}. Os ids vêm de linhas de
     * voto já filtradas pela consultoria (o {@code Usuario} não tem {@code @TenantId}).
     */
    private Map<UUID, Identidade> identidades(Collection<UUID> usuarioIds, UUID quemPede) {
        Map<UUID, Identidade> mapa = new HashMap<>();
        if (usuarioIds.isEmpty()) {
            return mapa;
        }
        List<VotanteDaComunidade> deAluno = alunos.votantesDaComunidade(usuarioIds);
        Set<UUID> comFoto = colegas.comFotoVisivel(deAluno, quemPede);
        for (VotanteDaComunidade v : deAluno) {
            boolean ativo = v.ativo() && v.anonimizadoEm() == null;
            mapa.put(v.usuarioId(), new Identidade(v.nome(), ativo ? v.apelido() : null, comFoto.contains(v.usuarioId())));
        }
        Set<UUID> daEquipe = new HashSet<>(usuarioIds);
        daEquipe.removeAll(mapa.keySet());
        if (!daEquipe.isEmpty()) {
            for (Usuario u : usuarios.findAllById(daEquipe)) {
                mapa.put(u.getId(), new Identidade(u.getNome(), null, false));
            }
        }
        return mapa;
    }
}
