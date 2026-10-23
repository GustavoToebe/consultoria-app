package br.com.treinos.api.importacao;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.conta.ContaLocalRepositorio;
import br.com.treinos.api.conta.DireitosLocais;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
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

        String alimentos = "nome;quantidade;unidade;kcal;proteina;carboidrato;gordura\nAveia fictícia;100;g;380;13;67;7\n";
        String configAl = config("nome", "IGNORAR", Map.of("nome", 0, "quantidade", 1, "unidade", 2, "kcal", 3, "proteina", 4, "carboidrato", 5, "gordura", 6));
        confirmar("alimentos", "al.csv", alimentos.getBytes(StandardCharsets.UTF_8), configAl, hash("alimentos", "al.csv", alimentos, configAl));
        assertThat(api.get("/alimentos", treinador, 200)).hasSize(1);

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
        return json.writeValueAsString(Map.of("aba", 0, "cabecalho", true, "chave", chave, "existentes", existentes, "mapeamento", mapeamento));
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
