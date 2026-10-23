package br.com.treinos.api.consultoria;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.treinos.api.consultoria.ConfiguracaoConsultoria.Combinacao;
import br.com.treinos.api.consultoria.ConfiguracaoConsultoria.Faixa;
import br.com.treinos.api.consultoria.ConfiguracaoConsultoria.PadraoPorModalidade;
import br.com.treinos.api.consultoria.ConfiguracaoConsultoria.Papel;
import br.com.treinos.api.consultoria.ConfiguracaoConsultoria.Repeticoes;
import br.com.treinos.api.consultoria.ConfiguracaoConsultoria.TecnicaDaMetodologia;
import br.com.treinos.api.consultoria.ConfiguracaoConsultoria.TipoDeSerie;
import br.com.treinos.api.treino.ConteudoTreino;
import br.com.treinos.api.treino.ConteudoTreino.Carga;
import br.com.treinos.api.treino.ConteudoTreino.Esforco;
import br.com.treinos.api.treino.ConteudoTreino.Tecnica;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatNoException;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Regras da metodologia: papéis, códigos, tipo de trabalho, regra de percentuais, carga e esforço padrão, técnicas e combinações. */
class MetodologiaTest {

    private static final ConfiguracaoConsultoria PADRAO = ConfiguracaoConsultoria.padrao();

    private static ConfiguracaoConsultoria comTipos(List<TipoDeSerie> tipos) {
        return new ConfiguracaoConsultoria(tipos, PADRAO.tecnicas(), PADRAO.combinacoes(), PADRAO.arredondamentoKg(),
                PADRAO.instrucoesTreino(), PADRAO.rodapePdf());
    }

    private static ConfiguracaoConsultoria comTecnicas(List<TecnicaDaMetodologia> tecnicas) {
        return new ConfiguracaoConsultoria(PADRAO.tipos(), tecnicas, PADRAO.combinacoes(), PADRAO.arredondamentoKg(),
                PADRAO.instrucoesTreino(), PADRAO.rodapePdf());
    }

    private static ConfiguracaoConsultoria comCombinacoes(List<Combinacao> combinacoes) {
        return new ConfiguracaoConsultoria(PADRAO.tipos(), PADRAO.tecnicas(), combinacoes, PADRAO.arredondamentoKg(),
                PADRAO.instrucoesTreino(), PADRAO.rodapePdf());
    }

    private static List<TipoDeSerie> padraoMais(TipoDeSerie tipo) {
        List<TipoDeSerie> tipos = new ArrayList<>(PADRAO.tipos());
        tipos.add(tipo);
        return tipos;
    }

    /** O código nasce do nome (maiúsculas e sublinhado), para os testes não repetirem código sem querer. */
    private static String codigoDe(String nome) {
        return nome.toUpperCase(java.util.Locale.ROOT).replaceAll("[^A-Z0-9]", "_");
    }

    private static TipoDeSerie tipo(String nome, Papel papel) {
        return new TipoDeSerie(codigoDe(nome), nome, papel, null, null, null, null, null, null);
    }

    private static TipoDeSerie tipo(String nome, Papel papel, Carga carga, Esforco esforco,
                                    Map<String, PadraoPorModalidade> porModalidade, Map<String, List<Faixa>> regra) {
        return new TipoDeSerie(codigoDe(nome), nome, papel, null, carga, esforco, porModalidade, regra, null);
    }

    private static TipoDeSerie comCodigo(String codigo) {
        return new TipoDeSerie(codigo, "Outro", Papel.TRABALHO, null, null, null, null, null, null);
    }

    private static void recusa(ConfiguracaoConsultoria c, String trecho) {
        assertThatThrownBy(() -> ConfiguracaoConsultoria.validar(c)).isInstanceOf(BadRequestException.class)
                .hasMessageContaining(trecho);
    }

