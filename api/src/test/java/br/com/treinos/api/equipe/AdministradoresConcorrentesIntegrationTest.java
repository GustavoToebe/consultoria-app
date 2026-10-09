package br.com.treinos.api.equipe;
import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.security.UsuarioAutenticado;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.web.ConflitoException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import tools.jackson.databind.json.JsonMapper;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import static org.assertj.core.api.Assertions.assertThat;
@AutoConfigureMockMvc
class AdministradoresConcorrentesIntegrationTest extends AbstractIntegrationTest {
    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;
    @Autowired private EquipeService equipe;
    @Test void doisAdministradoresNaoConseguemDesativarAmbosSimultaneamente() throws Exception {
        var api=new ApiDeTeste(mvc,json);var um=api.novoTreinador();var eu=api.get("/eu",um,200);
        UUID perfil=UUID.fromString(eu.path("perfil").path("id").asString());
        var convite=api.post("/usuarios/convites",um,Map.of("nome","Segundo administrador fictício","email",ApiDeTeste.emailUnico("admin"),"perfilId",perfil),200);
        var dois=api.post("/publico/convites-equipe/"+convite.path("codigo").asString(),null,Map.of("senha",ApiDeTeste.SENHA),200);
        UUID a=UUID.fromString(um.path("usuario").path("id").asString());UUID b=UUID.fromString(dois.path("usuario").path("id").asString());
        UUID cid=banco.queryForObject("select consultoria_id from usuario where id=?",UUID.class,a);
        var inicio=new CountDownLatch(1);
        try(var executor=Executors.newVirtualThreadPerTaskExecutor()) {
            var primeira=executor.submit(() -> desativar(inicio,cid,a,perfil));
            var segunda=executor.submit(() -> desativar(inicio,cid,b,perfil));
            inicio.countDown();
            assertThat(List.of(primeira.get(30,TimeUnit.SECONDS),segunda.get(30,TimeUnit.SECONDS))).containsExactlyInAnyOrder(200,409);
        }
        assertThat(banco.queryForObject("select count(*) from usuario u join perfil p on p.id=u.perfil_id where u.consultoria_id=? and u.ativo and p.ativo and p.acesso_total",Integer.class,cid)).isEqualTo(1);
    }
    private int desativar(CountDownLatch inicio,UUID cid,UUID id,UUID perfil) throws InterruptedException {
        inicio.await();
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(new UsuarioAutenticado(id,cid,"TREINADOR",null),null,List.of()));
        try {
            return TenantContext.executarComo(cid,() -> {equipe.alterarUsuario(id,new EquipeDtos.UsuarioRequest("Administrador fictício",perfil,false));return 200;});
        } catch(ConflitoException conflito) { assertThat(conflito.getCodigo()).isEqualTo("ULTIMO_ADMINISTRADOR");return 409; }
        finally { SecurityContextHolder.clearContext(); }
    }
}
