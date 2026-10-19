package br.com.treinos.api.questionarios;

import br.com.treinos.api.atualizacoes.ValidadorAtualizacao;
import br.com.treinos.api.planos.ResultadoValidacao;
import br.com.plataforma.comum.web.ApiError;
import br.com.treinos.api.web.ValidacaoException;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestFactory;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import br.com.treinos.api.web.Fuso;

import java.io.IOException;
import java.time.LocalDate;
import java.io.InputStream;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Paridade com o TypeScript: as mesmas fixtures (JSON em {@code paridade-questionario/}) são lidas aqui e no Jest
 * ({@code app/src/dominio/paridadeQuestionario.test.ts}). Compara só os caminhos/campos com erro e os avisos, nunca as
 * mensagens. Dados fictícios.
 */
class ParidadeQuestionarioTest {

    private final JsonMapper json = JsonMapper.builder().build();
    private final ValidadorQuestionario validador = new ValidadorQuestionario();
    private final ValidadorAtualizacao respostas = new ValidadorAtualizacao(json);

    private JsonNode fixture(String nome) throws IOException {
        try (InputStream in = getClass().getResourceAsStream("/paridade-questionario/" + nome)) {
            assertThat(in).as("fixture " + nome).isNotNull();
            return json.readTree(in);
        }
    }

    private static List<String> lista(JsonNode no) {
        return no.valueStream().map(JsonNode::asString).toList();
    }

    @Test
    void limitesIguaisAosDoTypeScript() throws IOException {
        Map<String, Integer> daqui = new LinkedHashMap<>();
        daqui.put("secoes", LimitesQuestionario.SECOES);
        daqui.put("perguntasPorSecao", LimitesQuestionario.PERGUNTAS_POR_SECAO);
        daqui.put("perguntasTotal", LimitesQuestionario.PERGUNTAS_TOTAL);
        daqui.put("instrucoes", LimitesQuestionario.INSTRUCOES);
        daqui.put("instrucaoTamanho", LimitesQuestionario.INSTRUCAO_TAMANHO);
        daqui.put("tituloTamanho", LimitesQuestionario.TITULO_TAMANHO);
        daqui.put("rotuloTamanho", LimitesQuestionario.ROTULO_TAMANHO);
        daqui.put("ajudaTamanho", LimitesQuestionario.AJUDA_TAMANHO);
        daqui.put("rotuloCurtoTamanho", LimitesQuestionario.ROTULO_CURTO_TAMANHO);
        daqui.put("opcoesMinimo", LimitesQuestionario.OPCOES_MINIMO);
        daqui.put("opcoesMaximo", LimitesQuestionario.OPCOES_MAXIMO);
        daqui.put("opcaoTamanho", LimitesQuestionario.OPCAO_TAMANHO);
        daqui.put("unidadeTamanho", LimitesQuestionario.UNIDADE_TAMANHO);
        daqui.put("casasMaximo", LimitesQuestionario.CASAS_MAXIMO);
        daqui.put("diasMaximo", LimitesQuestionario.DIAS_MAXIMO);
        daqui.put("diaValorMaximo", LimitesQuestionario.DIA_VALOR_MAXIMO);
        daqui.put("destaquesMaximo", LimitesQuestionario.DESTAQUES_MAXIMO);
        daqui.put("textoCurtoCapacidade", LimitesQuestionario.TEXTO_CURTO_CAPACIDADE);
        daqui.put("textoLongoCapacidade", LimitesQuestionario.TEXTO_LONGO_CAPACIDADE);
        daqui.put("capacidadeDeTextoTotal", LimitesQuestionario.CAPACIDADE_DE_TEXTO_TOTAL);
        daqui.put("rascunhoBytes", LimitesQuestionario.RASCUNHO_BYTES);
        daqui.put("respostasBytes", LimitesQuestionario.RESPOSTAS_BYTES);
        daqui.put("idTamanho", LimitesQuestionario.ID_TAMANHO);
        daqui.put("numeroAbsoluto", LimitesQuestionario.NUMERO_ABSOLUTO);
        daqui.put("fotosPorPergunta", LimitesQuestionario.FOTOS_POR_PERGUNTA);
        daqui.put("linhasMinimo", LimitesQuestionario.LINHAS_MINIMO);
        daqui.put("linhasMaximo", LimitesQuestionario.LINHAS_MAXIMO);
        daqui.put("colunasMinimo", LimitesQuestionario.COLUNAS_MINIMO);
        daqui.put("colunasMaximo", LimitesQuestionario.COLUNAS_MAXIMO);
        daqui.put("textoInformativoTamanho", LimitesQuestionario.TEXTO_INFORMATIVO_TAMANHO);
        daqui.put("declaracaoTamanho", LimitesQuestionario.DECLARACAO_TAMANHO);
        daqui.put("telefoneTamanho", LimitesQuestionario.TELEFONE_TAMANHO);
        daqui.put("telefoneDigitosMinimo", LimitesQuestionario.TELEFONE_DIGITOS_MINIMO);
        daqui.put("telefoneDigitosMaximo", LimitesQuestionario.TELEFONE_DIGITOS_MAXIMO);
        daqui.put("emailTamanho", LimitesQuestionario.EMAIL_TAMANHO);
        daqui.put("dataAnoMinimo", LimitesQuestionario.DATA_ANO_MINIMO);
        daqui.put("dataAnoMaximo", LimitesQuestionario.DATA_ANO_MAXIMO);
        daqui.put("imagemBytes", LimitesQuestionario.IMAGEM_BYTES);
        daqui.put("imagemLado", LimitesQuestionario.IMAGEM_LADO);
        daqui.put("objetivoTamanho", LimitesQuestionario.OBJETIVO_TAMANHO);

        JsonNode fixture = fixture("limites.json");
        Map<String, Integer> esperado = new LinkedHashMap<>();
        fixture.properties().forEach(e -> esperado.put(e.getKey(), e.getValue().asInt()));
        assertThat(daqui).isEqualTo(esperado);
    }