    @Test
    void padraoTemCincoTiposComCodigoPapelERegraDoSaraiva() {
        assertThat(PADRAO.tipos()).extracting(TipoDeSerie::codigo)
                .containsExactly("WARM_UP", "FEEDER", "WORKING", "TOP_SET", "BACK_OFF");
        assertThat(PADRAO.tipos()).extracting(TipoDeSerie::nome)
                .containsExactly("Aquecimento", "FS", "WS", "Top set", "Back off");
        assertThat(PADRAO.tipoTrabalho()).isEqualTo("WS");
        assertThat(PADRAO.codigoTrabalho()).isEqualTo("WORKING");
        assertThat(PADRAO.tipoPorCodigo("FEEDER").papel()).isEqualTo(Papel.PREPARACAO);
        assertThat(PADRAO.tipoPorCodigo("FEEDER").regraPercentuais().get("3"))
                .containsExactly(new Faixa(50, null), new Faixa(70, null), new Faixa(85, 90));
        assertThat(PADRAO.tipoPorCodigo("FEEDER").repeticoes()).isEqualTo(new Repeticoes(3, 3));
        assertThat(PADRAO.tipoPorCodigo("BACK_OFF").papel()).isEqualTo(Papel.POS_TRABALHO);
        assertThat(PADRAO.tipoPorCodigo("BACK_OFF").repeticoes()).isEqualTo(new Repeticoes(6, 8));
        assertThat(PADRAO.tipoPorCodigo("BACK_OFF").cargaPadrao().percentualMin()).isEqualByComparingTo("85");
        assertThat(PADRAO.tipoPorCodigo("PIRAMIDE")).isNull();
        assertThat(PADRAO.tipoPorCodigo(null)).isNull();
        assertThat(PADRAO.tipo(" WS ")).isSameAs(PADRAO.tipoPorCodigo("WORKING"));
        assertThat(PADRAO.tipo("Cardio")).isNull();
        assertThat(PADRAO.tipo(null)).isNull();
    }

    @Test
    void padraoTemCargaEEsforcoPadraoPorTipo() {
        TipoDeSerie ws = PADRAO.tipoPorCodigo("WORKING");
        assertThat(ws.cargaPadrao().modo()).isEqualTo("CARGA_TRABALHO");
        assertThat(ws.esforcoPadrao()).isEqualTo(Esforco.deRir(1));
        assertThat(ws.porModalidade().get("LIVRE").esforco().rir()).isEqualTo(1);
        assertThat(ws.porModalidade().get("MAQUINA").esforco().rir()).isZero();
        TipoDeSerie top = PADRAO.tipoPorCodigo("TOP_SET");
        assertThat(top.cargaPadrao().modo()).isEqualTo("ACIMA_DA_ANTERIOR");
        assertThat(top.porModalidade().get("LIVRE").carga().percentualMax()).isEqualByComparingTo("5");
        assertThat(top.porModalidade().get("MAQUINA").carga().percentualMin()).isEqualByComparingTo("5");
        assertThat(top.porModalidade().get("MAQUINA").carga().percentualMax()).isEqualByComparingTo("10");
        // Aquecimento e FS não levam esforço de falha por padrão.
        assertThat(PADRAO.tipoPorCodigo("WARM_UP").esforcoPadrao()).isNull();
        assertThat(PADRAO.tipoPorCodigo("FEEDER").esforcoPadrao()).isNull();
    }

