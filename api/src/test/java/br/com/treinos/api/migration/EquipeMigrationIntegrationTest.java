package br.com.treinos.api.migration;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.json.JsonMapper;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** A criação pública e o banco devem manter o vínculo obrigatório e o isolamento dos perfis. */
@AutoConfigureMockMvc
class EquipeMigrationIntegrationTest extends AbstractIntegrationTest {
    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;

    @Test void novasConsultoriasRecebemOsQuatroPerfisSemCompartilharVinculos() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var um = api.novoTreinador();
        var outro = api.novoTreinador();
        UUID usuario = UUID.fromString(um.path("usuario").path("id").asString());
        UUID outroUsuario = UUID.fromString(outro.path("usuario").path("id").asString());
        UUID consultoria = banco.queryForObject("select consultoria_id from usuario where id=?", UUID.class, usuario);
        var nomes = banco.queryForList("select nome from perfil where consultoria_id=? order by nome", String.class, consultoria);
        assertThat(nomes).containsExactly("Administrador", "Assistente", "Nutricionista", "Treinador");
        assertThat(banco.queryForObject("select p.sistema and p.acesso_total and p.ativo from usuario u join perfil p on p.id=u.perfil_id where u.id=?", Boolean.class, usuario)).isTrue();
        UUID perfilOutro = banco.queryForObject("select perfil_id from usuario where id=?", UUID.class, outroUsuario);
        assertThatThrownBy(() -> banco.update("update usuario set perfil_id=? where id=?", perfilOutro, usuario))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> banco.update("update usuario set perfil_id=null where id=?", usuario))
                .isInstanceOf(DataIntegrityViolationException.class);
        UUID aluno = api.criarAluno(um, "Aluno fictício da migração");
        var loginAluno = api.convidarEEntrar(um, aluno);
        UUID idAluno = UUID.fromString(loginAluno.path("usuario").path("id").asString());
        assertThat(banco.queryForObject("select perfil_id from usuario where id=?", UUID.class, idAluno)).isNull();
        assertThatThrownBy(() -> banco.update("update aluno set responsavel_id=? where id=?", outroUsuario, aluno))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThat(banco.queryForObject("select count(*) from perfil_permissao pp join perfil p on p.id=pp.perfil_id where p.consultoria_id=? and p.nome='Assistente' and (pp.codigo like '%SENSIVEL%' or pp.codigo like 'ATUALIZACAO_%')", Integer.class, consultoria)).isZero();
    }

    @Test void novaConsultoriaNasceComOQuestionarioPadraoEComAsPermissoesDele() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var treinador = api.novoTreinador();
        UUID usuario = UUID.fromString(treinador.path("usuario").path("id").asString());
        UUID consultoria = banco.queryForObject("select consultoria_id from usuario where id=?", UUID.class, usuario);
        assertThat(banco.queryForObject(
                "select count(*) from questionario where consultoria_id = ? and padrao and finalidade = 'ATUALIZACAO' and versao_publicada = 1 and not arquivado",
                Integer.class, consultoria)).isEqualTo(1);
        assertThat(banco.queryForObject(
                "select v.conteudo->>'formato' from questionario_versao v join questionario q on q.id = v.questionario_id"
                        + " where q.consultoria_id = ? and q.padrao and q.finalidade = 'ATUALIZACAO'", String.class, consultoria)).isEqualTo("2");
        assertThat(banco.queryForObject(
                "select count(*) from questionario_versao v, jsonb_array_elements(v.conteudo->'secoes') s,"
                        + " jsonb_array_elements(s->'perguntas') p where v.consultoria_id = ? and p->>'id' = 'treino_dias'"
                        + " and p->>'ajudaAutomatica' = 'MEDIA_DIAS_TREINO'", Integer.class, consultoria)).isEqualTo(1);
        // Versão publicada é imutável e só há um padrão por consultoria.
        assertThatThrownBy(() -> banco.update("update questionario_versao set conteudo = '{}'::jsonb where consultoria_id = ?", consultoria))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> banco.update(
                "insert into questionario(id, consultoria_id, nome, padrao, rascunho, versao_publicada) values (?, ?, 'Outro', true, '{}'::jsonb, 1)",
                UUID.randomUUID(), consultoria)).isInstanceOf(DataIntegrityViolationException.class);
        // Perfis padrão: treinador e nutricionista leem e alteram, o assistente só lê, o administrador tem acesso total.
        assertThat(permissoes(consultoria, "Treinador")).contains("QUESTIONARIO_LER", "QUESTIONARIO_ALTERAR");
        assertThat(permissoes(consultoria, "Nutricionista")).contains("QUESTIONARIO_LER", "QUESTIONARIO_ALTERAR");
        assertThat(permissoes(consultoria, "Assistente")).contains("QUESTIONARIO_LER").doesNotContain("QUESTIONARIO_ALTERAR");
    }

    private java.util.List<String> permissoes(UUID consultoria, String perfil) {
        return banco.queryForList("select pp.codigo from perfil_permissao pp join perfil p on p.id = pp.perfil_id"
                + " where p.consultoria_id = ? and p.nome = ?", String.class, consultoria, perfil);
    }
}
