package br.com.treinos.api.comunidade;

import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.auth.Usuario;
import br.com.treinos.api.auth.UsuarioRepository;
import br.com.treinos.api.comunidade.dto.ComunidadeDtos.*;
import br.com.treinos.api.security.UsuarioAutenticado;
import br.com.treinos.api.sessoesconcluidas.SessaoConcluida;
import br.com.treinos.api.sessoesconcluidas.SessaoConcluidaRepository;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class ComunidadeService {

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
                .map(a -> new AulaResumo(a.getId(), a.getTitulo(), a.getDescricao(), a.getVideoUrl(), a.getMiniaturaUrl(),
                        a.getCategoria(), a.getOrdem(), a.isPublicada(), a.getCriadaEm(),
                        aulaComentarios.countByAulaIdAndOcultoFalse(a.getId())))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<AulaResumo> listarAulasEquipe() {
        return aulas.findAllByOrderByOrdemAscCriadaEmDesc().stream()
                .map(a -> new AulaResumo(a.getId(), a.getTitulo(), a.getDescricao(), a.getVideoUrl(), a.getMiniaturaUrl(),
                        a.getCategoria(), a.getOrdem(), a.isPublicada(), a.getCriadaEm(),
                        aulaComentarios.countByAulaIdAndOcultoFalse(a.getId())))
                .toList();
    }

    public AulaResumo criarAula(CriarAulaRequest r) {
        ComunidadeAula a = new ComunidadeAula(r.titulo().trim(), r.descricao(), r.videoUrl().trim(),
                r.miniaturaUrl(), r.categoria(), r.ordem() == null ? 0 : r.ordem(),
                r.publicada() == null || r.publicada());
        aulas.saveAndFlush(a);
        return new AulaResumo(a.getId(), a.getTitulo(), a.getDescricao(), a.getVideoUrl(), a.getMiniaturaUrl(),
                a.getCategoria(), a.getOrdem(), a.isPublicada(), a.getCriadaEm(), 0);
    }

    public AulaResumo alterarAula(UUID id, CriarAulaRequest r) {
        ComunidadeAula a = aulas.findById(id).orElseThrow(() -> new NaoEncontradoException("Aula não encontrada."));
        a.atualizar(r.titulo().trim(), r.descricao(), r.videoUrl().trim(), r.miniaturaUrl(), r.categoria(),
                r.ordem() == null ? 0 : r.ordem(), r.publicada() == null || r.publicada());
        aulas.saveAndFlush(a);
        return new AulaResumo(a.getId(), a.getTitulo(), a.getDescricao(), a.getVideoUrl(), a.getMiniaturaUrl(),
                a.getCategoria(), a.getOrdem(), a.isPublicada(), a.getCriadaEm(),
                aulaComentarios.countByAulaIdAndOcultoFalse(a.getId()));
    }

    public void excluirAula(UUID id) {
        aulas.deleteById(id);
    }

    @Transactional(readOnly = true)
    public List<ComentarioResponse> listarComentariosAula(UUID aulaId) {
        return aulaComentarios.findByAulaIdAndOcultoFalseOrderByCriadoEmAsc(aulaId).stream()
                .map(c -> new ComentarioResponse(c.getId(), c.getAutorId(), c.getAutorNome(), c.getAutorFotoUrl(), c.getTexto(), c.getCriadoEm()))
                .toList();
    }

    public ComentarioResponse adicionarComentarioAula(UUID aulaId, String texto, UsuarioAutenticado eu) {
        String nome = usuarios.findById(eu.usuarioId()).map(Usuario::getNome).orElse("Membro");
        ComunidadeAulaComentario c = new ComunidadeAulaComentario(aulaId, eu.usuarioId(), nome, null, texto.trim());
        aulaComentarios.saveAndFlush(c);
        return new ComentarioResponse(c.getId(), c.getAutorId(), c.getAutorNome(), c.getAutorFotoUrl(), c.getTexto(), c.getCriadoEm());
    }

    public void excluirComentarioAula(UUID id) {
        aulaComentarios.findById(id).ifPresent(c -> {
            c.ocultar();
            aulaComentarios.saveAndFlush(c);
        });
    }

    // ---- Mural ----

    @Transactional(readOnly = true)
    public Page<MuralPostResponse> listarMural(Pageable pageable, UsuarioAutenticado eu) {
        Page<ComunidadeMuralPost> page = muralPosts.findByOcultoFalseOrderByFixadoDescCriadoEmDesc(pageable);
        return page.map(p -> {
            List<ComunidadeMuralReacao> reacoes = muralReacoes.findByPostId(p.getId());
            Map<String, Long> contagem = reacoes.stream()
                    .collect(Collectors.groupingBy(ComunidadeMuralReacao::getEmoji, Collectors.counting()));
            List<String> minhas = eu == null ? List.of() : reacoes.stream()
                    .filter(r -> r.getUsuarioId().equals(eu.usuarioId()))
                    .map(ComunidadeMuralReacao::getEmoji)
                    .toList();
            long totalComentarios = muralComentarios.countByPostIdAndOcultoFalse(p.getId());
            return new MuralPostResponse(p.getId(), p.getAutorId(), p.getAutorNome(), p.getAutorFotoUrl(),
                    p.getTexto(), p.getImagemUrl(), p.isFixado(), p.getCriadoEm(), contagem, minhas, totalComentarios);
        });
    }

    public MuralPostResponse criarPostMural(CriarPostRequest r, UsuarioAutenticado eu) {
        String nome = usuarios.findById(eu.usuarioId()).map(Usuario::getNome).orElse("Membro");
        ComunidadeMuralPost post = new ComunidadeMuralPost(eu.usuarioId(), nome, null, r.texto().trim(), r.imagemUrl());
        muralPosts.saveAndFlush(post);
        return new MuralPostResponse(post.getId(), post.getAutorId(), post.getAutorNome(), post.getAutorFotoUrl(),
                post.getTexto(), post.getImagemUrl(), post.isFixado(), post.getCriadoEm(), Map.of(), List.of(), 0);
    }

    public void alternarReacaoMural(UUID postId, String emoji, UsuarioAutenticado eu) {
        var existente = muralReacoes.findByPostIdAndUsuarioIdAndEmoji(postId, eu.usuarioId(), emoji);
        if (existente.isPresent()) {
            muralReacoes.delete(existente.get());
        } else {
            muralReacoes.saveAndFlush(new ComunidadeMuralReacao(postId, eu.usuarioId(), emoji));
        }
    }

    @Transactional(readOnly = true)
    public List<ComentarioResponse> listarComentariosMural(UUID postId) {
        return muralComentarios.findByPostIdAndOcultoFalseOrderByCriadoEmAsc(postId).stream()
                .map(c -> new ComentarioResponse(c.getId(), c.getAutorId(), c.getAutorNome(), c.getAutorFotoUrl(), c.getTexto(), c.getCriadoEm()))
                .toList();
    }

    public ComentarioResponse adicionarComentarioMural(UUID postId, String texto, UsuarioAutenticado eu) {
        String nome = usuarios.findById(eu.usuarioId()).map(Usuario::getNome).orElse("Membro");
        ComunidadeMuralComentario c = new ComunidadeMuralComentario(postId, eu.usuarioId(), nome, null, texto.trim());
        muralComentarios.saveAndFlush(c);
        return new ComentarioResponse(c.getId(), c.getAutorId(), c.getAutorNome(), c.getAutorFotoUrl(), c.getTexto(), c.getCriadoEm());
    }

    public void moderarPost(UUID postId) {
        muralPosts.findById(postId).ifPresent(p -> { p.ocultar(); muralPosts.saveAndFlush(p); });
    }

    public void fixarPost(UUID postId) {
        muralPosts.findById(postId).ifPresent(p -> { p.alternarFixado(); muralPosts.saveAndFlush(p); });
    }

    public void moderarComentarioMural(UUID comentarioId) {
        muralComentarios.findById(comentarioId).ifPresent(c -> { c.ocultar(); muralComentarios.saveAndFlush(c); });
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

    @Transactional(readOnly = true)
    public RankingResponse obterRanking(UUID alunoId) {
        Aluno alunoAtual = alunos.findById(alunoId).orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado."));
        List<Aluno> listaAlunos = alunos.findAll().stream().filter(Aluno::isAtivo).toList();
        List<ItemRanking> constancia = new ArrayList<>();
        for (Aluno a : listaAlunos) {
            long treinos = sessoes.countByAlunoIdAndSituacaoAndConcluidaTrue(a.getId(), "ACEITO");
            int pontuacao = (int) treinos * 10;
            constancia.add(new ItemRanking(a.getId(), a.getNome(), null, pontuacao, (int) treinos, 0, 0));
        }
        constancia.sort(Comparator.comparingInt(ItemRanking::pontuacao).reversed());
        List<ItemRanking> constanciaRanqueada = new ArrayList<>();
        for (int i = 0; i < constancia.size(); i++) {
            ItemRanking item = constancia.get(i);
            constanciaRanqueada.add(new ItemRanking(item.alunoId(), item.alunoNome(), item.fotoUrl(),
                    item.pontuacao(), item.treinosConcluidos(), item.recordesBatidos(), i + 1));
        }

        List<ItemRankingForca> forca = new ArrayList<>();
        if (alunoAtual.isParticipaRankingForca()) {
            for (Aluno a : listaAlunos) {
                if (a.isParticipaRankingForca()) {
                    forca.add(new ItemRankingForca(a.getId(), a.getNome(), null, "Supino / Agachamento", 100.0, 0));
                }
            }
            forca.sort(Comparator.comparingDouble(ItemRankingForca::cargaKg).reversed());
            List<ItemRankingForca> forcaRanqueada = new ArrayList<>();
            for (int i = 0; i < forca.size(); i++) {
                ItemRankingForca it = forca.get(i);
                forcaRanqueada.add(new ItemRankingForca(it.alunoId(), it.alunoNome(), it.fotoUrl(), it.exercicio(), it.cargaKg(), i + 1));
            }
            forca = forcaRanqueada;
        }

        return new RankingResponse(constanciaRanqueada, forca, alunoAtual.isParticipaRankingForca());
    }

    public void alterarOptInForca(UUID alunoId, boolean participa) {
        Aluno a = alunos.findById(alunoId).orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado."));
        a.alterarParticipaRankingForca(participa);
        alunos.saveAndFlush(a);
    }
}
