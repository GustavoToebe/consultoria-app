package br.com.treinos.api;

import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.JsonNode;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Atalhos dos testes do limite de alunos por treinador (supervisão da equipe, D2 a D16). O limite é gravado pela rota nova
 * {@code PUT /usuarios/{id}/limite-de-alunos}; o resto usa só rotas que já existem. Dados sempre fictícios, com nome único.
 */
public final class LimiteDoTreinadorDeTeste {

    public static final String CODIGO = "LIMITE_DO_TREINADOR";

    /** Membro da equipe que aceitou o convite: o login, o id, o nome e o e-mail fictícios. */
    public record Membro(JsonNode login, String id, String nome, String email) {
    }

    private final ApiDeTeste api;
    private final JsonNode admin;
    private final JdbcTemplate banco;

    public LimiteDoTreinadorDeTeste(ApiDeTeste api, JsonNode admin, JdbcTemplate banco) {
        this.api = api;
        this.admin = admin;
        this.banco = banco;
    }

    public String idDoAdmin() {
        return admin.path("usuario").path("id").asString();
    }

    /** Membro que pode ler e alterar alunos (o suficiente para criar, editar e importar). */
    public Membro membro() throws Exception {
        return membro(Set.of("ALUNO_LER", "ALUNO_ALTERAR"));
    }

    public Membro membro(Set<String> permissoes) throws Exception {
        String nome = "Membro Limite " + UUID.randomUUID();
        String email = ApiDeTeste.emailUnico("membro-limite");
        String perfil = api.post("/perfis", admin, Map.of("nome", "Perfil limite " + UUID.randomUUID(),
                "permissoes", permissoes), 200).path("id").asString();
        JsonNode convite = api.post("/usuarios/convites", admin, Map.of("nome", nome, "email", email, "perfilId", perfil), 200);
        JsonNode login = api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.path("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
        return new Membro(login, login.path("usuario").path("id").asString(), nome, email);
    }

    /** Grava (ou, com {@code null}, apaga) o limite do membro pela rota nova, como Administrador. */
    public void limite(Membro membro, Integer limite) throws Exception {
        Map<String, Object> corpo = new HashMap<>();
        corpo.put("limite", limite);
        api.put("/usuarios/" + membro.id() + "/limite-de-alunos", admin, corpo, 204);
    }

    /** Cria um aluno ativo (como Administrador) com o membro como responsável; sem membro, o responsável é o Administrador. */
    public UUID aluno(Membro membro) throws Exception {
        Map<String, Object> corpo = new HashMap<>();
        corpo.put("nome", "Aluno Fictício " + UUID.randomUUID());
        if (membro != null) {
            corpo.put("responsavelId", membro.id());
        }
        return UUID.fromString(api.post("/alunos", admin, corpo, 200).path("id").asString());
    }

    /** Cria {@code quantos} alunos ativos do membro. */
    public void alunos(Membro membro, int quantos) throws Exception {
        for (int i = 0; i < quantos; i++) {
            aluno(membro);
        }
    }

    public void inativar(UUID aluno) throws Exception {
        api.patch("/alunos/" + aluno + "/situacao", admin, Map.of("ativo", false), 200);
    }

    public String nomeDe(UUID aluno) {
        return banco.queryForObject("select nome from aluno where id = ?", String.class, aluno);
    }

    public String responsavelDe(UUID aluno) throws Exception {
        return api.get("/alunos/" + aluno, admin, 200).path("responsavelId").asString();
    }

    public boolean ativo(UUID aluno) throws Exception {
        return api.get("/alunos/" + aluno, admin, 200).path("ativo").asBoolean();
    }

    /** Alunos ativos e não anonimizados que têm o membro como responsável (D6): a contagem do limite. */
    public long ativosDe(Membro membro) {
        return banco.queryForObject("select count(*) from aluno where responsavel_id = ?::uuid and ativo = true "
                + "and anonimizado_em is null", Long.class, membro.id());
    }

    /** {@code PUT /alunos/{id}} como Administrador, mudando só o responsável (ou o repetindo). */
    public JsonNode editarResponsavel(UUID aluno, String responsavelId, int esperado) throws Exception {
        JsonNode atual = api.get("/alunos/" + aluno, admin, 200);
        Map<String, Object> corpo = new HashMap<>();
        corpo.put("nome", atual.path("nome").asString());
        corpo.put("versao", atual.path("versao").asLong());
        corpo.put("responsavelId", responsavelId);
        return api.put("/alunos/" + aluno, admin, corpo, esperado);
    }

    /**
     * A recusa do limite do treinador (D10): 409 com o código próprio (nunca {@code LIMITE_DO_PLANO}), mensagem e
     * {@code fieldErrors} sem nenhum dos textos proibidos (nome ou id do membro, nome ou id do aluno). O {@code path} do
     * erro leva o id da rota e por isso não entra na conferência.
     */
    public static void exigirRecusa(JsonNode erro, String... proibidos) {
        assertThat(erro.path("codigo").asString()).isEqualTo(CODIGO);
        assertThat(erro.path("message").asString()).isNotBlank();
        String texto = erro.path("message").asString() + " " + erro.path("fieldErrors").toString();
        for (String proibido : proibidos) {
            assertThat(texto).as("a recusa não pode repetir " + proibido.length() + " caracteres de dado de pessoa")
                    .doesNotContain(proibido);
        }
    }

    /**
     * Liga o link de inscrição com o membro como responsável padrão e recebe uma inscrição nova com o e-mail dado.
     * Devolve {id, versao}. A ordem do aceite pede a consultoria travada antes da inscrição (D9).
     */
    public String[] inscricaoNova(String email, Membro responsavel) throws Exception {
        JsonNode atual = api.get("/inscricoes/configuracao", admin, 200);
        Map<String, Object> config = new HashMap<>();
        config.put("aberta", true);
        config.put("responsavelId", responsavel == null ? null : responsavel.id());
        config.put("texto", null);
        config.put("versao", atual.path("versao").isNull() ? null : atual.path("versao").asLong());
        String codigo = api.put("/inscricoes/configuracao", admin, config, 200).path("codigo").asString();

        Map<String, Object> corpo = new HashMap<>();
        corpo.put("nome", "Pessoa Fictícia " + UUID.randomUUID());
        corpo.put("whatsapp", "11987654321");
        corpo.put("email", email);
        corpo.put("objetivo", "Objetivo fictício");
        api.post("/publico/inscricoes/" + codigo, null, corpo, 202);

        JsonNode lista = api.get("/inscricoes?busca=" + email, admin, 200);
        assertThat(lista.path("total").asLong()).isEqualTo(1);
        String id = lista.path("itens").get(0).path("id").asString();
        return new String[] {id, String.valueOf(api.get("/inscricoes/" + id, admin, 200).path("versao").asLong())};
    }
}