    @Test
    void padraoTemAsSeisTecnicasEAsSeteCombinacoesEPassaNaValidacao() {
        assertThat(PADRAO.tecnicas()).extracting(TecnicaDaMetodologia::tipo)
                .containsExactlyElementsOf(ConteudoTreino.ESTRUTURADAS);
        assertThat(PADRAO.tecnica("REST_PAUSE").padrao().pausaSegundos()).isEqualTo(20);
        assertThat(PADRAO.tecnica("REST_PAUSE").padrao().pausas()).isEqualTo(1);
        assertThat(PADRAO.tecnica("CLUSTER").explicacao()).contains("Muscle Round");
        assertThat(PADRAO.tecnica("DROP_SET").padrao().quedas()).isEqualTo(1);
        assertThat(PADRAO.tecnica("MYO_REPS").padrao().pausaRespiracoes()).isEqualTo(5);
        assertThat(PADRAO.tecnica("PARTIAL_REPS").padrao().regiao()).isEqualTo("LIVRE");
        assertThat(PADRAO.tecnica("FORCED_REPS").padrao().tipo()).isEqualTo("FORCED_REPS");
        assertThat(PADRAO.tecnica("PIRAMIDE")).isNull();
        assertThat(PADRAO.combinacoes()).extracting(Combinacao::tipo)
                .containsExactlyElementsOf(ConteudoTreino.TECNICAS_DE_GRUPO);
        assertThat(PADRAO.combinacoes()).allSatisfy(c -> {
            assertThat(c.nome()).hasSizeLessThanOrEqualTo(30);
            assertThat(c.explicacao()).isNotBlank().hasSizeLessThanOrEqualTo(500);
        });
        assertThat(PADRAO.combinacao("CIRCUITO").nome()).isEqualTo("Circuito");
        assertThat(PADRAO.combinacao("PIRAMIDE")).isNull();
        assertThat(PADRAO.tipos()).extracting(TipoDeSerie::nome).noneMatch(ConfiguracaoConsultoria::nomeDeTecnica)
                .noneMatch(ConfiguracaoConsultoria::nomeDeCombinacao);
        assertThatNoException().isThrownBy(() -> ConfiguracaoConsultoria.validarComoMetodologia(PADRAO));
    }

    @Test
    void precisaDeUmTipoDeTrabalhoEOPrimeiroDaONome() {
        recusa(comTipos(List.of(tipo("Aquecimento", Papel.AQUECIMENTO), tipo("FS", Papel.PREPARACAO))),
                "pelo menos um tipo de série de trabalho");
        ConfiguracaoConsultoria doisDeTrabalho = comTipos(List.of(tipo("Top set", Papel.TRABALHO), tipo("WS", Papel.TRABALHO)));
        assertThatNoException().isThrownBy(() -> ConfiguracaoConsultoria.validar(doisDeTrabalho));
        assertThat(doisDeTrabalho.tipoTrabalho()).isEqualTo("Top set");
        assertThat(doisDeTrabalho.codigoTrabalho()).isEqualTo("TOP_SET");
        assertThat(comTipos(List.of()).tipoTrabalho()).isNull();
        assertThat(comTipos(List.of()).codigoTrabalho()).isNull();
    }

    @Test
    void recusaPapelNuloNomeRepetidoOuLongoEExplicacaoLonga() {
        recusa(comTipos(List.of(tipo("WS", null))), "precisa de um papel");
        recusa(comTipos(List.of(tipo("WS", Papel.TRABALHO), tipo(" WS ", Papel.TRABALHO))), "repetidos");
        // Repetido também mudando só a caixa, o acento ou o hífen: o editor e o aluno procuram pelo nome.
        recusa(comTipos(List.of(tipo("WS", Papel.TRABALHO), tipo("ws", Papel.TRABALHO))), "repetidos");
        recusa(comTipos(List.of(tipo("Back off", Papel.TRABALHO), tipo("Back-off", Papel.POS_TRABALHO))), "repetidos");
        recusa(comTipos(List.of(tipo("x".repeat(31), Papel.TRABALHO))), "30 letras");
        recusa(comTipos(List.of(new TipoDeSerie("WS", "WS", Papel.TRABALHO, null, null, null, null, null,
                "x".repeat(501)))), "500 caracteres");
        recusa(comTipos(List.of()), "1 a 20 tipos");
    }

