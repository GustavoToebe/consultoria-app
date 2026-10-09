package br.com.treinos.api.equipe;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import java.util.Map;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;

/** Casos reais via HTTP: o JWT permanece igual enquanto o perfil muda no banco. */
@AutoConfigureMockMvc
class AutorizacaoEquipeIntegrationTest extends AbstractIntegrationTest {
    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;
    private void perfil(JsonNode login,String nome) {
        UUID id=UUID.fromString(login.path("usuario").path("id").asString());
        banco.update("update usuario u set perfil_id=p.id from perfil p where u.id=? and p.consultoria_id=u.consultoria_id and p.nome=?",id,nome);
    }
    @ParameterizedTest
    @CsvSource({"Administrador,200,200", "Treinador,200,403", "Nutricionista,200,403", "Assistente,403,403"})
    void perfisProntosConferemPermissoesEmCadaRequisicao(String nome,int atualizacoes,int marca) throws Exception {
        var api=new ApiDeTeste(mvc,json);var login=api.novoTreinador();
        perfil(login,nome);
        api.get("/painel",login,200);
        api.get("/alunos",login,200);
        api.get("/atualizacoes",login,atualizacoes);
        var resposta=api.put("/consultoria/marca",login,Map.of("nome","Nome fictício","corPrimaria","#C62828","fonteTitulo","PADRAO","temaPadrao","ESCURO","versao",0),marca);
        if(marca==403) assertThat(resposta.path("codigo").asString()).isEqualTo("PERMISSAO_NEGADA");
    }
    @Test void assistenteNaoRecebeNemApagaDadosSensiveisDaFicha() throws Exception {
        var api=new ApiDeTeste(mvc,json);var login=api.novoTreinador();
        var aluno=api.post("/alunos",login,Map.of("nome","Pessoa fictícia","objetivo","Objetivo sensível fictício","observacoes","Observação sensível fictícia"),200);
        String id=aluno.path("id").asString();
        perfil(login,"Assistente");
        var ficha=api.get("/alunos/"+id,login,200);
        assertThat(ficha.has("objetivo")).isFalse();assertThat(ficha.has("observacoes")).isFalse();
        api.get("/alunos/"+id+"/pesos",login,403);
        api.get("/alunos/"+id+"/lesoes",login,403);
        api.get("/alunos/"+id+"/atualizacoes",login,403);
        api.get("/alunos/"+id+"/execucoes",login,403);
        api.put("/alunos/"+id,login,Map.of("nome","Cadastro alterado","versao",ficha.path("versao").asLong()),200);
        api.put("/alunos/"+id,login,Map.of("nome","Pessoa fictícia","observacoes","Tentativa fictícia","versao",ficha.path("versao").asLong()+1),403);
        perfil(login,"Administrador");
        var completo=api.get("/alunos/"+id,login,200);
        assertThat(completo.path("objetivo").asString()).isEqualTo("Objetivo sensível fictício");
        assertThat(completo.path("observacoes").asString()).isEqualTo("Observação sensível fictícia");
    }
    @Test void mudarPermissaoDoPerfilValeSemReemitirToken() throws Exception {
        var api=new ApiDeTeste(mvc,json);var login=api.novoTreinador();
        perfil(login,"Assistente");api.get("/alunos",login,200);
        UUID id=UUID.fromString(login.path("usuario").path("id").asString());
        banco.update("delete from perfil_permissao pp using usuario u where u.id=? and pp.perfil_id=u.perfil_id and pp.codigo='ALUNO_LER'",id);
        api.get("/alunos",login,403);
        perfil(login,"Administrador");api.get("/alunos",login,200);
    }
}
