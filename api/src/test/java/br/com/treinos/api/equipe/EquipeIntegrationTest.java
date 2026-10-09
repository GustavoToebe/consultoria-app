package br.com.treinos.api.equipe;
import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;
@AutoConfigureMockMvc
class EquipeIntegrationTest extends AbstractIntegrationTest {
    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;
    private ApiDeTeste api;
    private JsonNode admin;
    @BeforeEach void preparar() throws Exception { api=new ApiDeTeste(mvc,json);admin=api.novoTreinador(); }
    private JsonNode perfil(String nome) throws Exception {
        for(var p:api.get("/perfis",admin,200)) if(p.path("nome").asString().equals(nome)) return p;
        throw new AssertionError("Perfil pronto ausente");
    }
    private JsonNode convite(String nome,String email,String perfil) throws Exception {
        return api.post("/usuarios/convites",admin,Map.of("nome",nome,"email",email,"perfilId",perfil),200);
    }
    private JsonNode aceitar(JsonNode convite,int status) throws Exception {
        return api.post("/publico/convites-equipe/"+convite.path("codigo").asString(),null,Map.of("senha",ApiDeTeste.SENHA),status);
    }
    @Test void administradorESistemaNaoPodemSerRemovidos() throws Exception {
        var p=perfil("Administrador");String pid=p.path("id").asString();String uid=admin.path("usuario").path("id").asString();
        assertThat(p.path("acessoTotal").asBoolean()).isTrue();assertThat(p.path("usuarios").asInt()).isEqualTo(1);
        assertThat(api.delete("/perfis/"+pid,admin,409).path("codigo").asString()).isEqualTo("PERFIL_DE_SISTEMA");
        assertThat(api.put("/perfis/"+pid,admin,Map.of("nome","Outro","permissoes",Set.of(),"versao",p.path("versao").asLong()),409).path("codigo").asString()).isEqualTo("PERFIL_DE_SISTEMA");
        assertThat(api.put("/usuarios/"+uid,admin,Map.of("nome","Admin","perfilId",pid,"ativo",false),409).path("codigo").asString()).isEqualTo("ULTIMO_ADMINISTRADOR");
        assertThat(api.put("/usuarios/"+uid,admin,Map.of("nome","Admin","perfilId",perfil("Assistente").path("id").asString(),"ativo",true),409).path("codigo").asString()).isEqualTo("ULTIMO_ADMINISTRADOR");
        api.get("/permissoes/catalogo",admin,200);
    }
    @Test void criarEditarDuplicarEApagarPerfilComDependenciasELock() throws Exception {
        api.post("/perfis",admin,Map.of("nome","Inválido","permissoes",Set.of("TREINO_PUBLICAR")),400);
        var p=api.post("/perfis",admin,Map.of("nome","Somente leitura","descricao","Perfil fictício","permissoes",Set.of("ALUNO_LER")),200);
        String id=p.path("id").asString();
        api.post("/perfis",admin,Map.of("nome","somente LEITURA","permissoes",Set.of()),409);
        var copia=api.post("/perfis/"+id+"/duplicar",admin,null,200);
        assertThat(copia.path("nome").asString()).isEqualTo("Somente leitura (cópia)");
        var alterado=api.put("/perfis/"+id,admin,Map.of("nome","Leitura editada","descricao","Descrição fictícia","ativo",false,"permissoes",Set.of("ALUNO_LER","ALUNO_ALTERAR"),"versao",p.path("versao").asLong()),200);
        assertThat(alterado.path("ativo").asBoolean()).isFalse();
        api.put("/perfis/"+id,admin,Map.of("nome","Antigo","permissoes",Set.of(),"versao",p.path("versao").asLong()),409);
        api.delete("/perfis/"+id,admin,204);api.delete("/perfis/"+copia.path("id").asString(),admin,204);
    }
    @Test void conviteAceitoUmaVezTrocaDePerfilEDesativacaoEncerramSessoes() throws Exception {
        String assistente=perfil("Assistente").path("id").asString();String nutri=perfil("Nutricionista").path("id").asString();
        String email=ApiDeTeste.emailUnico("assistente");var c=convite("Assistente Teste",email,assistente);
        assertThat(api.get("/usuarios",admin,200)).hasSize(2);
        var membro=aceitar(c,200);aceitar(c,404);
        var eu=api.get("/eu",membro,200);
        assertThat(eu.path("perfil").path("nome").asString()).isEqualTo("Assistente");
        assertThat(eu.path("permissoes").toString()).doesNotContain("SENSIVEL","ATUALIZACAO");
        api.get("/perfis",membro,403);
        api.put("/usuarios/"+membro.path("usuario").path("id").asString(),admin,Map.of("nome","Nutricionista Teste","perfilId",nutri,"ativo",true),200);
        api.get("/eu",membro,401);
        api.post("/auth/refresh",null,Map.of("refreshToken",membro.path("refreshToken").asString()),401);
        var renovado=api.post("/auth/login",null,Map.of("email",email,"senha",ApiDeTeste.SENHA),200);
        assertThat(api.get("/eu",renovado,200).path("permissoes").toString()).contains("DIETA_PUBLICAR").doesNotContain("TREINO_PUBLICAR");
        api.delete("/perfis/"+nutri,admin,409);
        api.put("/usuarios/"+membro.path("usuario").path("id").asString(),admin,Map.of("nome","Nutricionista Teste","perfilId",nutri,"ativo",false),200);
        api.get("/eu",renovado,401);api.post("/auth/login",null,Map.of("email",email,"senha",ApiDeTeste.SENHA),401);
    }
    @Test void conviteNovoInvalidaAnteriorEExpiradoOuErradoRespondeGenerico() throws Exception {
        String pid=perfil("Assistente").path("id").asString();String email=ApiDeTeste.emailUnico("convite");
        var antigo=convite("Pessoa fictícia",email,pid);var novo=convite("Pessoa fictícia",email,pid);
        aceitar(antigo,404);
        String hash=br.com.treinos.api.security.OpaqueTokenGenerator.hash(novo.path("codigo").asString());
        banco.update("update usuario_convite set expira_em=now()-interval '1 second' where codigo_hash=?",hash);
        var expirado=aceitar(novo,404);var errado=api.post("/publico/convites-equipe/incorreto",null,Map.of("senha",ApiDeTeste.SENHA),404);
        assertThat(expirado.path("message").asString()).isEqualTo(errado.path("message").asString());
        api.post("/usuarios/convites",admin,Map.of("nome","Duplicado","email",admin.path("usuario").path("email").asString(),"perfilId",pid),409);
    }
    @Test void outroTenantNaoEditaPerfilUsuarioOuResponsavelEMeuPerfilGuardaTelefone() throws Exception {
        var outro=api.novoTreinador();String uid=outro.path("usuario").path("id").asString();
        String pid=api.get("/eu",outro,200).path("perfil").path("id").asString();
        api.put("/perfis/"+pid,admin,Map.of("nome","Não pode","permissoes",Set.of(),"versao",0),404);
        api.delete("/perfis/"+pid,admin,404);api.post("/perfis/"+pid+"/duplicar",admin,null,404);
        api.put("/usuarios/"+uid,admin,Map.of("nome","Não pode","perfilId",perfil("Assistente").path("id").asString(),"ativo",true),404);
        UUID aluno=api.criarAluno(admin,"Aluno fictício");
        api.put("/alunos/"+aluno+"/responsavel",admin,Map.of("usuarioId",uid),404);
        var ficha=api.put("/alunos/"+aluno+"/responsavel",admin,Map.of("usuarioId",admin.path("usuario").path("id").asString()),200);
        assertThat(ficha.path("responsavelId").asString()).isEqualTo(admin.path("usuario").path("id").asString());
        var eu=api.put("/eu",admin,Map.of("nome","Meu nome fictício","telefone","+55 45 99999-8888"),200);
        assertThat(eu.path("usuario").path("telefone").asString()).isEqualTo("(45) 99999-8888");
        api.put("/eu",admin,Map.of("nome","Meu nome fictício","telefone","123"),400);
        assertThat(api.get("/responsaveis",admin,200)).hasSize(1);
    }
}