    @Test
    void codigoDoTipoPrecisaSerValidoEUnico() {
        recusa(comTipos(List.of(comCodigo(null))), "código único");
        recusa(comTipos(List.of(comCodigo(""))), "código único");
        recusa(comTipos(List.of(comCodigo("working"))), "código único");
        recusa(comTipos(List.of(comCodigo("WORK ING"))), "código único");
        recusa(comTipos(List.of(comCodigo("WS-1"))), "código único");
        recusa(comTipos(List.of(comCodigo("A".repeat(31)))), "código único");
        recusa(comTipos(List.of(new TipoDeSerie("WORKING", "WS", Papel.TRABALHO, null, null, null, null, null, null),
                new TipoDeSerie("WORKING", "Outro", Papel.TRABALHO, null, null, null, null, null, null))), "código único");
        assertThatNoException().isThrownBy(() -> ConfiguracaoConsultoria.validar(
                comTipos(List.of(comCodigo("A".repeat(30))))));
        assertThatNoException().isThrownBy(() -> ConfiguracaoConsultoria.validar(comTipos(List.of(comCodigo("TOP_2")))));
    }

    @Test
    void repeticoesInvalidasSaoRecusadas() {
        for (Repeticoes ruim : List.of(new Repeticoes(6, 3), new Repeticoes(3, null), new Repeticoes(1, 501))) {
            recusa(comTipos(List.of(new TipoDeSerie("WORKING", "WS", Papel.TRABALHO, ruim, null, null, null, null, null))),
                    "Repetições de WS");
        }
    }

    @Test
    void regraDePercentuaisSoEmPreparacaoComFaixasValidas() {
        Map<String, List<Faixa>> regra = Map.of("1", List.of(new Faixa(85, 90)));
        recusa(comTipos(List.of(tipo("WS", Papel.TRABALHO, null, null, null, regra))), "só em tipo de preparação");
        recusa(comTipos(padraoMais(tipo("FS2", Papel.PREPARACAO, null, null, null, Map.of("2", List.of(new Faixa(85, null)))))),
                "2 série(s) precisam de 2 percentual(is)");
        recusa(comTipos(padraoMais(tipo("FS2", Papel.PREPARACAO, null, null, null, Map.of("1", List.of(new Faixa(90, 85)))))),
                "máximo maior ou igual ao mínimo");
        recusa(comTipos(padraoMais(tipo("FS2", Papel.PREPARACAO, null, null, null, Map.of("1", List.of(new Faixa(0, null)))))),
                "1 a 200");
        recusa(comTipos(padraoMais(tipo("FS2", Papel.PREPARACAO, null, null, null, Map.of("x", List.of(new Faixa(85, null)))))),
                "quantidade de séries");
        // "01" e "+1" seriam a mesma quantidade que "1", e o editor só procura por "1".
        recusa(comTipos(padraoMais(tipo("FS2", Papel.PREPARACAO, null, null, null, Map.of("01", List.of(new Faixa(85, null)))))),
                "quantidade de séries");
        recusa(comTipos(padraoMais(tipo("FS2", Papel.PREPARACAO, null, null, null, Map.of("+1", List.of(new Faixa(85, null)))))),
                "quantidade de séries");
        recusa(comTipos(padraoMais(tipo("FS2", Papel.PREPARACAO, null, null, null, Map.of("11", List.of(new Faixa(85, null)))))),
                "quantidade de séries");
        assertThatNoException().isThrownBy(() -> ConfiguracaoConsultoria.validar(
                comTipos(padraoMais(tipo("FS2", Papel.PREPARACAO, null, null, null, regra)))));
        // Regra vazia em tipo que não é de preparação é o mesmo que nenhuma.
        assertThatNoException().isThrownBy(() -> ConfiguracaoConsultoria.validar(
                comTipos(List.of(tipo("WS", Papel.TRABALHO, null, null, null, Map.of())))));
    }

