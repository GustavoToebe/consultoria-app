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
    @Test void permissaoNulaNoPerfilDa400() throws Exception {
        var comNulo=java.util.Collections.singletonList(null);
        api.post("/perfis",admin,Map.of("nome","Com nulo","permissoes",comNulo),400);
        var p=api.post("/perfis",admin,Map.of("nome","Para editar","permissoes",Set.of("ALUNO_LER")),200);
        api.put("/perfis/"+p.path("id").asString(),admin,Map.of("nome","Para editar","permissoes",comNulo,"versao",p.path("versao").asLong()),400);
    }
    @Test void conviteVencidoNaoTravaOPerfilECancelarLiberaOPerfil() throws Exception {
        String perfil=api.post("/perfis",admin,Map.of("nome","Perfil temporário","permissoes",Set.of("ALUNO_LER")),200).path("id").asString();
        String emailVencido=ApiDeTeste.emailUnico("vencida"),emailVigente=ApiDeTeste.emailUnico("vigente");
        convite("Convidada vencida",emailVencido,perfil);
        convite("Convidado vigente",emailVigente,perfil);
        banco.update("update usuario_convite set expira_em=now()-interval '1 day' where email=?",emailVencido);
        String idVencido=null,idVigente=null;
        for(var u:api.get("/usuarios",admin,200)) {
            if(u.path("email").asString().equals(emailVencido)) idVencido=u.path("id").asString();
            if(u.path("email").asString().equals(emailVigente)) idVigente=u.path("id").asString();
        }
        // Convite vigente ainda trava o perfil; o vencido sozinho não.
        assertThat(api.delete("/perfis/"+perfil,admin,409).path("codigo").asString()).isEqualTo("PERFIL_EM_USO");
        api.delete("/usuarios/convites/"+idVigente,admin,204);
        api.delete("/usuarios/convites/"+idVigente,admin,404);
        api.delete("/perfis/"+perfil,admin,204);
        assertThat(banco.queryForObject("select count(*) from usuario_convite where email in (?,?)",Integer.class,emailVencido,emailVigente)).isZero();
        assertThat(idVencido).isNotNull();
        assertThat(api.get("/auditoria?acao=CONVITE_EQUIPE_CANCELADO",admin,200).path("itens")).hasSize(1);
    }
    @Test void cancelarConviteRespeitaConsultoriaAceiteETeto() throws Exception {
        String assistente=perfil("Assistente").path("id").asString();
        String emailAceito=ApiDeTeste.emailUnico("aceito"),emailFuturo=ApiDeTeste.emailUnico("futuro");
        var aceito=convite("Aceito",emailAceito,assistente);aceitar(aceito,200);
        var pendenteAdmin=convite("Futuro administrador",emailFuturo,perfil("Administrador").path("id").asString());
        String idPendente=null;
        for(var u:api.get("/usuarios",admin,200)) if(u.path("email").asString().equals(emailFuturo)) idPendente=u.path("id").asString();
        // Convite já aceito não é mais convite (o id do membro também não vale).
        for(var u:api.get("/usuarios",admin,200)) if(u.path("email").asString().equals(emailAceito)) api.delete("/usuarios/convites/"+u.path("id").asString(),admin,404);
        // Outra consultoria não enxerga o convite.
        api.delete("/usuarios/convites/"+idPendente,api.novoTreinador(),404);
        // Quem tem USUARIO_ALTERAR mas não é administrador não cancela convite de Administrador.
        String pm=api.post("/perfis",admin,Map.of("nome","Gestor de convites","permissoes",Set.of("EQUIPE_LER","USUARIO_ALTERAR")),200).path("id").asString();
        var gestor=aceitar(convite("Gestor",ApiDeTeste.emailUnico("gestor"),pm),200);
        api.delete("/usuarios/convites/"+idPendente,gestor,403);
        api.delete("/usuarios/convites/"+idPendente,admin,204);
        assertThat(pendenteAdmin.path("codigo").asString()).isNotBlank();
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
    @Test void filtroMeusAlunosSegueResponsavelSemRestringirLeituraEAtualizaCadastroAtomicamente() throws Exception {
        var c=convite("Responsável fictício",ApiDeTeste.emailUnico("responsavel"),perfil("Assistente").path("id").asString());
        var membro=aceitar(c,200);String uid=membro.path("usuario").path("id").asString();
        UUID antigo=api.criarAluno(admin,"Aluno do administrador");
        var novo=api.post("/alunos",admin,Map.of("nome","Aluno do responsável","responsavelId",uid),200);
        assertThat(api.get("/alunos?meus=true",membro,200).path("total").asLong()).isEqualTo(1);
        assertThat(api.get("/alunos?meus=false",membro,200).path("total").asLong()).isEqualTo(2);
        assertThat(api.get("/painel?meus=true",membro,200).path("alunosAtivos").asLong()).isEqualTo(1);
        assertThat(api.get("/painel?meus=false",membro,200).path("alunosAtivos").asLong()).isEqualTo(2);
        api.get("/alunos/"+antigo,membro,200); // Filtro é uma preferência, não uma restrição de escopo.
        var outro=api.novoTreinador();String externo=outro.path("usuario").path("id").asString();
        api.post("/alunos",admin,Map.of("nome","Não deve gravar","responsavelId",externo),404);
        assertThat(api.get("/alunos?meus=false",admin,200).path("total").asLong()).isEqualTo(2);
        String id=novo.path("id").asString();
        api.put("/alunos/"+id,admin,Map.of("nome","Nome não deve mudar","responsavelId",externo,"versao",novo.path("versao").asLong()),404);
        assertThat(api.get("/alunos/"+id,admin,200).path("nome").asString()).isEqualTo("Aluno do responsável");
        api.put("/alunos/"+id,admin,Map.of("nome","Aluno reatribuído","responsavelId",admin.path("usuario").path("id").asString(),"versao",novo.path("versao").asLong()),200);
        assertThat(api.get("/painel?meus=true",membro,200).path("alunosAtivos").asLong()).isZero();
        assertThat(api.get("/auditoria?acao=ALUNO_RESPONSAVEL_ALTERADO",admin,200).path("total").asLong()).isEqualTo(1);
    }
    @Test void outroTenantNaoEditaPerfilOuUsuarioEMeuPerfilGuardaTelefone() throws Exception {
        var outro=api.novoTreinador();String uid=outro.path("usuario").path("id").asString();
        String pid=api.get("/eu",outro,200).path("perfil").path("id").asString();
        api.put("/perfis/"+pid,admin,Map.of("nome","Não pode","permissoes",Set.of(),"versao",0),404);
        api.delete("/perfis/"+pid,admin,404);api.post("/perfis/"+pid+"/duplicar",admin,null,404);
        api.put("/usuarios/"+uid,admin,Map.of("nome","Não pode","perfilId",perfil("Assistente").path("id").asString(),"ativo",true),404);
        var eu=api.put("/eu",admin,Map.of("nome","Meu nome fictício","telefone","+55 45 99999-8888"),200);
        assertThat(eu.path("usuario").path("telefone").asString()).isEqualTo("(45) 99999-8888");
        api.put("/eu",admin,Map.of("nome","Meu nome fictício","telefone","123"),400);
        assertThat(api.get("/responsaveis",admin,200)).hasSize(1);
    }
    @Test void auditorSemGestaoDaEquipeConsegueFiltrarPessoasSomenteDaConsultoria() throws Exception {
        var p=api.post("/perfis",admin,Map.of("nome","Auditor fictício","permissoes",Set.of("AUDITORIA_LER")),200);
        var c=convite("Auditor Teste",ApiDeTeste.emailUnico("auditor"),p.path("id").asString());var auditor=aceitar(c,200);
        var outro=api.novoTreinador();String externo=outro.path("usuario").path("id").asString();
        api.get("/usuarios",auditor,403);api.get("/auditoria",auditor,200);
        assertThat(api.get("/auditoria/pessoas",auditor,200)).hasSize(2);
        assertThat(api.get("/auditoria/pessoas",auditor,200).toString()).doesNotContain(externo);
    }

    private static final String MSG_ADMIN = "Somente administradores podem alterar administradores.";
    private static final String NEGADA = "Você não pode dar permissões que não tem.";

    private JsonNode criarPerfilComPermissoes(String nome, String... permissoes) throws Exception {
        return api.post("/perfis", admin, Map.of("nome", nome, "permissoes", Set.of(permissoes)), 200);
    }

    private JsonNode membroComPerfil(JsonNode perfil) throws Exception {
        var c = convite("Membro fictício", ApiDeTeste.emailUnico("membro"), perfil.path("id").asString());
        return aceitar(c, 200);
    }

    private void assertNegada(JsonNode resposta) {
        assertNegada(resposta, NEGADA);
    }

    /** A mensagem distingue a regra nova do 403 genérico do @PreAuthorize ("Seu perfil não permite esta ação."). */
    private void assertNegada(JsonNode resposta, String mensagem) {
        assertThat(resposta.path("codigo").asString()).isEqualTo("PERMISSAO_NEGADA");
        assertThat(resposta.path("message").asString()).isEqualTo(mensagem);
    }

    @Test void membroComUsuarioAlterarNaoSobeDePrivilegioNemMexeEmAdministrador() throws Exception {
        String adminPerfil = perfil("Administrador").path("id").asString();
        String adminId = admin.path("usuario").path("id").asString();
        var gestor = criarPerfilComPermissoes("Gestor fictício", "EQUIPE_LER", "USUARIO_ALTERAR");
        var membro = membroComPerfil(gestor);
        String membroId = membro.path("usuario").path("id").asString();

        assertNegada(api.put("/usuarios/" + membroId, membro,
                Map.of("nome", "Gestor", "perfilId", adminPerfil, "ativo", true), 403));
        assertNegada(api.post("/usuarios/convites", membro,
                Map.of("nome", "Outra pessoa", "email", ApiDeTeste.emailUnico("promovido"), "perfilId", adminPerfil), 403));
        assertNegada(api.put("/usuarios/" + adminId, membro,
                Map.of("nome", "Admin", "perfilId", adminPerfil, "ativo", false), 403), MSG_ADMIN);
        assertNegada(api.put("/usuarios/" + adminId, membro,
                Map.of("nome", "Admin", "perfilId", gestor.path("id").asString(), "ativo", true), 403), MSG_ADMIN);
        // perfil que ele não possui por inteiro (Nutricionista tem permissões que o Gestor não tem)
        assertNegada(api.post("/usuarios/convites", membro,
                Map.of("nome", "Outra pessoa", "email", ApiDeTeste.emailUnico("nutri"),
                        "perfilId", perfil("Nutricionista").path("id").asString()), 403));
        // nem trocar o próprio perfil
        var menor = criarPerfilComPermissoes("Menor fictício", "EQUIPE_LER");
        assertNegada(api.put("/usuarios/" + membroId, membro,
                Map.of("nome", "Gestor", "perfilId", menor.path("id").asString(), "ativo", true), 403),
                "Você não pode trocar o seu próprio perfil.");

        var eu = api.get("/eu", admin, 200);
        assertThat(eu.path("perfil").path("nome").asString()).isEqualTo("Administrador");
        assertThat(api.get("/eu", membro, 200).path("perfil").path("nome").asString()).isEqualTo("Gestor fictício");
        assertThat(api.get("/usuarios", admin, 200)).hasSize(2);
    }

    @Test void membroComPerfilAlterarNaoAmpliaOProprioPerfilNemDuplicaOAdministrador() throws Exception {
        var editor = criarPerfilComPermissoes("Editor fictício", "EQUIPE_LER", "PERFIL_ALTERAR");
        var membro = membroComPerfil(editor);
        String editorId = editor.path("id").asString();

        assertNegada(api.put("/perfis/" + editorId, membro, Map.of("nome", "Editor fictício",
                "permissoes", Set.of("EQUIPE_LER", "PERFIL_ALTERAR", "ALUNO_LER", "ALUNO_SENSIVEL_LER"),
                "versao", editor.path("versao").asLong()), 403));
        assertNegada(api.post("/perfis", membro,
                Map.of("nome", "Com sensível", "permissoes", Set.of("EQUIPE_LER", "ALUNO_LER", "ALUNO_SENSIVEL_LER")), 403));
        assertNegada(api.post("/perfis/" + perfil("Administrador").path("id").asString() + "/duplicar", membro, null, 403));

        var perfisDepois = api.get("/perfis", admin, 200);
        for (var p : perfisDepois) {
            assertThat(p.path("nome").asString()).doesNotContain("(cópia");
            if (p.path("id").asString().equals(editorId)) {
                assertThat(p.path("permissoes").toString()).doesNotContain("SENSIVEL");
            }
        }
        // dentro do próprio teto continua funcionando
        api.post("/perfis", membro, Map.of("nome", "Leitura fictícia", "permissoes", Set.of("EQUIPE_LER")), 200);
        api.post("/perfis/" + editorId + "/duplicar", membro, null, 200);
    }

    @Test void administradorContinuaPromovendoConvidandoEDuplicandoAdministrador() throws Exception {
        String adminPerfil = perfil("Administrador").path("id").asString();
        var membro = membroComPerfil(perfil("Assistente"));
        String membroId = membro.path("usuario").path("id").asString();
        api.put("/usuarios/" + membroId, admin, Map.of("nome", "Promovido", "perfilId", adminPerfil, "ativo", true), 200);
        convite("Outro administrador", ApiDeTeste.emailUnico("admin2"), adminPerfil);
        var copia = api.post("/perfis/" + adminPerfil + "/duplicar", admin, null, 200);
        assertThat(copia.path("permissoes")).isNotEmpty();
    }

    @Test void membroSemSerAdministradorNaoAlteraMembroComPerfilAcimaDoTeto() throws Exception {
        var gestor = membroComPerfil(criarPerfilComPermissoes("Gestor de membros", "EQUIPE_LER", "USUARIO_ALTERAR"));
        var leitura = criarPerfilComPermissoes("Leitura de membros", "EQUIPE_LER");
        var acima = membroComPerfil(perfil("Nutricionista"));
        var abaixo = membroComPerfil(leitura);
        String acimaId = acima.path("usuario").path("id").asString();
        String abaixoId = abaixo.path("usuario").path("id").asString();
        String nutri = perfil("Nutricionista").path("id").asString();

        // Mesmo perfil, só nome ou situação: o perfil ATUAL do membro precisa caber no teto de quem altera.
        assertNegada(api.put("/usuarios/" + acimaId, gestor, Map.of("nome", "Renomeada", "perfilId", nutri, "ativo", true), 403));
        assertNegada(api.put("/usuarios/" + acimaId, gestor, Map.of("nome", "Nutricionista", "perfilId", nutri, "ativo", false), 403));
        api.get("/eu", acima, 200); // continua ativa e logada
        // Inativa por um administrador, também não é reativada por quem está abaixo.
        api.put("/usuarios/" + acimaId, admin, Map.of("nome", "Nutricionista", "perfilId", nutri, "ativo", false), 200);
        assertNegada(api.put("/usuarios/" + acimaId, gestor, Map.of("nome", "Nutricionista", "perfilId", nutri, "ativo", true), 403));
        // Dentro do teto continua funcionando.
        api.put("/usuarios/" + abaixoId, gestor, Map.of("nome", "Renomeada", "perfilId", leitura.path("id").asString(), "ativo", false), 200);
        api.get("/eu", abaixo, 401);
    }

    @Test void membroSemSerAdministradorNaoApagaPerfilAcimaDoTeto() throws Exception {
        var editor = membroComPerfil(criarPerfilComPermissoes("Editor de perfis", "EQUIPE_LER", "PERFIL_ALTERAR"));
        var alto = criarPerfilComPermissoes("Perfil alto", "EQUIPE_LER", "ALUNO_LER", "ALUNO_SENSIVEL_LER");
        var baixo = criarPerfilComPermissoes("Perfil baixo", "EQUIPE_LER");
        assertNegada(api.delete("/perfis/" + alto.path("id").asString(), editor, 403));
        assertThat(perfil("Perfil alto").path("id").asString()).isEqualTo(alto.path("id").asString());
        api.delete("/perfis/" + baixo.path("id").asString(), editor, 204);
        api.delete("/perfis/" + alto.path("id").asString(), admin, 204);
    }

    @Test void convidarNaoSubstituiConvitePendenteDePerfilAcimaDoTeto() throws Exception {
        var gestor = membroComPerfil(criarPerfilComPermissoes("Gestor de convites 2", "EQUIPE_LER", "USUARIO_ALTERAR"));
        String leitura = criarPerfilComPermissoes("Leitura de convites", "EQUIPE_LER").path("id").asString();
        String nutri = perfil("Nutricionista").path("id").asString();
        String email = ApiDeTeste.emailUnico("substituido");
        var pendente = convite("Pessoa fictícia", email, nutri);
        assertNegada(api.post("/usuarios/convites", gestor, Map.of("nome", "Outra", "email", email, "perfilId", leitura), 403));
        aceitar(pendente, 200); // o convite original continua valendo
        // Convite pendente dentro do teto pode ser substituído.
        String outro = ApiDeTeste.emailUnico("substituivel");
        var antigo = convite("Pessoa fictícia", outro, leitura);
        api.post("/usuarios/convites", gestor, Map.of("nome", "Outra", "email", outro, "perfilId", leitura), 200);
        aceitar(antigo, 404);
    }

    @Test void alterarPerfilEncerraSessoesDeQuemPerdeAcesso() throws Exception {
        var perfil = criarPerfilComPermissoes("Perfil de sessões", "EQUIPE_LER", "ALUNO_LER");
        String pid = perfil.path("id").asString();
        String email = ApiDeTeste.emailUnico("sessoes");
        aceitar(convite("Membro fictício", email, pid), 200);
        var login = (java.util.function.Supplier<JsonNode>) () -> {
            try { return api.post("/auth/login", null, Map.of("email", email, "senha", ApiDeTeste.SENHA), 200); }
            catch (Exception e) { throw new AssertionError(e); }
        };
        var membro = login.get();
        // Ganhar permissão não derruba a sessão.
        var ampliado = api.put("/perfis/" + pid, admin, Map.of("nome", "Perfil de sessões", "permissoes", Set.of("EQUIPE_LER", "ALUNO_LER", "ALUNO_ALTERAR"),
                "versao", perfil.path("versao").asLong()), 200);
        api.get("/eu", membro, 200);
        // Perder permissão derruba (bearer e refresh).
        var reduzido = api.put("/perfis/" + pid, admin, Map.of("nome", "Perfil de sessões", "permissoes", Set.of("EQUIPE_LER", "ALUNO_LER"),
                "versao", ampliado.path("versao").asLong()), 200);
        api.get("/eu", membro, 401);
        api.post("/auth/refresh", null, Map.of("refreshToken", membro.path("refreshToken").asString()), 401);
        // Desativar o perfil também derruba.
        membro = login.get();
        api.get("/eu", membro, 200);
        api.put("/perfis/" + pid, admin, Map.of("nome", "Perfil de sessões", "permissoes", Set.of("EQUIPE_LER", "ALUNO_LER"), "ativo", false,
                "versao", reduzido.path("versao").asLong()), 200);
        api.get("/eu", membro, 401);
    }
}
