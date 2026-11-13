package br.com.treinos.api.comunidade;

import br.com.treinos.api.security.UsuarioAutenticado;
import org.hibernate.exception.ConstraintViolationException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import java.sql.SQLException;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Só a violação da chave única da reação vira "já reagiu"; qualquer outra sobe. Repositórios de mentira, sem banco. */
@ExtendWith(MockitoExtension.class)
class ReacoesDoMuralServiceTest {

    @Mock private ComunidadeMuralPostRepository posts;
    @Mock private ComunidadeMuralReacaoRepository reacoes;

    private static DataIntegrityViolationException violacao(String restricao) {
        return new DataIntegrityViolationException("violação fictícia",
                new ConstraintViolationException("violação fictícia", new SQLException("fictícia"), restricao));
    }

    @Test
    void soAChaveUnicaDaReacaoContaComoCorrida() {
        assertThat(ReacoesDoMuralService.violouIndiceUnico(violacao("uk_mural_reacao_usuario"))).isTrue();
        assertThat(ReacoesDoMuralService.violouIndiceUnico(violacao("fk_comunidade_mural_reacao_post"))).isFalse();
        assertThat(ReacoesDoMuralService.violouIndiceUnico(violacao("outra_restricao"))).isFalse();
        assertThat(ReacoesDoMuralService.violouIndiceUnico(violacao(null))).isFalse();
        // Sem causa do Hibernate (nem a mensagem conta), não é a chave única.
        assertThat(ReacoesDoMuralService.violouIndiceUnico(new DataIntegrityViolationException("uk_mural_reacao_usuario"))).isFalse();
        assertThat(ReacoesDoMuralService.violouIndiceUnico(
                new DataIntegrityViolationException("x", new SQLException("uk_mural_reacao_usuario")))).isFalse();
    }

    private ReacoesDoMuralService comSaveQueFalhaCom(DataIntegrityViolationException erro, UUID postId) {
        ComunidadeMuralPost post = mock(ComunidadeMuralPost.class);
        when(post.isOculto()).thenReturn(false);
        when(posts.findById(postId)).thenReturn(Optional.of(post));
        when(reacoes.saveAndFlush(any(ComunidadeMuralReacao.class))).thenThrow(erro);
        return new ReacoesDoMuralService(posts, reacoes);
    }

    @Test
    void reagirEngoleACorridaDaChaveUnica() {
        UUID postId = UUID.randomUUID();
        UsuarioAutenticado eu = new UsuarioAutenticado(UUID.randomUUID(), UUID.randomUUID(), "ALUNO", UUID.randomUUID());

        ReacoesDoMuralService corrida = comSaveQueFalhaCom(violacao("uk_mural_reacao_usuario"), postId);
        assertThatCode(() -> corrida.reagir(postId, "CURTIR", eu)).doesNotThrowAnyException();
    }

    @Test
    void reagirRelancaAViolacaoQueNaoEOIndiceUnico() {
        UUID postId = UUID.randomUUID();
        UsuarioAutenticado eu = new UsuarioAutenticado(UUID.randomUUID(), UUID.randomUUID(), "ALUNO", UUID.randomUUID());
        DataIntegrityViolationException chaveEstrangeira = violacao("fk_comunidade_mural_reacao_post");

        ReacoesDoMuralService service = comSaveQueFalhaCom(chaveEstrangeira, postId);
        assertThatThrownBy(() -> service.reagir(postId, "CURTIR", eu)).isSameAs(chaveEstrangeira);
    }
}
