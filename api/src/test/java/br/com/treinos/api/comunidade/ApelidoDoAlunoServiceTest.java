package br.com.treinos.api.comunidade;

import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.security.UsuarioAutenticado;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.web.ValidacaoException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ApelidoDoAlunoServiceTest {

    @Mock private AlunoRepository alunos;
    @Mock private Auditoria auditoria;

    private final UUID alunoId = UUID.randomUUID();
    private final UsuarioAutenticado eu = new UsuarioAutenticado(UUID.randomUUID(), UUID.randomUUID(), "ALUNO", alunoId);

    @Test
    void normalizaStripNfcEApagaComVazio() {
        assertThat(ApelidoDoAlunoService.normalizar("  Ana_Fit.01 ")).isEqualTo("Ana_Fit.01");
        assertThat(ApelidoDoAlunoService.normalizar("João")).isEqualTo("João");
        assertThat(ApelidoDoAlunoService.normalizar("Zé Ñandú-2")).isEqualTo("Zé Ñandú-2");
        assertThat(ApelidoDoAlunoService.normalizar("ab")).isEqualTo("ab");
        assertThat(ApelidoDoAlunoService.normalizar("x".repeat(24))).hasSize(24);
        assertThat(ApelidoDoAlunoService.normalizar(null)).isNull();
        assertThat(ApelidoDoAlunoService.normalizar("   ")).isNull();
    }

    @Test
    void recusaTamanhoCaractereELinkSemRepetirOValor() {
        for (String ruim : new String[] {"a", " a ", "x".repeat(25), "ana@email", "ana_<b>", "ana!", "a/b", "ana ana", "ana🔥",
                "www.site", "WWW.Site", "https-ana", "meusite.com", "loja.com.br", "x.gg",
                // só preenchimento Hangul (invisível), só pontuação, link em largura total e em letras matemáticas
                "ㅤㅤㅤ", "ᅟᅠ", "aﾠb", "..", "--", "_.",
                "ｗｗｗ.site.ｃｏｍ", "𝐰𝐰𝐰.x.𝐜𝐨𝐦"}) {
            assertThatThrownBy(() -> ApelidoDoAlunoService.normalizar(ruim)).as(ruim)
                    .isInstanceOfSatisfying(ValidacaoException.class, e -> {
                        assertThat(e.getProblemas()).hasSize(1);
                        assertThat(e.getProblemas().get(0).field()).isEqualTo("apelido");
                        if (ruim.strip().length() >= 5) { // valor curto aparece em qualquer texto
                            assertThat(e.getMessage()).doesNotContain(ruim);
                            assertThat(e.getProblemas().get(0).message()).doesNotContain(ruim);
                        }
                    });
        }
        // Ponto no meio de um nome não é link.
        assertThat(ApelidoDoAlunoService.normalizar("joao.silva")).isEqualTo("joao.silva");
        assertThat(ApelidoDoAlunoService.normalizar("Compadre")).isEqualTo("Compadre");
    }

    @Test
    void anonimizadoRecebe409ENaoGrava() {
        Aluno aluno = new Aluno("Aluno", null, null, null);
        aluno.anonimizar(Instant.now());
        when(alunos.buscarParaAlterar(alunoId)).thenReturn(Optional.of(aluno));

        assertThatThrownBy(() -> new ApelidoDoAlunoService(alunos, auditoria).alterar(eu, "Novo.Apelido"))
                .hasMessageContaining("anonimizado");
        assertThat(aluno.getApelido()).isNull();
        verify(auditoria, never()).registrarEvento(any(), any(), any(), any());
    }

    @Test
    void auditaSoQuandoMudaERemoverSemApelidoNaoAudita() {
        Aluno aluno = new Aluno("Aluno", null, null, null);
        when(alunos.buscarParaAlterar(alunoId)).thenReturn(Optional.of(aluno));
        var servico = new ApelidoDoAlunoService(alunos, auditoria);

        servico.alterar(eu, "Ana.Fit");
        servico.alterar(eu, " Ana.Fit ");
        verify(auditoria).registrarEvento("ALUNO_APELIDO_ALTERADO", "ALUNO", null, ApelidoDoAlunoService.RESUMO_ALTERADO);

        UUID autor = UUID.randomUUID();
        when(alunos.buscarPorUsuarioParaAlterar(autor)).thenReturn(Optional.of(aluno));
        servico.remover(autor);
        servico.remover(autor);
        assertThat(aluno.getApelido()).isNull();
        verify(auditoria).registrarEvento("COMUNIDADE_APELIDO_REMOVIDO", "ALUNO", null, ApelidoDoAlunoService.RESUMO_REMOVIDO);

        when(alunos.buscarPorUsuarioParaAlterar(autor)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> servico.remover(autor)).isInstanceOf(NaoEncontradoException.class);
    }
}