    @TestFactory
    Stream<DynamicTest> questionarios() throws IOException {
        return fixture("questionarios.json").valueStream().map(caso -> DynamicTest.dynamicTest(caso.path("nome").asString(), () -> {
            ConteudoQuestionario conteudo = json.treeToValue(caso.path("conteudo"), ConteudoQuestionario.class);
            Finalidade finalidade = Finalidade.valueOf(caso.path("finalidade").asString("ATUALIZACAO"));
            ResultadoValidacao r = validador.validar(conteudo, finalidade);
            assertThat(new TreeSet<>(r.erros().stream().map(ResultadoValidacao.Problema::caminho).toList()))
                    .as("erros").containsExactlyElementsOf(new TreeSet<>(lista(caso.path("erros"))));
            assertThat(r.avisos().stream().map(ResultadoValidacao.Problema::caminho).toList())
                    .as("avisos").isEqualTo(lista(caso.path("avisos")));
        }));
    }

    @TestFactory
    Stream<DynamicTest> respostas() throws IOException {
        return fixture("respostas.json").valueStream().map(caso -> DynamicTest.dynamicTest(caso.path("nome").asString(), () -> {
            TreeSet<String> esperado = new TreeSet<>(lista(caso.path("camposComErro")));
            TreeSet<String> obtido = new TreeSet<>();
            LocalDate hoje = caso.path("hoje").isString() ? LocalDate.parse(caso.path("hoje").asString()) : LocalDate.now(Fuso.BRASILIA);
            JsonNode aceitas = null;
            try {
                aceitas = respostas.validar(caso.path("modelo"), caso.path("respostas"), caso.path("fotosLigadas").asBoolean(true),
                        "ATUALIZACAO_INVALIDA", hoje);
            } catch (ValidacaoException e) {
                e.getProblemas().stream().map(ApiError.FieldError::field).forEach(obtido::add);
            }
            assertThat(obtido).containsExactlyElementsOf(esperado);
            if (caso.has("chavesAceitas")) {
                assertThat(aceitas).as("sem erro").isNotNull();
                assertThat(new TreeSet<>(aceitas.propertyNames())).containsExactlyElementsOf(new TreeSet<>(lista(caso.path("chavesAceitas"))));
            }
        }));
    }
}
