package br.com.treinos.api.consultoria;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.treinos.api.consultoria.ConfiguracaoConsultoria.Faixa;
import br.com.treinos.api.consultoria.ConfiguracaoConsultoria.Papel;
import br.com.treinos.api.consultoria.ConfiguracaoConsultoria.Repeticoes;
import br.com.treinos.api.consultoria.ConfiguracaoConsultoria.TecnicaDaMetodologia;
import br.com.treinos.api.consultoria.ConfiguracaoConsultoria.TipoDeSerie;
import br.com.treinos.api.treino.ConteudoTreino;
import br.com.treinos.api.treino.ConteudoTreino.Intensidade;
import br.com.treinos.api.treino.ConteudoTreino.Tecnica;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatNoException;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Regras da metodologia: papéis, tipo de trabalho, regra de percentuais, intensidades padrão e técnicas. */
class MetodologiaTest {

    private static final ConfiguracaoConsultoria PADRAO = ConfiguracaoConsultoria.padrao();

    private static ConfiguracaoConsultoria comTipos(List<TipoDeSerie> tipos) {
        return new ConfiguracaoConsultoria(tipos, PADRAO.tecnicas(), PADRAO.arredondamentoKg(), PADRAO.instrucoesTreino(),
                PADRAO.rodapePdf());
    }

    private static ConfiguracaoConsultoria comTecnicas(List<TecnicaDaMetodologia> tecnicas) {
        return new ConfiguracaoConsultoria(PADRAO.tipos(), tecnicas, PADRAO.arredondamentoKg(), PADRAO.instrucoesTreino(),
                PADRAO.rodapePdf());
    }

    private static List<TipoDeSerie> padraoMais(TipoDeSerie tipo) {
        List<TipoDeSerie> tipos = new ArrayList<>(PADRAO.tipos());
        tipos.add(tipo);
        return tipos;
    }

    private static TipoDeSerie tipo(String nome, Papel papel) {
        return new TipoDeSerie(nome, papel, null, null, null, null, null);
    }

    private static TipoDeSerie tipo(String nome, Papel papel, Intensidade padrao, Map<String, Intensidade> porModalidade,
                                    Map<String, List<Faixa>> regra) {
        return new TipoDeSerie(nome, papel, null, padrao, porModalidade, regra, null);
    }

    private static Intensidade percentual(int min, Integer max) {
        return new Intensidade("PERCENTUAL_WS", BigDecimal.valueOf(min), max == null ? null : BigDecimal.valueOf(max),
                null, null);
    }

    private static void recusa(ConfiguracaoConsultoria c, String trecho) {
        assertThatThrownBy(() -> ConfiguracaoConsultoria.validar(c)).isInstanceOf(BadRequestException.class)
                .hasMessageContaining(trecho);
    }

    @Test
    void padraoTemPapeisRegraDoSaraivaETecnicasEPassaNaValidacao() {
        assertThat(PADRAO.tipoTrabalho()).isEqualTo("WS");
        assertThat(PADRAO.tipo("FS").papel()).isEqualTo(Papel.PREPARACAO);
        assertThat(PADRAO.tipo("FS").regraPercentuais().get("3"))
                .containsExactly(new Faixa(50, null), new Faixa(70, null), new Faixa(85, 90));
        assertThat(PADRAO.tipo("FS").repeticoes()).isEqualTo(new Repeticoes(3, 3));
        assertThat(PADRAO.tipo("WS").intensidadePadrao().rir()).isEqualTo(1);
        assertThat(PADRAO.tipo("WS").intensidadePorModalidade().get("MAQUINA").rir()).isZero();
        assertThat(PADRAO.tipo("Top set").intensidadePadrao().modo()).isEqualTo("ACIMA_DA_ANTERIOR");
        assertThat(PADRAO.tipo("Back off").papel()).isEqualTo(Papel.POS_TRABALHO);
        assertThat(PADRAO.tipo("Cardio").papel()).isEqualTo(Papel.OUTRO);
        assertThat(PADRAO.tipo(" WS ")).isSameAs(PADRAO.tipo("WS"));
        assertThat(PADRAO.tipo("Pirâmide")).isNull();
        assertThat(PADRAO.tecnicas()).hasSize(3);
        assertThat(PADRAO.tecnica("REST_PAUSE").padrao().pausaSegundos()).isEqualTo(20);
        assertThat(PADRAO.tecnica("REST_PAUSE").padrao().pausas()).isEqualTo(1);
        assertThat(PADRAO.tecnica("CLUSTER").explicacao()).contains("Muscle Round");
        assertThat(PADRAO.tecnica("DROP_SET").padrao().quedas()).isEqualTo(1);
        assertThat(PADRAO.tecnica("PIRAMIDE")).isNull();
        assertThat(PADRAO.tipos()).extracting(TipoDeSerie::nome).noneMatch(ConfiguracaoConsultoria::nomeDeTecnica)
                .contains("Cardio");
        assertThatNoException().isThrownBy(() -> ConfiguracaoConsultoria.validarComoMetodologia(PADRAO));
    }

