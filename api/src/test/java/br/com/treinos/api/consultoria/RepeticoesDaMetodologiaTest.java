package br.com.treinos.api.consultoria;

import br.com.plataforma.comum.web.BadRequestException;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThatNoException;

class RepeticoesDaMetodologiaTest {

    private static ConfiguracaoConsultoria com(Map<String, ConfiguracaoConsultoria.Repeticoes> repeticoes) {
        ConfiguracaoConsultoria p = ConfiguracaoConsultoria.padrao();
        return new ConfiguracaoConsultoria(p.tiposSerie(), p.tipoTrabalho(), p.tipoPreparacao(), p.regraPreparacao(),
                p.arredondamentoKg(), p.instrucoesTreino(), p.rodapePdf(), repeticoes);
    }

    /** Configuração igual à padrão, com os tipos dados; as faixas ficam só para os tipos que continuam na lista. */
    private static ConfiguracaoConsultoria comTipos(List<String> tipos) {
        ConfiguracaoConsultoria p = ConfiguracaoConsultoria.padrao();
        Map<String, ConfiguracaoConsultoria.Repeticoes> repeticoes = new LinkedHashMap<>();
        p.repeticoes().forEach((tipo, faixa) -> {
            if (tipos.contains(tipo)) {
                repeticoes.put(tipo, faixa);
            }
        });
        return new ConfiguracaoConsultoria(tipos, p.tipoTrabalho(), p.tipoPreparacao(), p.regraPreparacao(),
                p.arredondamentoKg(), p.instrucoesTreino(), p.rodapePdf(), repeticoes);
    }

    private static List<String> padraoMais(String tipo) {
        List<String> tipos = new ArrayList<>(ConfiguracaoConsultoria.padrao().tiposSerie());
        if (!tipos.contains(tipo)) {
            tipos.add(tipo);
        }
        return tipos;
    }

    @Test
    void padraoTrazAsFaixasDoSaraivaEPassaNaValidacao() {
        ConfiguracaoConsultoria p = ConfiguracaoConsultoria.padrao();
        assertThat(p.repeticoes()).containsEntry("FS", new ConfiguracaoConsultoria.Repeticoes(3, 3))
                .containsEntry("WS", new ConfiguracaoConsultoria.Repeticoes(3, 6));
        assertThatNoException().isThrownBy(() -> ConfiguracaoConsultoria.validar(p));
    }

    @Test
    void semFaixasContinuaValida() {
        assertThatNoException().isThrownBy(() -> ConfiguracaoConsultoria.validar(com(null)));
        assertThatNoException().isThrownBy(() -> ConfiguracaoConsultoria.validar(com(Map.of())));
    }

    @Test
    void recusaTipoForaDaListaEFaixaInvalida() {
        assertThatThrownBy(() -> ConfiguracaoConsultoria.validar(com(Map.of("Drop set", new ConfiguracaoConsultoria.Repeticoes(8, 10)))))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> ConfiguracaoConsultoria.validar(com(Map.of("WS", new ConfiguracaoConsultoria.Repeticoes(6, 3)))))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> ConfiguracaoConsultoria.validar(com(Map.of("WS", new ConfiguracaoConsultoria.Repeticoes(3, null)))))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> ConfiguracaoConsultoria.validar(com(Map.of("WS", new ConfiguracaoConsultoria.Repeticoes(1, 501)))))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void padraoNaoTemNomeDeTecnica() {
        List<String> tipos = ConfiguracaoConsultoria.padrao().tiposSerie();
        assertThat(tipos).noneMatch(ConfiguracaoConsultoria::nomeDeTecnica);
        assertThat(tipos).contains("Cardio").doesNotContain("Rest pause", "Cluster");
    }

    @Test
    void recusaTipoComNomeDeTecnica() {
        for (String nome : List.of("Cluster", "rest-pause", "Rest  pause", "DROP SET", "Drop-set", "Clúster", "Restpause")) {
            assertThatThrownBy(() -> ConfiguracaoConsultoria.validarComoMetodologia(comTipos(padraoMais(nome))))
                    .as(nome)
                    .isInstanceOf(BadRequestException.class)
                    .hasMessageContaining("é uma técnica, não um tipo de série");
        }
    }

    @Test
    void copiaNoPlanoSoPassaPelaValidacaoEstrutural() {
        // A cópia da metodologia dentro de um plano antigo pode ter "Cluster": só a receita é recusada.
        assertThatNoException().isThrownBy(() -> ConfiguracaoConsultoria.validar(comTipos(padraoMais("Cluster"))));
    }

    @Test
    void aceitaTiposQueNaoSaoTecnica() {
        for (String tipo : List.of("Top set", "Back off", "Cardio", "Drop", "Cluster A")) {
            assertThatNoException().as(tipo).isThrownBy(() -> ConfiguracaoConsultoria.validarComoMetodologia(comTipos(padraoMais(tipo))));
        }
    }

    @Test
    void chaveDeTipoNormaliza() {
        assertThat(ConfiguracaoConsultoria.chaveDeTipo("Rest-Pause")).isEqualTo("rest pause");
        assertThat(ConfiguracaoConsultoria.chaveDeTipo("  Drop   set ")).isEqualTo("drop set");
        assertThat(ConfiguracaoConsultoria.chaveDeTipo("Clúster")).isEqualTo("cluster");
    }
}
