package br.com.treinos.api.treino;

import br.com.treinos.api.consultoria.ConfiguracaoConsultoria;
import br.com.treinos.api.planos.ResultadoValidacao;
import br.com.treinos.api.treino.ConteudoTreino.ExercicioPlano;
import br.com.treinos.api.treino.ConteudoTreino.Intensidade;
import br.com.treinos.api.treino.ConteudoTreino.Serie;
import br.com.treinos.api.treino.ConteudoTreino.Sessao;
import br.com.treinos.api.treino.ConteudoTreino.Tecnica;
import br.com.treinos.api.web.VideoUrls;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Regras de publicação das técnicas (drop-set), da execução (cadência, isometria) e do agrupamento de exercícios. */
class ValidadorTreinoTest {

    private static final String BASE = "sessoes[0].exercicios[";
    private final ValidadorTreino validador = new ValidadorTreino(new VideoUrls(List.of("youtube.com")));

    @Test
    void dropSetConfereQuedasReducaoERepeticoes() {
        List<String> ruins = caminhosDeErro(conteudo(List.of(exercicio(serie(
                new Tecnica("DROP_SET", null, null, null, null, null, 0, 60, 0))))));
        assertThat(ruins).contains(BASE + "0].series[0].tecnica.quedas", BASE + "0].series[0].tecnica.reducaoPercentual",
                BASE + "0].series[0].tecnica.repsPorQueda");

        // Só as quedas são obrigatórias: sem redução fixada e até a falha. Campos de outra técnica são ignorados.
        List<String> boas = caminhosDeErro(conteudo(List.of(exercicio(serie(
                new Tecnica("DROP_SET", 99, null, null, null, null, 2, null, null))))));
        assertThat(boas).noneMatch(c -> c.contains("tecnica"));
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie(
                new Tecnica("DROP_SET", null, null, null, null, null, 5, 50, 50))))))).noneMatch(c -> c.contains("tecnica"));
    }

    @Test
    void tecnicaDesconhecidaContinuaRecusada() {
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie(
                new Tecnica("PIRAMIDE", null, null, null, null, null))))))).contains(BASE + "0].series[0].tecnica.tipo");
    }

    @Test
    void cadenciaEmQuatroPartesEIsometriaDeUmACentoEVinte() {
        for (String boa : List.of("3-1-1-0", "2-0-X-1", "X-X-X-X", "")) {
            assertThat(caminhosDeErro(conteudo(List.of(execucao(boa, null))))).as(boa)
                    .doesNotContain(BASE + "0].cadencia");
        }
        for (String ruim : List.of("3-1-1", "3-1-1-0-0", "31-1-0", "3-1-x-0", "3 1 1 0", "a-b-c-d", "10-1-1-0")) {
            assertThat(caminhosDeErro(conteudo(List.of(execucao(ruim, null))))).as(ruim).contains(BASE + "0].cadencia");
        }
        assertThat(caminhosDeErro(conteudo(List.of(execucao(null, 0))))).contains(BASE + "0].isometriaSegundos");
        assertThat(caminhosDeErro(conteudo(List.of(execucao(null, 121))))).contains(BASE + "0].isometriaSegundos");
        assertThat(caminhosDeErro(conteudo(List.of(execucao(null, 10))))).doesNotContain(BASE + "0].isometriaSegundos");
    }

    @Test
    void primeiroExercicioDaSessaoNaoFicaJuntoComAnterior() {
        List<String> erros = caminhosDeErro(conteudo(List.of(junto(true, null), junto(true, null))));
        assertThat(erros).contains(BASE + "0].juntoComAnterior").doesNotContain(BASE + "1].juntoComAnterior");
    }

    @Test
    void grupoVaiAteSeisExercicios() {
        List<ExercicioPlano> seis = new ArrayList<>(List.of(junto(false, null)));
        for (int i = 0; i < 5; i++) {
            seis.add(junto(true, null));
        }
        assertThat(caminhosDeErro(conteudo(seis))).noneMatch(c -> c.endsWith("juntoComAnterior"));

        List<ExercicioPlano> sete = new ArrayList<>(seis);
        sete.add(junto(true, null));
        // Um exercício solto depois recomeça a contagem.
        sete.add(junto(false, null));
        sete.add(junto(true, null));
        assertThat(caminhosDeErro(conteudo(sete)).stream().filter(c -> c.endsWith("juntoComAnterior")))
                .containsExactly(BASE + "6].juntoComAnterior");
    }

    @Test
    void nomeDoGrupoSoAceitaSuperserie() {
        assertThat(caminhosDeErro(conteudo(List.of(junto(false, "SUPERSERIE"), junto(true, null)))))
                .noneMatch(c -> c.endsWith("combinacao"));
        // Fora do primeiro de um grupo de 2 é ignorado, sem erro.
        assertThat(caminhosDeErro(conteudo(List.of(junto(false, null), junto(true, "SUPERSERIE")))))
                .noneMatch(c -> c.endsWith("combinacao"));
        assertThat(caminhosDeErro(conteudo(List.of(junto(false, "TRISET"), junto(true, null)))))
                .contains(BASE + "0].combinacao");
    }

    @Test
    void tipoForaDaMetodologiaEAvisoNaoErro() {
        ResultadoValidacao r = validador.validar(conteudoComMetodologia(List.of(exercicio(serieDoTipo("Pirâmide")))), null, null);
        assertThat(r.erros()).isEmpty();
        assertThat(r.avisos()).anySatisfy(a -> {
            assertThat(a.caminho()).isEqualTo(BASE + "0].series[0].tipo");
            assertThat(a.mensagem()).contains("não está na metodologia do plano");
        });
    }

    @Test
    void umAvisoPorTipoDesconhecidoEmCadaExercicio() {
        ExercicioPlano duasPiramides = new ExercicioPlano(UUID.randomUUID(), null, "Supino reto com barra", "LIVRE", null,
                null, true, "kg", List.of(serieDoTipo("Pirâmide"), serieDoTipo("Pirâmide"), serieDoTipo("Escada")));
        ResultadoValidacao r = validador.validar(conteudoComMetodologia(List.of(duasPiramides)), null, null);
        assertThat(r.erros()).isEmpty();
        assertThat(r.avisos().stream().filter(a -> a.caminho().endsWith(".tipo")).map(a -> a.caminho()))
                .containsExactly(BASE + "0].series[0].tipo", BASE + "0].series[2].tipo");
    }

    @Test
    void semMetodologiaNaoAvisaDoTipo() {
        ResultadoValidacao r = validador.validar(conteudo(List.of(exercicio(serieDoTipo("Pirâmide")))), null, null);
        assertThat(r.avisos()).noneMatch(a -> a.caminho().endsWith(".tipo"));
    }

    @Test
    void tipoComEspacosNasPontasNaoAvisa() {
        ResultadoValidacao r = validador.validar(conteudoComMetodologia(List.of(exercicio(serieDoTipo(" WS ")))), null, null);
        assertThat(r.avisos()).noneMatch(a -> a.caminho().endsWith(".tipo"));
    }

    private List<String> caminhosDeErro(ConteudoTreino conteudo) {
        ResultadoValidacao r = validador.validar(conteudo, null, null);
        return r.erros().stream().map(ResultadoValidacao.Problema::caminho).toList();
    }

    private static Serie serie(Tecnica tecnica) {
        return new Serie(UUID.randomUUID(), "WS", 6, 8, null,
                new Intensidade("CARGA_TRABALHO", null, null, null, null), null, tecnica);
    }

    private static Serie serieDoTipo(String tipo) {
        return new Serie(UUID.randomUUID(), tipo, 6, 8, null,
                new Intensidade("CARGA_TRABALHO", null, null, null, null), null, null);
    }

    private static ExercicioPlano exercicio(Serie serie) {
        return new ExercicioPlano(UUID.randomUUID(), null, "Supino reto com barra", "LIVRE", null, null, true, "kg",
                List.of(serie));
    }

    private static ExercicioPlano execucao(String cadencia, Integer isometria) {
        return new ExercicioPlano(UUID.randomUUID(), null, "Agachamento livre", "LIVRE", null, null, true, "kg",
                List.of(serie(null)), cadencia, isometria, null, null);
    }

    private static ExercicioPlano junto(boolean junto, String combinacao) {
        return new ExercicioPlano(UUID.randomUUID(), null, "Rosca direta", "LIVRE", null, null, true, "kg",
                List.of(serie(null)), null, null, junto, combinacao);
    }

    private static ConteudoTreino conteudo(List<ExercicioPlano> exercicios) {
        return new ConteudoTreino(null, null, List.of(
                new Sessao(UUID.randomUUID(), "Treino A", 1, "TREINO", null, null, null, exercicios),
                new Sessao(UUID.randomUUID(), "Descanso", 7, "DESCANSO", null, null, null, List.of())));
    }

    /** Mesmo conteúdo de {@link #conteudo}, com a metodologia padrão copiada no plano. */
    private static ConteudoTreino conteudoComMetodologia(List<ExercicioPlano> exercicios) {
        return new ConteudoTreino(null, null, List.of(
                new Sessao(UUID.randomUUID(), "Treino A", 1, "TREINO", null, null, null, exercicios),
                new Sessao(UUID.randomUUID(), "Descanso", 7, "DESCANSO", null, null, null, List.of())),
                new ConteudoTreino.Metodologia(null, "M", ConfiguracaoConsultoria.padrao()));
    }
}