    @Test
    void precisaDeUmTipoDeTrabalhoEOPrimeiroDaONome() {
        recusa(comTipos(List.of(tipo("Aquecimento", Papel.AQUECIMENTO), tipo("FS", Papel.PREPARACAO))),
                "pelo menos um tipo de série de trabalho");
        ConfiguracaoConsultoria doisDeTrabalho = comTipos(List.of(tipo("Top set", Papel.TRABALHO), tipo("WS", Papel.TRABALHO)));
        assertThatNoException().isThrownBy(() -> ConfiguracaoConsultoria.validar(doisDeTrabalho));
        assertThat(doisDeTrabalho.tipoTrabalho()).isEqualTo("Top set");
        assertThat(comTipos(List.of()).tipoTrabalho()).isNull();
    }

    @Test
    void recusaPapelNuloNomeRepetidoOuLongoEExplicacaoLonga() {
        recusa(comTipos(List.of(tipo("WS", null))), "precisa de um papel");
        recusa(comTipos(List.of(tipo("WS", Papel.TRABALHO), tipo(" WS ", Papel.TRABALHO))), "repetidos");
        // Repetido também mudando só a caixa, o acento ou o hífen: o editor e o aluno procuram pelo nome.
        recusa(comTipos(List.of(tipo("WS", Papel.TRABALHO), tipo("ws", Papel.TRABALHO))), "repetidos");
        recusa(comTipos(List.of(tipo("Back off", Papel.TRABALHO), tipo("Back-off", Papel.POS_TRABALHO))), "repetidos");
        recusa(comTipos(List.of(tipo("x".repeat(31), Papel.TRABALHO))), "30 letras");
        recusa(comTipos(List.of(new TipoDeSerie("WS", Papel.TRABALHO, null, null, null, null, "x".repeat(501)))),
                "500 caracteres");
        recusa(comTipos(List.of()), "1 a 20 tipos");
    }

    @Test
    void repeticoesInvalidasSaoRecusadas() {
        for (Repeticoes ruim : List.of(new Repeticoes(6, 3), new Repeticoes(3, null), new Repeticoes(1, 501))) {
            recusa(comTipos(List.of(new TipoDeSerie("WS", Papel.TRABALHO, ruim, null, null, null, null))), "Repetições de WS");
        }
    }

