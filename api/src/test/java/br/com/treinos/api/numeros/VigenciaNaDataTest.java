package br.com.treinos.api.numeros;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class VigenciaNaDataTest {

    private static final UUID ALUNO = UUID.randomUUID();
    private static final Instant ANTES = Instant.parse("2026-01-01T12:00:00Z");

    private static PastaCandidata pasta(UUID aluno, LocalDate inicio, Instant criadoEm) {
        return new PastaCandidata(UUID.randomUUID(), aluno, inicio, criadoEm);
    }

    @Test
    void renovacaoQueComecaDepoisDoPrazoNaoTiraAPastaAntiga() {
        var a = pasta(ALUNO, LocalDate.of(2026, 9, 1), ANTES);
        var b = pasta(ALUNO, LocalDate.of(2026, 10, 1), ANTES);
        var vigencia = new VigenciaNaData(List.of(a, b));
        assertThat(vigencia.vigente(ALUNO, LocalDate.of(2026, 9, 30))).contains(a.pastaId());
    }

    @Test
    void renovacaoAntesDoFimFazDaNovaAVigente() {
        var a = pasta(ALUNO, LocalDate.of(2026, 9, 1), ANTES);
        var b = pasta(ALUNO, LocalDate.of(2026, 9, 20), ANTES);
        var vigencia = new VigenciaNaData(List.of(a, b));
        assertThat(vigencia.vigente(ALUNO, LocalDate.of(2026, 9, 30))).contains(b.pastaId());
        assertThat(vigencia.vigente(ALUNO, LocalDate.of(2026, 9, 19))).contains(a.pastaId());
    }

    @Test
    void renovacaoQueComecaNoProprioDiaDoPrazoJaEAVigente() {
        var a = pasta(ALUNO, LocalDate.of(2026, 9, 1), ANTES);
        var b = pasta(ALUNO, LocalDate.of(2026, 9, 30), ANTES);
        assertThat(new VigenciaNaData(List.of(a, b)).vigente(ALUNO, LocalDate.of(2026, 9, 30))).contains(b.pastaId());
    }

    @Test
    void empateDeInicioVaiParaACriadaPorUltimo() {
        var antiga = pasta(ALUNO, LocalDate.of(2026, 9, 1), ANTES);
        var nova = pasta(ALUNO, LocalDate.of(2026, 9, 1), ANTES.plusSeconds(60));
        assertThat(new VigenciaNaData(List.of(nova, antiga)).vigente(ALUNO, LocalDate.of(2026, 9, 30))).contains(nova.pastaId());
        assertThat(new VigenciaNaData(List.of(antiga, nova)).vigente(ALUNO, LocalDate.of(2026, 9, 30))).contains(nova.pastaId());
    }

    @Test
    void semPastaQueJaTenhaComecadoNaoHaVigente() {
        var futura = pasta(ALUNO, LocalDate.of(2026, 10, 1), ANTES);
        assertThat(new VigenciaNaData(List.of(futura)).vigente(ALUNO, LocalDate.of(2026, 9, 30))).isEmpty();
        assertThat(new VigenciaNaData(List.of()).vigente(ALUNO, LocalDate.of(2026, 9, 30))).isEmpty();
    }

    @Test
    void cadaAlunoTemASuaVigente() {
        UUID outro = UUID.randomUUID();
        var doAluno = pasta(ALUNO, LocalDate.of(2026, 9, 1), ANTES);
        var doOutro = pasta(outro, LocalDate.of(2026, 9, 20), ANTES);
        var vigencia = new VigenciaNaData(List.of(doAluno, doOutro));
        assertThat(vigencia.vigente(ALUNO, LocalDate.of(2026, 9, 30))).contains(doAluno.pastaId());
        assertThat(vigencia.vigente(outro, LocalDate.of(2026, 9, 30))).contains(doOutro.pastaId());
    }
}
