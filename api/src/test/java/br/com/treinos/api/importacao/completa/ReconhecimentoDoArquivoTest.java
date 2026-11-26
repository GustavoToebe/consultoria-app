package br.com.treinos.api.importacao.completa;

import br.com.treinos.api.importacao.ImportacaoDtos.Reconhecimento;
import br.com.treinos.api.importacao.ReconhecimentoDoArquivo;
import br.com.treinos.api.web.ValidacaoException;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static br.com.treinos.api.importacao.completa.PlanilhaDeTeste.CAB_ALUNOS;
import static br.com.treinos.api.importacao.completa.PlanilhaDeTeste.CAB_PESOS;
import static br.com.treinos.api.importacao.completa.PlanilhaDeTeste.data;
import static br.com.treinos.api.importacao.completa.PlanilhaDeTeste.linha;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Trilha do arquivo (completa, uma aba ou nenhuma) sobre planilhas fictícias geradas no teste. */
class ReconhecimentoDoArquivoTest {

    private static Reconhecimento de(Map<String, List<List<Object>>> abas) {
        return ReconhecimentoDoArquivo.reconhecer("planilha.xlsx", PlanilhaDeTeste.xlsx(abas));
    }

    @Test
    void planilhaDoTreinadorVaiParaACompleta() {
        Reconhecimento r = de(PlanilhaDeTeste.abasDoTreinador());
        assertThat(r.trilha()).isEqualTo("COMPLETA");
        assertThat(r.aba()).isNull();
        assertThat(r.destino()).isNull();
        var alunos = r.abas().getFirst();
        assertThat(alunos.nome()).isEqualTo("Alunos");
        assertThat(alunos.destino()).isEqualTo("alunos");
        assertThat(alunos.tipoNaPlanilhaCompleta()).isEqualTo("ALUNOS");
        assertThat(alunos.linhaDoCabecalho()).isEqualTo(1);
        assertThat(alunos.linhas()).isEqualTo(5);
        // Treino, dieta e suplemento com dose só a completa trata: sem destino de uma aba.
        assertThat(r.abas()).filteredOn(a -> "TREINO".equals(a.tipoNaPlanilhaCompleta())).isNotEmpty()
                .allMatch(a -> a.destino() == null);
    }

    @Test
    void doisTiposDeAbaViramCompletaMesmoSemTreinoNemDieta() {
        Map<String, List<List<Object>>> abas = new LinkedHashMap<>();
        abas.put("Alunos", List.of(CAB_ALUNOS, linha("AL1", "Aluno Um", "um@example.com", null, null, null, null, "Ativo", null)));
        abas.put("Pesos", List.of(CAB_PESOS, linha("P1", "AL1", "Aluno Um", data("2026-01-05"), 1, 80.5, null, null)));
        assertThat(de(abas).trilha()).isEqualTo("COMPLETA");
    }

    @Test
    void umaAbaReconhecidaComOutraVaziaVaiParaAImportacaoDeUmaAba() {
        Map<String, List<List<Object>>> abas = new LinkedHashMap<>();
        abas.put("Notas", List.of(linha("anotação solta")));
        abas.put("Alunos", List.of(linha("Relatório fictício"), CAB_ALUNOS,
                linha("AL1", "Aluno Um", "um@example.com", null, null, null, null, "Ativo", null),
                linha("AL2", "Aluno Dois", "dois@example.com", null, null, null, null, "Ativo", null)));
        Reconhecimento r = de(abas);
        assertThat(r.trilha()).isEqualTo("UMA_ABA");
        assertThat(r.aba()).isEqualTo(1);
        assertThat(r.destino()).isEqualTo("alunos");
        assertThat(r.abas().get(0).destino()).isNull();
        // O título acima do cabeçalho: a linha 2 do arquivo, com 2 linhas de dados depois dela.
        assertThat(r.abas().get(1).linhaDoCabecalho()).isEqualTo(2);
        assertThat(r.abas().get(1).linhas()).isEqualTo(2);
    }

    @Test
    void listaDeExerciciosESuplementosDaBibliotecaPeloCabecalho() {
        Reconhecimento exercicios = de(Map.of("Lista", List.of(linha("Exercício", "Grupo Muscular", "Link Vídeo"),
                linha("Remada fictícia", "Costas", "https://youtu.be/abc123"))));
        assertThat(exercicios.trilha()).isEqualTo("UMA_ABA");
        assertThat(exercicios.destino()).isEqualTo("exercicios");

        Reconhecimento suplementos = de(Map.of("Produtos", List.of(linha("Nome", "Marca", "Categoria", "Porção", "Sabores"),
                linha("Creatina Fictícia", "Marca Fictícia", "Creatina", "3 g", "Natural"))));
        assertThat(suplementos.trilha()).isEqualTo("UMA_ABA");
        assertThat(suplementos.destino()).isEqualTo("suplementos");
        assertThat(suplementos.abas().getFirst().tipoNaPlanilhaCompleta()).isNull();
    }

    @Test
    void arquivoSemNadaReconhecidoEDesconhecida() {
        Reconhecimento r = de(Map.of("Compras", List.of(linha("Lista de compras"), linha("leite"), linha("pão"))));
        assertThat(r.trilha()).isEqualTo("DESCONHECIDA");
        assertThat(r.aba()).isNull();
        assertThat(r.abas().getFirst().destino()).isNull();
    }

    @Test
    void csvDeUmaAbaEAsDuasAbasDeAlunosNaoSaoUmaAbaSo() {
        Reconhecimento csv = ReconhecimentoDoArquivo.reconhecer("alunos.csv",
                "Nome;E-mail\nAna Fictícia;ana@example.com\n".getBytes(StandardCharsets.UTF_8));
        assertThat(csv.trilha()).isEqualTo("UMA_ABA");
        assertThat(csv.destino()).isEqualTo("alunos");
        assertThat(csv.aba()).isZero();

        Map<String, List<List<Object>>> abas = new LinkedHashMap<>();
        abas.put("Turma A", List.of(CAB_ALUNOS, linha("AL1", "Aluno Um", "um@example.com", null, null, null, null, "Ativo", null)));
        abas.put("Turma B", List.of(CAB_ALUNOS, linha("AL2", "Aluno Dois", "dois@example.com", null, null, null, null, "Ativo", null)));
        assertThat(de(abas).trilha()).isEqualTo("DESCONHECIDA");
    }

    @Test
    void xlsAntigoERecusadoComCodigoProprio() {
        byte[] xls = {(byte) 0xD0, (byte) 0xCF, 0x11, (byte) 0xE0, 0, 0};
        assertThatThrownBy(() -> ReconhecimentoDoArquivo.reconhecer("antigo.xls", xls))
                .isInstanceOfSatisfying(ValidacaoException.class, e -> assertThat(e.getCodigo()).isEqualTo("FORMATO_XLS_ANTIGO"));
    }
}
