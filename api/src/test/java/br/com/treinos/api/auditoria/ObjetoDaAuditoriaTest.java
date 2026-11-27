package br.com.treinos.api.auditoria;

import br.com.treinos.api.pagamentos.PagamentosProperties;
import br.com.treinos.api.pagamentos.RotuloDaCobranca;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Com o Financeiro desligado, o rótulo da cobrança (que leva o valor) não é lido nem com {@code FINANCEIRO_LER}. */
class ObjetoDaAuditoriaTest {

    @AfterEach
    void limpar() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void cobrancaSemNomeComOFinanceiroDesligado() {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("membro", null,
                List.of(new SimpleGrantedAuthority("PERM_AUDITORIA_LER"), new SimpleGrantedAuthority("PERM_FINANCEIRO_LER"),
                        new SimpleGrantedAuthority("PERM_ALUNO_LER"))));
        RotuloDaCobranca rotulos = mock(RotuloDaCobranca.class);
        var objetos = new ObjetoDaAuditoria(mock(EntityManager.class), rotulos, new PagamentosProperties(false, null, null, false, false));
        RegistroAuditoria evento = mock(RegistroAuditoria.class);
        when(evento.getEntidade()).thenReturn("COBRANCA");
        when(evento.getEntidadeId()).thenReturn(UUID.randomUUID());

        assertThat(objetos.nomes(List.of(evento))).containsExactly((String) null);
        verify(rotulos, never()).de(any());
    }
}
