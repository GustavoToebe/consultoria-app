package br.com.treinos.api.auditoria;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * {@code objetoNome} de cada tipo só com a permissão de leitura dele: quem só tem {@code AUDITORIA_LER} vê o evento sem o nome
 * (fora o membro da equipe, que {@code /auditoria/pessoas} já mostra). Também roda de verdade cada consulta JPQL do
 * {@link ObjetoDaAuditoria} (aluno, pasta, os três planos, cobrança, questionário, perfil e usuário). Dados fictícios.
 */
@AutoConfigureMockMvc
class ObjetoDaAuditoriaPermissoesIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;
    @Autowired private AuditoriaGravacao gravacao;
    @Autowired private PlatformTransactionManager transacoes;

    private ApiDeTeste api;
    private JsonNode admin;

    private JsonNode membro(String nome, Set<String> permissoes) throws Exception {
        String perfil = api.post("/perfis", admin, Map.of("nome", nome + " " + UUID.randomUUID(), "permissoes", permissoes), 200)
                .path("id").asString();
        JsonNode convite = api.post("/usuarios/convites", admin, Map.of("nome", nome,
                "email", ApiDeTeste.emailUnico("objeto"), "perfilId", perfil), 200);
        return api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.path("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
    }

    private static UUID id(JsonNode no) {
        return UUID.fromString(no.path("id").asString());
    }

    /** Ação do evento → objetoNome (nulo como {@code null}). */
    private Map<String, String> nomes(JsonNode login, String acoes) throws Exception {
        Map<String, String> nomes = new HashMap<>();
        api.get("/auditoria?acao=" + acoes, login, 200).path("itens").forEach(e ->
                nomes.put(e.path("acao").asString(), e.path("objetoNome").isNull() ? null : e.path("objetoNome").asString()));
        return nomes;
    }

    @Test
    void nomeDoObjetoSoComAPermissaoDeLeituraDoTipo() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        UUID uid = UUID.fromString(admin.path("usuario").path("id").asString());
        UUID cid = banco.queryForObject("select consultoria_id from usuario where id=?", UUID.class, uid);
        String sufixo = UUID.randomUUID().toString().substring(0, 8);

        UUID aluno = id(api.post("/alunos", admin, Map.of("nome", "Aluno Objeto " + sufixo), 200));
        JsonNode pasta = api.post("/alunos/" + aluno + "/pastas", admin, Map.of("titulo", "Pasta " + sufixo), 200);
        JsonNode treino = api.post("/alunos/" + aluno + "/planos-treino", admin, Map.of("titulo", "Treino " + sufixo), 200).path("plano");
        JsonNode dieta = api.post("/alunos/" + aluno + "/planos-dieta", admin, Map.of("titulo", "Dieta " + sufixo), 200).path("plano");
        JsonNode mobilidade = api.post("/alunos/" + aluno + "/planos-mobilidade", admin, Map.of("titulo", "Mobilidade " + sufixo), 200).path("plano");
        UUID questionario = id(api.post("/questionarios", admin, Map.of("nome", "Questionário " + sufixo, "origem", "FABRICA"), 200));
        UUID perfil = id(api.post("/perfis", admin, Map.of("nome", "Perfil " + sufixo, "permissoes", Set.of("ALUNO_LER")), 200));
        UUID cobranca = UUID.randomUUID();
        banco.update("insert into cobranca_aluno(id,consultoria_id,aluno_id,valor_centavos,vencimento,situacao,tipo,descricao) "
                + "values (?,?,?,123456,'2026-07-15','ABERTA','AVULSA','Descrição fictícia')", cobranca, cid, aluno);

        JsonNode auditor = membro("Auditor Objeto", Set.of("AUDITORIA_LER"));
        JsonNode soAlunos = membro("Auditor de alunos", Set.of("AUDITORIA_LER", "ALUNO_LER"));
        JsonNode completo = membro("Auditor completo", Set.of("AUDITORIA_LER", "ALUNO_LER", "TREINO_LER", "DIETA_LER",
                "FINANCEIRO_LER", "QUESTIONARIO_LER", "EQUIPE_LER"));
        UUID membro = UUID.fromString(auditor.path("usuario").path("id").asString());

        Map<String, Object[]> eventos = new LinkedHashMap<>();
        eventos.put("TESTE_NOME_ALUNO", new Object[] {"ALUNO", aluno});
        eventos.put("TESTE_NOME_PASTA", new Object[] {"PASTA", id(pasta)});
        eventos.put("TESTE_NOME_TREINO", new Object[] {"TREINO", id(treino)});
        eventos.put("TESTE_NOME_DIETA", new Object[] {"DIETA", id(dieta)});
        eventos.put("TESTE_NOME_MOBILIDADE", new Object[] {"PLANO", id(mobilidade)});
        eventos.put("TESTE_NOME_COBRANCA", new Object[] {"COBRANCA", cobranca});
        eventos.put("TESTE_NOME_QUESTIONARIO", new Object[] {"QUESTIONARIO", questionario});
        eventos.put("TESTE_NOME_PERFIL", new Object[] {"PERFIL", perfil});
        eventos.put("TESTE_NOME_USUARIO", new Object[] {"USUARIO", membro});
        new TransactionTemplate(transacoes).executeWithoutResult(s -> eventos.forEach((acao, alvo) ->
                gravacao.gravar(cid, uid, acao, (String) alvo[0], (UUID) alvo[1], "Ação fictícia.", null, null)));
        String acoes = String.join(",", eventos.keySet());

        Map<String, String> esperado = new HashMap<>();
        esperado.put("TESTE_NOME_ALUNO", "Aluno Objeto " + sufixo);
        esperado.put("TESTE_NOME_PASTA", pasta.path("titulo").asString());
        esperado.put("TESTE_NOME_TREINO", treino.path("titulo").asString());
        esperado.put("TESTE_NOME_DIETA", dieta.path("titulo").asString());
        esperado.put("TESTE_NOME_MOBILIDADE", mobilidade.path("titulo").asString());
        esperado.put("TESTE_NOME_COBRANCA", "venc. 15/07/2026 de R$ 1.234,56");
        esperado.put("TESTE_NOME_QUESTIONARIO", "Questionário " + sufixo);
        esperado.put("TESTE_NOME_PERFIL", "Perfil " + sufixo);
        esperado.put("TESTE_NOME_USUARIO", "Auditor Objeto");
        assertThat(esperado.values()).doesNotContainNull().doesNotContain("");

        // Com as permissões de leitura de cada tipo (e o administrador), todos os nomes; as consultas JPQL rodam de verdade.
        assertThat(nomes(completo, acoes)).isEqualTo(esperado);
        assertThat(nomes(admin, acoes)).isEqualTo(esperado);

        // Só AUDITORIA_LER: os nove eventos aparecem, só o membro da equipe tem nome.
        Map<String, String> semPermissao = new HashMap<>();
        eventos.keySet().forEach(acao -> semPermissao.put(acao, null));
        semPermissao.put("TESTE_NOME_USUARIO", "Auditor Objeto");
        assertThat(nomes(auditor, acoes)).isEqualTo(semPermissao);
        assertThat(api.get("/auditoria?acao=" + acoes, auditor, 200).toString())
                .doesNotContain("Aluno Objeto", "1.234,56", "Pasta " + sufixo, "Treino " + sufixo, "Questionário " + sufixo, "Perfil " + sufixo);

        // ALUNO_LER sem TREINO_LER/DIETA_LER: aluno e pasta sim, os planos não.
        Map<String, String> deAlunos = new HashMap<>(semPermissao);
        deAlunos.put("TESTE_NOME_ALUNO", esperado.get("TESTE_NOME_ALUNO"));
        deAlunos.put("TESTE_NOME_PASTA", esperado.get("TESTE_NOME_PASTA"));
        assertThat(nomes(soAlunos, acoes)).isEqualTo(deAlunos);

        // Evento de outra consultoria apontando para os ids desta: sem nome, mesmo com todas as permissões.
        JsonNode outro = api.novoTreinador();
        UUID uidOutro = UUID.fromString(outro.path("usuario").path("id").asString());
        UUID cidOutro = banco.queryForObject("select consultoria_id from usuario where id=?", UUID.class, uidOutro);
        new TransactionTemplate(transacoes).executeWithoutResult(s -> eventos.forEach((acao, alvo) ->
                gravacao.gravar(cidOutro, uidOutro, acao, (String) alvo[0], (UUID) alvo[1], "Ação fictícia.", null, null)));
        assertThat(nomes(outro, acoes)).hasSize(eventos.size()).allSatisfy((acao, nome) -> assertThat(nome).isNull());
    }
}
