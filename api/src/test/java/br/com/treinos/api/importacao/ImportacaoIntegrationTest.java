package br.com.treinos.api.importacao;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.Documentos;
import br.com.treinos.api.conta.ContaLocalRepositorio;
import br.com.treinos.api.conta.DireitosLocais;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doReturn;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Importação de planilha: prévia sem efeito, confirmação, regras e permissões. Só dados fictícios. */
@AutoConfigureMockMvc
@TestPropertySource(properties = "treinos.plano.aplicar=true")
class ImportacaoIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private ContaLocalRepositorio contas;
    @Autowired private PlatformTransactionManager transacoes;
    @MockitoSpyBean private br.com.treinos.api.conta.PlanoDaConsultoria plano;

    private ApiDeTeste api;
    private JsonNode treinador;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
    }

    @Test
    void previaNaoGravaECsvEXlsxCriamAluno() throws Exception {
        String email = unico("ana");
        String csv = "nome;email\nAna Fictícia;" + email + "\n";
        String config = config("email", "IGNORAR", Map.of("nome", 0, "email", 1));
        JsonNode previa = enviar("alunos/previa", "alunos.csv", csv.getBytes(StandardCharsets.UTF_8), config, 200);
        assertThat(previa.path("novos").asInt()).isEqualTo(1);
        assertThat(previa.path("comErro").asInt()).isZero();
        assertThat(api.get("/alunos", treinador, 200).path("total").asInt()).isZero();
        JsonNode feito = confirmar("alunos", "alunos.csv", csv.getBytes(StandardCharsets.UTF_8), config, previa.path("hash").asString());
        assertThat(feito.path("situacao").asString()).isEqualTo("CONCLUIDA");
        assertThat(api.get("/alunos", treinador, 200).path("total").asInt()).isEqualTo(1);
        String outro = unico("bruno");
        String csv2 = "nome;email\nBruno Fictício;" + outro + "\n";
        JsonNode previaX = enviar("alunos/previa", "alunos.xlsx", xlsx(csv2), config, 200);
        confirmar("alunos", "alunos.xlsx", xlsx(csv2), config, previaX.path("hash").asString());
        assertThat(api.get("/alunos", treinador, 200).path("total").asInt()).isEqualTo(2);
    }

    @Test
    void colunasTrazemAsPrimeirasLinhasSemGravarNada() throws Exception {
        StringBuilder csv = new StringBuilder("Nome do aluno;E-mail;Obs\n");
        for (int i = 1; i <= 7; i++) {
            csv.append("Aluno Fictício ").append(i).append(';').append(unico("amostra" + i)).append(';')
                    .append(i == 1 ? "x".repeat(300) : "").append('\n');
        }
        byte[] bytes = csv.toString().getBytes(StandardCharsets.UTF_8);
        JsonNode colunas = enviar("alunos/colunas", "alunos.csv", bytes, "{}", 200);
        assertThat(colunas.path("colunas").size()).isEqualTo(3);
        assertThat(colunas.path("linhas").asInt()).isEqualTo(7);
        JsonNode amostra = colunas.path("amostra");
        assertThat(amostra.size()).isEqualTo(7);
        assertThat(colunas.path("amostraCortada").asBoolean()).isFalse();
        assertThat(colunas.path("numerosDasLinhas").get(0).asInt()).isEqualTo(2);
        assertThat(colunas.path("numerosDasLinhas").get(6).asInt()).isEqualTo(8);
        assertThat(amostra.get(0).get(0).asString()).isEqualTo("Aluno Fictício 1");
        assertThat(amostra.get(0).get(2).asString()).hasSize(ImportacaoService.TEXTO_DA_AMOSTRA + 1).endsWith("…");
        assertThat(amostra.get(1).get(2).asString()).isEmpty();

        var semCabecalho = multipart("/importacoes/alunos/colunas")
                .file(new MockMultipartFile("arquivo", "alunos.csv", "text/csv", bytes))
                .param("linhaDoCabecalho", "0")
                .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(treinador))
                .header("X-Treinos-Cliente", "nativo");
        JsonNode sem = json.readTree(mvc.perform(semCabecalho).andExpect(status().isOk()).andReturn()
                .getResponse().getContentAsString(StandardCharsets.UTF_8));
        assertThat(sem.path("linhas").asInt()).isEqualTo(8);
        assertThat(sem.path("amostra").get(0).get(0).asString()).isEqualTo("Nome do aluno");
        assertThat(sem.path("numerosDasLinhas").get(0).asInt()).isEqualTo(1);

        assertThat(api.get("/alunos", treinador, 200).path("total").asInt()).isZero();
        assertThat(api.get("/importacoes", treinador, 200).path("total").asInt()).isZero();
    }

    @Test
    void linhaDoCabecalhoPulaOsTitulosDeCimaEOHashCobreAEscolha() throws Exception {
        String a = unico("cab-a");
        String b = unico("cab-b");
        // Planilha com título e uma linha em branco em cima: o cabeçalho é a linha 4 (a 2 em branco não é lida).
        String csv = "Relatório fictício de alunos\n\n\nnome;email\nAna Fictícia;" + a + "\nBia Fictícia;" + b + "\n";
        byte[] bytes = csv.getBytes(StandardCharsets.UTF_8);
        Map<String, Integer> mapa = Map.of("nome", 0, "email", 1);

        var colunasDaLinha4 = multipart("/importacoes/alunos/colunas")
                .file(new MockMultipartFile("arquivo", "alunos.csv", "text/csv", bytes))
                .param("linhaDoCabecalho", "4")
                .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(treinador))
                .header("X-Treinos-Cliente", "nativo");
        JsonNode colunas = json.readTree(mvc.perform(colunasDaLinha4).andExpect(status().isOk()).andReturn()
                .getResponse().getContentAsString(StandardCharsets.UTF_8));
        assertThat(colunas.path("colunas").get(0).asString()).isEqualTo("nome");
        assertThat(colunas.path("colunas").get(1).asString()).isEqualTo("email");
        assertThat(colunas.path("linhas").asInt()).isEqualTo(2);
        assertThat(colunas.path("numerosDasLinhas").get(0).asInt()).isEqualTo(5);

        JsonNode previa = enviar("alunos/previa", "alunos.csv", bytes, configComLinha(4, mapa), 200);
        assertThat(previa.path("linhas").asInt()).isEqualTo(2);
        assertThat(previa.path("comErro").asInt()).isZero();
        assertThat(previa.path("novos").asInt()).isEqualTo(2);

        // A escolha da linha entra no hash: a confirmação com outra linha recusa.
        JsonNode recusa = enviar("alunos", "alunos.csv", bytes, configComLinha(1, mapa), previa.path("hash").asString(), 409);
        assertThat(recusa.path("codigo").asString()).isEqualTo("PREVIA_DESATUALIZADA");
        assertThat(api.get("/alunos", treinador, 200).path("total").asInt()).isZero();

        // Ajuste numa linha de cima do cabeçalho recusa; na de dados vale, com o número da linha no arquivo.
        enviar("alunos/previa", "alunos.csv", bytes, configComLinha(4, mapa, List.of(Map.of("linha", 1, "coluna", 0, "valor", "x"))), 422);
        enviar("alunos/previa", "alunos.csv", bytes, configComLinha(4, mapa, List.of(Map.of("linha", 4, "coluna", 0, "valor", "x"))), 422);
        enviar("alunos/previa", "alunos.csv", bytes, configComLinha(4, mapa, List.of(Map.of("linha", 5, "coluna", 0, "valor", "Ana Ajustada"))), 200);

        JsonNode feito = confirmar("alunos", "alunos.csv", bytes, configComLinha(4, mapa), previa.path("hash").asString());
        assertThat(feito.path("novos").asInt()).isEqualTo(2);
        assertThat(feito.path("configuracao").path("linhaDoCabecalho").asInt()).isEqualTo(4);
        assertThat(feito.path("configuracao").has("cabecalho")).isFalse();
        assertThat(api.get("/alunos?busca=Relat", treinador, 200).path("total").asInt()).isZero();
        assertThat(api.get("/alunos?busca=Bia", treinador, 200).path("total").asInt()).isEqualTo(1);
    }

    @Test
    void linhaDoCabecalhoInvalidaOuFaltandoEhRecusadaComArquivoInvalido() throws Exception {
        byte[] bytes = ("nome;email\nAna Fictícia;" + unico("cab-inv") + "\n").getBytes(StandardCharsets.UTF_8);
        Map<String, Integer> mapa = Map.of("nome", 0, "email", 1);
        List<String> recusadas = List.of(
                configComLinha(3, mapa),                                  // a linha 3 não existe no arquivo
                configComLinha(51, mapa),                                 // acima do teto
                configComLinha(-1, mapa),
                json.writeValueAsString(Map.of("aba", 0, "chave", "email", "existentes", "IGNORAR", "mapeamento", mapa)),
                // Formato antigo: só `cabecalho` não vale.
                json.writeValueAsString(Map.of("aba", 0, "cabecalho", true, "chave", "email", "existentes", "IGNORAR", "mapeamento", mapa)),
                json.writeValueAsString(Map.of("aba", 0, "linhaDoCabecalho", "1", "chave", "email", "existentes", "IGNORAR", "mapeamento", mapa)),
                json.writeValueAsString(Map.of("aba", 0, "linhaDoCabecalho", 1.5, "chave", "email", "existentes", "IGNORAR", "mapeamento", mapa)));
        for (String config : recusadas) {
            JsonNode erro = enviar("alunos/previa", "alunos.csv", bytes, config, 422);
            assertThat(erro.path("codigo").asString()).as(config).isEqualTo("ARQUIVO_INVALIDO");
        }
        // Linha 2 é a de dados, sem nada depois dela: sobra zero linha para importar.
        assertThat(enviar("alunos/previa", "alunos.csv", bytes, configComLinha(2, mapa), 422).path("codigo").asString())
                .isEqualTo("ARQUIVO_INVALIDO");
        for (String linha : List.of("51", "-1", "3")) {
            var colunas = multipart("/importacoes/alunos/colunas")
                    .file(new MockMultipartFile("arquivo", "alunos.csv", "text/csv", bytes))
                    .param("linhaDoCabecalho", linha)
                    .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(treinador))
                    .header("X-Treinos-Cliente", "nativo");
            mvc.perform(colunas).andExpect(status().isUnprocessableEntity());
        }
    }

    @Test
    void ajustesDaTabelaCorrigemERemovemLinhasECobremOHash() throws Exception {
        String a = unico("ajuste-a");
        String c = unico("ajuste-c");
        String csv = "nome;email\nAna Fictícia;" + a + "\nBia Fictícia;nao-e-email\nCaio Fictício;" + c + "\n";
        byte[] bytes = csv.getBytes(StandardCharsets.UTF_8);
        Map<String, Integer> mapa = Map.of("nome", 0, "email", 1);
        JsonNode semAjuste = enviar("alunos/previa", "alunos.csv", bytes, config("email", "IGNORAR", mapa), 200);
        assertThat(semAjuste.path("comErro").asInt()).isEqualTo(1);
        assertThat(semAjuste.path("erros").get(0).path("linha").asInt()).isEqualTo(3);

        String corrigido = unico("ajuste-b");
        String comAjuste = configComAjustes(mapa, List.of(Map.of("linha", 3, "coluna", 1, "valor", corrigido)), List.of(4));
        JsonNode previa = enviar("alunos/previa", "alunos.csv", bytes, comAjuste, 200);
        assertThat(previa.path("comErro").asInt()).isZero();
        assertThat(previa.path("linhas").asInt()).isEqualTo(2);
        assertThat(previa.path("novos").asInt()).isEqualTo(2);
        assertThat(previa.path("hash").asString()).isNotEqualTo(semAjuste.path("hash").asString());

        // Ajustes diferentes dos da prévia: a confirmação recusa (o hash cobre os ajustes).
        String outroAjuste = configComAjustes(mapa, List.of(Map.of("linha", 3, "coluna", 1, "valor", corrigido)), List.of());
        JsonNode recusa = enviar("alunos", "alunos.csv", bytes, outroAjuste, previa.path("hash").asString(), 409);
        assertThat(recusa.path("codigo").asString()).isEqualTo("PREVIA_DESATUALIZADA");
        assertThat(api.get("/alunos", treinador, 200).path("total").asInt()).isZero();

        JsonNode feito = confirmar("alunos", "alunos.csv", bytes, comAjuste, previa.path("hash").asString());
        assertThat(feito.path("novos").asInt()).isEqualTo(2);
        assertThat(feito.path("configuracao").has("ajustes")).isFalse();
        assertThat(api.get("/alunos?busca=Caio", treinador, 200).path("total").asInt()).isZero();
        assertThat(api.get("/alunos?busca=Bia", treinador, 200).path("total").asInt()).isEqualTo(1);
        String gravada = jdbc.queryForObject("select configuracao from importacao where id = ?::uuid", String.class,
                feito.path("id").asString());
        assertThat(gravada).doesNotContain(corrigido).doesNotContain("ajustes");
    }

    @Test
    void ajustesForaDaPlanilhaOuAcimaDosLimitesSaoRecusadosSemEco() throws Exception {
        byte[] bytes = ("nome;email\nAna Fictícia;" + unico("lim") + "\n").getBytes(StandardCharsets.UTF_8);
        Map<String, Integer> mapa = Map.of("nome", 0, "email", 1);
        String segredo = "valor-que-nao-pode-voltar";
        List<String> recusados = List.of(
                configComAjustes(mapa, List.of(Map.of("linha", 1, "coluna", 0, "valor", segredo)), List.of()),
                configComAjustes(mapa, List.of(Map.of("linha", 99, "coluna", 0, "valor", segredo)), List.of()),
                configComAjustes(mapa, List.of(), List.of(99)),
                configComAjustes(mapa, List.of(Map.of("linha", 2, "coluna", 0, "valor", "x".repeat(AjustesDaImportacao.TEXTO_MAXIMO + 1))), List.of()),
                configComAjustes(mapa, List.of(Map.of("linha", 2, "coluna", 0, "valor", segredo), Map.of("linha", 2, "coluna", 0, "valor", "b")), List.of()),
                configComAjustes(mapa, List.of(Map.of("linha", 2, "coluna", 256, "valor", segredo)), List.of()),
                configComAjustes(mapa, List.of(), java.util.stream.IntStream.rangeClosed(2, AjustesDaImportacao.REMOVIDAS_MAXIMO + 2).boxed().toList()));
        for (String config : recusados) {
            JsonNode erro = enviar("alunos/previa", "alunos.csv", bytes, config, 422);
            assertThat(erro.path("codigo").asString()).isEqualTo("ARQUIVO_INVALIDO");
            assertThat(erro.toString()).doesNotContain(segredo);
        }
        // Tirar a única linha deixa o arquivo sem nada para importar.
        JsonNode vazio = enviar("alunos/previa", "alunos.csv", bytes, configComAjustes(mapa, List.of(), List.of(2)), 422);
        assertThat(vazio.path("codigo").asString()).isEqualTo("ARQUIVO_INVALIDO");
    }

    @Test
    void amostraDasColunasParaNoTetoDeLinhasEDeCelulas() throws Exception {
        StringBuilder estreita = new StringBuilder("Nome;E-mail\n");
        for (int i = 1; i <= ImportacaoService.LINHAS_DA_AMOSTRA + 5; i++) {
            estreita.append("Aluno ").append(i).append(";a").append(i).append("@exemplo.test\n");
        }
        JsonNode porLinhas = enviar("alunos/colunas", "alunos.csv", estreita.toString().getBytes(StandardCharsets.UTF_8), "{}", 200);
        assertThat(porLinhas.path("linhas").asInt()).isEqualTo(ImportacaoService.LINHAS_DA_AMOSTRA + 5);
        assertThat(porLinhas.path("amostra").size()).isEqualTo(ImportacaoService.LINHAS_DA_AMOSTRA);
        assertThat(porLinhas.path("numerosDasLinhas").size()).isEqualTo(ImportacaoService.LINHAS_DA_AMOSTRA);
        assertThat(porLinhas.path("amostraCortada").asBoolean()).isTrue();

        int largura = 100;
        StringBuilder larga = new StringBuilder();
        for (int c = 0; c < largura; c++) {
            larga.append(c == 0 ? "" : ";").append("C").append(c);
        }
        larga.append('\n');
        for (int l = 0; l < 250; l++) {
            for (int c = 0; c < largura; c++) {
                larga.append(c == 0 ? "" : ";").append(l);
            }
            larga.append('\n');
        }
        JsonNode porCelulas = enviar("alunos/colunas", "alunos.csv", larga.toString().getBytes(StandardCharsets.UTF_8), "{}", 200);
        assertThat(porCelulas.path("linhas").asInt()).isEqualTo(250);
        assertThat(porCelulas.path("amostra").size()).isEqualTo(ImportacaoService.CELULAS_DA_AMOSTRA / largura);
        assertThat(porCelulas.path("amostraCortada").asBoolean()).isTrue();
        assertThat(api.get("/importacoes", treinador, 200).path("total").asInt()).isZero();
    }

    @Test
    void tresRegrasECelulaVaziaNaoApaga() throws Exception {
        String email = unico("regra");
        String base = "nome;email;objetivo\nRegra Fictícia;" + email + ";\n";
        String config = config("email", "IGNORAR", Map.of("nome", 0, "email", 1, "objetivo", 2));
        confirmar("alunos", "a.csv", base.getBytes(StandardCharsets.UTF_8), config, hash("alunos", "a.csv", base, config));
        UUID id = UUID.fromString(api.get("/alunos", treinador, 200).path("itens").get(0).path("id").asString());
        String comObjetivo = "nome;email;objetivo\nRegra Fictícia;" + email + ";Ganhar força\n";
        JsonNode ignorar = previa("alunos", "b.csv", comObjetivo, config);
        assertThat(ignorar.path("ignorados").asInt()).isEqualTo(1);
        String completar = config("email", "COMPLETAR", Map.of("nome", 0, "email", 1, "objetivo", 2));
        confirmar("alunos", "c.csv", comObjetivo.getBytes(StandardCharsets.UTF_8), completar, hash("alunos", "c.csv", comObjetivo, completar));
        assertThat(api.get("/alunos/" + id, treinador, 200).path("objetivo").asString()).isEqualTo("Ganhar força");
        String atualizar = config("email", "ATUALIZAR", Map.of("nome", 0, "email", 1, "objetivo", 2));
        String troca = "nome;email;objetivo\nRegra Fictícia;" + email + ";Manter força\n";
        confirmar("alunos", "d.csv", troca.getBytes(StandardCharsets.UTF_8), atualizar, hash("alunos", "d.csv", troca, atualizar));
        String vazio = "nome;email;objetivo\nRegra Fictícia;" + email + ";\n";
        confirmar("alunos", "e.csv", vazio.getBytes(StandardCharsets.UTF_8), atualizar, hash("alunos", "e.csv", vazio, atualizar));
        assertThat(api.get("/alunos/" + id, treinador, 200).path("objetivo").asString()).isEqualTo("Manter força");
    }

    @Test
    void chavePorCpfNaoEcoaDocumentoERecusaODeOutro() throws Exception {
        String dono = unico("dono");
        api.post("/alunos", treinador, Map.of("nome", "Dono Fictício", "email", dono, "cpf", "529.982.247-25"), 200);
        String csv = "nome;email;cpf\nOutra Fictícia;" + unico("outra") + ";529.982.247-25\nZero Fictício;" + unico("zero") + ";012.345.678-90\n";
        String config = config("email", "IGNORAR", Map.of("nome", 0, "email", 1, "cpf", 2));
        JsonNode previa = previa("alunos", "cpf.csv", csv, config);
        assertThat(previa.path("comErro").asInt()).isEqualTo(1);
        assertThat(previa.path("novos").asInt()).isEqualTo(1);
        assertThat(previa.toString()).doesNotContain("529982247");
        confirmar("alunos", "cpf.csv", csv.getBytes(StandardCharsets.UTF_8), config, previa.path("hash").asString());
        JsonNode alunos = api.get("/alunos", treinador, 200);
        assertThat(alunos.path("total").asInt()).isEqualTo(2);
        String idZero = "";
        for (JsonNode item : alunos.path("itens")) {
            if ("Zero Fictício".equals(item.path("nome").asString())) {
                idZero = item.path("id").asString();
            }
        }
        assertThat(api.get("/alunos/" + idZero, treinador, 200).path("cpf").asString()).isEqualTo("012.345.678-90");
    }

    @Test
    void limiteDoPlanoDeixaALinhaDeFora() throws Exception {
        UUID consultoria = jdbc.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class,
                treinador.path("usuario").path("id").asString());
        contas.gravarDireitos(new DireitosLocais(consultoria, UUID.randomUUID(), 1, "ATIVA", true, null, null, "PAGO", "Pago",
                Map.of("alunos_ativos", 1L), List.of("MOBILIDADE", "PDF", "EQUIPE"), Instant.now()));
        String csv = "nome;email\nUm Fictício;" + unico("um") + "\nDois Fictício;" + unico("dois") + "\n";
        String config = config("email", "IGNORAR", Map.of("nome", 0, "email", 1));
        JsonNode previa = previa("alunos", "limite.csv", csv, config);
        assertThat(previa.path("novos").asInt()).isEqualTo(1);
        assertThat(previa.path("erros").get(0).path("motivo").asString()).isEqualTo("Limite de alunos do plano");
        confirmar("alunos", "limite.csv", csv.getBytes(StandardCharsets.UTF_8), config, previa.path("hash").asString());
        assertThat(api.get("/alunos", treinador, 200).path("total").asInt()).isEqualTo(1);
    }

    @Test
    void anonimizadoNaoEAtualizadoEHashErradoNaoGrava() throws Exception {
        UUID id = api.criarAluno(treinador, "Anon Fictício");
        String email = unico("anon");
        jdbc.update("update aluno set email = ?, anonimizado_em = now() where id = ?::uuid", email, id.toString());
        String csv = "nome;email\nAnon Trocado;" + email + "\n";
        String config = config("email", "ATUALIZAR", Map.of("nome", 0, "email", 1));
        JsonNode previa = previa("alunos", "anon.csv", csv, config);
        assertThat(previa.path("erros").get(0).path("motivo").asString()).contains("anonimizado");
        enviar("alunos", "anon.csv", csv.getBytes(StandardCharsets.UTF_8), config, "hash-errado", 409);
        assertThat(api.get("/alunos/" + id, treinador, 200).path("nome").asString()).isEqualTo("Anon Fictício");
    }

    @Test
    void outraConsultoriaNaoVeESemPermissaoRecebe403() throws Exception {
        String csv = "nome;email\nVisivel Fictício;" + unico("vis") + "\n";
        String config = config("email", "IGNORAR", Map.of("nome", 0, "email", 1));
        JsonNode feito = confirmar("alunos", "v.csv", csv.getBytes(StandardCharsets.UTF_8), config, hash("alunos", "v.csv", csv, config));
        api.get("/importacoes/" + feito.path("id").asString(), api.novoTreinador(), 404);
        String perfil = api.post("/perfis", treinador, Map.of("nome", "Só leitura fictícia", "permissoes", java.util.Set.of("ALUNO_LER")), 200)
                .path("id").asString();
        String email = ApiDeTeste.emailUnico("leitor");
        JsonNode convite = api.post("/usuarios/convites", treinador, Map.of("nome", "Leitor Fictício", "email", email, "perfilId", perfil), 200);
        JsonNode leitor = api.post("/publico/convites-equipe/aceitar", null, Map.of("codigo", convite.path("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
        enviarComo(leitor, "alunos/previa", "a.csv", csv.getBytes(StandardCharsets.UTF_8), config, null, 403);
    }

    @Test
    void colunaSensivelSemPermissaoE403() throws Exception {
        String perfil = api.post("/perfis", treinador, Map.of("nome", "Altera cadastro", "permissoes", java.util.Set.of("ALUNO_LER", "ALUNO_ALTERAR")), 200)
                .path("id").asString();
        JsonNode convite = api.post("/usuarios/convites", treinador, Map.of("nome", "Editor Fictício", "email", ApiDeTeste.emailUnico("editor"), "perfilId", perfil), 200);
        JsonNode editor = api.post("/publico/convites-equipe/aceitar", null, Map.of("codigo", convite.path("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
        String csv = "nome;cpf\nEditor Alvo;390.533.447-05\n";
        String config = config("nome", "IGNORAR", Map.of("nome", 0, "cpf", 1));
        enviarComo(editor, "alunos/previa", "s.csv", csv.getBytes(StandardCharsets.UTF_8), config, null, 403);
    }

    @Test
    void pesosExerciciosAlimentosSuplementosEOutros() throws Exception {
        String email = unico("peso");
        String alunos = "nome;email\nPeso Fictício;" + email + "\n";
        String configAluno = config("email", "IGNORAR", Map.of("nome", 0, "email", 1));
        confirmar("alunos", "p.csv", alunos.getBytes(StandardCharsets.UTF_8), configAluno, hash("alunos", "p.csv", alunos, configAluno));
        String pesos = "aluno;data;peso\n" + email + ";01/01/2026;70,5\n";
        String configPeso = config("email", "IGNORAR", Map.of("aluno", 0, "data", 1, "peso", 2));
        JsonNode previaPeso = previa("pesos", "pesos.csv", pesos, configPeso);
        assertThat(previaPeso.path("novos").asInt()).isEqualTo(1);
        confirmar("pesos", "pesos.csv", pesos.getBytes(StandardCharsets.UTF_8), configPeso, previaPeso.path("hash").asString());
        JsonNode deNovo = previa("pesos", "pesos.csv", pesos, configPeso);
        assertThat(deNovo.path("ignorados").asInt()).isEqualTo(1);
        String substituir = config("email", "SUBSTITUIR", Map.of("aluno", 0, "data", 1, "peso", 2));
        String novoPeso = "aluno;data;peso\n" + email + ";01/01/2026;71\n";
        confirmar("pesos", "pesos2.csv", novoPeso.getBytes(StandardCharsets.UTF_8), substituir, hash("pesos", "pesos2.csv", novoPeso, substituir));

        String exercicios = "nome;grupo;modalidade\nRemada fictícia;Costas;livre\n";
        String configEx = config("nome", "IGNORAR", Map.of("nome", 0, "grupo", 1, "modalidade", 2));
        confirmar("exercicios", "ex.csv", exercicios.getBytes(StandardCharsets.UTF_8), configEx, hash("exercicios", "ex.csv", exercicios, configEx));
        assertThat(api.get("/exercicios", treinador, 200)).hasSize(1);

        String alimentos = "nome;quantidade;unidade;kcal;proteina;carboidrato;gordura;grupo\n"
                + "Aveia fictícia;100;g;380;13;67;7;  Cereais   e derivados \n"
                + "Grupo longo fictício;100;g;1;1;1;1;" + "g".repeat(61) + "\n";
        String configAl = config("nome", "IGNORAR", Map.of("nome", 0, "quantidade", 1, "unidade", 2, "kcal", 3, "proteina", 4,
                "carboidrato", 5, "gordura", 6, "grupo", 7));
        JsonNode feitoAlimentos = confirmar("alimentos", "al.csv", alimentos.getBytes(StandardCharsets.UTF_8), configAl,
                hash("alimentos", "al.csv", alimentos, configAl));
        // O grupo passa pela mesma regra do cadastro (espaços sobrando saem, até 60 caracteres).
        assertThat(feitoAlimentos.path("comErro").asInt()).isEqualTo(1);
        assertThat(feitoAlimentos.path("erros").get(0).path("campo").asString()).isEqualTo("grupo");
        assertThat(api.get("/alimentos", treinador, 200)).hasSize(1);
        assertThat(api.get("/alimentos", treinador, 200).get(0).path("grupo").asString()).isEqualTo("Cereais e derivados");

        String suplementos = "nome;marca\nWhey fictício;Marca Fictícia\n";
        String configSu = config("nome_marca", "IGNORAR", Map.of("nome", 0, "marca", 1));
        confirmar("suplementos", "su.csv", suplementos.getBytes(StandardCharsets.UTF_8), configSu, hash("suplementos", "su.csv", suplementos, configSu));

        String outros = "nome;categoria\nCafeína fictícia;Estimulante\n";
        String configOu = config("nome", "IGNORAR", Map.of("nome", 0, "categoria", 1));
        JsonNode outro = confirmar("outros", "ou.csv", outros.getBytes(StandardCharsets.UTF_8), configOu, hash("outros", "ou.csv", outros, configOu));
        assertThat(outro.path("situacao").asString()).isEqualTo("CONCLUIDA");
        JsonNode auditoria = api.get("/auditoria?acao=IMPORTACAO_CONCLUIDA", treinador, 200);
        assertThat(auditoria.path("itens").toString()).contains("Importou dados de outros.");
        assertThat(auditoria.toString()).doesNotContain(email);
    }

    @Test
    void modelosVersionadosPassamNaPrevia() throws Exception {
        Path pasta = Path.of("..", "app", "public", "modelos", "importacao");
        String alunos = config("email", "IGNORAR", colunas("nome", "email", "telefone", "cpf", "objetivo", "observacoes",
                "cep", "logradouro", "numero", "complemento", "bairro", "cidade", "uf", "responsavel", "dias", "situacao"));
        for (String extensao : List.of("csv", "xlsx")) {
            JsonNode previa = previaArquivo("alunos", pasta.resolve("alunos." + extensao), alunos);
            assertThat(previa.path("novos").asInt()).isEqualTo(3);
            assertThat(previa.path("comErro").asInt()).isEqualTo(0);
            assertThat(previa.path("erros")).isEmpty();
            assertThat(previa.path("amostra").toString()).contains("012.345.678-90");
        }
        byte[] alunosCsv = Files.readAllBytes(pasta.resolve("alunos.csv"));
        confirmar("alunos", "alunos.csv", alunosCsv, alunos, hashArquivo("alunos", pasta.resolve("alunos.csv"), alunos));

        String pesos = config("email", "IGNORAR", colunas("aluno", "data", "peso", "observacao"));
        String exercicios = config("nome", "IGNORAR", colunas("nome", "grupo", "equipamento", "modalidade", "video", "observacoes"));
        String alimentos = config("nome", "IGNORAR", colunas("nome", "quantidade", "unidade", "kcal", "proteina",
                "carboidrato", "gordura", "gramas", "fonte", "fc", "fcc"));
        String suplementos = config("nome_marca", "IGNORAR", colunas("nome", "marca", "categoria", "porcao", "porcoes", "sabores", "link"));
        String outros = config("nome", "IGNORAR", colunas("nome", "categoria", "principio", "concentracao", "apresentacao", "observacao"));
        Map<String, String> configs = new LinkedHashMap<>();
        configs.put("pesos", pesos);
        configs.put("exercicios", exercicios);
        configs.put("alimentos", alimentos);
        configs.put("suplementos", suplementos);
        configs.put("outros", outros);
        for (var entrada : configs.entrySet()) {
            for (String extensao : List.of("csv", "xlsx")) {
                JsonNode previa = previaArquivo(entrada.getKey(), pasta.resolve(entrada.getKey() + "." + extensao), entrada.getValue());
                assertThat(previa.path("comErro").asInt()).as(entrada.getKey() + "." + extensao + " " + previa.path("erros")).isEqualTo(0);
                assertThat(previa.path("novos").asInt() + previa.path("ignorados").asInt()).isEqualTo(3);
            }
        }
    }

    // ---- Rodada 3a: situação, CPF repetido, COMPLETAR, endereço em bloco e "Outros" por variante ----

    @Test
    void situacaoPelaPlanilhaSegueAsRegrasDoCadastro() throws Exception {
        String emailSai = unico("sai");
        String emailJaInativo = unico("ja-inativo");
        String emailFica = unico("fica");
        UUID sai = alunoComEmail("Sai Fictício", emailSai);
        UUID jaInativo = alunoComEmail("Já Inativo Fictício", emailJaInativo);
        UUID fica = alunoComEmail("Fica Fictício", emailFica);
        JsonNode login = api.convidarEEntrar(treinador, sai);
        api.get("/aluno/painel", login, 200);
        JsonNode plano = api.post("/financeiro/planos", treinador, Map.of("nome", "Mensal " + UUID.randomUUID(),
                "valorCentavos", 25000, "periodicidade", "MENSAL"), 200);
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        api.post("/alunos/" + sai + "/contratacoes", treinador, Map.of("planoComercialId", plano.path("id").asString(),
                "inicio", hoje.toString(), "diaVencimento", hoje.getDayOfMonth()), 200);
        api.patch("/alunos/" + jaInativo + "/situacao", treinador, Map.of("ativo", false), 200);
        int auditoriaJaInativo = auditorias("ALUNO_SITUACAO", jaInativo);

        String csv = "nome;email;situacao\nSai Fictício;" + emailSai + ";inativo\nJá Inativo Fictício;" + emailJaInativo
                + ";inativo\nFica Fictício;" + emailFica + ";ativo\n";
        String config = config("email", "ATUALIZAR", Map.of("nome", 0, "email", 1, "situacao", 2));
        JsonNode previa = previa("alunos", "situacao.csv", csv, config);
        assertThat(previa.path("comErro").asInt()).isZero();
        assertThat(usuarioAtivo(login)).isTrue();

        JsonNode feito = confirmar("alunos", "situacao.csv", csv.getBytes(StandardCharsets.UTF_8), config, previa.path("hash").asString());

        assertThat(usuarioAtivo(login)).as("usuário do aluno inativado").isFalse();
        api.get("/aluno/painel", login, 401);
        JsonNode cobrancas = api.get("/alunos/" + sai + "/cobrancas", treinador, 200);
        assertThat(cobrancas).isNotEmpty();
        cobrancas.forEach(c -> assertThat(c.path("situacao").asString()).isEqualTo("CANCELADA"));
        assertThat(api.get("/alunos/" + sai + "/contratacoes", treinador, 200).get(0).path("situacao").asString())
                .isEqualTo("ENCERRADA");
        assertThat(auditorias("ALUNO_SITUACAO", sai)).isEqualTo(1);
        assertThat(auditorias("ALUNO_SITUACAO", jaInativo)).isEqualTo(auditoriaJaInativo);
        assertThat(auditorias("ALUNO_SITUACAO", fica)).isZero();
        assertThat(auditorias("IMPORTACAO_CONCLUIDA", UUID.fromString(feito.path("id").asString()))).isEqualTo(1);
    }

    /** D18: inativar pela planilha cancela os compromissos futuros de quem já existe; quem fica e quem é criado não mudam. */
    @Test
    void inativarPelaPlanilhaCancelaOsCompromissosFuturos() throws Exception {
        String emailSai = unico("agenda-sai");
        String emailFica = unico("agenda-fica");
        UUID sai = alunoComEmail("Agenda Sai Fictício", emailSai);
        UUID fica = alunoComEmail("Agenda Fica Fictício", emailFica);
        String responsavel = treinador.path("usuario").path("id").asString();
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        String futuroDele = marcarCompromisso(sai, responsavel, hoje.plusDays(3), "09:00");
        String futuroDoOutro = marcarCompromisso(fica, responsavel, hoje.plusDays(3), "11:00");
        String passadoDele = marcarCompromisso(sai, responsavel, hoje.minusDays(3), "09:00");

        String csv = "nome;email;situacao\nAgenda Sai Fictício;" + emailSai + ";inativo\nAgenda Fica Fictício;" + emailFica
                + ";ativo\nAgenda Novo Fictício;" + unico("agenda-novo") + ";inativo\n";
        String config = config("email", "ATUALIZAR", Map.of("nome", 0, "email", 1, "situacao", 2));
        JsonNode previa = previa("alunos", "agenda.csv", csv, config);
        assertThat(previa.path("comErro").asInt()).isZero();
        assertThat(jdbc.queryForObject("select cancelado from compromisso where id = ?::uuid", Boolean.class, futuroDele)).isFalse();

        confirmar("alunos", "agenda.csv", csv.getBytes(StandardCharsets.UTF_8), config, previa.path("hash").asString());

        assertThat(jdbc.queryForObject("select cancelado from compromisso where id = ?::uuid", Boolean.class, futuroDele)).isTrue();
        assertThat(situacaoDoAluno(futuroDele, sai)).isEqualTo("CANCELADO");
        assertThat(situacaoDoAluno(passadoDele, sai)).isEqualTo("AGENDADO");
        assertThat(situacaoDoAluno(futuroDoOutro, fica)).isEqualTo("AGENDADO");
        assertThat(auditorias("ALUNO_COMPROMISSOS_CANCELADOS", sai)).isEqualTo(1);
        assertThat(auditorias("ALUNO_COMPROMISSOS_CANCELADOS", fica)).isZero();
    }

    private String marcarCompromisso(UUID alunoId, String responsavelId, LocalDate data, String hora) throws Exception {
        return api.post("/agenda/compromissos", treinador, Map.of("alunoIds", List.of(alunoId), "responsavelId", responsavelId,
                "data", data.toString(), "hora", hora, "duracaoMinutos", 45), 200).path("id").asString();
    }

    private String situacaoDoAluno(String compromissoId, UUID alunoId) {
        return jdbc.queryForObject("select situacao from compromisso_aluno where compromisso_id = ?::uuid and aluno_id = ?",
                String.class, compromissoId, alunoId);
    }

    @Test
    void reativarPelaPlanilhaReabreOLoginEAnonimizadoViraErroDaLinha() throws Exception {
        String emailVolta = unico("volta");
        String emailAnonimo = unico("anonimo");
        UUID volta = alunoComEmail("Volta Fictício", emailVolta);
        UUID anonimo = alunoComEmail("Anônimo Fictício", emailAnonimo);
        JsonNode login = api.convidarEEntrar(treinador, volta);
        String emailLogin = jdbc.queryForObject("select email from usuario where id = ?::uuid", String.class,
                login.path("usuario").path("id").asString());
        api.patch("/alunos/" + volta + "/situacao", treinador, Map.of("ativo", false), 200);
        assertThat(usuarioAtivo(login)).isFalse();
        jdbc.update("update aluno set ativo = false, inativado_em = now(), anonimizado_em = now() where id = ?::uuid",
                anonimo.toString());

        String csv = "nome;email;situacao\nVolta Fictício;" + emailVolta + ";ativo\nAnônimo Fictício;" + emailAnonimo + ";ativo\n";
        String config = config("email", "ATUALIZAR", Map.of("nome", 0, "email", 1, "situacao", 2));
        JsonNode previa = previa("alunos", "volta.csv", csv, config);
        assertThat(previa.path("comErro").asInt()).isEqualTo(1);
        assertThat(previa.path("erros").get(0).path("motivo").asString()).contains("anonimizado");
        confirmar("alunos", "volta.csv", csv.getBytes(StandardCharsets.UTF_8), config, previa.path("hash").asString());

        assertThat(api.get("/alunos/" + volta, treinador, 200).path("ativo").asBoolean()).isTrue();
        assertThat(usuarioAtivo(login)).as("usuário reativado").isTrue();
        api.post("/auth/login", null, Map.of("email", emailLogin, "senha", ApiDeTeste.SENHA), 200);
        assertThat(auditorias("ALUNO_SITUACAO", volta)).isEqualTo(2);
        assertThat(api.get("/alunos/" + anonimo, treinador, 200).path("ativo").asBoolean()).isFalse();
        assertThat(auditorias("ALUNO_SITUACAO", anonimo)).isZero();
    }

    @Test
    void cpfRepetidoEntreExistentesViraErroDaLinhaNaPreviaENaConfirmacao() throws Exception {
        String emailA = unico("cpf-a");
        String emailB = unico("cpf-b");
        UUID a = alunoComEmail("Cpf A Fictício", emailA);
        UUID b = alunoComEmail("Cpf B Fictício", emailB);
        String cpf = Documentos.cpf();
        String csv = "nome;email;cpf\nCpf A Fictício;" + emailA + ";" + cpf + "\nCpf B Fictício;" + emailB + ";" + cpf + "\n";
        String config = config("email", "ATUALIZAR", Map.of("nome", 0, "email", 1, "cpf", 2));
        JsonNode previa = previa("alunos", "cpf2.csv", csv, config);
        assertThat(previa.path("atualizados").asInt()).isEqualTo(1);
        assertThat(previa.path("comErro").asInt()).isEqualTo(1);
        assertThat(previa.path("erros").get(0).path("campo").asString()).isEqualTo("cpf");
        assertThat(previa.path("erros").toString()).doesNotContain(cpf).doesNotContain(cpf.replaceAll("\\D", ""));

        JsonNode feito = confirmar("alunos", "cpf2.csv", csv.getBytes(StandardCharsets.UTF_8), config, previa.path("hash").asString());
        assertThat(feito.path("situacao").asString()).isEqualTo("CONCLUIDA_COM_ERROS");
        assertThat(feito.path("atualizados").asInt()).isEqualTo(1);
        assertThat(feito.path("comErro").asInt()).isEqualTo(1);
        assertThat(feito.path("erros").get(0).path("linha").asInt()).isEqualTo(previa.path("erros").get(0).path("linha").asInt());
        assertThat(feito.toString()).doesNotContain(cpf);
        assertThat(api.get("/alunos/" + a, treinador, 200).path("cpf").asString()).isEqualTo(cpf);
        assertThat(api.get("/alunos/" + b, treinador, 200).path("cpf").isMissingNode()
                || api.get("/alunos/" + b, treinador, 200).path("cpf").isNull()).isTrue();
    }

    @Test
    void cpfAntigoLiberadoPorAtualizacaoETrocaEntreDoisNaoDa500() throws Exception {
        String emailA = unico("troca-a");
        String antigo = Documentos.cpf();
        String novo = Documentos.cpf();
        api.post("/alunos", treinador, Map.of("nome", "Troca A Fictício", "email", emailA, "cpf", antigo), 200);
        String emailNovoUm = unico("novo-um");
        String emailNovoDois = unico("novo-dois");
        String csv = "nome;email;cpf\nTroca A Fictício;" + emailA + ";" + novo + "\nNovo Um Fictício;" + emailNovoUm + ";" + antigo
                + "\nNovo Dois Fictício;" + emailNovoDois + ";" + novo + "\n";
        String config = config("email", "ATUALIZAR", Map.of("nome", 0, "email", 1, "cpf", 2));
        JsonNode previa = previa("alunos", "troca.csv", csv, config);
        assertThat(previa.path("atualizados").asInt()).isEqualTo(1);
        assertThat(previa.path("novos").asInt()).as("o CPF antigo de A ficou livre").isEqualTo(1);
        assertThat(previa.path("comErro").asInt()).isEqualTo(1);
        assertThat(previa.path("erros").get(0).path("linha").asInt()).as("só o novo com o CPF que A passou a ter").isEqualTo(4);
        confirmar("alunos", "troca.csv", csv.getBytes(StandardCharsets.UTF_8), config, previa.path("hash").asString());
        assertThat(jdbc.queryForObject("select cpf from aluno where email = ?", String.class, emailA)).isEqualTo(novo);
        assertThat(jdbc.queryForObject("select cpf from aluno where email = ?", String.class, emailNovoUm)).isEqualTo(antigo);
        assertThat(jdbc.queryForObject("select count(*) from aluno where email = ?", Integer.class, emailNovoDois)).isZero();

        // Troca entre dois: processando em sequência, cada CPF ainda é do outro; as duas linhas são recusadas, sem 500.
        String emailC = unico("troca-c");
        String emailD = unico("troca-d");
        String cpfC = Documentos.cpf();
        String cpfD = Documentos.cpf();
        api.post("/alunos", treinador, Map.of("nome", "Troca C Fictício", "email", emailC, "cpf", cpfC), 200);
        api.post("/alunos", treinador, Map.of("nome", "Troca D Fictício", "email", emailD, "cpf", cpfD), 200);
        String troca = "nome;email;cpf\nTroca C Fictício;" + emailC + ";" + cpfD + "\nTroca D Fictício;" + emailD + ";" + cpfC + "\n";
        JsonNode previaTroca = previa("alunos", "troca2.csv", troca, config);
        assertThat(previaTroca.path("comErro").asInt()).isEqualTo(2);
        JsonNode feitoTroca = confirmar("alunos", "troca2.csv", troca.getBytes(StandardCharsets.UTF_8), config, previaTroca.path("hash").asString());
        assertThat(feitoTroca.path("comErro").asInt()).isEqualTo(2);
        assertThat(jdbc.queryForObject("select cpf from aluno where email = ?", String.class, emailC)).isEqualTo(cpfC);
        assertThat(jdbc.queryForObject("select cpf from aluno where email = ?", String.class, emailD)).isEqualTo(cpfD);
    }

    @Test
    void completarNaoTrocaTelefoneNemSituacao() throws Exception {
        String emailCom = unico("com-tel");
        String emailSem = unico("sem-tel");
        String emailInativo = unico("inativo-completar");
        UUID com = alunoComEmail("Com Telefone Fictício", emailCom);
        UUID sem = alunoComEmail("Sem Telefone Fictício", emailSem);
        UUID inativo = alunoComEmail("Inativo Fictício", emailInativo);
        JsonNode loginCom = api.convidarEEntrar(treinador, com);
        JsonNode loginSem = api.convidarEEntrar(treinador, sem);
        jdbc.update("update usuario set telefone = ? where id = ?::uuid", "(45) 99999-1111", loginCom.path("usuario").path("id").asString());
        api.patch("/alunos/" + inativo + "/situacao", treinador, Map.of("ativo", false), 200);

        String csv = "nome;email;telefone;situacao\nCom Telefone Fictício;" + emailCom + ";(45) 98888-2222;inativo\nSem Telefone Fictício;"
                + emailSem + ";(45) 98888-2222;\nInativo Fictício;" + emailInativo + ";;ativo\n";
        String config = config("email", "COMPLETAR", Map.of("nome", 0, "email", 1, "telefone", 2, "situacao", 3));
        JsonNode previa = previa("alunos", "completar.csv", csv, config);
        assertThat(previa.path("comErro").asInt()).isZero();
        confirmar("alunos", "completar.csv", csv.getBytes(StandardCharsets.UTF_8), config, previa.path("hash").asString());

        assertThat(telefoneDe(loginCom)).isEqualTo("45999991111");
        assertThat(api.get("/alunos/" + com, treinador, 200).path("ativo").asBoolean()).isTrue();
        assertThat(usuarioAtivo(loginCom)).isTrue();
        assertThat(telefoneDe(loginSem)).as("o vazio é preenchido").isEqualTo("45988882222");
        assertThat(api.get("/alunos/" + inativo, treinador, 200).path("ativo").asBoolean()).isFalse();
    }

    @Test
    void telefoneDeAlunoSemAcessoFicaNoCadastroEPassaAoUsuarioNoAcesso() throws Exception {
        // Planilha real de 30/10: aluno novo com telefone recusava a linha inteira ("Aluno sem acesso ao app.").
        String email = unico("novo-tel");
        String csv = "nome;email;telefone\nNovo Com Telefone Fictício;" + email + ";45 98888-3333\n";
        String config = config("email", "IGNORAR", Map.of("nome", 0, "email", 1, "telefone", 2));
        JsonNode previa = previa("alunos", "novo-tel.csv", csv, config);
        assertThat(previa.path("comErro").asInt()).isZero();
        assertThat(previa.path("novos").asInt()).isEqualTo(1);
        confirmar("alunos", "novo-tel.csv", csv.getBytes(StandardCharsets.UTF_8), config, previa.path("hash").asString());

        String id = jdbc.queryForObject("select id::text from aluno where email = ?", String.class, email);
        assertThat(jdbc.queryForObject("select telefone_sem_acesso from aluno where id = ?::uuid", String.class, id))
                .isEqualTo("(45) 98888-3333");
        assertThat(api.get("/alunos/" + id, treinador, 200).path("telefone").asString()).isEqualTo("(45) 98888-3333");

        JsonNode login = api.convidarEEntrar(treinador, UUID.fromString(id));
        assertThat(telefoneDe(login)).isEqualTo("45988883333");
        assertThat(jdbc.queryForObject("select telefone_sem_acesso from aluno where id = ?::uuid", String.class, id)).isNull();
    }

    private static final Map<String, Integer> COLUNAS_COM_ENDERECO = colunas("nome", "email", "cep", "logradouro", "numero",
            "complemento", "bairro", "cidade", "uf");

    private UUID alunoComEndereco(String nome, String email) throws Exception {
        Map<String, Object> endereco = Map.of("cep", "85800-000", "logradouro", "Rua Antiga Fictícia", "numero", "10",
                "complemento", "Apto 1", "bairro", "Centro", "cidade", "Cidade Fictícia", "uf", "PR");
        return UUID.fromString(api.post("/alunos", treinador, Map.of("nome", nome, "email", email, "endereco", endereco), 200)
                .path("id").asString());
    }

    @Test
    void enderecoDaPlanilhaEUmBlocoQueSubstituiOAtual() throws Exception {
        String emailParcial = unico("end-parcial");
        String emailCompleto = unico("end-completo");
        UUID parcial = alunoComEndereco("Parcial Fictício", emailParcial);
        UUID completo = alunoComEndereco("Completo Fictício", emailCompleto);
        String csv = "nome;email;cep;logradouro;numero;complemento;bairro;cidade;uf\n"
                + "Parcial Fictício;" + emailParcial + ";85900-111;;;;;;\n"
                + "Completo Fictício;" + emailCompleto + ";85900-222;Rua Nova Fictícia;99;;Bairro Novo;Outra Cidade Fictícia;SC\n";
        String config = config("email", "ATUALIZAR", COLUNAS_COM_ENDERECO);
        JsonNode previa = previa("alunos", "endereco.csv", csv, config);
        assertThat(previa.path("comErro").asInt()).isEqualTo(1);
        assertThat(previa.path("atualizados").asInt()).isEqualTo(1);
        assertThat(previa.path("erros").get(0).path("campo").asString()).isEqualTo("logradouro");
        confirmar("alunos", "endereco.csv", csv.getBytes(StandardCharsets.UTF_8), config, previa.path("hash").asString());

        JsonNode antigo = api.get("/alunos/" + parcial, treinador, 200).path("endereco");
        assertThat(antigo.path("cep").asString()).isEqualTo("85800-000");
        assertThat(antigo.path("logradouro").asString()).isEqualTo("Rua Antiga Fictícia");
        JsonNode novo = api.get("/alunos/" + completo, treinador, 200).path("endereco");
        assertThat(novo.path("cep").asString()).isEqualTo("85900-222");
        assertThat(novo.path("logradouro").asString()).isEqualTo("Rua Nova Fictícia");
        assertThat(novo.path("uf").asString()).isEqualTo("SC");
        assertThat(novo.path("complemento").isMissingNode() || novo.path("complemento").isNull())
                .as("o complemento antigo some junto com o resto").isTrue();
    }

    @Test
    void completarSoGravaEnderecoSeOAtualEstaTodoVazio() throws Exception {
        String emailCom = unico("end-com");
        String emailSem = unico("end-sem");
        UUID com = alunoComEndereco("Com Endereço Fictício", emailCom);
        UUID sem = alunoComEmail("Sem Endereço Fictício", emailSem);
        String csv = "nome;email;cep;logradouro;numero;complemento;bairro;cidade;uf\n"
                + "Com Endereço Fictício;" + emailCom + ";85900-222;Rua Nova Fictícia;99;;Bairro Novo;Outra Cidade Fictícia;SC\n"
                + "Sem Endereço Fictício;" + emailSem + ";85900-222;Rua Nova Fictícia;99;;Bairro Novo;Outra Cidade Fictícia;SC\n";
        String config = config("email", "COMPLETAR", COLUNAS_COM_ENDERECO);
        JsonNode previa = previa("alunos", "endereco2.csv", csv, config);
        assertThat(previa.path("comErro").asInt()).isZero();
        confirmar("alunos", "endereco2.csv", csv.getBytes(StandardCharsets.UTF_8), config, previa.path("hash").asString());
        JsonNode intacto = api.get("/alunos/" + com, treinador, 200).path("endereco");
        assertThat(intacto.path("cep").asString()).isEqualTo("85800-000");
        assertThat(intacto.path("complemento").asString()).isEqualTo("Apto 1");
        assertThat(api.get("/alunos/" + sem, treinador, 200).path("endereco").path("cep").asString()).isEqualTo("85900-222");
    }

    @Test
    void outrosCasaPorNomeConcentracaoEApresentacao() throws Exception {
        String nome = "Teste X " + UUID.randomUUID();
        String config = config("nome", "ATUALIZAR", Map.of("nome", 0, "categoria", 1, "concentracao", 2));
        String primeiro = "nome;categoria;concentracao\n" + nome + ";Categoria A;100 mg\n";
        confirmar("outros", "o1.csv", primeiro.getBytes(StandardCharsets.UTF_8), config, hash("outros", "o1.csv", primeiro, config));

        String segundo = "nome;categoria;concentracao\n" + nome + ";Categoria B;250 mg\n" + nome + ";Categoria C;100 mg\n";
        JsonNode previa = previa("outros", "o2.csv", segundo, config);
        assertThat(previa.path("novos").asInt()).isEqualTo(1);
        assertThat(previa.path("atualizados").asInt()).isEqualTo(1);
        confirmar("outros", "o2.csv", segundo.getBytes(StandardCharsets.UTF_8), config, previa.path("hash").asString());
        Map<String, String> categorias = new LinkedHashMap<>();
        for (JsonNode item : api.get("/ergogenicos", treinador, 200)) {
            categorias.put(item.path("concentracao").asString(), item.path("categoria").asString());
        }
        assertThat(categorias).containsOnly(Map.entry("100 mg", "Categoria C"), Map.entry("250 mg", "Categoria B"));

        // Duas linhas com a mesma tripla na própria planilha: a segunda cai no que a primeira criou (a regra vale).
        String repetido = "nome;categoria;concentracao\nOutro " + nome + ";Categoria D;50 mg\nOutro " + nome + ";Categoria E;50 mg\n";
        JsonNode previaRepetido = previa("outros", "o3.csv", repetido, config);
        assertThat(previaRepetido.path("novos").asInt()).isEqualTo(1);
        assertThat(previaRepetido.path("atualizados").asInt()).isEqualTo(1);
        confirmar("outros", "o3.csv", repetido.getBytes(StandardCharsets.UTF_8), config, previaRepetido.path("hash").asString());
        assertThat(api.get("/ergogenicos", treinador, 200)).hasSize(3);
    }

    private static final String AMBIGUO = "Número ambíguo: use vírgula para decimais.";

    @Test
    void numeroComPontoETresDigitosEAmbiguoNoPesoENoAlimento() throws Exception {
        String email = unico("numero");
        String alunos = "nome;email\nNumero Fictício;" + email + "\n";
        String configAluno = config("email", "IGNORAR", Map.of("nome", 0, "email", 1));
        confirmar("alunos", "n0.csv", alunos.getBytes(StandardCharsets.UTF_8), configAluno, hash("alunos", "n0.csv", alunos, configAluno));
        UUID alunoId = UUID.fromString(api.get("/alunos", treinador, 200).path("itens").get(0).path("id").asString());

        String pesos = "aluno;data;peso\n" + email + ";01/01/2026;1.500\n" + email + ";02/01/2026;70.5\n" + email
                + ";03/01/2026;70,5\n" + email + ";04/01/2026;70.25\n";
        String configPeso = config("email", "IGNORAR", Map.of("aluno", 0, "data", 1, "peso", 2));
        JsonNode previaPeso = previa("pesos", "n1.csv", pesos, configPeso);
        assertThat(previaPeso.path("comErro").asInt()).isEqualTo(1);
        assertThat(previaPeso.path("novos").asInt()).isEqualTo(3);
        assertThat(previaPeso.path("erros").get(0).path("campo").asString()).isEqualTo("peso");
        assertThat(previaPeso.path("erros").get(0).path("motivo").asString()).isEqualTo(AMBIGUO);
        JsonNode feitoPeso = confirmar("pesos", "n1.csv", pesos.getBytes(StandardCharsets.UTF_8), configPeso, previaPeso.path("hash").asString());
        assertThat(feitoPeso.path("comErro").asInt()).isEqualTo(1);
        assertThat(feitoPeso.path("novos").asInt()).isEqualTo(3);
        assertThat(feitoPeso.path("erros").get(0).path("motivo").asString()).isEqualTo(AMBIGUO);
        assertThat(feitoPeso.toString()).doesNotContain("1.500");
        assertThat(api.get("/alunos/" + alunoId + "/pesos", treinador, 200)).hasSize(3);

        String sufixo = UUID.randomUUID().toString();
        String alimentos = "nome;quantidade;unidade;kcal;proteina;carboidrato;gordura;fc\n"
                + "Ambíguo " + sufixo + ";100;g;1.500;1;1;1;\n"
                + "Milhar " + sufixo + ";100;g;1.234,5;1;1;1;\n"
                + "Tres casas " + sufixo + ";100;g;1,234;1;1;1;\n"
                + "Virgula " + sufixo + ";100;g;1,5;1;1;1;\n"
                + "Zero " + sufixo + ";100;g;0.500;1;1;1;\n"
                + "Fator " + sufixo + ";100;g;10;1;1;1;2.500\n";
        String configAl = config("nome", "IGNORAR", Map.of("nome", 0, "quantidade", 1, "unidade", 2, "kcal", 3, "proteina", 4,
                "carboidrato", 5, "gordura", 6, "fc", 7));
        JsonNode previaAl = previa("alimentos", "n2.csv", alimentos, configAl);
        // "0.500" começa com zero: milhar não começa assim, então é decimal e grava (a recusa é só do "1.500").
        assertThat(previaAl.path("novos").asInt()).isEqualTo(2);
        assertThat(previaAl.path("comErro").asInt()).isEqualTo(4);
        long ambiguos = 0;
        for (JsonNode erro : previaAl.path("erros")) {
            if (AMBIGUO.equals(erro.path("motivo").asString())) {
                ambiguos++;
            }
        }
        assertThat(ambiguos).isEqualTo(2);
        assertThat(previaAl.path("erros").toString()).doesNotContain("1.500").doesNotContain("2.500");
        JsonNode feitoAl = confirmar("alimentos", "n2.csv", alimentos.getBytes(StandardCharsets.UTF_8), configAl, previaAl.path("hash").asString());
        assertThat(feitoAl.path("novos").asInt()).isEqualTo(2);
        assertThat(feitoAl.path("comErro").asInt()).isEqualTo(4);
    }

    @Test
    void confirmacaoDeAlunosEPesosTravaAConsultoriaEAPreviaNao() throws Exception {
        String email = unico("trava");
        String base = "nome;email\nTrava Fictícia;" + email + "\n";
        String configAluno = config("email", "IGNORAR", Map.of("nome", 0, "email", 1));
        confirmar("alunos", "t0.csv", base.getBytes(StandardCharsets.UTF_8), configAluno, hash("alunos", "t0.csv", base, configAluno));
        String novo = "nome;email\nTrava Dois Fictícia;" + unico("trava2") + "\n";
        String hashNovo = hash("alunos", "t1.csv", novo, configAluno);
        String pesos = "aluno;data;peso\n" + email + ";01/01/2026;70,5\n";
        String configPeso = config("email", "IGNORAR", Map.of("aluno", 0, "data", 1, "peso", 2));
        String hashPeso = hash("pesos", "t2.csv", pesos, configPeso);
        UUID consultoria = jdbc.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class,
                treinador.path("usuario").path("id").asString());
        ExecutorService pool = Executors.newFixedThreadPool(3);
        List<Future<JsonNode>> confirmacoes = new ArrayList<>();
        try {
            new TransactionTemplate(transacoes).executeWithoutResult(tx -> {
                jdbc.queryForObject("select id from consultoria where id = ?::uuid for no key update", UUID.class, consultoria.toString());
                try {
                    Future<JsonNode> previa = pool.submit(() -> previa("alunos", "t3.csv", novo, configAluno));
                    assertThat(previa.get(15, TimeUnit.SECONDS).path("novos").asInt()).as("a prévia não espera a trava").isEqualTo(1);
                    confirmacoes.add(pool.submit(() -> confirmar("alunos", "t1.csv", novo.getBytes(StandardCharsets.UTF_8), configAluno, hashNovo)));
                    confirmacoes.add(pool.submit(() -> confirmar("pesos", "t2.csv", pesos.getBytes(StandardCharsets.UTF_8), configPeso, hashPeso)));
                    assertThat(sessoesEsperandoTrava(2)).as("as duas confirmações esperam a trava da consultoria").isTrue();
                    assertThat(confirmacoes).noneMatch(Future::isDone);
                } catch (java.util.concurrent.ExecutionException | java.util.concurrent.TimeoutException
                         | InterruptedException e) {
                    throw new IllegalStateException(e);
                }
            });
            for (Future<JsonNode> confirmacao : confirmacoes) {
                assertThat(confirmacao.get(30, TimeUnit.SECONDS).path("situacao").asString()).isEqualTo("CONCLUIDA");
            }
        } finally {
            pool.shutdownNow();
        }
    }

    private boolean sessoesEsperandoTrava(int minimo) throws InterruptedException {
        long limite = System.nanoTime() + Duration.ofSeconds(10).toNanos();
        while (System.nanoTime() < limite) {
            Integer esperando = jdbc.queryForObject("select count(*) from pg_stat_activity where datname = current_database() "
                    + "and wait_event_type = 'Lock'", Integer.class);
            if (esperando != null && esperando >= minimo) {
                return true;
            }
            Thread.sleep(100);
        }
        return false;
    }

    @Test
    void vagaQueSomeNaGravacaoViraConflitoDoPlanoSem500() throws Exception {
        limiteDeAlunos(1);
        String csv = "nome;email\nUm Fictício;" + unico("um") + "\nDois Fictício;" + unico("dois") + "\n";
        String config = config("email", "IGNORAR", Map.of("nome", 0, "email", 1));
        String hash = hash("alunos", "corrida.csv", csv, config);
        // Outra gravação ocupou a vaga depois de a importação contá-la: a contagem local diz 2, o plano diz 1.
        doReturn(2L).when(plano).vagasDeAluno();
        JsonNode erro = enviar("alunos", "corrida.csv", csv.getBytes(StandardCharsets.UTF_8), config, hash, 409);
        assertThat(erro.path("codigo").asString()).isEqualTo("LIMITE_DO_PLANO");
        assertThat(erro.path("fieldErrors").get(0).path("field").asString()).isEqualTo("alunos_ativos");
        assertThat(erro.toString()).doesNotContain("Fictício");
        assertThat(api.get("/alunos", treinador, 200).path("total").asInt()).isZero();
        assertThat(api.get("/importacoes", treinador, 200).path("total").asInt()).isZero();
    }

    @Test
    void linhaInvalidaAntesDasValidasNaoConsomeVagaDoPlano() throws Exception {
        limiteDeAlunos(2);
        String csv = "nome;email\nInvalido Fictício;sem-arroba\nUm Fictício;" + unico("um") + "\nDois Fictício;" + unico("dois") + "\n";
        String config = config("email", "IGNORAR", Map.of("nome", 0, "email", 1));
        JsonNode previa = previa("alunos", "vagas.csv", csv, config);
        assertThat(previa.path("novos").asInt()).isEqualTo(2);
        assertThat(previa.path("comErro").asInt()).isEqualTo(1);
        JsonNode feito = confirmar("alunos", "vagas.csv", csv.getBytes(StandardCharsets.UTF_8), config, previa.path("hash").asString());
        assertThat(feito.path("novos").asInt()).isEqualTo(2);
        assertThat(feito.path("comErro").asInt()).isEqualTo(1);
        assertThat(api.get("/alunos", treinador, 200).path("total").asInt()).isEqualTo(2);
    }

    private void limiteDeAlunos(long limite) {
        UUID consultoria = jdbc.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class,
                treinador.path("usuario").path("id").asString());
        contas.gravarDireitos(new DireitosLocais(consultoria, UUID.randomUUID(), 1, "ATIVA", true, null, null, "PAGO", "Pago",
                Map.of("alunos_ativos", limite), List.of("MOBILIDADE", "PDF", "EQUIPE"), Instant.now()));
    }

    @Test
    void perfilComSensivelAlterarSemSensivelLerNaoPodeExistir() throws Exception {
        api.post("/perfis", treinador, Map.of("nome", "Só alterar fictício", "permissoes",
                java.util.Set.of("ALUNO_LER", "ALUNO_SENSIVEL_ALTERAR")), 400);
        api.post("/perfis", treinador, Map.of("nome", "Só alterar dois fictício", "permissoes",
                java.util.Set.of("ALUNO_SENSIVEL_ALTERAR")), 400);
    }

    @Test
    void nomeDoArquivoNuncaFicaGuardadoSoAExtensao() throws Exception {
        String config = config("email", "IGNORAR", Map.of("nome", 0, "email", 1));
        String csv = "nome;email\nArquivo Fictício;" + unico("arq") + "\n";
        byte[] planilha = xlsx(csv); // uma vez só: o zip leva a data da entrada e o hash exige os mesmos bytes
        String hashX = enviar("alunos/previa", "Fulano Silva.xlsx", planilha, config, 200).path("hash").asString();
        JsonNode feito = enviar("alunos", "Fulano Silva.xlsx", planilha, config, hashX, 200);
        assertThat(feito.path("nomeArquivo").asString()).isEqualTo(".xlsx");
        assertThat(nomeGravado(feito)).isEqualTo(".xlsx");

        String outro = "nome;email\nOutro Fictício;" + unico("arq2") + "\n";
        String hashC = hash("alunos", "Beltrano Souza.CSV", outro, config);
        JsonNode feitoCsv = confirmar("alunos", "Beltrano Souza.CSV", outro.getBytes(StandardCharsets.UTF_8), config, hashC);
        assertThat(nomeGravado(feitoCsv)).isEqualTo(".csv");

        String sem = "nome;email\nTerceiro Fictício;" + unico("arq3") + "\n";
        String hashS = hash("alunos", "Ciclana de Tal", sem, config);
        JsonNode feitoSem = confirmar("alunos", "Ciclana de Tal", sem.getBytes(StandardCharsets.UTF_8), config, hashS);
        assertThat(nomeGravado(feitoSem)).isEqualTo(".csv");

        String lista = api.get("/importacoes", treinador, 200).toString();
        String detalhe = api.get("/importacoes/" + feito.path("id").asString(), treinador, 200).toString();
        String auditoria = api.get("/auditoria?acao=IMPORTACAO_CONCLUIDA", treinador, 200).toString();
        assertThat(lista + detalhe + auditoria).doesNotContain("Fulano").doesNotContain("Silva").doesNotContain("Beltrano")
                .doesNotContain("Ciclana");
    }

    private String nomeGravado(JsonNode importacao) {
        return jdbc.queryForObject("select nome_arquivo from importacao where id = ?::uuid", String.class,
                importacao.path("id").asString());
    }

    private UUID alunoComEmail(String nome, String email) throws Exception {
        return UUID.fromString(api.post("/alunos", treinador, Map.of("nome", nome, "email", email), 200).path("id").asString());
    }

    private int auditorias(String acao, UUID entidade) {
        return jdbc.queryForObject("select count(*) from auditoria where acao = ? and entidade_id = ?::uuid", Integer.class,
                acao, entidade.toString());
    }

    private boolean usuarioAtivo(JsonNode login) {
        return Boolean.TRUE.equals(jdbc.queryForObject("select ativo from usuario where id = ?::uuid", Boolean.class,
                login.path("usuario").path("id").asString()));
    }

    private String telefoneDe(JsonNode login) {
        String telefone = jdbc.queryForObject("select telefone from usuario where id = ?::uuid", String.class,
                login.path("usuario").path("id").asString());
        return telefone == null ? null : telefone.replaceAll("\\D", "");
    }

    private JsonNode previaArquivo(String destino, Path arquivo, String config) throws Exception {
        return enviar(destino + "/previa", arquivo.getFileName().toString(), Files.readAllBytes(arquivo), config, 200);
    }

    private String hashArquivo(String destino, Path arquivo, String config) throws Exception {
        return previaArquivo(destino, arquivo, config).path("hash").asString();
    }

    private static Map<String, Integer> colunas(String... campos) {
        Map<String, Integer> mapa = new LinkedHashMap<>();
        for (int i = 0; i < campos.length; i++) {
            mapa.put(campos[i], i);
        }
        return mapa;
    }

    private JsonNode previa(String destino, String nome, String csv, String config) throws Exception {
        return enviar(destino + "/previa", nome, csv.getBytes(StandardCharsets.UTF_8), config, 200);
    }

    private String hash(String destino, String nome, String csv, String config) throws Exception {
        return previa(destino, nome, csv, config).path("hash").asString();
    }

    private JsonNode confirmar(String destino, String nome, byte[] bytes, String config, String hash) throws Exception {
        return enviar(destino, nome, bytes, config, hash, 200);
    }

    private JsonNode enviar(String caminho, String nome, byte[] bytes, String config, int esperado) throws Exception {
        return enviar(caminho, nome, bytes, config, null, esperado);
    }

    private JsonNode enviar(String caminho, String nome, byte[] bytes, String config, String hash, int esperado) throws Exception {
        return enviarComo(treinador, caminho, nome, bytes, config, hash, esperado);
    }

    private JsonNode enviarComo(JsonNode login, String caminho, String nome, byte[] bytes, String config, String hash, int esperado)
            throws Exception {
        var pedido = multipart("/importacoes/" + caminho)
                .file(new MockMultipartFile("arquivo", nome, "text/csv", bytes))
                .file(new MockMultipartFile("configuracao", "config.json", "application/json", config.getBytes(StandardCharsets.UTF_8)))
                .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(login))
                .header("X-Treinos-Cliente", "nativo");
        if (hash != null) {
            pedido.param("hash", hash);
        }
        MvcResult r = mvc.perform(pedido).andExpect(status().is(esperado)).andReturn();
        String texto = r.getResponse().getContentAsString(StandardCharsets.UTF_8);
        return texto.isBlank() ? json.nullNode() : json.readTree(texto);
    }

    private String config(String chave, String existentes, Map<String, Integer> mapeamento) throws Exception {
        return json.writeValueAsString(Map.of("aba", 0, "linhaDoCabecalho", 1, "chave", chave, "existentes", existentes, "mapeamento", mapeamento));
    }

    private String configComLinha(int linhaDoCabecalho, Map<String, Integer> mapeamento) throws Exception {
        return configComLinha(linhaDoCabecalho, mapeamento, List.of());
    }

    private String configComLinha(int linhaDoCabecalho, Map<String, Integer> mapeamento, List<Map<String, Object>> celulas)
            throws Exception {
        Map<String, Object> config = new java.util.LinkedHashMap<>();
        config.put("aba", 0);
        config.put("linhaDoCabecalho", linhaDoCabecalho);
        config.put("chave", "email");
        config.put("existentes", "IGNORAR");
        config.put("mapeamento", mapeamento);
        if (!celulas.isEmpty()) {
            config.put("ajustes", Map.of("celulas", celulas, "removidas", List.of()));
        }
        return json.writeValueAsString(config);
    }

    private String configComAjustes(Map<String, Integer> mapeamento, List<Map<String, Object>> celulas, List<Integer> removidas)
            throws Exception {
        Map<String, Object> config = new java.util.LinkedHashMap<>();
        config.put("aba", 0);
        config.put("linhaDoCabecalho", 1);
        config.put("chave", "email");
        config.put("existentes", "IGNORAR");
        config.put("mapeamento", mapeamento);
        config.put("ajustes", Map.of("celulas", celulas, "removidas", removidas));
        return json.writeValueAsString(config);
    }

    private static String unico(String prefixo) {
        return prefixo + "-" + UUID.randomUUID() + "@exemplo.com";
    }

    private static byte[] xlsx(String csv) {
        String[] linhas = csv.split("\n");
        StringBuilder sst = new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\"?><sst xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\">");
        StringBuilder sheet = new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\"?><worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><sheetData>");
        int i = 0;
        int linha = 1;
        for (String bruta : linhas) {
            if (bruta.isBlank()) {
                continue;
            }
            sheet.append("<row r=\"").append(linha).append("\">");
            int coluna = 0;
            for (String campo : bruta.split(";", -1)) {
                sst.append("<si><t>").append(campo).append("</t></si>");
                sheet.append("<c r=\"").append((char) ('A' + coluna)).append(linha).append("\" t=\"s\"><v>").append(i++).append("</v></c>");
                coluna++;
            }
            sheet.append("</row>");
            linha++;
        }
        sst.append("</sst>");
        sheet.append("</sheetData></worksheet>");
        return planilha(sst.toString(), sheet.toString());
    }

    private static byte[] planilha(String sst, String sheet) {
        try {
            java.io.ByteArrayOutputStream saida = new java.io.ByteArrayOutputStream();
            try (java.util.zip.ZipOutputStream zip = new java.util.zip.ZipOutputStream(saida)) {
                gravar(zip, "[Content_Types].xml", "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"></Types>");
                gravar(zip, "xl/workbook.xml", """
                        <?xml version="1.0" encoding="UTF-8"?>
                        <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
                        <sheets><sheet name="Dados" sheetId="1" r:id="rId1"/></sheets></workbook>
                        """);
                gravar(zip, "xl/_rels/workbook.xml.rels", """
                        <?xml version="1.0" encoding="UTF-8"?>
                        <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
                        </Relationships>
                        """);
                gravar(zip, "xl/sharedStrings.xml", sst);
                gravar(zip, "xl/worksheets/sheet1.xml", sheet);
            }
            return saida.toByteArray();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static void gravar(java.util.zip.ZipOutputStream zip, String nome, String xml) throws Exception {
        zip.putNextEntry(new java.util.zip.ZipEntry(nome));
        zip.write(xml.getBytes(StandardCharsets.UTF_8));
    }
}
