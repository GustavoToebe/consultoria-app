package br.com.treinos.api.equipe;
import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.json.JsonMapper;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
@AutoConfigureMockMvc
class MatrizPerfisIntegrationTest extends AbstractIntegrationTest {
    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;
    @ParameterizedTest
    @CsvSource({"Administrador,200,200,200,200,200,200", "Treinador,200,200,200,200,403,200", "Nutricionista,403,200,403,200,403,200", "Assistente,403,403,200,403,403,403"})
    void permissaoDaAcaoValeParaRascunhoPublicacaoCadastroConteudoEEquipe(String perfil,int treino,int dieta,int cadastro,int conteudo,int equipe,int questionario) throws Exception {
        var api=new ApiDeTeste(mvc,json);var login=api.novoTreinador();UUID aluno=api.criarAluno(login,"Aluno da matriz fictícia");
        var t=api.post("/alunos/"+aluno+"/planos-treino",login,Map.of("titulo","Treino da matriz"),200);
        String tid=t.path("plano").path("id").asString();
        var conteudoTreino=ApiDeTeste.treino().conteudo();
        var salvo=api.put("/planos-treino/"+tid+"/rascunho",login,ApiDeTeste.rascunho("Treino da matriz",conteudoTreino,t.path("plano").path("versao").asLong()),200);
        var d=api.post("/alunos/"+aluno+"/planos-dieta",login,Map.of("titulo","Dieta da matriz"),200);
        String did=d.path("plano").path("id").asString();
        var item=new br.com.treinos.api.dieta.ConteudoDieta.Item(UUID.randomUUID(),null,"Item manual fictício",java.math.BigDecimal.ONE,"un",java.math.BigDecimal.ONE,java.math.BigDecimal.ZERO,java.math.BigDecimal.ZERO,java.math.BigDecimal.ZERO,true);
        var opcao=new br.com.treinos.api.dieta.ConteudoDieta.Opcao(UUID.randomUUID(),"A",java.util.List.of(item));
        var refeicao=new br.com.treinos.api.dieta.ConteudoDieta.Refeicao(UUID.randomUUID(),"Refeição fictícia",null,null,java.util.List.of(opcao));
        var conteudoDieta=new br.com.treinos.api.dieta.ConteudoDieta(null,null,null,java.util.List.of(refeicao),java.util.List.of(),null,java.util.List.of());
        d=api.put("/planos-dieta/"+did+"/rascunho",login,ApiDeTeste.rascunho("Dieta da matriz",conteudoDieta,d.path("plano").path("versao").asLong()),200);
        UUID uid=UUID.fromString(login.path("usuario").path("id").asString());
        // Configuração do caso, não é uma rota: mantém o JWT para testar cada autoridade lida do banco.
        banco.update("update usuario u set perfil_id=p.id from perfil p where u.id=? and p.consultoria_id=u.consultoria_id and p.nome=?",uid,perfil);
        api.get("/planos-treino/"+tid,login,200);api.get("/planos-dieta/"+did,login,200);
        api.post("/planos-treino/"+tid+"/publicar",login,Map.of("versao",salvo.path("plano").path("versao").asLong(),"confirmarAvisos",true),treino);
        api.post("/planos-dieta/"+did+"/publicar",login,Map.of("versao",d.path("plano").path("versao").asLong(),"confirmarAvisos",true),dieta);
        UUID cid=banco.queryForObject("select consultoria_id from usuario where id=?",UUID.class,uid);
        org.assertj.core.api.Assertions.assertThat(banco.queryForObject("select count(*) from auditoria where consultoria_id=? and acao='TREINO_PUBLICADO'",Integer.class,cid)).isEqualTo(treino==200?1:0);
        org.assertj.core.api.Assertions.assertThat(banco.queryForObject("select count(*) from auditoria where consultoria_id=? and acao='DIETA_PUBLICADA'",Integer.class,cid)).isEqualTo(dieta==200?1:0);
        api.post("/alunos",login,Map.of("nome","Cadastro da matriz fictícia"),cadastro);
        api.post("/perfis",login,Map.of("nome","Perfil da matriz","permissoes",Set.of()),equipe);
        api.get("/usuarios",login,equipe);api.get("/auditoria",login,equipe);
        api.get("/questionarios",login,200);
        api.post("/questionarios",login,Map.of("nome","Questionário da matriz","origem","VAZIO"),questionario);
        api.post("/exercicios",login,Map.of("nome","Exercício da matriz","modalidade","PESO_CORPORAL","unidadeCarga","kg"),conteudo);
    }
}
