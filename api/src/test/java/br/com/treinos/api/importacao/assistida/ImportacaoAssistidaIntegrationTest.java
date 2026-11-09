package br.com.treinos.api.importacao.assistida;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.LimiteDoTreinadorDeTeste;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Importação assistida de ponta a ponta (modo {@code regras}, sem provedor): isolamento por consultoria, permissões por
 * parte gravada (403 antes de qualquer efeito), aluno de outra consultoria, vários alunos numa sessão, erro isolado por
 * grupo, retenção e anonimização. Só dados fictícios; nomes únicos porque os testes dividem um Postgres.
 */
@AutoConfigureMockMvc
class ImportacaoAssistidaIntegrationTest extends AbstractIntegrationTest {

    private static final String BASE = "/importacoes/assistidas/sessoes";
    private static final String PLANO = "\nPeso: 82.5 kg\n\nTreino A - Peito e Tríceps\n1. Supino reto - 4x10 - 60s\n"
            + "2. Tríceps corda - 3x12 - 45s\n\nCafé da Manhã\n3 un Ovos inteiros\n50g Aveia em flocos\n";

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JsonMapper json;
    @Autowired
    private JdbcTemplate banco;
    @Autowired
    private ImportacaoAssistidaRetencao retencao;

    private ApiDeTeste api;
    private JsonNode admin;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
    }

    // ------------------------------------------------------------------------------------------------ ajudantes

    private static String nomeUnico() {
        StringBuilder b = new StringBuilder();
        for (char c : UUID.randomUUID().toString().replace("-", "").substring(0, 10).toCharArray()) {
            b.append(Character.isDigit(c) ? (char) ('k' + (c - '0')) : c);
        }
        return "Fulano " + Character.toUpperCase(b.charAt(0)) + b.substring(1);
    }

    private String novaSessao(JsonNode login) throws Exception {
        return api.post(BASE, login, Map.of("objetivo", "CADASTROS_E_PLANOS_ATUAIS"), 200).path("id").asString();
    }

    /** Sessão processada pelo modo {@code regras}, um arquivo de texto por conteúdo (um grupo por arquivo). */
    private String sessaoProcessada(JsonNode login, String... textos) throws Exception {
        String id = novaSessao(login);
        int n = 0;
        for (String texto : textos) {
            n++;
            api.post(BASE + "/" + id + "/textos", login, Map.of("titulo", "Texto " + n, "conteudo", texto), 200);
        }
        api.post(BASE + "/" + id + "/processar", login, null, 200);
        return id;
    }

    private JsonNode detalhe(JsonNode login, String sessaoId) throws Exception {
        return api.get(BASE + "/" + sessaoId, login, 200);
    }

    private JsonNode confirmar(JsonNode login, String sessaoId, int esperado) throws Exception {
        int revisao = detalhe(admin, sessaoId).path("revisao").asInt();
        return api.post(BASE + "/" + sessaoId + "/confirmar", login,
                Map.of("gruposIds", List.of(), "revisaoEsperada", revisao), esperado);
    }

    private long alunosComNome(String nome) {
        return banco.queryForObject("select count(*) from aluno where lower(nome) = lower(?)", Long.class, nome);
    }

    private UUID aluno(JsonNode login, String nome, String email) throws Exception {
        Map<String, Object> corpo = email == null ? Map.of("nome", nome) : Map.of("nome", nome, "email", email);
        return UUID.fromString(api.post("/alunos", login, corpo, 200).path("id").asString());
    }

    private void inativar(UUID aluno) throws Exception {
        api.patch("/alunos/" + aluno + "/situacao", admin, Map.of("ativo", false), 200);
    }

    // ------------------------------------------------------------------------------------------------ isolamento

    @Test
    void sessaoDeOutraConsultoriaDa404EmTodasAsRotas() throws Exception {
        String sessao = sessaoProcessada(admin, "Aluno: " + nomeUnico() + "\n");
        JsonNode grupo = detalhe(admin, sessao).path("grupos").get(0);
        JsonNode outra = api.novoTreinador();

        api.get(BASE + "/" + sessao, outra, 404);
        api.post(BASE + "/" + sessao + "/textos", outra, Map.of("titulo", "x", "conteudo", "y"), 404);
        api.post(BASE + "/" + sessao + "/processar", outra, null, 404);
        api.put(BASE + "/" + sessao + "/grupos/" + grupo.path("id").asString(), outra, Map.of("destino", "IGNORAR"), 404);
        api.post(BASE + "/" + sessao + "/confirmar", outra, Map.of("gruposIds", List.of(), "revisaoEsperada", 1), 404);
        // O dono segue vendo a sua.
        assertThat(detalhe(admin, sessao).path("estado").asString()).isEqualTo("REVISANDO");
    }

    @Test
    void alunoDeOutraConsultoriaInativoOuAnonimizadoNaoVincula() throws Exception {
        String nomeGrupo = nomeUnico();
        String sessao = sessaoProcessada(admin, "Aluno: " + nomeGrupo + "\n");
        String grupo = detalhe(admin, sessao).path("grupos").get(0).path("id").asString();
        String rota = BASE + "/" + sessao + "/grupos/" + grupo;

        // Aluno de outra consultoria: 404, nunca vaza que existe.
        JsonNode outra = api.novoTreinador();
        UUID alheio = aluno(outra, nomeUnico(), null);
        api.put(rota, admin, Map.of("destino", "VINCULAR_EXISTENTE", "alunoExistenteId", alheio), 404);

        // Inativo: 409.
        UUID inativo = aluno(admin, nomeUnico(), null);
        inativar(inativo);
        JsonNode recusa = api.put(rota, admin, Map.of("destino", "VINCULAR_EXISTENTE", "alunoExistenteId", inativo), 409);
        assertThat(recusa.path("codigo").asString()).isEqualTo("ALUNO_INATIVO");

        // Anonimizado: 409 (e a ficha dele deixa de ser candidata).
        String nomeAnonimizado = nomeUnico();
        UUID anonimizado = aluno(admin, nomeAnonimizado, null);
        inativar(anonimizado);
        api.post("/alunos/" + anonimizado + "/anonimizar", admin, Map.of("nomeConfirmado", nomeAnonimizado), 200);
        recusa = api.put(rota, admin, Map.of("destino", "VINCULAR_EXISTENTE", "alunoExistenteId", anonimizado), 409);
        assertThat(recusa.path("codigo").asString()).isEqualTo("ALUNO_ANONIMIZADO");

        // Nada foi vinculado.
        assertThat(detalhe(admin, sessao).path("grupos").get(0).path("alunoExistenteId").isNull()
                || detalhe(admin, sessao).path("grupos").get(0).path("alunoExistenteId").isMissingNode()).isTrue();
    }

    // ------------------------------------------------------------------------------------------------ permissões

    @Test
    void membroSemAsPermissoesDoPlanoLevaDa403AntesDeQualquerEfeito() throws Exception {
        String nome = nomeUnico();
        String sessao = sessaoProcessada(admin, "Aluno: " + nome + PLANO);
        String nomeDetectado = detalhe(admin, sessao).path("grupos").get(0).path("nomeDetectado").asString();
        LimiteDoTreinadorDeTeste.Membro membro = new LimiteDoTreinadorDeTeste(api, admin, banco).membro();

        // ALUNO_LER + ALUNO_ALTERAR deixam ver e revisar, mas o grupo tem peso, treino e dieta: 403, nada gravado.
        confirmar(membro.login(), sessao, 403);
        assertThat(alunosComNome(nomeDetectado)).isZero();
        assertThat(detalhe(admin, sessao).path("estado").asString()).isEqualTo("REVISANDO");

        // O administrador confirma: o peso sem data é ignorado (a data nunca é inventada).
        JsonNode r = confirmar(admin, sessao, 200);
        assertThat(r.path("situacao").asString()).isEqualTo("CONCLUIDA");
        assertThat(r.path("alunosCriados").asInt()).isEqualTo(1);
        assertThat(r.path("treinosCriados").asInt()).isEqualTo(1);
        assertThat(r.path("dietasCriadas").asInt()).isEqualTo(1);
        assertThat(r.path("pesosGravados").asInt()).isZero();
        assertThat(r.path("pesosIgnorados").asInt()).isEqualTo(1);
        assertThat(alunosComNome(nomeDetectado)).isEqualTo(1);
    }

    @Test
    void soComPesoOMembroSemSensivelLevaDa403ENaoVeOPesoNoGet() throws Exception {
        String sessao = sessaoProcessada(admin, "Aluno: " + nomeUnico() + "\nPeso: 80 kg em 12/03/2026\n");
        LimiteDoTreinadorDeTeste.Membro membro = new LimiteDoTreinadorDeTeste(api, admin, banco).membro();

        JsonNode doAdmin = detalhe(admin, sessao).path("grupos").get(0);
        assertThat(doAdmin.path("pesos")).hasSize(1);
        JsonNode doMembro = detalhe(membro.login(), sessao).path("grupos").get(0);
        assertThat(doMembro.path("pesos")).isEmpty();

        confirmar(membro.login(), sessao, 403);
        assertThat(detalhe(admin, sessao).path("estado").asString()).isEqualTo("REVISANDO");
    }

    // ------------------------------------------------------------------------------------------------ gravação

    @Test
    void variosAlunosNumaSessaoSaemEsqueletoDepoisDeGravados() throws Exception {
        String sessao = sessaoProcessada(admin,
                "Aluno: " + nomeUnico() + "\nPeso: 80 kg em 12/03/2026\n",
                "Aluno: " + nomeUnico() + "\nPeso: 70 kg em 13/03/2026\n");
        JsonNode antes = detalhe(admin, sessao);
        assertThat(antes.path("grupos")).hasSize(2);
        String n1 = antes.path("grupos").get(0).path("nomeDetectado").asString();
        String n2 = antes.path("grupos").get(1).path("nomeDetectado").asString();
        // Bytes do arquivo não ficam depois de processar.
        assertThat(banco.queryForObject("select count(*) from importacao_arquivo where sessao_id = ?::uuid "
                + "and conteudo_bytes is not null", Long.class, sessao)).isZero();

        JsonNode r = confirmar(admin, sessao, 200);

        assertThat(r.path("situacao").asString()).isEqualTo("CONCLUIDA");
        assertThat(r.path("gruposImportados").asInt()).isEqualTo(2);
        assertThat(r.path("alunosCriados").asInt()).isEqualTo(2);
        assertThat(r.path("pesosGravados").asInt()).isEqualTo(2);
        assertThat(alunosComNome(n1)).isEqualTo(1);
        assertThat(alunosComNome(n2)).isEqualTo(1);
        JsonNode depois = detalhe(admin, sessao);
        assertThat(depois.path("estado").asString()).isEqualTo("CONCLUIDA");
        for (JsonNode g : depois.path("grupos")) {
            assertThat(g.path("estado").asString()).isEqualTo("IMPORTADO");
            assertThat(g.path("nomeDetectado").asString()).doesNotContain("Fulano");
            assertThat(g.path("pesos")).isEmpty();
            assertThat(g.path("cadastro").isNull()).isTrue();
        }
        // Reenviar depois de concluída: 409, sem gravar de novo.
        api.post(BASE + "/" + sessao + "/confirmar", admin, Map.of("gruposIds", List.of(), "revisaoEsperada", 1), 409);
        assertThat(alunosComNome(n1)).isEqualTo(1);
        // Auditoria com resumo fixo (nunca nome, peso nem código do aluno).
        assertThat(banco.queryForObject("select count(*) from auditoria where acao = 'IMPORTACAO_ASSISTIDA_CONCLUIDA'",
                Long.class)).isGreaterThanOrEqualTo(1);
        assertThat(banco.queryForObject("select count(*) from auditoria where acao = 'IMPORTACAO_ASSISTIDA_CONCLUIDA' "
                + "and resumo <> 'Importou dados pela importação assistida.'", Long.class)).isZero();
    }

    @Test
    void erroDeUmGrupoNaoDerrubaOsOutrosNemVazaMensagem() throws Exception {
        String email = ApiDeTeste.emailUnico("ja-existe");
        UUID existente = aluno(admin, nomeUnico(), email);
        String bom = nomeUnico();
        String sessao = sessaoProcessada(admin,
                "Aluno: " + nomeUnico() + "\nE-mail: " + email + "\n",
                "Aluno: " + bom + "\n");
        JsonNode grupos = detalhe(admin, sessao).path("grupos");
        JsonNode comEmail = grupos.get(0);
        // Um único aluno ativo tem o e-mail: o servidor vincula sozinho (nunca por nome).
        assertThat(comEmail.path("destino").asString()).isEqualTo("VINCULAR_EXISTENTE");
        assertThat(comEmail.path("alunoExistenteId").asString()).isEqualTo(existente.toString());
        // O treinador força "criar": o e-mail repetido é 409 ALUNO_JA_EXISTE só nesse grupo.
        api.put(BASE + "/" + sessao + "/grupos/" + comEmail.path("id").asString(), admin,
                Map.of("destino", "CRIAR_ALUNO"), 200);

        JsonNode r = confirmar(admin, sessao, 200);

        assertThat(r.path("situacao").asString()).isEqualTo("CONCLUIDA_COM_ERROS");
        assertThat(r.path("gruposImportados").asInt()).isEqualTo(1);
        assertThat(r.path("gruposComErro").asInt()).isEqualTo(1);
        JsonNode depois = detalhe(admin, sessao);
        assertThat(depois.path("estado").asString()).isEqualTo("REVISANDO");
        assertThat(depois.path("grupos").get(0).path("estado").asString()).isEqualTo("ERRO");
        assertThat(depois.path("grupos").get(0).path("erroCodigo").asString()).isEqualTo("ALUNO_JA_EXISTE");
        assertThat(depois.path("grupos").get(1).path("estado").asString()).isEqualTo("IMPORTADO");
        assertThat(depois.toString()).doesNotContain("Já existe um aluno");
    }

    // ------------------------------------------------------------------------------------------------ retenção e anonimização

    @Test
    void retencaoApagaSessaoVencidaEMantemAsDemais() throws Exception {
        String vencida = sessaoProcessada(admin, "Aluno: " + nomeUnico() + "\n");
        String valida = sessaoProcessada(admin, "Aluno: " + nomeUnico() + "\n");
        banco.update("update importacao_sessao set expira_em = ? where id = ?::uuid",
                java.sql.Timestamp.from(Instant.now().minusSeconds(86_400)), vencida);

        assertThat(retencao.limpar(Instant.now())).isGreaterThanOrEqualTo(1);

        api.get(BASE + "/" + vencida, admin, 404);
        assertThat(banco.queryForObject("select count(*) from importacao_arquivo where sessao_id = ?::uuid", Long.class,
                vencida)).isZero();
        assertThat(detalhe(admin, valida).path("estado").asString()).isEqualTo("REVISANDO");
    }

    @Test
    void anonimizarOAlunoLimpaOGrupoLigadoAEleENaoOMantemComoCandidato() throws Exception {
        String nome = nomeUnico();
        UUID alvo = aluno(admin, nome, null);
        String sessao = sessaoProcessada(admin, "Aluno: " + nome + "\nPeso: 80 kg em 12/03/2026\n",
                "Aluno: " + nome + "\n");
        JsonNode grupos = detalhe(admin, sessao).path("grupos");
        // Mesmo nome só gera candidato: o treinador escolhe, o servidor não vincula sozinho.
        assertThat(grupos.get(0).path("destino").asString()).isEqualTo("CRIAR_ALUNO");
        assertThat(grupos.get(0).path("candidatos")).hasSize(1);
        assertThat(grupos.get(0).path("candidatos").get(0).path("motivo").asString()).isEqualTo("NOME");
        api.put(BASE + "/" + sessao + "/grupos/" + grupos.get(0).path("id").asString(), admin,
                Map.of("destino", "VINCULAR_EXISTENTE", "alunoExistenteId", alvo), 200);

        inativar(alvo);
        api.post("/alunos/" + alvo + "/anonimizar", admin, Map.of("nomeConfirmado", nome), 200);

        JsonNode depois = detalhe(admin, sessao).path("grupos");
        assertThat(depois.get(0).path("estado").asString()).isEqualTo("IGNORADO");
        assertThat(depois.get(0).path("nomeDetectado").asString()).doesNotContain("Fulano");
        assertThat(depois.get(0).path("pesos")).isEmpty();
        assertThat(depois.get(1).path("candidatos")).isEmpty();
        assertThat(depois.toString()).doesNotContain(alvo.toString());
    }
}