    @Test
    void cargaPadraoEPorModalidadeSaoConferidas() {
        recusa(comTipos(List.of(tipo("WS", Papel.TRABALHO, Carga.percentual("PERCENTUAL_WS", 250, null), null, null, null))),
                "Carga padrão de WS");
        recusa(comTipos(List.of(tipo("WS", Papel.TRABALHO, Carga.percentual("PERCENTUAL_WS", 85, 80), null, null, null))),
                "Percentual máximo");
        recusa(comTipos(List.of(tipo("WS", Papel.TRABALHO, Carga.de("LIVRE"), null, null, null))),
                "Forma de carga inválida");
        recusa(comTipos(List.of(tipo("WS", Papel.TRABALHO, Carga.percentual("ACIMA_DA_ANTERIOR", 101, null), null, null,
                null))), "Carga padrão de WS");
        recusa(comTipos(List.of(tipo("WS", Papel.TRABALHO, Carga.percentual("ABAIXO_DA_REFERENCIA", 51, null), null, null,
                null))), "Carga padrão de WS");
        recusa(comTipos(List.of(tipo("WS", Papel.TRABALHO, null, null,
                Map.of("ELASTICO", new PadraoPorModalidade(null, Esforco.deRir(1))), null))), "só LIVRE e MAQUINA");
        recusa(comTipos(List.of(tipo("WS", Papel.TRABALHO, null, null,
                Map.of("LIVRE", new PadraoPorModalidade(Carga.percentual("PERCENTUAL_WS", 0, null), null)), null))),
                "Carga padrão de WS");
        // A referência do back off só existe na série: o padrão da metodologia não a exige.
        assertThatNoException().isThrownBy(() -> ConfiguracaoConsultoria.validar(comTipos(List.of(tipo("WS",
                Papel.TRABALHO, Carga.percentual("ABAIXO_DA_REFERENCIA", 10, 15), null, null, null)))));
        assertThatNoException().isThrownBy(() -> ConfiguracaoConsultoria.validar(comTipos(List.of(tipo("WS", Papel.TRABALHO,
                Carga.percentual("ACIMA_DA_ANTERIOR", 1, 10), Esforco.deRir(0),
                Map.of("MAQUINA", new PadraoPorModalidade(Carga.de("CARGA_TRABALHO"), Esforco.deRpe("8.5"))), null)))));
    }

    @Test
    void esforcoPadraoInformadoPrecisaDeValorValido() {
        recusa(comTipos(List.of(tipo("WS", Papel.TRABALHO, null, new Esforco(null, null), null, null))), "informe o RIR ou o RPE");
        recusa(comTipos(List.of(tipo("WS", Papel.TRABALHO, null, Esforco.deRir(6), null, null))), "RIR");
        recusa(comTipos(List.of(tipo("WS", Papel.TRABALHO, null, new Esforco(1, new BigDecimal("8")), null, null))),
                "RIR ou RPE");
        recusa(comTipos(List.of(tipo("WS", Papel.TRABALHO, null, Esforco.deRpe("8.3"), null, null))), "meio em meio");
        recusa(comTipos(List.of(tipo("WS", Papel.TRABALHO, null, null,
                Map.of("MAQUINA", new PadraoPorModalidade(null, new Esforco(null, null))), null))), "informe o RIR ou o RPE");
        assertThatNoException().isThrownBy(() -> ConfiguracaoConsultoria.validar(comTipos(List.of(tipo("WS",
                Papel.TRABALHO, null, Esforco.deRpe("10"), null, null)))));
    }

