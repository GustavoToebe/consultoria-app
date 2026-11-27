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
    @Test void objetoNomeEOrigemResolvidosPorTenantSemDadoSensivel() throws Exception {
        var api=new ApiDeTeste(mvc,json);var admin=api.novoTreinador();
        UUID uid=UUID.fromString(admin.path("usuario").path("id").asString());
        UUID cid=banco.queryForObject("select consultoria_id from usuario where id=?",UUID.class,uid);
        String nomeAluno="Aluno Objeto "+UUID.randomUUID().toString().substring(0,8);
        String cpf=br.com.treinos.api.Documentos.cpf();String email=ApiDeTeste.emailUnico("objeto");
        var aluno=api.post("/alunos",admin,Map.of("nome",nomeAluno,"email",email,"cpf",cpf,"telefone","11999990000","objetivo","OBJETIVO_PRIVADO_FICTICIO"),200);
        UUID aid=UUID.fromString(aluno.path("id").asString());
        String nomeQuestionario="Questionário "+UUID.randomUUID().toString().substring(0,8);
        UUID qid=UUID.fromString(api.post("/questionarios",admin,Map.of("nome",nomeQuestionario,"origem","FABRICA"),200).path("id").asString());
        String nomePerfil="Perfil "+UUID.randomUUID().toString().substring(0,8);
        api.post("/perfis",admin,Map.of("nome",nomePerfil,"permissoes",java.util.Set.of("ALUNO_LER")),200);
        api.post("/alunos/"+aid+"/pastas",admin,Map.of("titulo","Pasta do objeto"),200);
        api.publicarTreino(admin,aid,ApiDeTeste.treino().conteudo());
        // Mensalidade (tem competência) pela contratação; avulsa (sem competência) direto no banco, com descrição "privada".
        var plano=api.post("/financeiro/planos",admin,Map.of("nome","Mensal "+UUID.randomUUID(),"valorCentavos",99700,"periodicidade","MENSAL"),200);
        var hoje=java.time.LocalDate.now(br.com.treinos.api.web.Fuso.BRASILIA);
        api.post("/alunos/"+aid+"/contratacoes",admin,Map.of("planoComercialId",plano.path("id").asString(),"inicio",hoje.toString(),"diaVencimento",hoje.getDayOfMonth()),200);
        UUID comCompetencia=UUID.fromString(api.get("/alunos/"+aid+"/cobrancas",admin,200).get(0).path("id").asString());
        String competencia=banco.queryForObject("select to_char(competencia,'MM/YYYY') from cobranca_aluno where id=?",String.class,comCompetencia);
        UUID semCompetencia=UUID.randomUUID();
        banco.update("insert into cobranca_aluno(id,consultoria_id,aluno_id,valor_centavos,vencimento,situacao,tipo,descricao) values (?,?,?,123456,'2026-07-15','ABERTA','AVULSA','DESCRICAO_PRIVADA_FICTICIA')",semCompetencia,cid,aid);
        UUID apagado=UUID.randomUUID();
        var tx=new TransactionTemplate(transacoes);
        tx.executeWithoutResult(status -> {
            gravacao.gravar(cid,uid,"TESTE_OBJ_COBRANCA","COBRANCA",comCompetencia,"Ação fictícia.","127.0.0.1","Mozilla/5.0 (X11; Linux x86_64) Chrome/126");
            gravacao.gravar(cid,uid,"TESTE_OBJ_COBRANCA","COBRANCA",semCompetencia,"Ação fictícia.","127.0.0.1","okhttp/4.12.0");
            gravacao.gravar(cid,uid,"TESTE_OBJ_QUESTIONARIO","QUESTIONARIO",qid,"Ação fictícia.",null,"Treinos/12 CFNetwork/1494.0.7 Darwin/23.4.0");
            gravacao.gravar(cid,uid,"TESTE_OBJ_APAGADO","COBRANCA",apagado,"Ação fictícia.",null,null);
            gravacao.gravar(cid,uid,"TESTE_OBJ_APAGADO","ALUNO",apagado,"Ação fictícia.",null,"curl/8.0");
            gravacao.gravar(cid,uid,"TESTE_OBJ_DESCONHECIDO","VITRINE_PAGINA",null,"Ação fictícia.",null,null);
        });
        var lista=api.get("/auditoria",admin,200);
        assertThat(nome(lista,"ALUNO_CRIADO")).isEqualTo(nomeAluno);
        assertThat(nome(lista,"PERFIL_CRIADO")).isEqualTo(nomePerfil);
        assertThat(nome(lista,"PASTA_CRIADA")).isEqualTo("Pasta do objeto");
        assertThat(nome(lista,"TREINO_PUBLICADO")).isEqualTo("Plano de teste");
        assertThat(nome(lista,"TESTE_OBJ_QUESTIONARIO")).isEqualTo(nomeQuestionario);
        var cobrancas=lista.path("itens").valueStream().filter(e -> e.path("acao").asString().equals("TESTE_OBJ_COBRANCA")).toList();
        assertThat(cobrancas.stream().map(e -> e.path("objetoNome").asString())).containsExactlyInAnyOrder(competencia+" de R$ 997,00","venc. 15/07/2026 de R$ 1.234,56");
        // Objeto apagado, tipo não resolvido, sem id e o login do próprio autor: sem nome.
        assertThat(lista.path("itens").valueStream().filter(e -> e.path("acao").asString().equals("TESTE_OBJ_APAGADO")).map(e -> e.path("objetoNome").isNull()).toList()).containsExactly(true,true);
        assertThat(nome(lista,"TESTE_OBJ_DESCONHECIDO")).isNull();
        assertThat(nome(lista,"LOGIN_SUCESSO")).isNull();
        // Origem pelo user agent; sem user agent, nula; nunca o texto cru nem o IP.
        assertThat(origem(lista,"TESTE_OBJ_QUESTIONARIO")).isEqualTo("App iOS");
        assertThat(lista.path("itens").valueStream().filter(e -> e.path("acao").asString().equals("TESTE_OBJ_COBRANCA")).map(e -> e.path("origem").asString()))
                .containsExactlyInAnyOrder("Web","App Android");
        assertThat(origem(lista,"TESTE_OBJ_APAGADO")).isNull();
        assertThat(lista.toString()).doesNotContain(cpf,email,"11999990000","OBJETIVO_PRIVADO_FICTICIO","DESCRICAO_PRIVADA_FICTICIA","Mozilla","okhttp","CFNetwork","127.0.0.1");
        // Outra consultoria não vê o nome nem o evento.
        var outro=api.novoTreinador();
        assertThat(api.get("/auditoria",outro,200).toString()).doesNotContain(nomeAluno,nomePerfil,nomeQuestionario,"Pasta do objeto");
        UUID cidOutro=banco.queryForObject("select consultoria_id from usuario where id=?",UUID.class,UUID.fromString(outro.path("usuario").path("id").asString()));
        UUID uidOutro=UUID.fromString(outro.path("usuario").path("id").asString());
        // Evento da outra consultoria apontando para ids que são desta: o nome não resolve.
        tx.executeWithoutResult(status -> {
            gravacao.gravar(cidOutro,uidOutro,"TESTE_OBJ_CRUZADO","ALUNO",aid,"Ação fictícia.",null,null);
            gravacao.gravar(cidOutro,uidOutro,"TESTE_OBJ_CRUZADO","QUESTIONARIO",qid,"Ação fictícia.",null,null);
            gravacao.gravar(cidOutro,uidOutro,"TESTE_OBJ_CRUZADO","COBRANCA",comCompetencia,"Ação fictícia.",null,null);
            gravacao.gravar(cidOutro,uidOutro,"TESTE_OBJ_CRUZADO","USUARIO",uid,"Ação fictícia.",null,null);
        });
        var cruzados=api.get("/auditoria?acao=TESTE_OBJ_CRUZADO",outro,200);
        assertThat(cruzados.path("itens")).hasSize(4);
        cruzados.path("itens").forEach(e -> assertThat(e.path("objetoNome").isNull()).isTrue());
        assertThat(cruzados.toString()).doesNotContain(nomeAluno,nomeQuestionario,"997,00");
    }
    private static String nome(tools.jackson.databind.JsonNode lista,String acao) {
        var e=lista.path("itens").valueStream().filter(i -> i.path("acao").asString().equals(acao)).findFirst().orElseThrow();
        return e.path("objetoNome").isNull()?null:e.path("objetoNome").asString();
    }
    private static String origem(tools.jackson.databind.JsonNode lista,String acao) {
        var e=lista.path("itens").valueStream().filter(i -> i.path("acao").asString().equals(acao)).findFirst().orElseThrow();
        return e.path("origem").isNull()?null:e.path("origem").asString();
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