    @Test
    void regraDePercentuaisSoEmPreparacaoComFaixasValidas() {
        Map<String, List<Faixa>> regra = Map.of("1", List.of(new Faixa(85, 90)));
        recusa(comTipos(List.of(tipo("WS", Papel.TRABALHO, null, null, regra))), "só em tipo de preparação");
        recusa(comTipos(padraoMais(tipo("FS2", Papel.PREPARACAO, null, null, Map.of("2", List.of(new Faixa(85, null)))))),
                "2 série(s) precisam de 2 percentual(is)");
        recusa(comTipos(padraoMais(tipo("FS2", Papel.PREPARACAO, null, null, Map.of("1", List.of(new Faixa(90, 85)))))),
                "máximo maior ou igual ao mínimo");
        recusa(comTipos(padraoMais(tipo("FS2", Papel.PREPARACAO, null, null, Map.of("1", List.of(new Faixa(0, null)))))),
                "1 a 200");
        recusa(comTipos(padraoMais(tipo("FS2", Papel.PREPARACAO, null, null, Map.of("x", List.of(new Faixa(85, null)))))),
                "quantidade de séries");
        // "01" e "+1" seriam a mesma quantidade que "1", e o editor só procura por "1".
        recusa(comTipos(padraoMais(tipo("FS2", Papel.PREPARACAO, null, null, Map.of("01", List.of(new Faixa(85, null)))))),
                "quantidade de séries");
        recusa(comTipos(padraoMais(tipo("FS2", Papel.PREPARACAO, null, null, Map.of("+1", List.of(new Faixa(85, null)))))),
                "quantidade de séries");
        recusa(comTipos(padraoMais(tipo("FS2", Papel.PREPARACAO, null, null, Map.of("11", List.of(new Faixa(85, null)))))),
                "quantidade de séries");
        assertThatNoException().isThrownBy(() -> ConfiguracaoConsultoria.validar(
                comTipos(padraoMais(tipo("FS2", Papel.PREPARACAO, null, null, regra)))));
        // Regra vazia em tipo que não é de preparação é o mesmo que nenhuma.
        assertThatNoException().isThrownBy(() -> ConfiguracaoConsultoria.validar(
                comTipos(List.of(tipo("WS", Papel.TRABALHO, null, null, Map.of())))));
    }

    @Test
    void intensidadePadraoEPorModalidadeSaoConferidas() {
        recusa(comTipos(List.of(tipo("WS", Papel.TRABALHO, percentual(250, null), null, null))), "Intensidade padrão de WS");
        recusa(comTipos(List.of(tipo("WS", Papel.TRABALHO, percentual(85, 80), null, null))), "Percentual máximo");
        recusa(comTipos(List.of(tipo("WS", Papel.TRABALHO, new Intensidade("CARGA_TRABALHO", null, null, null, 6), null,
                null))), "RIR");
        recusa(comTipos(List.of(tipo("WS", Papel.TRABALHO, new Intensidade("LIVRE", null, null, null, null), null, null))),
                "Forma de intensidade inválida");
        recusa(comTipos(List.of(tipo("WS", Papel.TRABALHO, null,
                Map.of("ELASTICO", new Intensidade("CARGA_TRABALHO", null, null, null, 1)), null))), "só LIVRE e MAQUINA");
        assertThatNoException().isThrownBy(() -> ConfiguracaoConsultoria.validar(comTipos(List.of(tipo("WS", Papel.TRABALHO,
                new Intensidade("ACIMA_DA_ANTERIOR", BigDecimal.ONE, BigDecimal.TEN, null, 0),
                Map.of("MAQUINA", new Intensidade("RPE", null, null, new BigDecimal("8.5"), null)), null)))));
    }

    @Test
    void tecnicasSaoAsTresSemRepetirComPadraoDoProprioTipo() {
        TecnicaDaMetodologia restPause = PADRAO.tecnica("REST_PAUSE");
        TecnicaDaMetodologia cluster = PADRAO.tecnica("CLUSTER");
        TecnicaDaMetodologia dropSet = PADRAO.tecnica("DROP_SET");
        recusa(comTecnicas(List.of(restPause, cluster)), "precisa das três");
        recusa(comTecnicas(List.of(restPause, cluster, dropSet, dropSet)), "sem repetir");
        recusa(comTecnicas(List.of(restPause, cluster, new TecnicaDaMetodologia("DROP_SET", "", null, null))), "1 a 30 letras");
        recusa(comTecnicas(List.of(restPause, cluster, new TecnicaDaMetodologia("DROP_SET", "Drop-set", null,
                new Tecnica("REST_PAUSE", 20, null, null, null, null, null, null)))), "é de outra técnica");
        recusa(comTecnicas(List.of(new TecnicaDaMetodologia("REST_PAUSE", "Rest pause", null,
                new Tecnica("REST_PAUSE", 700, null, null, null, null, null, null)), cluster, dropSet)), "5 a 600 segundos");
        // Padrão parcial: cluster sem blocos e rest pause só com respirações valem.
        assertThatNoException().isThrownBy(() -> ConfiguracaoConsultoria.validar(comTecnicas(List.of(
                new TecnicaDaMetodologia("REST_PAUSE", "Rest pause", null,
                        new Tecnica("REST_PAUSE", null, 5, null, null, null, null, null)),
                new TecnicaDaMetodologia("CLUSTER", "Muscle Round", "x".repeat(500),
                        new Tecnica("CLUSTER", 10, 5, null, null, null, null, null)),
                new TecnicaDaMetodologia("DROP_SET", "Drop-set", null, null)))));
    }

