package br.com.treinos.api.importacao.completa;

import br.com.treinos.api.importacao.completa.AmostraDaPlanilha.Amostra;
import br.com.treinos.api.importacao.completa.MontagemDaImportacao.AlunoNovo;
import br.com.treinos.api.importacao.completa.MontagemDaImportacao.Dono;
import br.com.treinos.api.importacao.completa.MontagemDaImportacao.Montagem;
import br.com.treinos.api.importacao.completa.MontagemDaImportacao.PesoNovo;
import br.com.treinos.api.importacao.completa.MontagemDaImportacao.PlanosDoAluno;
import br.com.treinos.api.importacao.completa.PlanilhaCompletaDtos.Pendencias;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** A regra pura da amostra: fatia, ordem do arquivo, aluno existente e sigilo no {@code toString}. Nomes fictícios. */
class AmostraDaPlanilhaTest {

    private static AlunoNovo novo(int linha) {
        return new AlunoNovo(new Dono(linha, null), "Aluno Fictício " + linha, null, null, null, null, true);
    }

    private static Montagem montagem(List<AlunoNovo> novos, List<PesoNovo> pesos, List<PlanosDoAluno> planos) {
        return new Montagem(novos, 0, pesos, 0, 0, List.of(), planos, 0, 0, List.of(), 0, List.of(),
                new Pendencias(0, 0, 0, 0), Map.of());
    }

    @Test
    void fatiaNaOrdemDoArquivoEPlanoDeAlunoExistenteVemDepoisDosCadastros() {
        List<AlunoNovo> novos = new ArrayList<>();
        for (int i = 2; i <= 8; i++) {
            novos.add(novo(i));
        }
        PlanosDoAluno deExistente = new PlanosDoAluno(new Dono(null, UUID.randomUUID()), "Existente Fictício", null, null);
        Montagem m = montagem(novos, List.of(), List.of(deExistente));

        Amostra primeira = AmostraDaPlanilha.de(m, "h", 0);
        assertThat(primeira.total()).isEqualTo(8);
        assertThat(primeira.alunos()).extracting(a -> a.numero()).containsExactly(1, 2, 3, 4, 5);
        assertThat(primeira.alunos().get(0).situacao()).isEqualTo("NOVO");

        Amostra resto = AmostraDaPlanilha.de(m, "h", 5);
        assertThat(resto.alunos()).extracting(a -> a.numero()).containsExactly(6, 7, 8);
        assertThat(resto.alunos().get(2).situacao()).isEqualTo("EXISTENTE");
        assertThat(resto.alunos().get(2).nome()).isEqualTo("Existente Fictício");
        assertThat(resto.alunos().get(2).ativo()).isNull();

        assertThat(AmostraDaPlanilha.de(m, "h", 99).alunos()).isEmpty();
        assertThat(AmostraDaPlanilha.de(m, "h", -3).alunos()).hasSize(5);
    }

    @Test
    void pesosVemEmOrdemDeDataComOTotalESemVazarNoToString() {
        AlunoNovo a = novo(2);
        List<PesoNovo> pesos = new ArrayList<>();
        for (int dia = 12; dia >= 1; dia--) { // fora de ordem de propósito
            pesos.add(new PesoNovo(a.dono(), LocalDate.of(2026, 1, dia), new BigDecimal("70." + dia), null));
        }
        Amostra amostra = AmostraDaPlanilha.de(montagem(List.of(a), pesos, List.of()), "h", 0);

        var aluno = amostra.alunos().get(0);
        assertThat(aluno.pesos()).isEqualTo(12);
        assertThat(aluno.ultimosPesos()).hasSize(AmostraDaPlanilha.PESOS_MOSTRADOS);
        assertThat(aluno.ultimosPesos().get(9).data()).isEqualTo(LocalDate.of(2026, 1, 12));
        assertThat(aluno.ultimosPesos().get(0).data()).isEqualTo(LocalDate.of(2026, 1, 3));
        assertThat(amostra.toString() + aluno + aluno.ultimosPesos().get(0)).doesNotContain("Fictício").doesNotContain("70.");
    }
}
