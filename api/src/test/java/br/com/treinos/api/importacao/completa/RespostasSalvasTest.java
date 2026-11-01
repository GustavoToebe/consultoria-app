package br.com.treinos.api.importacao.completa;

import br.com.treinos.api.importacao.completa.PlanilhaCompletaDtos.Analise;
import br.com.treinos.api.importacao.completa.PlanilhaCompletaDtos.Pergunta;
import br.com.treinos.api.importacao.completa.RespostasSalvas.NomeSalvo;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static br.com.treinos.api.importacao.completa.PlanilhaDeTeste.linha;
import static org.assertj.core.api.Assertions.assertThat;

/** As respostas guardadas voltam como sugestão marcada na análise (fase 2), sem banco. Planilha fictícia. */
class RespostasSalvasTest {

    private static final LocalDate HOJE = LocalDate.of(2026, 11, 1);

    private static LeituraDasAbas.Leitura ler(Map<String, List<List<Object>>> abas) {
        return LeituraDasAbas.ler("planilha.xlsx", PlanilhaDeTeste.xlsx(abas));
    }

    private static Map<String, List<List<Object>>> planilha(String tituloDoExercicio) {
        Map<String, List<List<Object>>> abas = new LinkedHashMap<>();
        abas.put("Alunos", List.of(linha("Nome", "Email"), linha("Aluna Fictícia", "a@example.com")));
        abas.put("Coisas", List.of(linha(tituloDoExercicio, "Séries", "Repetições", "Aluno"),
                linha("Supino inclinado halter", 3, 10, "Aluna Fictícia"),
                linha("Xyzzy qwerty", 3, 10, "Aluna Fictícia")));
        abas.put("Suplementos", List.of(linha("Aluno", "Suplemento", "Dose"),
                linha("Aluna Fictícia", "Remédio Fictício XYZ", "1 cp")));
        return abas;
    }

    private static String assinatura(LeituraDasAbas.Leitura leitura, int indice) {
        LigacaoDeAbas.AbaReconhecida aba = AnaliseDaPlanilha.reconhecerAbas(leitura, Map.of()).get(indice);
        return AnaliseDaPlanilha.assinaturaDosTitulos(leitura, aba);
    }

    @Test
    void assinaturaDosTitulosNaoGuardaOTextoENaoLigaParaAcentoECaixa() {
        String a = assinatura(ler(planilha("Exercício")), 1);
        String b = assinatura(ler(planilha("EXERCICIO")), 1);
        String c = assinatura(ler(planilha("Movimento")), 1);
        assertThat(a).hasSize(64).isEqualTo(b).isNotEqualTo(c);
        assertThat(a).doesNotContainIgnoringCase("exerc");
    }

    @Test
    void respostasSalvasVoltamMarcadas() {
        LeituraDasAbas.Leitura leitura = ler(planilha("Exercício"));
        UUID supino = UUID.randomUUID();
        RespostasSalvas salvas = new RespostasSalvas(
                Map.of(assinatura(leitura, 1), "IGNORAR"),
                Map.of(CasamentoDeNomes.chave("Supino inclinado halter"), new NomeSalvo("BIBLIOTECA", supino),
                        CasamentoDeNomes.chave("Xyzzy qwerty"), new NomeSalvo("ACEITAR", null)),
                Map.of(),
                Map.of(MontagemDaImportacao.nomeDeSuplemento("Remédio Fictício XYZ"), "SENSIVEL"),
                7);
        Analise a = AnaliseDaPlanilha.analisar(leitura, List.of("Supino reto com barra"), List.of(), List.of(), List.of(),
                List.of(), salvas, HOJE);
        assertThat(a.respostasSalvas()).isEqualTo(7);
        assertThat(a.abas().get(1).tipoSalvo()).isEqualTo("IGNORAR");
        assertThat(a.abas().get(0).tipoSalvo()).isNull();
        Pergunta s = a.exercicios().stream().filter(p -> p.nome().startsWith("Supino")).findFirst().orElseThrow();
        assertThat(s.respostaSalva()).isEqualTo("BIBLIOTECA");
        assertThat(s.idSalvo()).isEqualTo(supino);
        // "Aceitar" sem sugestão não volta.
        Pergunta x = a.exercicios().stream().filter(p -> p.nome().startsWith("Xyzzy")).findFirst().orElseThrow();
        assertThat(x.sugestao()).isNull();
        assertThat(x.respostaSalva()).isNull();
        assertThat(a.suplementos()).singleElement().satisfies(p -> assertThat(p.destinoSalvo()).isEqualTo("SENSIVEL"));
    }

    @Test
    void semRespostasSalvasNadaVemMarcado() {
        Analise a = AnaliseDaPlanilha.analisar(ler(planilha("Exercício")), List.of(), List.of(), List.of(), List.of(), HOJE);
        assertThat(a.respostasSalvas()).isZero();
        assertThat(a.abas()).allMatch(x -> x.tipoSalvo() == null);
        assertThat(a.exercicios()).allMatch(p -> p.respostaSalva() == null && p.idSalvo() == null);
        assertThat(a.suplementos()).allMatch(p -> p.destinoSalvo() == null);
    }
}