    @Test
    void recusaTipoComNomeDeTecnicaFixaOuConfigurada() {
        for (String nome : List.of("Cluster", "rest-pause", "Rest  pause", "DROP SET", "Drop-set", "Clúster", "Restpause")) {
            assertThatThrownBy(() -> ConfiguracaoConsultoria.validarComoMetodologia(comTipos(padraoMais(tipo(nome, Papel.OUTRO)))))
                    .as(nome)
                    .isInstanceOf(BadRequestException.class)
                    .hasMessageContaining("é uma técnica, não um tipo de série");
        }
        ConfiguracaoConsultoria muscleRound = new ConfiguracaoConsultoria(padraoMais(tipo("Muscle round", Papel.OUTRO)),
                List.of(PADRAO.tecnica("REST_PAUSE"), new TecnicaDaMetodologia("CLUSTER", "Muscle Round", null, null),
                        PADRAO.tecnica("DROP_SET")), PADRAO.arredondamentoKg(), "", "");
        assertThatThrownBy(() -> ConfiguracaoConsultoria.validarComoMetodologia(muscleRound))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("\"Muscle round\" é uma técnica");
    }

    @Test
    void copiaNoPlanoSoPassaPelaValidacaoEstrutural() {
        // A cópia da metodologia dentro de um plano pode ter "Cluster": só a receita é recusada.
        assertThatNoException().isThrownBy(() -> ConfiguracaoConsultoria.validar(comTipos(padraoMais(tipo("Cluster", Papel.OUTRO)))));
    }

    @Test
    void aceitaTiposQueNaoSaoTecnica() {
        for (String nome : List.of("Top set 2", "Pirâmide", "Drop", "Cluster A")) {
            assertThatNoException().as(nome).isThrownBy(() -> ConfiguracaoConsultoria.validarComoMetodologia(
                    comTipos(padraoMais(tipo(nome, Papel.OUTRO)))));
        }
    }

    @Test
    void chaveDeTipoNormaliza() {
        assertThat(ConfiguracaoConsultoria.chaveDeTipo("Rest-Pause")).isEqualTo("rest pause");
        assertThat(ConfiguracaoConsultoria.chaveDeTipo("  Drop   set ")).isEqualTo("drop set");
        assertThat(ConfiguracaoConsultoria.chaveDeTipo("Clúster")).isEqualTo("cluster");
    }

    @Test
    void comInstrucoesTrocaSoAsInstrucoes() {
        ConfiguracaoConsultoria com = PADRAO.comInstrucoes("Anote a carga.");
        assertThat(com.instrucoesTreino()).isEqualTo("Anote a carga.");
        assertThat(com.tipos()).isEqualTo(PADRAO.tipos());
        assertThat(com.tecnicas()).isEqualTo(PADRAO.tecnicas());
        assertThat(com.arredondamentoKg()).isEqualTo(PADRAO.arredondamentoKg());
        assertThat(PADRAO.instrucoesTreino()).isEmpty();
    }

    @Test
    void listasNulasViramVazias() {
        ConfiguracaoConsultoria c = new ConfiguracaoConsultoria(null, null, new BigDecimal("0.5"), null, null);
        assertThat(c.tipos()).isEmpty();
        assertThat(c.tecnicas()).isEmpty();
        assertThat(c.tecnica(ConteudoTreino.CLUSTER)).isNull();
        recusa(c, "1 a 20 tipos");
    }
}
