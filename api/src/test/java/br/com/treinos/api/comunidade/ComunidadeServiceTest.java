package br.com.treinos.api.comunidade;

import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.auth.Usuario;
import br.com.treinos.api.auth.UsuarioRepository;
import br.com.treinos.api.comunidade.dto.ComunidadeDtos.*;
import br.com.treinos.api.security.UsuarioAutenticado;
import br.com.treinos.api.sessoesconcluidas.SessaoConcluida;
import br.com.treinos.api.sessoesconcluidas.SessaoConcluidaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
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

    private ComunidadeService service;
    private final UUID consultoriaId = UUID.randomUUID();
    private final UUID usuarioId = UUID.randomUUID();
    private final UUID alunoId = UUID.randomUUID();
    private UsuarioAutenticado eu;

    @BeforeEach
    void setUp() {
        service = new ComunidadeService(aulas, aulaComentarios, muralPosts, muralReacoes, muralComentarios,
                conquistas, alunos, sessoes, usuarios);
        eu = new UsuarioAutenticado(usuarioId, consultoriaId, "ALUNO", alunoId);
    }

    @Test
    void criarEListarAulas() {
        CriarAulaRequest req = new CriarAulaRequest("Aulão de Periodização", "Descrição", "https://youtube.com/watch?v=123",
                null, "Treino", 1, true);
        AulaResumo resumo = service.criarAula(req);

        assertThat(resumo.titulo()).isEqualTo("Aulão de Periodização");
        assertThat(resumo.videoUrl()).isEqualTo("https://youtube.com/watch?v=123");
        verify(aulas).saveAndFlush(any(ComunidadeAula.class));
    }

    @Test
    void criarPostEReagirMural() {
        when(usuarios.findById(usuarioId)).thenReturn(Optional.of(mock(Usuario.class)));
        CriarPostRequest req = new CriarPostRequest("Treino concluído hoje!", null);

        MuralPostResponse post = service.criarPostMural(req, eu);
        assertThat(post.texto()).isEqualTo("Treino concluído hoje!");
        verify(muralPosts).saveAndFlush(any(ComunidadeMuralPost.class));

        UUID postId = UUID.randomUUID();
        when(muralReacoes.findByPostIdAndUsuarioIdAndEmoji(postId, usuarioId, "🔥")).thenReturn(Optional.empty());

        service.alternarReacaoMural(postId, "🔥", eu);
        verify(muralReacoes).saveAndFlush(any(ComunidadeMuralReacao.class));
    }

    @Test
    void avaliarEDesbloquearConquistas() {
        when(sessoes.countByAlunoIdAndSituacaoAndConcluidaTrue(alunoId, "ACEITO")).thenReturn(10L);
        when(conquistas.existsByAlunoIdAndTipo(eq(alunoId), any())).thenReturn(false);

        service.avaliarConquistas(alunoId);

        verify(conquistas).saveAndFlush(argThat(c -> c.getTipo().equals("PRIMEIRO_TREINO")));
        verify(conquistas).saveAndFlush(argThat(c -> c.getTipo().equals("TREINOS_10")));
    }
}
