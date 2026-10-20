package br.com.treinos.api.alunos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.Documentos;
import br.com.treinos.api.equipe.CatalogoPermissoes;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * CPF, endereço e telefone na ficha do aluno: quem lê e quem escreve (CPF e endereço atrás de ALUNO_SENSIVEL_*, telefone
 * atrás de ALUNO_LER e ALUNO_ALTERAR), formato, CPF único por consultoria, telefone só com acesso e anonimização. Só dados
 * fictícios (CPFs com dígitos verificadores calculados no teste).
 */
@AutoConfigureMockMvc
class AlunoCadastroIntegrationTest extends AbstractIntegrationTest {

    private static final Map<String, Object> ENDERECO = Map.of("cep", "85800-000", "logradouro", "Rua das Flores", "numero", "100",
            "complemento", "Apto 2", "bairro", "Centro", "cidade", "Cidade Exemplo", "uf", "PR");

    /** O endereço completo de {@link #ENDERECO} sem complemento e bairro, com as chaves trocadas (pares chave, valor). */
    private static Map<String, Object> enderecoCom(String... trocas) {
        Map<String, Object> e = new LinkedHashMap<>(ENDERECO);
        e.remove("complemento");
        e.remove("bairro");
        for (int i = 0; i < trocas.length; i += 2) {
            e.put(trocas[i], trocas[i + 1]);
        }
        return e;
    }

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;
    private ApiDeTeste api;
    private JsonNode treinador;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
    }

    // ---- apoio ----

    private Map<String, Object> corpo(String nome, String cpf, Map<String, Object> endereco) {
        Map<String, Object> c = new LinkedHashMap<>();
        c.put("nome", nome);
        if (cpf != null) c.put("cpf", cpf);
        if (endereco != null) c.put("endereco", endereco);
        return c;
    }

    private JsonNode criar(JsonNode quem, String nome, String cpf, Map<String, Object> endereco, int status) throws Exception {
        return api.post("/alunos", quem, corpo(nome, cpf, endereco), status);
    }

    /** PUT com o corpo dado e a versão atual do cadastro. */
    private JsonNode alterar(JsonNode quem, String id, Map<String, Object> corpo, int status) throws Exception {
        Map<String, Object> c = new LinkedHashMap<>(corpo);
        c.put("versao", api.get("/alunos/" + id, treinador, 200).path("versao").asLong());
        return api.put("/alunos/" + id, quem, c, status);
    }

    private JsonNode membro(Set<String> permissoes) throws Exception {
        String perfil = api.post("/perfis", treinador,
                Map.of("nome", "Perfil " + UUID.randomUUID(), "permissoes", CatalogoPermissoes.comDependencias(permissoes)), 200)
                .get("id").asString();
        JsonNode convite = api.post("/usuarios/convites", treinador,
                Map.of("nome", "Membro fictício", "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        return api.post("/publico/convites-equipe/" + convite.get("codigo").asString(), null,
                Map.of("senha", ApiDeTeste.SENHA), 200);
    }

    private static boolean semValor(JsonNode n) {
        return n.isMissingNode() || n.isNull();
    }

    private String sql(String coluna, String id) {
        return banco.queryForObject("select " + coluna + " from aluno where id = ?::uuid", String.class, id);
    }

    // ---- CPF e endereço ----

    @Test
    void criarGravaCpfFormatadoEEnderecoNormalizado() throws Exception {
        String cpf = Documentos.cpf();
        JsonNode criado = criar(treinador, "Aluno Fictício", Documentos.semPontuacao(cpf),
                Map.of("cep", "85800000", "logradouro", " Rua das Flores ", "numero", " s/n ", "cidade", " Cidade Exemplo ", "uf", "pr"), 200);

        assertThat(criado.path("cpf").asString()).isEqualTo(cpf);
        JsonNode e = criado.path("endereco");
        assertThat(e.path("cep").asString()).isEqualTo("85800-000");
        assertThat(e.path("logradouro").asString()).isEqualTo("Rua das Flores");
        assertThat(e.path("uf").asString()).isEqualTo("PR");
        assertThat(e.path("numero").asString()).isEqualTo("s/n");
        assertThat(e.path("cidade").asString()).isEqualTo("Cidade Exemplo");
        assertThat(semValor(e.path("complemento"))).isTrue();
        assertThat(semValor(e.path("bairro"))).isTrue();
        assertThat(sql("cidade", criado.path("id").asString())).isEqualTo("Cidade Exemplo"); // gravado já sem os espaços
        assertThat(sql("cpf", criado.path("id").asString())).isEqualTo(cpf);
        assertThat(api.get("/alunos/" + criado.path("id").asString(), treinador, 200).path("cpf").asString()).isEqualTo(cpf);
    }

    @Test
    void semAlunoSensivelLerCpfEEnderecoNaoSaemDaFichaNemDaLista() throws Exception {
        String cpf = Documentos.cpf();
        String id = criar(treinador, "Aluno Fictício", cpf, ENDERECO, 200).path("id").asString();

        JsonNode leitor = membro(Set.of("ALUNO_LER"));
        JsonNode ficha = api.get("/alunos/" + id, leitor, 200);
        assertThat(ficha.has("cpf")).isFalse();
        assertThat(ficha.has("endereco")).isFalse();
        assertThat(ficha.has("objetivo")).isFalse();
        assertThat(ficha.toString()).doesNotContain(cpf).doesNotContain("Rua das Flores");

        // Nem a lista nem a busca trazem o CPF.
        assertThat(api.get("/alunos?situacao=TODOS", treinador, 200).toString()).doesNotContain(cpf);
        assertThat(api.get("/alunos?situacao=TODOS&busca=" + cpf, treinador, 200).get("itens")).isEmpty();

        JsonNode sensivel = membro(Set.of("ALUNO_SENSIVEL_LER"));
        assertThat(api.get("/alunos/" + id, sensivel, 200).path("cpf").asString()).isEqualTo(cpf);
    }

    @Test
    void semAlunoSensivelAlterarCpfEEnderecoDoCorpoSaoIgnoradosEOGravadoFica() throws Exception {
        String cpf = Documentos.cpf();
        String id = criar(treinador, "Aluno Fictício", cpf, ENDERECO, 200).path("id").asString();
        JsonNode editor = membro(Set.of("ALUNO_ALTERAR"));

        // Edita o nome; o CPF e o endereço enviados não valem (nem os inválidos viram erro: nem são lidos).
        Map<String, Object> novo = corpo("Aluno Fictício Renomeado", Documentos.cpf(), Map.of("cidade", "Outra Cidade", "uf", "XX"));
        JsonNode resposta = alterar(editor, id, novo, 200);
        assertThat(resposta.path("nome").asString()).isEqualTo("Aluno Fictício Renomeado");
        assertThat(resposta.has("cpf")).isFalse(); // o editor também não lê o sensível
        assertThat(sql("cpf", id)).isEqualTo(cpf);
        assertThat(sql("cidade", id)).isEqualTo("Cidade Exemplo");
        assertThat(sql("uf", id)).isEqualTo("PR");

        // Criar também: sem a permissão não grava CPF nem endereço.
        String criado = criar(editor, "Aluno Criado Pelo Editor", Documentos.cpf(), ENDERECO, 200).path("id").asString();
        assertThat(sql("cpf", criado)).isNull();
        assertThat(sql("cidade", criado)).isNull();
    }

    @Test
    void comPermissaoAlterarSubstituiEApagarComNulo() throws Exception {
        String cpf = Documentos.cpf();
        String id = criar(treinador, "Aluno Fictício", cpf, ENDERECO, 200).path("id").asString();
        String outro = Documentos.cpf();

        JsonNode trocado = alterar(treinador, id, corpo("Aluno Fictício", outro, enderecoCom("cidade", "Cidade Nova", "logradouro", "Rua Nova")), 200);
        assertThat(trocado.path("cpf").asString()).isEqualTo(outro);
        assertThat(trocado.path("endereco").path("cidade").asString()).isEqualTo("Cidade Nova");
        // O endereço é substituído por inteiro (o complemento e o bairro que a ficha tinha não sobram).
        assertThat(trocado.path("endereco").path("logradouro").asString()).isEqualTo("Rua Nova");
        assertThat(semValor(trocado.path("endereco").path("complemento"))).isTrue();
        assertThat(semValor(trocado.path("endereco").path("bairro"))).isTrue();

        JsonNode limpo = alterar(treinador, id, corpo("Aluno Fictício", null, null), 200);
        assertThat(limpo.has("cpf")).isFalse();
        assertThat(limpo.has("endereco")).isFalse();
        assertThat(sql("cpf", id)).isNull();
        assertThat(sql("cep", id)).isNull();
        // O CPF apagado fica livre.
        criar(treinador, "Outro Aluno Fictício", outro, null, 200);
    }

    @Test
    void formatoInvalidoDa422NoCampoSemRepetirOValor() throws Exception {
        String nome = "Aluno Recusado " + UUID.randomUUID();
        String ruim = "111.111.111-11";
        JsonNode erro = criar(treinador, nome, ruim, null, 422);
        assertThat(erro.path("codigo").asString()).isEqualTo("ALUNO_INVALIDO");
        assertThat(erro.toString()).contains("\"field\":\"cpf\"").doesNotContain(ruim);

        // Dígito verificador errado.
        String cpf = Documentos.cpf();
        String errado = cpf.substring(0, 13) + (cpf.charAt(13) == '0' ? '1' : '0');
        assertThat(criar(treinador, nome, errado, null, 422).toString()).doesNotContain(errado);

        JsonNode cep = criar(treinador, nome, null, enderecoCom("cep", "123"), 422);
        assertThat(cep.toString()).contains("\"field\":\"endereco.cep\"").contains("CEP inválido.");
        JsonNode uf = criar(treinador, nome, null, enderecoCom("uf", "XX"), 422);
        assertThat(uf.toString()).contains("\"field\":\"endereco.uf\"").contains("UF inválida.");
        // Mais de um problema de uma vez, cada um no seu campo.
        JsonNode dois = criar(treinador, nome, ruim, enderecoCom("cep", "123", "uf", "XX"), 422);
        assertThat(dois.path("fieldErrors")).hasSize(3);

        // Acima do limite do campo, depois do strip: 422 no campo, com mensagem fixa e sem o valor recusado.
        String longoCpf = "9".repeat(21);
        String longoCep = "12345-6789";
        String longoLogradouro = "Rua Comprida Fictícia " + "x".repeat(201);
        assertThat(criar(treinador, nome, longoCpf, null, 400).toString()).doesNotContain(longoCpf);
        JsonNode cepLongo = criar(treinador, nome, null, enderecoCom("cep", longoCep), 422);
        assertThat(cepLongo.toString()).contains("\"field\":\"endereco.cep\"").doesNotContain(longoCep);
        JsonNode logradouroLongo = criar(treinador, nome, null, enderecoCom("logradouro", longoLogradouro), 422);
        assertThat(logradouroLongo.toString()).contains("\"field\":\"endereco.logradouro\"")
                .contains("Use no máximo 200 caracteres.").doesNotContain("Rua Comprida Fictícia");
        assertThat(alterar(treinador, criar(treinador, "Aluno Para Editar " + UUID.randomUUID(), null, null, 200).path("id").asString(),
                Map.of("nome", nome, "telefone", "1".repeat(26)), 400).toString()).doesNotContain("1".repeat(26));
        criar(treinador, nome, null, enderecoCom("numero", "1".repeat(21)), 422);
        criar(treinador, nome, null, enderecoCom("uf", "SPS"), 422);
        assertThat(banco.queryForObject("select count(*) from aluno where nome = ?", Integer.class, nome)).isZero();
    }

    @Test
    void enderecoNaoVazioFaltandoCampoObrigatorioMarcaCadaUmComMensagemFixa() throws Exception {
        String nome = "Aluno Parcial " + UUID.randomUUID();
        // Só a cidade (e um complemento): faltam CEP, logradouro, número e UF, cada um com a sua mensagem.
        JsonNode erro = criar(treinador, nome, null, Map.of("cidade", "Cidade Exemplo", "complemento", "Apto 2"), 422);
        assertThat(erro.path("codigo").asString()).isEqualTo("ALUNO_INVALIDO");
        Map<String, String> porCampo = new LinkedHashMap<>();
        erro.path("fieldErrors").forEach(f -> porCampo.put(f.path("field").asString(), f.path("message").asString()));
        assertThat(porCampo).containsOnly(
                Map.entry("endereco.cep", "Informe o CEP."),
                Map.entry("endereco.uf", "Informe a UF."),
                Map.entry("endereco.logradouro", "Informe a rua, avenida ou logradouro."),
                Map.entry("endereco.numero", "Informe o número (ou s/n)."));
        assertThat(erro.toString()).doesNotContain("Cidade Exemplo").doesNotContain("Apto 2");

        // Sem cidade.
        Map<String, Object> semCidade = enderecoCom();
        semCidade.remove("cidade");
        assertThat(criar(treinador, nome, null, semCidade, 422).toString()).contains("\"field\":\"endereco.cidade\"")
                .contains("Informe a cidade.");
        // Campo obrigatório só com espaços conta como faltando.
        assertThat(criar(treinador, nome, null, enderecoCom("numero", "   "), 422).toString())
                .contains("\"field\":\"endereco.numero\"");
        // Na edição também, e o endereço gravado fica como estava.
        String id = criar(treinador, "Aluno Fictício", null, ENDERECO, 200).path("id").asString();
        assertThat(alterar(treinador, id, corpo("Aluno Fictício", null, Map.of("cep", "85800-000")), 422).toString())
                .contains("\"field\":\"endereco.logradouro\"");
        assertThat(sql("cidade", id)).isEqualTo("Cidade Exemplo");
        assertThat(banco.queryForObject("select count(*) from aluno where nome = ?", Integer.class, nome)).isZero();
    }

    @Test
    void enderecoVazioOuEmBrancoEValidoEApagaOGravado() throws Exception {
        String id = criar(treinador, "Aluno Fictício", null, ENDERECO, 200).path("id").asString();
        Map<String, Object> branco = new LinkedHashMap<>();
        for (String campo : new String[] {"cep", "logradouro", "numero", "complemento", "bairro", "cidade", "uf"}) {
            branco.put(campo, "  ");
        }
        JsonNode limpo = alterar(treinador, id, corpo("Aluno Fictício", null, branco), 200);
        assertThat(limpo.has("endereco")).isFalse();
        assertThat(sql("cep", id)).isNull();
        assertThat(sql("logradouro", id)).isNull();

        // Objeto vazio e sem a chave também valem, na criação.
        assertThat(criar(treinador, "Aluno Sem Endereço " + UUID.randomUUID(), null, Map.of(), 200).has("endereco")).isFalse();
        assertThat(criar(treinador, "Aluno Sem Chave " + UUID.randomUUID(), null, null, 200).has("endereco")).isFalse();
    }

    @Test
    void enderecoComNumeroSnEComLimiteContadoDepoisDoStrip() throws Exception {
        String logradouro200 = "x".repeat(200);
        JsonNode criado = criar(treinador, "Aluno Fictício", null, enderecoCom("numero", "s/n", "logradouro", "  " + logradouro200 + "  "), 200);
        assertThat(criado.path("endereco").path("numero").asString()).isEqualTo("s/n");
        assertThat(criado.path("endereco").path("logradouro").asString()).isEqualTo(logradouro200);
        assertThat(sql("logradouro", criado.path("id").asString())).isEqualTo(logradouro200);
        criar(treinador, "Aluno Fictício", null, enderecoCom("logradouro", "x".repeat(201)), 422);
    }

    // ---- CPF único ----

    @Test
    void cpfDuplicadoNaConsultoriaDa409SemRepetirOValorMasOMesmoAlunoPodeManter() throws Exception {
        String cpf = Documentos.cpf();
        String primeiro = criar(treinador, "Primeiro Aluno", cpf, null, 200).path("id").asString();
        // O banco é compartilhado entre as classes de teste: nome fixo não serve para contar; este é único por execução.
        String nomeDoSegundo = "Segundo Aluno " + UUID.randomUUID();

        // Digitado sem pontuação é o mesmo CPF.
        JsonNode repetido = criar(treinador, nomeDoSegundo, Documentos.semPontuacao(cpf), null, 409);
        assertThat(repetido.path("codigo").asString()).isEqualTo("ALUNO_CPF_EM_USO");
        assertThat(repetido.toString()).doesNotContain(cpf).doesNotContain(Documentos.semPontuacao(cpf));
        assertThat(banco.queryForObject("select count(*) from aluno where nome = ?", Integer.class, nomeDoSegundo)).isZero();

        String segundo = criar(treinador, nomeDoSegundo, null, null, 200).path("id").asString();
        JsonNode emEdicao = alterar(treinador, segundo, corpo(nomeDoSegundo, cpf, null), 409);
        assertThat(emEdicao.path("codigo").asString()).isEqualTo("ALUNO_CPF_EM_USO");
        assertThat(emEdicao.toString()).doesNotContain(cpf);
        assertThat(sql("cpf", segundo)).isNull();

        // O dono do CPF pode salvar de novo com ele.
        alterar(treinador, primeiro, corpo("Primeiro Aluno Editado", cpf, null), 200);

        // Nem o CPF nem o endereço foram para a auditoria.
        assertThat(banco.queryForObject("select count(*) from auditoria where resumo like '%' || ? || '%'", Integer.class, cpf)).isZero();
    }

    @Test
    void mesmoCpfEmOutraConsultoriaNaoConflita() throws Exception {
        String cpf = Documentos.cpf();
        criar(treinador, "Aluno Fictício", cpf, null, 200);
        JsonNode outra = api.novoTreinador();

        JsonNode criado = criar(outra, "Aluno de Outra Consultoria", cpf, null, 200);
        assertThat(criado.path("cpf").asString()).isEqualTo(cpf);
        assertThat(banco.queryForObject("select count(*) from aluno where cpf = ?", Integer.class, cpf)).isEqualTo(2);
    }

    @Test
    void cpfAnonimizadoFicaLivreEOCadastroNaoVoltaAserEditado() throws Exception {
        String cpf = Documentos.cpf();
        JsonNode criado = criar(treinador, "Aluno Fictício", cpf, ENDERECO, 200);
        String id = criado.path("id").asString();
        api.patch("/alunos/" + id + "/situacao", treinador, Map.of("ativo", false), 200);

        JsonNode anonimo = api.post("/alunos/" + id + "/anonimizar", treinador, Map.of("nomeConfirmado", "Aluno Fictício"), 200);
        assertThat(anonimo.has("cpf")).isFalse();
        assertThat(anonimo.has("endereco")).isFalse();
        assertThat(banco.queryForObject("select count(*) from aluno where id = ?::uuid and cpf is null and cep is null and logradouro is null"
                + " and numero is null and complemento is null and bairro is null and cidade is null and uf is null", Integer.class, id))
                .isEqualTo(1);

        assertThat(alterar(treinador, id, corpo("Aluno Fictício", cpf, ENDERECO), 409).path("codigo").asString())
                .isEqualTo("ALUNO_ANONIMIZADO");
        assertThat(sql("cpf", id)).isNull();
        criar(treinador, "Outro Aluno Fictício", cpf, null, 200);
    }

    // ---- telefone ----

    @Test
    void telefoneSoParaQuemTemAcessoEOutrosCasosDeConflito() throws Exception {
        String id = criar(treinador, "Aluno Fictício", null, null, 200).path("id").asString();

        // Sem acesso não há onde guardar: 409 (criar e editar), a ficha segue sem telefone.
        Map<String, Object> comTelefone = corpo("Aluno Fictício", null, null);
        comTelefone.put("telefone", "(45) 99999-8888");
        assertThat(api.post("/alunos", treinador, comTelefone, 409).path("codigo").asString()).isEqualTo("ALUNO_SEM_ACESSO");
        JsonNode recusado = alterar(treinador, id, comTelefone, 409);
        assertThat(recusado.path("codigo").asString()).isEqualTo("ALUNO_SEM_ACESSO");
        assertThat(recusado.toString()).doesNotContain("99999");
        assertThat(semValor(api.get("/alunos/" + id, treinador, 200).path("telefone"))).isTrue();
        // Nulo ou em branco, sem acesso, é só "não mexe".
        Map<String, Object> embranco = corpo("Aluno Fictício", null, null);
        embranco.put("telefone", "  ");
        alterar(treinador, id, embranco, 200);
        alterar(treinador, id, corpo("Aluno Fictício", null, null), 200);

        // Com acesso: grava no usuário do aluno, normalizado.
        api.convidarEEntrar(treinador, UUID.fromString(id));
        Map<String, Object> digitado = corpo("Aluno Fictício", null, null);
        digitado.put("telefone", "+55 45 99999-8888");
        assertThat(alterar(treinador, id, digitado, 200).path("telefone").asString()).isEqualTo("(45) 99999-8888");
        assertThat(banco.queryForObject("select telefone from usuario where id = (select usuario_id from aluno where id = ?::uuid)",
                String.class, id)).isEqualTo("(45) 99999-8888");

        // Nulo = não mexe (a tela antiga não manda); em branco = apaga.
        assertThat(alterar(treinador, id, corpo("Aluno Fictício", null, null), 200).path("telefone").asString()).isEqualTo("(45) 99999-8888");
        assertThat(api.get("/alunos/" + id, treinador, 200).path("telefone").asString()).isEqualTo("(45) 99999-8888");
        assertThat(semValor(alterar(treinador, id, embranco, 200).path("telefone"))).isTrue();
        assertThat(banco.queryForObject("select telefone from usuario where id = (select usuario_id from aluno where id = ?::uuid)",
                String.class, id)).isNull();

        // Formato inválido: 422 no campo, sem repetir o que veio.
        Map<String, Object> ruim = corpo("Aluno Fictício", null, null);
        ruim.put("telefone", "(45) 9999-8888");
        JsonNode erro = alterar(treinador, id, ruim, 422);
        assertThat(erro.toString()).contains("\"field\":\"telefone\"").doesNotContain("9999-8888");
    }

    @Test
    void telefoneAparecePeloAlunoLerEEscrevePeloAlunoAlterar() throws Exception {
        String id = criar(treinador, "Aluno Fictício", null, null, 200).path("id").asString();
        api.convidarEEntrar(treinador, UUID.fromString(id));
        Map<String, Object> comTelefone = corpo("Aluno Fictício", null, null);
        comTelefone.put("telefone", "(45) 99999-8888");
        alterar(treinador, id, comTelefone, 200);

        // Quem só lê (sem dado sensível) vê o telefone: ele é cadastro, não dado de saúde.
        JsonNode leitor = membro(Set.of("ALUNO_LER"));
        JsonNode ficha = api.get("/alunos/" + id, leitor, 200);
        assertThat(ficha.path("telefone").asString()).isEqualTo("(45) 99999-8888");
        assertThat(ficha.has("cpf")).isFalse();
        // E não escreve: sem ALUNO_ALTERAR é 403.
        alterar(leitor, id, comTelefone, 403);

        // Quem edita sem o dado sensível troca o telefone (CPF e endereço seguem ignorados).
        JsonNode editor = membro(Set.of("ALUNO_ALTERAR"));
        Map<String, Object> outro = corpo("Aluno Fictício", Documentos.cpf(), null);
        outro.put("telefone", "(45) 98888-7777");
        assertThat(alterar(editor, id, outro, 200).path("telefone").asString()).isEqualTo("(45) 98888-7777");
        assertThat(sql("cpf", id)).isNull();
    }
}