    @Test
    void tecnicasSaoAsSeisSemRepetirComPadraoDoProprioTipo() {
        TecnicaDaMetodologia restPause = PADRAO.tecnica("REST_PAUSE");
        List<TecnicaDaMetodologia> outras = PADRAO.tecnicas().stream().filter(t -> !t.tipo().equals("REST_PAUSE")).toList();
        assertThatNoException().isThrownBy(() -> ConfiguracaoConsultoria.validar(comTecnicas(List.of())));
        assertThatNoException().isThrownBy(() -> ConfiguracaoConsultoria.validar(comTecnicas(List.of(restPause))));
        assertThatNoException().isThrownBy(() -> ConfiguracaoConsultoria.validar(comTecnicas(outras)));
        List<TecnicaDaMetodologia> repetida = new ArrayList<>(PADRAO.tecnicas());
        repetida.add(restPause);
        recusa(comTecnicas(repetida), "sem repetir");
        recusa(comTecnicas(trocando("DROP_SET", new TecnicaDaMetodologia("DROP_SET", "", null, null))), "1 a 30 letras");
        recusa(comTecnicas(trocando("DROP_SET", new TecnicaDaMetodologia("DROP_SET", "Drop-set", null,
                Tecnica.restPause(20, null, null)))), "é de outra técnica");
        recusa(comTecnicas(trocando("REST_PAUSE", new TecnicaDaMetodologia("REST_PAUSE", "Rest pause", null,
                Tecnica.restPause(700, null, null)))), "5 a 600 segundos");
        recusa(comTecnicas(trocando("PARTIAL_REPS", new TecnicaDaMetodologia("PARTIAL_REPS", "Partial reps", null,
                Tecnica.partialReps(null, "NO_MEIO")))), "Região das parciais");
        recusa(comTecnicas(trocando("MYO_REPS", new TecnicaDaMetodologia("MYO_REPS", "Myo-reps", null,
                Tecnica.myoReps(1, null, null, null)))), "mini-séries");
        recusa(comTecnicas(trocando("FORCED_REPS", new TecnicaDaMetodologia("FORCED_REPS", "Forced reps", null,
                Tecnica.forcedReps(6)))), "assistidas");
        recusa(comTecnicas(trocando("CLUSTER", new TecnicaDaMetodologia("CLUSTER", "Cluster", "x".repeat(501), null))),
                "500 caracteres");
        // Padrão parcial: cluster sem blocos, rest pause só com respirações e drop-set sem pausa (0) valem.
        assertThatNoException().isThrownBy(() -> ConfiguracaoConsultoria.validar(comTecnicas(
                trocando("REST_PAUSE", new TecnicaDaMetodologia("REST_PAUSE", "Rest pause", null,
                        Tecnica.restPause(null, 5, null))))));
        assertThatNoException().isThrownBy(() -> ConfiguracaoConsultoria.validar(comTecnicas(
                trocando("DROP_SET", new TecnicaDaMetodologia("DROP_SET", "Drop-set", null,
                        Tecnica.dropSet(2, 20, null, 0))))));
        assertThatNoException().isThrownBy(() -> ConfiguracaoConsultoria.validar(comTecnicas(
                trocando("CLUSTER", new TecnicaDaMetodologia("CLUSTER", "Muscle Round", "x".repeat(500),
                        Tecnica.cluster(null, 10, 5))))));
    }

    @Test
    void tecnicaDescritivaNaoTemPadraoETipoDesconhecidoERecusado() {
        assertThatNoException().isThrownBy(() -> ConfiguracaoConsultoria.validar(comTecnicas(List.of(
                new TecnicaDaMetodologia("NEGATIVA", "Negativa", "Desça a carga devagar.", null)))));
        recusa(comTecnicas(List.of(new TecnicaDaMetodologia("NEGATIVA", "Negativa", null, Tecnica.vazia("NEGATIVA")))),
                "não tem padrão");
        recusa(comTecnicas(List.of(new TecnicaDaMetodologia("PIRAMIDE", "Pirâmide", null, null))), "desconhecida");
        List<TecnicaDaMetodologia> repetida = List.of(
                new TecnicaDaMetodologia("NEGATIVA", "Negativa", null, null),
                new TecnicaDaMetodologia("NEGATIVA", "Outra negativa", null, null));
        recusa(comTecnicas(repetida), "sem repetir");
    }

    @Test
    void zeroTecnicasEZeroCombinacoesEValido() {
        ConfiguracaoConsultoria vazia = new ConfiguracaoConsultoria(PADRAO.tipos(), List.of(), List.of(),
                PADRAO.arredondamentoKg(), "", "");
        assertThatNoException().isThrownBy(() -> ConfiguracaoConsultoria.validar(vazia));
    }

