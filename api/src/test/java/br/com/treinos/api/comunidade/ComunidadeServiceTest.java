package br.com.treinos.api.comunidade;

import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.auth.Usuario;
import br.com.treinos.api.auth.UsuarioRepository;
import br.com.treinos.api.comunidade.dto.ComunidadeDtos.*;
import br.com.treinos.api.security.UsuarioAutenticado;
import br.com.treinos.api.sessoesconcluidas.SessaoConcluidaRepository;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.web.ValidacaoException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ComunidadeServiceTest {

    @Mock private ComunidadeAulaRepository aulas;
    @Mock private ComunidadeAulaComentarioRepository aulaComentarios;
    @Mock private ComunidadeMuralPostRepository muralPosts;
    @Mock private ComunidadeMuralReacaoRepository muralReacoes;
    @Mock private ComunidadeMuralComentarioRepository muralComentarios;
    @Mock private ConquistaAlunoRepository conquistas;
    @Mock private AlunoRepository alunos;
    @Mock private SessaoConcluidaRepository sessoes;
    @Mock private UsuarioRepository usuarios;
    @Mock private ComunidadeMuralFotoRepository fotos;
    @Mock private ComunidadeMuralDenunciaRepository denuncias;
    @Mock private ConfiguracaoDaComunidadeService configuracao;

    private ComunidadeService service;
    private final UUID consultoriaId = UUID.randomUUID();
    private final UUID usuarioId = UUID.randomUUID();
    private final UUID alunoId = UUID.randomUUID();
    private UsuarioAutenticado eu;

    @BeforeEach
    void setUp() {
        service = new ComunidadeService(aulas, aulaComentarios, muralPosts, muralReacoes, muralComentarios,
                conquistas, alunos, sessoes, usuarios, fotos, denuncias, configuracao);
        eu = new UsuarioAutenticado(usuarioId, consultoriaId, "ALUNO", alunoId);
    }

    private CriarAulaRequest aula(String video, String miniatura) {
        return new CriarAulaRequest("Aulão de Periodização", "Descrição", video, miniatura, "Treino", 1, true);
    }

    @Test
    void categoriaDeAulaSemEspacosNasPontasEVazioViraNulo() {
        assertThat(ComunidadeService.categoriaLimpa(null)).isNull();
        assertThat(ComunidadeService.categoriaLimpa("   ")).isNull();
        assertThat(ComunidadeService.categoriaLimpa("  Mobilidade   de  ombro ")).isEqualTo("Mobilidade de ombro");
    }

    @Test
    void criarAulaComLinksHttps() {
        AulaResumo resumo = service.criarAula(aula("https://youtube.com/watch?v=123", null));

        assertThat(resumo.titulo()).isEqualTo("Aulão de Periodização");
        assertThat(resumo.videoUrl()).isEqualTo("https://youtube.com/watch?v=123");
        verify(aulas).saveAndFlush(any(ComunidadeAula.class));
    }

    @Test
    void linkForaDoHttpsDa422NoCampoESemGravar() {
        for (String ruim : List.of("javascript:alert(1)", "http://exemplo.test/v", "ftp://exemplo.test/v", "https://u:s@exemplo.test/v")) {
            assertThatThrownBy(() -> service.criarAula(aula(ruim, null)))
                    .isInstanceOfSatisfying(ValidacaoException.class, e -> {
                        assertThat(e.getProblemas()).hasSize(1);
                        assertThat(e.getProblemas().get(0).field()).isEqualTo("videoUrl");
                        assertThat(e.getMessage()).doesNotContain(ruim);
                    });
        }
        assertThatThrownBy(() -> service.criarAula(aula("https://youtube.com/watch?v=1", "http://exemplo.test/m.png")))
                .isInstanceOfSatisfying(ValidacaoException.class,
                        e -> assertThat(e.getProblemas().get(0).field()).isEqualTo("miniaturaUrl"));
        verify(aulas, never()).saveAndFlush(any());
    }

    @Test
    void criarPostGravaComNomeDoUsuarioEVideoSoHttpsDaEquipe() {
        Usuario usuario = mock(Usuario.class);
        when(usuario.getNome()).thenReturn("Aluno Fictício");
        when(usuarios.findById(usuarioId)).thenReturn(Optional.of(usuario));

        MuralPostResponse post = service.criarPostMural(new CriarPostRequest(null, "Treino concluído hoje!", null, null), eu);

        assertThat(post.texto()).isEqualTo("Treino concluído hoje!");
        assertThat(post.autorNome()).isEqualTo("Aluno Fictício");
        verify(muralPosts).saveAndFlush(any(ComunidadeMuralPost.class));

        assertThat(post.tipo()).isEqualTo("CONVERSA");
        UsuarioAutenticado equipe = new UsuarioAutenticado(UUID.randomUUID(), consultoriaId, "TREINADOR", null);
        assertThatThrownBy(() -> service.criarPostMural(new CriarPostRequest("VIDEO", "Oi", "http://exemplo.test/v", null), equipe))
                .isInstanceOfSatisfying(ValidacaoException.class, e -> {
                    assertThat(e.getProblemas().get(0).field()).isEqualTo("videoUrl");
                    assertThat(e.getMessage()).doesNotContain("exemplo.test");
                });
        // Aluno não publica vídeo nem aviso, e só vídeo leva link.
        for (String tipo : List.of("VIDEO", "AVISO", "NAO_EXISTE")) {
            assertThatThrownBy(() -> service.criarPostMural(new CriarPostRequest(tipo, "Oi", null, null), eu))
                    .isInstanceOfSatisfying(ValidacaoException.class,
                            e -> assertThat(e.getProblemas().get(0).field()).isEqualTo("tipo"));
        }
        assertThatThrownBy(() -> service.criarPostMural(new CriarPostRequest("DUVIDA", "Oi", "https://exemplo.test/v", null), eu))
                .isInstanceOfSatisfying(ValidacaoException.class,
                        e -> assertThat(e.getProblemas().get(0).field()).isEqualTo("videoUrl"));
        verify(muralPosts, times(1)).saveAndFlush(any());
    }

    @Test
    void reagirAlternaNoPostVisivel() {
        UUID postId = UUID.randomUUID();
        ComunidadeMuralPost post = mock(ComunidadeMuralPost.class);
        when(post.isOculto()).thenReturn(false);
        when(muralPosts.findById(postId)).thenReturn(Optional.of(post));
        when(muralReacoes.findByPostIdAndUsuarioIdAndEmoji(postId, usuarioId, "🔥")).thenReturn(Optional.empty());

        service.alternarReacaoMural(postId, "🔥", eu);

        verify(muralReacoes).saveAndFlush(any(ComunidadeMuralReacao.class));
    }

    @Test
    void postDeOutraConsultoriaOuOcultoDa404EntraNadaNoBanco() {
        UUID deOutra = UUID.randomUUID();
        UUID oculto = UUID.randomUUID();
        ComunidadeMuralPost postOculto = mock(ComunidadeMuralPost.class);
        when(postOculto.isOculto()).thenReturn(true);
        when(muralPosts.findById(deOutra)).thenReturn(Optional.empty());
        when(muralPosts.findById(oculto)).thenReturn(Optional.of(postOculto));

        for (UUID id : List.of(deOutra, oculto)) {
            assertThatThrownBy(() -> service.alternarReacaoMural(id, "🔥", eu)).isInstanceOf(NaoEncontradoException.class);
            assertThatThrownBy(() -> service.adicionarComentarioMural(id, "Oi", eu)).isInstanceOf(NaoEncontradoException.class);
            assertThatThrownBy(() -> service.listarComentariosMural(id, null, null)).isInstanceOf(NaoEncontradoException.class);
            assertThatThrownBy(() -> service.fixarPost(id)).isInstanceOf(NaoEncontradoException.class);
        }
        verify(muralReacoes, never()).saveAndFlush(any());
        verify(muralComentarios, never()).saveAndFlush(any());
    }

    @Test
    void moderacaoDeRecursoInexistenteDa404EmVezDe204Mudo() {
        UUID id = UUID.randomUUID();
        when(muralPosts.findById(id)).thenReturn(Optional.empty());
        when(muralComentarios.findById(id)).thenReturn(Optional.empty());
        when(aulaComentarios.findById(id)).thenReturn(Optional.empty());
        when(aulas.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.moderarPost(id)).isInstanceOf(NaoEncontradoException.class);
        assertThatThrownBy(() -> service.moderarComentarioMural(id)).isInstanceOf(NaoEncontradoException.class);
        assertThatThrownBy(() -> service.excluirComentarioAula(id)).isInstanceOf(NaoEncontradoException.class);
        assertThatThrownBy(() -> service.excluirAula(id)).isInstanceOf(NaoEncontradoException.class);
        verify(aulas, never()).delete(any());
    }

    @Test
    void comentarAulaExigeAulaDaConsultoriaEPublicadaParaOAluno() {
        UUID deOutra = UUID.randomUUID();
        UUID rascunho = UUID.randomUUID();
        ComunidadeAula aulaRascunho = mock(ComunidadeAula.class);
        when(aulaRascunho.isPublicada()).thenReturn(false);
        when(aulas.findById(deOutra)).thenReturn(Optional.empty());
        when(aulas.findById(rascunho)).thenReturn(Optional.of(aulaRascunho));

        assertThatThrownBy(() -> service.adicionarComentarioAula(deOutra, "Dúvida", eu)).isInstanceOf(NaoEncontradoException.class);
        assertThatThrownBy(() -> service.adicionarComentarioAula(rascunho, "Dúvida", eu)).isInstanceOf(NaoEncontradoException.class);
        assertThatThrownBy(() -> service.listarComentariosAula(rascunho, eu, null, null)).isInstanceOf(NaoEncontradoException.class);
        verify(aulaComentarios, never()).saveAndFlush(any());

        // A equipe enxerga o rascunho da própria consultoria.
        UsuarioAutenticado equipe = new UsuarioAutenticado(usuarioId, consultoriaId, "TREINADOR", null);
        when(usuarios.findById(usuarioId)).thenReturn(Optional.empty());
        service.adicionarComentarioAula(rascunho, "Resposta", equipe);
        verify(aulaComentarios).saveAndFlush(any(ComunidadeAulaComentario.class));
    }

    @Test
    void rankingDevolveSoAPosicaoDoProprioAluno() {
        when(alunos.findById(alunoId)).thenReturn(Optional.of(mock(Aluno.class)));
        when(sessoes.countByAlunoIdAndSituacaoAndConcluidaTrue(alunoId, "ACEITO")).thenReturn(7L);
        when(alunos.contarAtivosComMaisTreinosConcluidos(7L)).thenReturn(2L);
        when(alunos.countByAtivoTrue()).thenReturn(9L);

        RankingResponse r = service.obterRanking(alunoId);

        assertThat(r).isEqualTo(new RankingResponse(3, 7, 70, 9));
    }

    @Test
    void avaliarEDesbloquearConquistas() {
        when(sessoes.countByAlunoIdAndSituacaoAndConcluidaTrue(alunoId, "ACEITO")).thenReturn(10L);
        when(conquistas.existsByAlunoIdAndTipo(eq(alunoId), any())).thenReturn(false);

        service.avaliarConquistas(alunoId);

        verify(conquistas).saveAndFlush(argThat(c -> c.getTipo().equals("PRIMEIRO_TREINO")));
        verify(conquistas).saveAndFlush(argThat(c -> c.getTipo().equals("TREINOS_10")));
    }

    @Test
    void exportarSemUsuarioDevolveSoAsConquistas() {
        Aluno aluno = mock(Aluno.class);
        when(aluno.getUsuarioId()).thenReturn(null);
        when(alunos.findById(alunoId)).thenReturn(Optional.of(aluno));
        when(conquistas.findByAlunoIdOrderByConquistadaEmDesc(alunoId)).thenReturn(List.of());

        ComunidadeExportada e = service.exportarDoAluno(alunoId);

        assertThat(e.posts()).isEmpty();
        assertThat(e.reacoes()).isEmpty();
        verifyNoInteractions(muralPosts, muralReacoes, muralComentarios, aulaComentarios);
    }
}
