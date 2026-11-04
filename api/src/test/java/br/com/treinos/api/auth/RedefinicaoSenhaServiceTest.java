package br.com.treinos.api.auth;

import br.com.plataforma.comum.auth.RedefinicaoDeSenha;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.push.PushService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * "Esqueci a senha" e os tokens de push, sem banco: os tokens só saem depois de o módulo gravar a senha (e encerrar as
 * sessões), e uma falha ao apagá-los não derruba a redefinição. A redefinição de verdade, com o banco, está no
 * {@code RedefinicaoSenhaIntegrationTest}.
 */
class RedefinicaoSenhaServiceTest {

    private final RedefinicaoDeSenha modulo = mock(RedefinicaoDeSenha.class);
    private final UsuarioRepository usuarios = mock(UsuarioRepository.class);
    private final Auditoria auditoria = mock(Auditoria.class);
    private final PushService push = mock(PushService.class);
    private final UUID consultoriaId = UUID.randomUUID();
    private final UUID usuarioId = UUID.randomUUID();

    @SuppressWarnings("unchecked")
    private RedefinicaoSenhaService servico() {
        ObjectProvider<RedefinicaoDeSenha> provedor = mock(ObjectProvider.class);
        when(provedor.getIfAvailable()).thenReturn(modulo);
        Usuario usuario = mock(Usuario.class);
        when(usuario.getId()).thenReturn(usuarioId);
        when(usuario.getConsultoriaId()).thenReturn(consultoriaId);
        when(usuarios.buscarParaAlterar(usuarioId)).thenReturn(Optional.of(usuario));
        return new RedefinicaoSenhaService(provedor, usuarios, auditoria, push);
    }

    /** O módulo grava a senha pelo callback do app, como faz depois de conferir link, regra e MFA. */
    private void moduloGrava() {
        doAnswer(chamada -> {
            RedefinicaoDeSenha.TrocaDeSenha troca = chamada.getArgument(5);
            troca.trocar(usuarioId.toString(), "hash-novo");
            return null;
        }).when(modulo).redefinir(anyString(), anyString(), any(), anyString(), any(), any());
    }

    @Test
    void redefinirApagaOsTokensDoUsuarioDepoisDeGravar() {
        RedefinicaoSenhaService servico = servico();
        moduloGrava();

        servico.redefinir("token", "senha-nova-456", null, "127.0.0.1");

        verify(auditoria).senhaRedefinida(any());
        verify(push).apagarDoUsuario(consultoriaId, usuarioId);
    }

    @Test
    void falhaAoApagarOsTokensNaoImpedeARedefinicao() {
        RedefinicaoSenhaService servico = servico();
        moduloGrava();
        doThrow(new IllegalStateException("banco fora")).when(push).apagarDoUsuario(consultoriaId, usuarioId);

        assertThatCode(() -> servico.redefinir("token", "senha-nova-456", null, "127.0.0.1")).doesNotThrowAnyException();
        verify(auditoria).senhaRedefinida(any());
    }

    @Test
    void linkRecusadoPeloModuloNaoApagaNada() {
        RedefinicaoSenhaService servico = servico();
        doThrow(new IllegalArgumentException("link inválido")).when(modulo)
                .redefinir(anyString(), anyString(), any(), anyString(), any(), any());

        assertThatCode(() -> servico.redefinir("token", "senha-nova-456", null, "127.0.0.1"))
                .isInstanceOf(IllegalArgumentException.class);
        verify(push, never()).apagarDoUsuario(any(), any());
    }
}