    private static List<TecnicaDaMetodologia> trocando(String tipo, TecnicaDaMetodologia nova) {
        return PADRAO.tecnicas().stream().map(t -> t.tipo().equals(tipo) ? nova : t).toList();
    }

    @Test
    void combinacoesSaoAsSeteSemRepetirComNomeEExplicacao() {
        List<Combinacao> semCircuito = PADRAO.combinacoes().stream().filter(c -> !c.tipo().equals("CIRCUITO")).toList();
        assertThatNoException().isThrownBy(() -> ConfiguracaoConsultoria.validar(comCombinacoes(List.of())));
        assertThatNoException().isThrownBy(() -> ConfiguracaoConsultoria.validar(comCombinacoes(semCircuito)));
        List<Combinacao> repetida = new ArrayList<>(PADRAO.combinacoes());
        repetida.add(PADRAO.combinacao("SUPERSET"));
        recusa(comCombinacoes(repetida), "sem repetir");
        recusa(comCombinacoes(trocandoCombinacao("SUPERSET", new Combinacao("SUPERSERIE", "Superset", null))),
                "uma de cada");
        recusa(comCombinacoes(trocandoCombinacao("SUPERSET", new Combinacao("SUPERSET", " ", null))), "1 a 30 letras");
        recusa(comCombinacoes(trocandoCombinacao("SUPERSET", new Combinacao("SUPERSET", "x".repeat(31), null))),
                "1 a 30 letras");
        recusa(comCombinacoes(trocandoCombinacao("SUPERSET", new Combinacao("SUPERSET", "Superset", "x".repeat(501)))),
                "500 caracteres");
        assertThatNoException().isThrownBy(() -> ConfiguracaoConsultoria.validar(comCombinacoes(
                trocandoCombinacao("SUPERSET", new Combinacao("SUPERSET", "Bi-set", "x".repeat(500))))));
        assertThat(new ConfiguracaoConsultoria(PADRAO.tipos(), PADRAO.tecnicas(), null, PADRAO.arredondamentoKg(), "", "")
                .combinacoes()).isEmpty();
    }

    private static List<Combinacao> trocandoCombinacao(String tipo, Combinacao nova) {
        return PADRAO.combinacoes().stream().map(c -> c.tipo().equals(tipo) ? nova : c).toList();
    }

    @Test
    void recusaTipoComNomeDeTecnicaFixaOuConfigurada() {
        for (String nome : List.of("Cluster", "rest-pause", "Rest  pause", "DROP SET", "Drop-set", "Clúster", "Restpause",
                "Myo-reps", "Myoreps", "Partial reps", "Forced reps", "Negativa", "Super-slow", "21s",
                "Pirâmide crescente", "GVT (10×10)", "FST-7", "EMOM")) {
            assertThatThrownBy(() -> ConfiguracaoConsultoria.validarComoMetodologia(comTipos(padraoMais(tipo(nome, Papel.OUTRO)))))
                    .as(nome)
                    .isInstanceOf(BadRequestException.class)
                    .hasMessageContaining("é uma técnica, não um tipo de série");
        }
        ConfiguracaoConsultoria muscleRound = new ConfiguracaoConsultoria(padraoMais(tipo("Muscle round", Papel.OUTRO)),
                trocando("CLUSTER", new TecnicaDaMetodologia("CLUSTER", "Muscle Round", null, null)),
                PADRAO.combinacoes(), PADRAO.arredondamentoKg(), "", "");
        assertThatThrownBy(() -> ConfiguracaoConsultoria.validarComoMetodologia(muscleRound))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("\"Muscle round\" é uma técnica");
    }

