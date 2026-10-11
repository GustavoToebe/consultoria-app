package br.com.treinos.api.equipe;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Sem usuário autenticado nada é permitido: a verificação nega por padrão. */
class AcessoAtualTest {

    @AfterEach
    void limpar() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void semAutenticacaoNegaEExigirLancaAcessoNegado() {
        SecurityContextHolder.clearContext();
        assertThat(AcessoAtual.pode("ALUNO_SENSIVEL_LER")).isFalse();
        assertThatThrownBy(() -> AcessoAtual.exigir("ALUNO_SENSIVEL_ALTERAR")).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void comAutenticacaoSoPermiteAsAutoridadesDoUsuario() {
        var contexto = SecurityContextHolder.createEmptyContext();
        contexto.setAuthentication(new UsernamePasswordAuthenticationToken("fulano", null,
                List.of(new SimpleGrantedAuthority("PERM_ALUNO_LER"))));
        SecurityContextHolder.setContext(contexto);
        assertThat(AcessoAtual.pode("ALUNO_LER")).isTrue();
        assertThat(AcessoAtual.pode("ALUNO_SENSIVEL_LER")).isFalse();
        AcessoAtual.exigir("ALUNO_LER");
        assertThatThrownBy(() -> AcessoAtual.exigir("ALUNO_SENSIVEL_LER")).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void comoSistemaConcedeSoOsDadosSensiveisDentroDoBlocoERestauraOContexto() {
        SecurityContextHolder.clearContext();
        boolean dentro = AcessoAtual.comoSistema(() -> {
            AcessoAtual.exigir("ALUNO_SENSIVEL_ALTERAR");
            assertThat(AcessoAtual.pode("ALUNO_SENSIVEL_LER")).isTrue();
            assertThat(AcessoAtual.pode("EQUIPE_LER")).isFalse();
            return true;
        });
        assertThat(dentro).isTrue();
        assertThat(AcessoAtual.pode("ALUNO_SENSIVEL_LER")).isFalse();
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        assertThatThrownBy(() -> AcessoAtual.comoSistema(() -> {
            throw new IllegalStateException("falha do seed");
        })).isInstanceOf(IllegalStateException.class);
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }
}
