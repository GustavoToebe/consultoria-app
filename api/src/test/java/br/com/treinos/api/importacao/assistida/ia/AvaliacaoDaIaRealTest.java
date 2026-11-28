package br.com.treinos.api.importacao.assistida.ia;

import br.com.treinos.api.dieta.ConteudoDieta;
import br.com.treinos.api.treino.ConteudoTreino;
import br.com.treinos.api.web.Buscas;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Conjunto de avaliação da IA (plano importacao-revisao-28-11, passo 1.8): chama o Claude DE VERDADE com os documentos
 * fictícios de {@code importacao-assistida/avaliacao/} e compara com o {@code .esperado.json} de cada um. Cada rodada
 * gasta dinheiro: só roda com {@code TREINOS_IA_AVALIACAO_REAL=sim} e a chave em {@code TREINOS_IA_CLAUDE_API_KEY}
 * (modelo e esforço opcionais em {@code TREINOS_IA_CLAUDE_MODELO} e {@code TREINOS_IA_CLAUDE_ESFORCO}); sem isso o
 * {@code mvn verify} o pula. Só o Gustavo pede a rodada.
 */
// shortcut: 3 documentos de exemplo e conferência só de nomes e contagens, completar até 10 a 20 documentos e campos de série depois.
@EnabledIfEnvironmentVariable(named = "TREINOS_IA_AVALIACAO_REAL", matches = "sim")
class AvaliacaoDaIaRealTest {

    private final JsonMapper json = JsonMapper.builder().build();

    @Test
    void documentosFicticiosBatemComOEsperado() throws Exception {
        String chave = System.getenv("TREINOS_IA_CLAUDE_API_KEY");
        assumeTrue(chave != null && !chave.isBlank(), "Sem a chave do Claude: avaliação pulada.");
        ConfiguracaoIaImportacao config = new ConfiguracaoIaImportacao();
        config.setClaudeApiKey(chave);
        config.setClaudeModelo(System.getenv("TREINOS_IA_CLAUDE_MODELO"));
        config.setClaudeEsforco(System.getenv("TREINOS_IA_CLAUDE_ESFORCO"));
        InterpretadorClaude claude = new InterpretadorClaude(config, json);

        Path pasta = Path.of(Objects.requireNonNull(getClass().getResource("/importacao-assistida/avaliacao")).toURI());
        List<Path> documentos;
        try (Stream<Path> arquivos = Files.list(pasta)) {
            documentos = arquivos.filter(p -> p.toString().endsWith(".txt")).sorted().toList();
        }
        assertThat(documentos).isNotEmpty();

        List<String> diferencas = new ArrayList<>();
        for (Path doc : documentos) {
            String nome = doc.getFileName().toString().replace(".txt", "");
            String texto = Files.readString(doc, StandardCharsets.UTF_8);
            JsonNode esperado = json.readTree(Files.readString(doc.resolveSibling(nome + ".esperado.json")));
            ResultadoInterpretacao r = claude.interpretar(new ContextoIa(nome + ".txt", "TEXTO", List.of(), texto,
                    List.of(), Map.of()));
            comparar(nome, esperado, r, diferencas);
        }
        assertThat(diferencas).as("Diferenças da avaliação").isEmpty();
    }

    private static void comparar(String doc, JsonNode esperado, ResultadoInterpretacao r, List<String> diferencas) {
        if (r.grupos().size() != esperado.path("grupos").size()) {
            diferencas.add(doc + ": " + r.grupos().size() + " alunos, esperado " + esperado.path("grupos").size());
        }
        for (JsonNode e : esperado.path("grupos")) {
            String aluno = e.path("nomeAluno").asText();
            ResultadoInterpretacao.PropostaGrupo g = r.grupos().stream()
                    .filter(x -> Buscas.semAcento(x.nomeAluno()).equals(Buscas.semAcento(aluno))).findFirst().orElse(null);
            if (g == null) {
                diferencas.add(doc + ": aluno não achado " + aluno);
                continue;
            }
            List<ConteudoTreino.Sessao> sessoes = g.treino() == null ? List.of() : g.treino().sessoes();
            iguais(doc + "/" + aluno + " sessões", nomes(e.path("sessoes")),
                    sessoes.stream().map(ConteudoTreino.Sessao::nome).map(Buscas::semAcento).toList(), diferencas);
            List<String> exercicios = sessoes.stream().flatMap(s -> s.exercicios().stream())
                    .map(ConteudoTreino.ExercicioPlano::nome).map(Buscas::semAcento).toList();
            nomes(e.path("exercicios")).stream().filter(n -> !exercicios.contains(n))
                    .forEach(n -> diferencas.add(doc + "/" + aluno + ": faltou o exercício " + n));
            List<ConteudoDieta.Refeicao> refeicoes = g.dieta() == null ? List.of() : g.dieta().refeicoes();
            iguais(doc + "/" + aluno + " refeições", nomes(e.path("refeicoes")),
                    refeicoes.stream().map(ConteudoDieta.Refeicao::nome).map(Buscas::semAcento).toList(), diferencas);
            if (g.pesos().size() != e.path("pesos").asInt()) {
                diferencas.add(doc + "/" + aluno + ": " + g.pesos().size() + " pesos, esperado " + e.path("pesos").asInt());
            }
        }
    }

    private static List<String> nomes(JsonNode lista) {
        List<String> nomes = new ArrayList<>();
        lista.forEach(n -> nomes.add(Buscas.semAcento(n.asText())));
        return nomes;
    }

    private static void iguais(String onde, List<String> esperado, List<String> lido, List<String> diferencas) {
        if (!esperado.equals(lido)) {
            diferencas.add(onde + ": lido " + lido + ", esperado " + esperado);
        }
    }
}