    @Test
    void recusaTipoComNomeDeCombinacaoFixaOuConfigurada() {
        for (String nome : List.of("Superset", "Super-set", "Agonista-antagonista", "Tri-set", "Triset", "Giant set",
                "Circuito", "Pré-exaustão", "Pos exaustao")) {
            assertThatThrownBy(() -> ConfiguracaoConsultoria.validarComoMetodologia(comTipos(padraoMais(tipo(nome, Papel.OUTRO)))))
                    .as(nome)
                    .isInstanceOf(BadRequestException.class)
                    .hasMessageContaining("é uma combinação de exercícios, não um tipo de série");
        }
        ConfiguracaoConsultoria biSet = new ConfiguracaoConsultoria(padraoMais(tipo("Bi-set", Papel.OUTRO)),
                PADRAO.tecnicas(), trocandoCombinacao("SUPERSET", new Combinacao("SUPERSET", "Bi-set", null)),
                PADRAO.arredondamentoKg(), "", "");
        assertThatThrownBy(() -> ConfiguracaoConsultoria.validarComoMetodologia(biSet))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("\"Bi-set\" é uma combinação");
    }

    @Test
    void copiaNoPlanoSoPassaPelaValidacaoEstrutural() {
        // A cópia da metodologia dentro de um plano pode ter "Cluster": só a receita é recusada.
        assertThatNoException().isThrownBy(() -> ConfiguracaoConsultoria.validar(comTipos(padraoMais(tipo("Cluster", Papel.OUTRO)))));
    }

    @Test
    void aceitaTiposQueNaoSaoTecnicaNemCombinacao() {
        for (String nome : List.of("Top set 2", "Pirâmide", "Drop", "Cluster A", "Circuito A")) {
            assertThatNoException().as(nome).isThrownBy(() -> ConfiguracaoConsultoria.validarComoMetodologia(
                    comTipos(padraoMais(tipo(nome, Papel.OUTRO)))));
        }
    }

    @Test
    void chaveDeTipoNormaliza() {
        assertThat(ConfiguracaoConsultoria.chaveDeTipo("Rest-Pause")).isEqualTo("rest pause");
        assertThat(ConfiguracaoConsultoria.chaveDeTipo("  Drop   set ")).isEqualTo("drop set");
        assertThat(ConfiguracaoConsultoria.chaveDeTipo("Back\u202Foff")).isEqualTo("back off");
        assertThat(ConfiguracaoConsultoria.chaveDeTipo("Clúster")).isEqualTo("cluster");
        assertThat(ConfiguracaoConsultoria.chaveDeTipo("Pré–exaustão")).isEqualTo("pre exaustao");
    }

    @Test
    void comInstrucoesTrocaSoAsInstrucoes() {
        ConfiguracaoConsultoria com = PADRAO.comInstrucoes("Anote a carga.");
        assertThat(com.instrucoesTreino()).isEqualTo("Anote a carga.");
        assertThat(com.tipos()).isEqualTo(PADRAO.tipos());
        assertThat(com.tecnicas()).isEqualTo(PADRAO.tecnicas());
        assertThat(com.combinacoes()).isEqualTo(PADRAO.combinacoes());
        assertThat(com.arredondamentoKg()).isEqualTo(PADRAO.arredondamentoKg());
        assertThat(PADRAO.instrucoesTreino()).isEmpty();
    }

    @Test
    void listasNulasViramVazias() {
        ConfiguracaoConsultoria c = new ConfiguracaoConsultoria(null, null, null, new BigDecimal("0.5"), null, null);
        assertThat(c.tipos()).isEmpty();
        assertThat(c.tecnicas()).isEmpty();
        assertThat(c.combinacoes()).isEmpty();
        assertThat(c.tecnica(ConteudoTreino.CLUSTER)).isNull();
        assertThat(c.combinacao(ConteudoTreino.CIRCUITO)).isNull();
        recusa(c, "1 a 20 tipos");
    }

    @Test
    void metodologiaPadraoVoltaIgualDoJson() {
        tools.jackson.databind.json.JsonMapper json = tools.jackson.databind.json.JsonMapper.builder().build();
        ConfiguracaoConsultoria volta = json.readValue(json.writeValueAsString(PADRAO), ConfiguracaoConsultoria.class);
        assertThat(volta).isEqualTo(PADRAO);
    }
}
