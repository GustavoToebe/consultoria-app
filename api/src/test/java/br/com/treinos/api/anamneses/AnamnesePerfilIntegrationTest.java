package br.com.treinos.api.anamneses;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.Documentos;
import br.com.treinos.api.equipe.CatalogoPermissoes;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Fase C da anamnese: respostas com destino no cadastro (peso, objetivo, CPF, telefone e endereço). Campo vazio é preenchido no envio, igual não
 * muda nada, diferente vira alteração para revisar (aplicar ou descartar), com permissão do campo, isolamento, reenvio
 * idempotente, data da pesagem, exportação e anonimização. Só dados fictícios.
 */
@AutoConfigureMockMvc
class AnamnesePerfilIntegrationTest extends AbstractIntegrationTest {

    private static final String OBJETIVO = "Objetivo fictício de teste";

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;
    private ApiDeTeste api;
    private JsonNode treinador;
    private JsonNode questionario;
    private LocalDate pesagem;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
        questionario = publicar(treinador, conteudo(true));
        pesagem = LocalDate.now(Fuso.BRASILIA).minusDays(5);
    }

    // ---- apoio ----

    /** Data da pesagem (só passado), peso → registro de peso (com ou sem a data indicada) e texto → objetivo. */
    private static Map<String, Object> conteudo(boolean comDataDaPesagem) {
        Map<String, Object> data = Map.of("id", "pesagem", "tipo", "DATA", "rotulo", "Data da pesagem", "obrigatoria", false,
                "somentePassado", true);
        Map<String, Object> peso = new HashMap<>(Map.of("id", "peso", "tipo", "PESO", "rotulo", "Peso", "obrigatoria", false,
                "destino", "PESO"));
        if (comDataDaPesagem) {
            peso.put("destinoData", "pesagem");
        }
        Map<String, Object> objetivo = Map.of("id", "objetivo", "tipo", "TEXTO", "rotulo", "Objetivo", "obrigatoria", false,
                "destino", "OBJETIVO");
        return Map.of("instrucoes", List.of(), "secoes", List.of(
                Map.of("uid", "s1", "titulo", "Geral", "perguntas", List.of(data, peso, objetivo))));
    }

    private JsonNode publicar(JsonNode quem, Map<String, Object> conteudo) throws Exception {
        String nome = "Anamnese " + UUID.randomUUID();
        JsonNode q = api.post("/questionarios", quem, Map.of("nome", nome, "origem", "VAZIO", "finalidade", "ANAMNESE"), 200);
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("nome", nome);
        corpo.put("conteudo", conteudo);
        corpo.put("versao", q.path("versao").asLong());
        JsonNode salvo = api.put("/questionarios/" + q.path("id").asString(), quem, corpo, 200);
        // O destino sobrevive à gravação (o conteúdo descarta chave desconhecida).
        assertThat(api.get("/questionarios/" + q.path("id").asString(), quem, 200).toString()).contains("\"destino\":\"");
        return api.post("/questionarios/" + q.path("id").asString() + "/publicar", quem,
                Map.of("versao", salvo.path("versao").asLong(), "confirmarAvisos", false), 200);
    }

    /** Cria o aluno (com objetivo, se houver), atribui a anamnese e devolve [anamnese, login do aluno]. */
    private JsonNode[] alunoComAnamnese(String objetivo, JsonNode q) throws Exception {
        Map<String, Object> corpo = new HashMap<>(Map.of("nome", "Aluno Fictício " + UUID.randomUUID().toString().substring(0, 8)));
        if (objetivo != null) {
            corpo.put("objetivo", objetivo);
        }
        UUID aluno = UUID.fromString(api.post("/alunos", treinador, corpo, 200).path("id").asString());
        JsonNode a = api.post("/alunos/" + aluno + "/anamneses", treinador, Map.of("questionarioId", q.path("id").asString()), 200);
        return new JsonNode[] {a, api.convidarEEntrar(treinador, aluno)};
    }

    private JsonNode enviar(JsonNode login, JsonNode a, Map<String, Object> respostas, int status) throws Exception {
        return api.post("/aluno/anamnese/" + a.path("id").asString() + "/enviar", login,
                Map.of("questionarioVersaoId", a.path("questionarioVersaoId").asString(), "respostas", respostas), status);
    }

    private static Map<String, Object> respostas(Object peso, String data, String objetivo) {
        Map<String, Object> r = new LinkedHashMap<>();
        if (data != null) r.put("pesagem", data);
        if (peso != null) r.put("peso", peso);
        if (objetivo != null) r.put("objetivo", objetivo);
        return r;
    }

    private String alunoId(JsonNode a) {
        return a.path("alunoId").asString();
    }

    private JsonNode pesos(JsonNode a) throws Exception {
        return api.get("/alunos/" + alunoId(a) + "/pesos", treinador, 200);
    }

    private JsonNode detalhe(JsonNode a, JsonNode quem) throws Exception {
        return api.get("/anamneses/" + a.path("id").asString(), quem, 200);
    }

    private static JsonNode alteracao(JsonNode detalhe, String destino) {
        return detalhe.path("alteracoes").valueStream().filter(x -> destino.equals(x.path("destino").asString())).findFirst()
                .orElseThrow();
    }

    private String acao(JsonNode a, String alteracao, String verbo) {
        return "/anamneses/" + a.path("id").asString() + "/alteracoes/" + alteracao + "/" + verbo;
    }

    private int auditorias(JsonNode a, String acao) {
        return banco.queryForObject("select count(*) from auditoria where entidade_id = ?::uuid and acao = ?", Integer.class,
                a.path("id").asString(), acao);
    }

    private JsonNode membro(Set<String> permissoes) throws Exception {
        String perfil = api.post("/perfis", treinador,
                Map.of("nome", "Perfil " + UUID.randomUUID(), "permissoes", permissoes), 200).get("id").asString();
        JsonNode convite = api.post("/usuarios/convites", treinador,
                Map.of("nome", "Membro fictício", "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        return api.post("/publico/convites-equipe/" + convite.get("codigo").asString(), null,
                Map.of("senha", ApiDeTeste.SENHA), 200);
    }

    // ---- apoio: CPF, telefone e endereço ----

    private static final Map<String, Object> ENDERECO = Map.of("cep", "85800-000", "logradouro", "Rua das Flores",
            "numero", "100", "bairro", "Centro", "cidade", "Cidade Exemplo", "uf", "PR");

    /** O {@link #ENDERECO} completo com outra cidade (não existe endereço parcial: a resposta precisa vir inteira). */
    private static Map<String, Object> enderecoComCidade(String cidade) {
        Map<String, Object> e = new LinkedHashMap<>(ENDERECO);
        e.put("cidade", cidade);
        return e;
    }

    /** Um destino de cada: CPF (texto), telefone e endereço. */
    private static Map<String, Object> conteudoCadastro() {
        return Map.of("instrucoes", List.of(), "secoes", List.of(Map.of("uid", "s1", "titulo", "Cadastro", "perguntas", List.of(
                Map.of("id", "cpf", "tipo", "TEXTO", "rotulo", "CPF", "obrigatoria", false, "destino", "CPF"),
                Map.of("id", "tel", "tipo", "TELEFONE", "rotulo", "Telefone", "obrigatoria", false, "destino", "TELEFONE"),
                Map.of("id", "end", "tipo", "ENDERECO", "rotulo", "Endereço", "obrigatoria", false, "destino", "ENDERECO")))));
    }

    private static Map<String, Object> cadastro(String cpf, String telefone, Map<String, Object> endereco) {
        Map<String, Object> r = new LinkedHashMap<>();
        if (cpf != null) r.put("cpf", cpf);
        if (telefone != null) r.put("tel", telefone);
        if (endereco != null) r.put("end", endereco);
        return r;
    }

    /** Aluno com o corpo dado (CPF e endereço de partida), anamnese atribuída e login (o aluno só tem telefone depois do acesso). */
    private JsonNode[] alunoComCadastro(Map<String, Object> extras, JsonNode q) throws Exception {
        Map<String, Object> corpo = new HashMap<>(extras);
        corpo.put("nome", "Aluno Fictício " + UUID.randomUUID().toString().substring(0, 8));
        UUID aluno = UUID.fromString(api.post("/alunos", treinador, corpo, 200).path("id").asString());
        JsonNode a = api.post("/alunos/" + aluno + "/anamneses", treinador, Map.of("questionarioId", q.path("id").asString()), 200);
        return new JsonNode[] {a, api.convidarEEntrar(treinador, aluno)};
    }

    /** Põe o telefone do usuário do aluno sem perder o CPF e o endereço que a ficha já tem (o PUT substitui tudo). */
    private void definirTelefone(JsonNode a, String telefone) throws Exception {
        JsonNode ficha = api.get("/alunos/" + alunoId(a), treinador, 200);
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("nome", ficha.path("nome").asString());
        corpo.put("versao", ficha.path("versao").asLong());
        corpo.put("telefone", telefone);
        if (ficha.has("cpf")) corpo.put("cpf", ficha.path("cpf").asString());
        if (ficha.has("endereco")) corpo.put("endereco", ficha.path("endereco"));
        api.put("/alunos/" + alunoId(a), treinador, corpo, 200);
    }

    private JsonNode ficha(JsonNode a) throws Exception {
        return api.get("/alunos/" + alunoId(a), treinador, 200);
    }

    private static boolean semValor(JsonNode n) {
        return n.isMissingNode() || n.isNull();
    }

    // ---- testes ----

    @Test
    void cpfTelefoneEEnderecoVaziosPreenchemNoEnvioJaNormalizadosEReenvioNaoMuda() throws Exception {
        JsonNode cad = publicar(treinador, conteudoCadastro());
        JsonNode[] x = alunoComCadastro(Map.of(), cad);
        JsonNode a = x[0];
        String cpf = Documentos.cpf();

        Map<String, Object> digitado = new LinkedHashMap<>(Map.of("cep", "85800000", "logradouro", " Rua das Flores ", "numero", "100",
                "cidade", "Cidade Exemplo", "uf", "pr"));
        enviar(x[1], a, cadastro(Documentos.semPontuacao(cpf), "+55 45 99999-8888", digitado), 200);

        JsonNode f = ficha(a);
        assertThat(f.path("cpf").asString()).isEqualTo(cpf);
        assertThat(f.path("telefone").asString()).isEqualTo("(45) 99999-8888");
        JsonNode e = f.path("endereco");
        assertThat(e.path("cep").asString()).isEqualTo("85800-000");
        assertThat(e.path("logradouro").asString()).isEqualTo("Rua das Flores");
        assertThat(e.path("numero").asString()).isEqualTo("100");
        assertThat(e.path("cidade").asString()).isEqualTo("Cidade Exemplo");
        assertThat(e.path("uf").asString()).isEqualTo("PR");
        assertThat(semValor(e.path("complemento"))).isTrue();
        assertThat(semValor(e.path("bairro"))).isTrue();

        // Registradas como origem, já aplicadas no envio e sem autor da equipe; nada para revisar; uma auditoria só.
        JsonNode d = detalhe(a, treinador);
        assertThat(d.path("alteracoes")).hasSize(3);
        assertThat(d.path("alteracoes").valueStream().allMatch(p -> "APLICADA".equals(p.path("situacao").asString())
                && p.path("automatica").asBoolean() && p.path("resolvidaPorNome").isNull())).isTrue();
        assertThat(alteracao(d, "CPF").path("valor").path("texto").asString()).isEqualTo(cpf);
        assertThat(alteracao(d, "TELEFONE").path("valor").path("texto").asString()).isEqualTo("(45) 99999-8888");
        assertThat(alteracao(d, "ENDERECO").path("valor").path("endereco").path("cep").asString()).isEqualTo("85800-000");
        assertThat(api.get("/alunos/" + alunoId(a) + "/anamneses", treinador, 200).get(0).path("alteracoesParaRevisar").asLong()).isZero();
        assertThat(auditorias(a, "ANAMNESE_CADASTRO_PREENCHIDO")).isEqualTo(1);

        // Reenvio, até com outros valores: nada muda.
        enviar(x[1], a, cadastro(Documentos.cpf(), "(45) 98888-7777", enderecoComCidade("Outra Cidade")), 200);
        assertThat(ficha(a).path("cpf").asString()).isEqualTo(cpf);
        assertThat(ficha(a).path("telefone").asString()).isEqualTo("(45) 99999-8888");
        assertThat(ficha(a).path("endereco").path("cidade").asString()).isEqualTo("Cidade Exemplo");
        assertThat(detalhe(a, treinador).path("alteracoes")).hasSize(3);
    }

    @Test
    void cadastroIgualNaoFazNadaMesmoDigitadoDeOutroJeito() throws Exception {
        JsonNode cad = publicar(treinador, conteudoCadastro());
        String cpf = Documentos.cpf();
        JsonNode[] x = alunoComCadastro(Map.of("cpf", cpf, "endereco", ENDERECO), cad);
        JsonNode a = x[0];
        definirTelefone(a, "(45) 99999-8888");

        enviar(x[1], a, cadastro(Documentos.semPontuacao(cpf), "45999998888",
                Map.of("cep", "85800000", "logradouro", " Rua das Flores ", "numero", "100", "bairro", "Centro",
                        "cidade", "Cidade Exemplo", "uf", "pr")), 200);

        assertThat(detalhe(a, treinador).path("alteracoes")).isEmpty();
        assertThat(ficha(a).path("cpf").asString()).isEqualTo(cpf);
        assertThat(ficha(a).path("telefone").asString()).isEqualTo("(45) 99999-8888");
        assertThat(auditorias(a, "ANAMNESE_CADASTRO_PREENCHIDO")).isZero();
    }

    @Test
    void cadastroDiferenteViraAlteracaoEAplicarGravaCadaCampo() throws Exception {
        JsonNode cad = publicar(treinador, conteudoCadastro());
        String cpf = Documentos.cpf();
        String novoCpf = Documentos.cpf();
        JsonNode[] x = alunoComCadastro(Map.of("cpf", cpf, "endereco", ENDERECO), cad);
        JsonNode a = x[0];
        definirTelefone(a, "(45) 99999-8888");
        Map<String, Object> novoEndereco = new LinkedHashMap<>(ENDERECO);
        novoEndereco.put("cidade", "Cidade Nova");
        novoEndereco.put("complemento", "Apto 2");

        enviar(x[1], a, cadastro(novoCpf, "(45) 98888-7777", novoEndereco), 200);

        // Nada mudou no cadastro; as três esperam revisão, com o valor proposto e o de hoje no mesmo formato.
        assertThat(ficha(a).path("cpf").asString()).isEqualTo(cpf);
        JsonNode d = detalhe(a, treinador);
        assertThat(d.path("alteracoes")).hasSize(3);
        JsonNode pc = alteracao(d, "CPF");
        assertThat(pc.path("situacao").asString()).isEqualTo("PENDENTE");
        assertThat(pc.path("valor").path("texto").asString()).isEqualTo(novoCpf);
        assertThat(pc.path("valorAtual").path("texto").asString()).isEqualTo(cpf);
        JsonNode pt = alteracao(d, "TELEFONE");
        assertThat(pt.path("valor").path("texto").asString()).isEqualTo("(45) 98888-7777");
        assertThat(pt.path("valorAtual").path("texto").asString()).isEqualTo("(45) 99999-8888");
        JsonNode pe = alteracao(d, "ENDERECO");
        assertThat(pe.path("valor").path("endereco").path("cidade").asString()).isEqualTo("Cidade Nova");
        assertThat(pe.path("valor").path("endereco").path("complemento").asString()).isEqualTo("Apto 2");
        assertThat(pe.path("valorAtual").path("endereco").path("cidade").asString()).isEqualTo("Cidade Exemplo");
        assertThat(semValor(pe.path("valorAtual").path("endereco").path("complemento"))).isTrue();
        assertThat(api.get("/alunos/" + alunoId(a) + "/anamneses", treinador, 200).get(0).path("alteracoesParaRevisar").asLong()).isEqualTo(3);

        for (JsonNode p : List.of(pc, pt, pe)) {
            JsonNode depois = api.post(acao(a, p.path("id").asString(), "aplicar"), treinador, null, 200);
            assertThat(alteracao(depois, p.path("destino").asString()).path("situacao").asString()).isEqualTo("APLICADA");
        }
        JsonNode f = ficha(a);
        assertThat(f.path("cpf").asString()).isEqualTo(novoCpf);
        assertThat(f.path("telefone").asString()).isEqualTo("(45) 98888-7777");
        assertThat(f.path("endereco").path("cidade").asString()).isEqualTo("Cidade Nova");
        assertThat(f.path("endereco").path("complemento").asString()).isEqualTo("Apto 2");
        // O endereço é substituído por inteiro: os sete campos são os da resposta.
        assertThat(f.path("endereco").path("logradouro").asString()).isEqualTo("Rua das Flores");
        assertThat(auditorias(a, "ANAMNESE_ALTERACAO_APLICADA")).isEqualTo(3);
        api.post(acao(a, pc.path("id").asString(), "aplicar"), treinador, null, 200);
        assertThat(auditorias(a, "ANAMNESE_ALTERACAO_APLICADA")).isEqualTo(3);
    }

    @Test
    void descartarCpfTelefoneEEnderecoNaoMexeNoCadastro() throws Exception {
        JsonNode cad = publicar(treinador, conteudoCadastro());
        String cpf = Documentos.cpf();
        JsonNode[] x = alunoComCadastro(Map.of("cpf", cpf, "endereco", ENDERECO), cad);
        JsonNode a = x[0];
        definirTelefone(a, "(45) 99999-8888");
        enviar(x[1], a, cadastro(Documentos.cpf(), "(45) 98888-7777", enderecoComCidade("Cidade Nova")), 200);

        for (JsonNode p : detalhe(a, treinador).path("alteracoes")) {
            api.post(acao(a, p.path("id").asString(), "descartar"), treinador, null, 200);
        }
        JsonNode f = ficha(a);
        assertThat(f.path("cpf").asString()).isEqualTo(cpf);
        assertThat(f.path("telefone").asString()).isEqualTo("(45) 99999-8888");
        assertThat(f.path("endereco").path("cidade").asString()).isEqualTo("Cidade Exemplo");
    }

    @Test
    void permissaoDeCadaDestinoDoCadastro() throws Exception {
        JsonNode cad = publicar(treinador, conteudoCadastro());
        JsonNode[] x = alunoComCadastro(Map.of("cpf", Documentos.cpf(), "endereco", ENDERECO), cad);
        JsonNode a = x[0];
        definirTelefone(a, "(45) 99999-8888");
        enviar(x[1], a, cadastro(Documentos.cpf(), "(45) 98888-7777", enderecoComCidade("Cidade Nova")), 200);
        JsonNode d = detalhe(a, treinador);
        String cpf = alteracao(d, "CPF").path("id").asString();
        String telefone = alteracao(d, "TELEFONE").path("id").asString();
        String endereco = alteracao(d, "ENDERECO").path("id").asString();

        // Telefone pede ALUNO_ALTERAR; CPF e endereço pedem ALUNO_SENSIVEL_ALTERAR.
        JsonNode soCadastro = membro(CatalogoPermissoes.comDependencias(Set.of("ANAMNESE_ALTERAR", "ALUNO_ALTERAR", "ALUNO_SENSIVEL_LER")));
        api.post(acao(a, cpf, "aplicar"), soCadastro, null, 403);
        api.post(acao(a, endereco, "aplicar"), soCadastro, null, 403);
        api.post(acao(a, cpf, "descartar"), soCadastro, null, 403);
        api.post(acao(a, telefone, "aplicar"), soCadastro, null, 200);
        assertThat(ficha(a).path("telefone").asString()).isEqualTo("(45) 98888-7777");

        JsonNode soSensivel = membro(CatalogoPermissoes.comDependencias(Set.of("ANAMNESE_ALTERAR", "ALUNO_SENSIVEL_ALTERAR")));
        api.post(acao(a, telefone, "descartar"), soSensivel, null, 403); // a permissão do campo vale também para descartar
        api.post(acao(a, cpf, "aplicar"), soSensivel, null, 200);
        api.post(acao(a, endereco, "aplicar"), soSensivel, null, 200);
        assertThat(ficha(a).path("endereco").path("cidade").asString()).isEqualTo("Cidade Nova");
    }

    @Test
    void cpfQueJaEDeOutroAlunoNaoPreencheViraPendenteEAplicarDa409SemRepetirOValor() throws Exception {
        JsonNode cad = publicar(treinador, conteudoCadastro());
        String cpf = Documentos.cpf();
        api.post("/alunos", treinador, Map.of("nome", "Outro Aluno Fictício", "cpf", cpf), 200);
        JsonNode[] x = alunoComCadastro(Map.of(), cad);
        JsonNode a = x[0];

        // O envio dá certo (o aluno não descobre de quem é o CPF) e o cadastro continua sem CPF.
        enviar(x[1], a, cadastro(Documentos.semPontuacao(cpf), null, null), 200);
        assertThat(ficha(a).has("cpf")).isFalse();
        JsonNode p = alteracao(detalhe(a, treinador), "CPF");
        assertThat(p.path("situacao").asString()).isEqualTo("PENDENTE");
        assertThat(p.path("valorAtual").isNull()).isTrue();
        assertThat(auditorias(a, "ANAMNESE_CADASTRO_PREENCHIDO")).isZero();

        JsonNode erro = api.post(acao(a, p.path("id").asString(), "aplicar"), treinador, null, 409);
        assertThat(erro.path("codigo").asString()).isEqualTo("ALUNO_CPF_EM_USO");
        assertThat(erro.toString()).doesNotContain(cpf).doesNotContain(Documentos.semPontuacao(cpf));
        assertThat(alteracao(detalhe(a, treinador), "CPF").path("situacao").asString()).isEqualTo("PENDENTE");
        assertThat(ficha(a).has("cpf")).isFalse();
        api.post(acao(a, p.path("id").asString(), "descartar"), treinador, null, 200);
    }

    @Test
    void cpfQueViraDeOutroAlunoDepoisDoEnvioTambemDa409AoAplicar() throws Exception {
        JsonNode cad = publicar(treinador, conteudoCadastro());
        JsonNode[] x = alunoComCadastro(Map.of("cpf", Documentos.cpf()), cad);
        JsonNode a = x[0];
        String novo = Documentos.cpf();
        enviar(x[1], a, cadastro(novo, null, null), 200);
        JsonNode p = alteracao(detalhe(a, treinador), "CPF");
        assertThat(p.path("situacao").asString()).isEqualTo("PENDENTE");

        api.post("/alunos", treinador, Map.of("nome", "Outro Aluno Fictício", "cpf", novo), 200);
        JsonNode erro = api.post(acao(a, p.path("id").asString(), "aplicar"), treinador, null, 409);
        assertThat(erro.path("codigo").asString()).isEqualTo("ALUNO_CPF_EM_USO");
        assertThat(erro.toString()).doesNotContain(novo);
    }

    @Test
    void cpfEmUsoEmOutraConsultoriaNaoImpede() throws Exception {
        JsonNode cad = publicar(treinador, conteudoCadastro());
        String cpf = Documentos.cpf();
        JsonNode outro = api.novoTreinador();
        api.post("/alunos", outro, Map.of("nome", "Aluno de Outra Consultoria", "cpf", cpf), 200);
        JsonNode[] x = alunoComCadastro(Map.of(), cad);

        enviar(x[1], x[0], cadastro(cpf, null, null), 200);

        assertThat(ficha(x[0]).path("cpf").asString()).isEqualTo(cpf);
    }

    @Test
    void respostaDeCpfTelefoneEEnderecoInvalidosNaoPassaESemRepetirOValor() throws Exception {
        JsonNode cad = publicar(treinador, conteudoCadastro());
        JsonNode[] x = alunoComCadastro(Map.of(), cad);

        JsonNode cpfRuim = enviar(x[1], x[0], cadastro("111.111.111-11", null, null), 422);
        assertThat(cpfRuim.toString()).contains("\"field\":\"cpf\"").doesNotContain("111.111.111-11");
        // Fixo com 9 na frente: a pergunta de telefone comum aceita, a que alimenta o cadastro não.
        assertThat(enviar(x[1], x[0], cadastro(null, "(45) 9999-8888", null), 422).toString()).contains("\"field\":\"tel\"");
        assertThat(enviar(x[1], x[0], cadastro(null, null, Map.of("uf", "XX")), 422).toString()).contains("\"field\":\"end\"");
        assertThat(enviar(x[1], x[0], cadastro(null, null, Map.of("cep", "123")), 422).toString()).contains("\"field\":\"end\"");
        assertThat(enviar(x[1], x[0], cadastro(null, null, Map.of("pais", "BR")), 422).toString()).contains("\"field\":\"end\"");
        // Não existe endereço parcial: sem um obrigatório (CEP, logradouro, número, cidade, UF) a resposta é recusada.
        for (String falta : new String[] {"cep", "logradouro", "numero", "cidade", "uf"}) {
            Map<String, Object> parcial = new LinkedHashMap<>(ENDERECO);
            parcial.remove(falta);
            JsonNode erro = enviar(x[1], x[0], cadastro(null, null, parcial), 422);
            assertThat(erro.path("codigo").asString()).as(falta).isEqualTo("ANAMNESE_INVALIDA");
            assertThat(erro.toString()).as(falta).contains("\"field\":\"end\"").contains("Confira o formato e os limites deste campo.")
                    .doesNotContain("Rua das Flores");
        }
        assertThat(enviar(x[1], x[0], cadastro(null, null, Map.of("cidade", "Cidade Exemplo", "uf", "pr")), 422).toString())
                .contains("\"field\":\"end\"");
        // Obrigatório só com espaços também falta; logradouro com 201 caracteres depois do strip passa do limite.
        assertThat(enviar(x[1], x[0], cadastro(null, null, enderecoComCidade("   ")), 422).toString()).contains("\"field\":\"end\"");
        Map<String, Object> longo = new LinkedHashMap<>(ENDERECO);
        longo.put("logradouro", " " + "x".repeat(201) + " ");
        assertThat(enviar(x[1], x[0], cadastro(null, null, longo), 422).toString()).contains("\"field\":\"end\"");
        assertThat(ficha(x[0]).has("cpf")).isFalse();
    }

    @Test
    void enderecoCompletoComSnELimiteDepoisDoStripPreencheNormalizado() throws Exception {
        JsonNode cad = publicar(treinador, conteudoCadastro());
        JsonNode[] x = alunoComCadastro(Map.of(), cad);
        Map<String, Object> digitado = new LinkedHashMap<>(ENDERECO);
        digitado.put("numero", " s/n ");
        digitado.put("logradouro", "  " + "x".repeat(200) + "  ");
        enviar(x[1], x[0], cadastro(null, null, digitado), 200);

        JsonNode e = ficha(x[0]).path("endereco");
        assertThat(e.path("numero").asString()).isEqualTo("s/n");
        assertThat(e.path("logradouro").asString()).isEqualTo("x".repeat(200));
        assertThat(e.path("cep").asString()).isEqualTo("85800-000");
        assertThat(semValor(e.path("complemento"))).isTrue();
    }

    @Test
    void enderecoEmBrancoNaoObrigatorioEAceitoESomeObrigatorioPedePreenchimento() throws Exception {
        // Opcional (conteudoCadastro): tudo em branco é aceito, nada vira alteração e o cadastro continua sem endereço.
        JsonNode cad = publicar(treinador, conteudoCadastro());
        JsonNode[] x = alunoComCadastro(Map.of(), cad);
        Map<String, Object> branco = new LinkedHashMap<>();
        for (String campo : new String[] {"cep", "logradouro", "numero", "complemento", "bairro", "cidade", "uf"}) {
            branco.put(campo, " ");
        }
        enviar(x[1], x[0], cadastro(null, null, branco), 200);
        assertThat(ficha(x[0]).has("endereco")).isFalse();
        assertThat(detalhe(x[0], treinador).path("alteracoes")).isEmpty();

        // Obrigatória: em branco continua "Preencha este campo.".
        Map<String, Object> obrigatoria = new LinkedHashMap<>(Map.of("id", "end", "tipo", "ENDERECO", "rotulo", "Endereço",
                "obrigatoria", true, "destino", "ENDERECO"));
        JsonNode cadObrigatorio = publicar(treinador, Map.of("instrucoes", List.of(),
                "secoes", List.of(Map.of("uid", "s1", "titulo", "Cadastro", "perguntas", List.of(obrigatoria)))));
        JsonNode[] y = alunoComCadastro(Map.of(), cadObrigatorio);
        JsonNode erro = enviar(y[1], y[0], cadastro(null, null, branco), 422);
        assertThat(erro.toString()).contains("\"field\":\"end\"").contains("Preencha este campo.");
    }

    @Test
    void publicacaoConfereOsDestinosNovos() throws Exception {
        Map<String, Object> cpfNoTextoLongo = Map.of("id", "cpf", "tipo", "TEXTO_LONGO", "rotulo", "CPF", "obrigatoria", false, "destino", "CPF");
        JsonNode q = api.post("/questionarios", treinador, Map.of("nome", "Anamnese ruim", "origem", "VAZIO", "finalidade", "ANAMNESE"), 200);
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("nome", "Anamnese ruim");
        corpo.put("conteudo", Map.of("instrucoes", List.of(), "secoes", List.of(Map.of("uid", "s1", "titulo", "A", "perguntas", List.of(cpfNoTextoLongo)))));
        corpo.put("versao", q.path("versao").asLong());
        JsonNode salvo = api.put("/questionarios/" + q.path("id").asString(), treinador, corpo, 200);
        JsonNode erro = api.post("/questionarios/" + q.path("id").asString() + "/publicar", treinador,
                Map.of("versao", salvo.path("versao").asLong(), "confirmarAvisos", true), 422);
        assertThat(erro.toString()).contains("secoes[0].perguntas[0].destino");
    }

    // ---- testes (peso e objetivo) ----

    @Test
    void campoVazioPreencheNoEnvioComADataInformadaEReenvioNaoDuplica() throws Exception {
        JsonNode[] x = alunoComAnamnese(null, questionario);
        JsonNode a = x[0];
        JsonNode login = x[1];

        enviar(login, a, respostas(80.5, pesagem.toString(), "  " + OBJETIVO + " "), 200);

        assertThat(api.get("/alunos/" + alunoId(a), treinador, 200).path("objetivo").asString()).isEqualTo(OBJETIVO);
        JsonNode lista = pesos(a);
        assertThat(lista).hasSize(1);
        assertThat(lista.get(0).path("data").asString()).isEqualTo(pesagem.toString());
        assertThat(lista.get(0).path("pesoKg").decimalValue()).isEqualByComparingTo("80.5");

        // Ficam registradas como origem (aplicadas no envio, sem autor da equipe); nada para revisar.
        JsonNode d = detalhe(a, treinador);
        assertThat(d.path("alteracoes")).hasSize(2);
        assertThat(d.path("alteracoes").valueStream().allMatch(p -> "APLICADA".equals(p.path("situacao").asString())
                && p.path("automatica").asBoolean() && p.path("resolvidaPorNome").isNull())).isTrue();
        assertThat(api.get("/alunos/" + alunoId(a) + "/anamneses", treinador, 200).get(0).path("alteracoesParaRevisar").asLong()).isZero();
        assertThat(auditorias(a, "ANAMNESE_CADASTRO_PREENCHIDO")).isEqualTo(1);
        // O aluno não vê as alterações do cadastro.
        assertThat(api.get("/aluno/anamnese", login, 200).path("alteracoes").isNull()).isTrue();

        // Reenvio (clique duplo, rede que caiu), até com outros valores: nada muda, nada duplica.
        enviar(login, a, respostas(90, pesagem.toString(), "Outro objetivo fictício"), 200);
        assertThat(pesos(a)).hasSize(1);
        assertThat(detalhe(a, treinador).path("alteracoes")).hasSize(2);
        assertThat(api.get("/alunos/" + alunoId(a), treinador, 200).path("objetivo").asString()).isEqualTo(OBJETIVO);
        assertThat(auditorias(a, "ANAMNESE_CADASTRO_PREENCHIDO")).isEqualTo(1);
    }

    @Test
    void semDataIndicadaOPesoUsaADataDoEnvio() throws Exception {
        JsonNode semData = publicar(treinador, conteudo(false));
        JsonNode[] x = alunoComAnamnese(null, semData);
        // A data respondida não é a da pesagem neste questionário: vale a do envio.
        enviar(x[1], x[0], respostas(70, pesagem.toString(), null), 200);
        assertThat(pesos(x[0]).get(0).path("data").asString()).isEqualTo(LocalDate.now(Fuso.BRASILIA).toString());

        // Com a data indicada mas sem resposta (opcional), também a do envio.
        JsonNode[] y = alunoComAnamnese(null, questionario);
        enviar(y[1], y[0], respostas(70, null, null), 200);
        assertThat(pesos(y[0]).get(0).path("data").asString()).isEqualTo(LocalDate.now(Fuso.BRASILIA).toString());
    }

    @Test
    void igualNaoMudaEDiferenteViraAlteracaoParaAplicar() throws Exception {
        JsonNode[] x = alunoComAnamnese(OBJETIVO, questionario);
        JsonNode a = x[0];
        api.post("/alunos/" + alunoId(a) + "/pesos", treinador, Map.of("data", pesagem.toString(), "pesoKg", 70,
                "observacao", "Observação fictícia"), 200);

        enviar(x[1], a, respostas(72, pesagem.toString(), OBJETIVO + "  "), 200);

        // Objetivo igual: nada. Peso diferente na mesma data: não sobrescreve, vira alteração.
        assertThat(api.get("/alunos/" + alunoId(a), treinador, 200).path("objetivo").asString()).isEqualTo(OBJETIVO);
        assertThat(pesos(a).get(0).path("pesoKg").decimalValue()).isEqualByComparingTo("70");
        JsonNode d = detalhe(a, treinador);
        assertThat(d.path("alteracoes")).hasSize(1);
        JsonNode p = alteracao(d, "PESO");
        assertThat(p.path("situacao").asString()).isEqualTo("PENDENTE");
        assertThat(p.path("valor").path("pesoKg").decimalValue()).isEqualByComparingTo("72");
        assertThat(p.path("valor").path("data").asString()).isEqualTo(pesagem.toString());
        assertThat(p.path("valorAtual").path("pesoKg").decimalValue()).isEqualByComparingTo("70");
        assertThat(api.get("/alunos/" + alunoId(a) + "/anamneses", treinador, 200).get(0).path("alteracoesParaRevisar").asLong()).isEqualTo(1);
        assertThat(auditorias(a, "ANAMNESE_CADASTRO_PREENCHIDO")).isZero();

        // Aplicar: o peso da data muda e a observação fica; repetir não grava nem audita; descartar depois = 409.
        String id = p.path("id").asString();
        JsonNode aplicada = api.post(acao(a, id, "aplicar"), treinador, null, 200);
        assertThat(alteracao(aplicada, "PESO").path("situacao").asString()).isEqualTo("APLICADA");
        assertThat(alteracao(aplicada, "PESO").path("resolvidaPorNome").isNull()).isFalse();
        assertThat(alteracao(aplicada, "PESO").path("valorAtual").isNull()).isTrue();
        JsonNode lista = pesos(a);
        assertThat(lista).hasSize(1);
        assertThat(lista.get(0).path("pesoKg").decimalValue()).isEqualByComparingTo("72");
        assertThat(lista.get(0).path("observacao").asString()).isEqualTo("Observação fictícia");
        api.post(acao(a, id, "aplicar"), treinador, null, 200);
        assertThat(auditorias(a, "ANAMNESE_ALTERACAO_APLICADA")).isEqualTo(1);
        api.post(acao(a, id, "descartar"), treinador, null, 409);
        assertThat(api.get("/alunos/" + alunoId(a) + "/anamneses", treinador, 200).get(0).path("alteracoesParaRevisar").asLong()).isZero();
    }

    @Test
    void objetivoDiferenteSeDescartaSemMexerNoCadastro() throws Exception {
        JsonNode[] x = alunoComAnamnese(OBJETIVO, questionario);
        JsonNode a = x[0];
        enviar(x[1], a, respostas(null, null, "Objetivo fictício novo"), 200);

        JsonNode p = alteracao(detalhe(a, treinador), "OBJETIVO");
        assertThat(p.path("valor").path("texto").asString()).isEqualTo("Objetivo fictício novo");
        assertThat(p.path("valorAtual").path("texto").asString()).isEqualTo(OBJETIVO);
        String id = p.path("id").asString();
        JsonNode descartada = api.post(acao(a, id, "descartar"), treinador, null, 200);
        assertThat(alteracao(descartada, "OBJETIVO").path("situacao").asString()).isEqualTo("DESCARTADA");
        api.post(acao(a, id, "descartar"), treinador, null, 200);
        assertThat(auditorias(a, "ANAMNESE_ALTERACAO_DESCARTADA")).isEqualTo(1);
        api.post(acao(a, id, "aplicar"), treinador, null, 409);
        assertThat(api.get("/alunos/" + alunoId(a), treinador, 200).path("objetivo").asString()).isEqualTo(OBJETIVO);
        // A resposta original continua na anamnese.
        assertThat(detalhe(a, treinador).path("respostas").path("objetivo").asString()).isEqualTo("Objetivo fictício novo");
    }

    @Test
    void objetivoAplicadoAtualizaOCadastroEPassaDoTamanhoERecusado() throws Exception {
        JsonNode[] x = alunoComAnamnese(OBJETIVO, questionario);
        JsonNode a = x[0];
        JsonNode erro = enviar(x[1], a, respostas(null, null, "x".repeat(201)), 422);
        assertThat(erro.toString()).contains("objetivo");
        enviar(x[1], a, respostas(null, null, "Objetivo fictício novo"), 200);
        api.post(acao(a, alteracao(detalhe(a, treinador), "OBJETIVO").path("id").asString(), "aplicar"), treinador, null, 200);
        assertThat(api.get("/alunos/" + alunoId(a), treinador, 200).path("objetivo").asString()).isEqualTo("Objetivo fictício novo");
    }

    @Test
    void permissaoDoCampoEOutraConsultoria() throws Exception {
        JsonNode[] x = alunoComAnamnese(OBJETIVO, questionario);
        JsonNode a = x[0];
        enviar(x[1], a, respostas(null, null, "Objetivo fictício novo"), 200);
        String id = alteracao(detalhe(a, treinador), "OBJETIVO").path("id").asString();

        // Só ler: vê, não age. Anamnese sem o dado sensível de escrita: também não age.
        JsonNode leitor = membro(CatalogoPermissoes.comDependencias(Set.of("ANAMNESE_LER")));
        assertThat(detalhe(a, leitor).path("alteracoes")).hasSize(1);
        api.post(acao(a, id, "aplicar"), leitor, null, 403);
        JsonNode semCampo = membro(CatalogoPermissoes.comDependencias(Set.of("ANAMNESE_ALTERAR")));
        api.post(acao(a, id, "aplicar"), semCampo, null, 403);
        api.post(acao(a, id, "descartar"), semCampo, null, 403);
        JsonNode comCampo = membro(CatalogoPermissoes.comDependencias(Set.of("ANAMNESE_ALTERAR", "ALUNO_SENSIVEL_ALTERAR")));

        // Outra consultoria: 404, também com o id da alteração debaixo de outra anamnese.
        JsonNode outro = api.novoTreinador();
        api.post(acao(a, id, "aplicar"), outro, null, 404);
        JsonNode[] y = alunoComAnamnese(null, questionario);
        api.post(acao(y[0], id, "aplicar"), treinador, null, 404);

        api.post(acao(a, id, "aplicar"), comCampo, null, 200);
        assertThat(api.get("/alunos/" + alunoId(a), treinador, 200).path("objetivo").asString()).isEqualTo("Objetivo fictício novo");
    }

    @Test
    void publicacaoConfereODestino() throws Exception {
        // Destino em questionário de atualização: 422 no caminho dele.
        JsonNode q = api.post("/questionarios", treinador, Map.of("nome", "Atualização com destino", "origem", "VAZIO"), 200);
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("nome", "Atualização com destino");
        corpo.put("conteudo", Map.of("instrucoes", List.of(), "secoes", List.of(Map.of("uid", "s1", "titulo", "A", "perguntas",
                List.of(Map.of("id", "peso", "tipo", "PESO", "rotulo", "Peso", "destino", "PESO"))))));
        corpo.put("versao", q.path("versao").asLong());
        JsonNode salvo = api.put("/questionarios/" + q.path("id").asString(), treinador, corpo, 200);
        JsonNode erro = api.post("/questionarios/" + q.path("id").asString() + "/publicar", treinador,
                Map.of("versao", salvo.path("versao").asLong(), "confirmarAvisos", true), 422);
        assertThat(erro.toString()).contains("secoes[0].perguntas[0].destino");
    }

    @Test
    void exportacaoLevaEAnonimizacaoApagaAsAlteracoes() throws Exception {
        JsonNode[] x = alunoComAnamnese(OBJETIVO, questionario);
        JsonNode a = x[0];
        enviar(x[1], a, respostas(81, pesagem.toString(), "Objetivo fictício novo"), 200);

        JsonNode exportacao = api.get("/alunos/" + alunoId(a) + "/exportacao", treinador, 200);
        JsonNode alteracoes = exportacao.path("anamneses").path("itens").get(0).path("alteracoesDoCadastro");
        assertThat(alteracoes).hasSize(2);
        assertThat(alteracoes.toString()).contains("Objetivo fictício novo");

        String nome = api.get("/alunos/" + alunoId(a), treinador, 200).path("nome").asString();
        api.patch("/alunos/" + alunoId(a) + "/situacao", treinador, Map.of("ativo", false), 200);
        api.post("/alunos/" + alunoId(a) + "/anonimizar", treinador, Map.of("nomeConfirmado", nome), 200);
        assertThat(banco.queryForObject("select count(*) from anamnese_pendencia where aluno_id = ?::uuid", Integer.class,
                alunoId(a))).isZero();
        assertThat(detalhe(a, treinador).path("alteracoes")).isEmpty();
    }
}
