package br.com.treinos.api.equipe;
import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.auditoria.AuditoriaGravacao;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import tools.jackson.databind.json.JsonMapper;
import java.util.Map;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;
@AutoConfigureMockMvc
class AuditoriaIntegrationTest extends AbstractIntegrationTest {
    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;
    @Autowired private AuditoriaGravacao gravacao;
    @Autowired private Auditoria auditoria;
    @Autowired private PlatformTransactionManager transacoes;
    @Test void acoesSaoRegistradasSemDadoSensivelENaoVazamEntreConsultorias() throws Exception {
        var api=new ApiDeTeste(mvc,json);var admin=api.novoTreinador();
        var aluno=api.post("/alunos",admin,Map.of("nome","Pessoa fictícia","observacoes","OBSERVACAO_PRIVADA_FICTICIA"),200);
        String aid=aluno.path("id").asString();
        api.post("/alunos/"+aid+"/convite",admin,null,200);
        api.post("/alunos/"+aid+"/pesos",admin,Map.of("data",java.time.LocalDate.now(br.com.treinos.api.web.Fuso.BRASILIA),"pesoKg",89.7,"observacao","PESO_PRIVADO_FICTICIO"),200);
        api.post("/alunos/"+aid+"/lesoes",admin,Map.of("regiao","Região fictícia","descricao","LESAO_PRIVADA_FICTICIA","situacao","ATIVA"),200);
        var lista=api.get("/auditoria",admin,200);
        assertThat(lista.path("total").asInt()).isGreaterThanOrEqualTo(4);
        assertThat(lista.toString()).contains("LOGIN_SUCESSO","ALUNO_CRIADO","ALUNO_CONVIDADO","PESO_REGISTRADO","LESAO_REGISTRADA")
                .doesNotContain("OBSERVACAO_PRIVADA_FICTICIA","89.7","PESO_PRIVADO_FICTICIO","LESAO_PRIVADA_FICTICIA","Região fictícia");
        var filtrada=api.get("/auditoria?acao=ALUNO_CRIADO",admin,200);
        assertThat(filtrada.path("itens")).hasSize(1);
        var outro=api.novoTreinador();
        assertThat(api.get("/auditoria",outro,200).toString()).doesNotContain(aid);
        api.get("/auditoria?usuarioId="+admin.path("usuario").path("id").asString(),outro,404);
        api.get("/auditoria?de=2026-10-10&ate=2026-10-09",admin,400);
    }
    @Test void mesmoRollbackDaAcaoApagaEventoEPaginacaoLimitaCinquenta() throws Exception {
        var api=new ApiDeTeste(mvc,json);var admin=api.novoTreinador();
        UUID uid=UUID.fromString(admin.path("usuario").path("id").asString());
        UUID cid=banco.queryForObject("select consultoria_id from usuario where id=?",UUID.class,uid);
        var tx=new TransactionTemplate(transacoes);
        tx.executeWithoutResult(status -> {gravacao.gravar(cid,uid,"TESTE_ROLLBACK","USUARIO",uid,"Ação fictícia.",null,null);status.setRollbackOnly();});
        assertThat(api.get("/auditoria?acao=TESTE_ROLLBACK",admin,200).path("total").asInt()).isZero();
        tx.executeWithoutResult(status -> {for(int i=0;i<51;i++) gravacao.gravar(cid,uid,"TESTE_PAGINA","USUARIO",uid,"Ação fictícia.",null,null);});
        var primeira=api.get("/auditoria?acao=TESTE_PAGINA",admin,200);
        var segunda=api.get("/auditoria?acao=TESTE_PAGINA&pagina=1",admin,200);
        assertThat(primeira.path("itens")).hasSize(50);assertThat(segunda.path("itens")).hasSize(1);
        assertThat(primeira.path("total").asInt()).isEqualTo(51);
        banco.update("update auditoria set criado_em=now()-interval '2 years' where consultoria_id=? and acao='TESTE_PAGINA'",cid);
        auditoria.limparAntigos();
        assertThat(api.get("/auditoria?acao=TESTE_PAGINA",admin,200).path("total").asInt()).isZero();
        assertThat(api.get("/auditoria?acao=LOGIN_SUCESSO",admin,200).path("total").asInt()).isPositive();
    }
}
