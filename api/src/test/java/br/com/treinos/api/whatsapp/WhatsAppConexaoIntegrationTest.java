package br.com.treinos.api.whatsapp;

import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import tools.jackson.databind.JsonNode;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Conexão, modelos e opt-in do WhatsApp (B7), com a Meta de mentira: o token nunca volta (resposta, auditoria, log, coluna),
 * quem não é Administrador leva 403, uma consultoria não vê a outra, a chave desligada não existe aqui (o teste dela é
 * {@link WhatsAppDesligadoIntegrationTest}), o opt-in grava a data e audita uma vez e a exclusão da conta o desfaz.
 */
@ExtendWith(OutputCaptureExtension.class)
class WhatsAppConexaoIntegrationTest extends WhatsAppIntegrationTestBase {

    @Test
    void tokenNuncaApareceNaRespostaNaAuditoriaNemNoLogNemNaColuna(CapturedOutput saida) throws Exception {
        UUID consultoria = consultoriaDe(admin);
        String texto = api.get("/eu", admin, 200).toString();
        assertThat(texto).contains("\"whatsappHabilitado\":true");

        String criada = conectar(admin, token).toString();
        String lida = api.get("/whatsapp/conexao", admin, 200).toString();
        modelo(admin, "COMPROMISSO_NOVO", "compromisso_novo");
        META.modeloNaConta("compromisso_novo", "pt_BR", "APPROVED");
        String modelos = api.get("/whatsapp/modelos", admin, 200).toString();
        JsonNode erro = api.put("/whatsapp/conexao", admin,
                Map.of("phoneNumberId", "abc", "wabaId", "123456", "accessToken", token), 422);

        assertThat(criada).doesNotContain(token);
        assertThat(lida).doesNotContain(token).doesNotContain("token_cifrado").doesNotContain("v1:");
        assertThat(modelos).doesNotContain(token);
        assertThat(erro.path("codigo").asString()).isEqualTo("WHATSAPP_INVALIDO");
        assertThat(erro.toString()).doesNotContain(token);
        assertThat(jdbc.queryForObject("select count(*) from auditoria a where a.consultoria_id = ? and a::text like ?",
                Integer.class, consultoria, "%" + token + "%")).isZero();
        assertThat(jdbc.queryForObject("select token_cifrado from whatsapp_conexao where consultoria_id = ?", String.class,
                consultoria)).startsWith("v1:").doesNotContain(token);
        assertThat(saida.getAll()).doesNotContain(token);
        // O que a Meta recebeu foi o token decifrado, só no cabeçalho de quem consultou os modelos.
        assertThat(META.chamadasDe(token)).isNotEmpty();
    }

    @Test
    void criarAlterarMantendoOTokenEExcluir() throws Exception {
        UUID consultoria = consultoriaDe(admin);
        JsonNode vazia = api.get("/whatsapp/conexao", admin, 200);
        assertThat(vazia.path("habilitado").asBoolean()).isTrue();
        assertThat(vazia.path("configurada").asBoolean()).isFalse();
        assertThat(vazia.path("tokenGravadoEm").isNull()).isTrue();

        // Sem token na criação e criar com versão: recusados, sem gravar.
        api.put("/whatsapp/conexao", admin, pedidoDaConexao(null, null), 422);
        api.put("/whatsapp/conexao", admin, pedidoDaConexao(token, 3L), 409);
        assertThat(api.get("/whatsapp/conexao", admin, 200).path("configurada").asBoolean()).isFalse();

        JsonNode criada = conectar(admin, token);
        assertThat(criada.path("configurada").asBoolean()).isTrue();
        assertThat(criada.path("tokenGravadoEm").isNull()).isFalse();
        long versao = criada.path("versao").asLong();
        String cifradoAntes = jdbc.queryForObject("select token_cifrado from whatsapp_conexao where consultoria_id = ?",
                String.class, consultoria);
        assertThat(auditorias(consultoria, "WHATSAPP_CONEXAO_CONFIGURADA")).isEqualTo(1);

        // Alterar sem versão ou com versão velha: 409. Token em branco mantém o gravado (e a data dele).
        api.put("/whatsapp/conexao", admin, pedidoDaConexao(null, null), 409);
        api.put("/whatsapp/conexao", admin, pedidoDaConexao(null, versao + 5), 409);
        Map<String, Object> semToken = pedidoDaConexao("   ", versao);
        JsonNode mantida = api.put("/whatsapp/conexao", admin, semToken, 200);
        assertThat(mantida.path("tokenGravadoEm")).isEqualTo(criada.path("tokenGravadoEm"));
        assertThat(api.get("/whatsapp/conexao", admin, 200).path("tokenGravadoEm")).isEqualTo(criada.path("tokenGravadoEm"));
        assertThat(mantida.path("phoneNumberId").asString()).isEqualTo(semToken.get("phoneNumberId"));
        assertThat(jdbc.queryForObject("select token_cifrado from whatsapp_conexao where consultoria_id = ?", String.class,
                consultoria)).isEqualTo(cifradoAntes);

        // Token novo troca o cifrado e a data.
        String outroToken = tokenNovo();
        JsonNode trocada = api.put("/whatsapp/conexao", admin, pedidoDaConexao(outroToken, mantida.path("versao").asLong()), 200);
        assertThat(jdbc.queryForObject("select token_cifrado from whatsapp_conexao where consultoria_id = ?", String.class,
                consultoria)).isNotEqualTo(cifradoAntes);
        assertThat(auditorias(consultoria, "WHATSAPP_CONEXAO_CONFIGURADA")).isEqualTo(3);

        // Token fora do formato: 422 sem repetir o valor.
        JsonNode curto = api.put("/whatsapp/conexao", admin, pedidoDaConexao("curto demais", trocada.path("versao").asLong()), 422);
        assertThat(curto.path("codigo").asString()).isEqualTo("WHATSAPP_INVALIDO");
        assertThat(curto.toString()).doesNotContain("curto demais");

        api.delete("/whatsapp/conexao?versao=" + (trocada.path("versao").asLong() + 9), admin, 409);
        api.delete("/whatsapp/conexao?versao=" + trocada.path("versao").asLong(), admin, 204);
        assertThat(api.get("/whatsapp/conexao", admin, 200).path("configurada").asBoolean()).isFalse();
        assertThat(auditorias(consultoria, "WHATSAPP_CONEXAO_REMOVIDA")).isEqualTo(1);
        // Sem conexão, remover é 204 sem auditoria nova.
        api.delete("/whatsapp/conexao", admin, 204);
        assertThat(auditorias(consultoria, "WHATSAPP_CONEXAO_REMOVIDA")).isEqualTo(1);
    }

    @Test
    void modelosComASituacaoQueAMetaDa() throws Exception {
        UUID consultoria = consultoriaDe(admin);
        JsonNode lista = api.get("/whatsapp/modelos", admin, 200).path("modelos");
        assertThat(lista).hasSize(6);
        assertThat(lista.valueStream().map(m -> m.path("tipo").asString())).containsExactly("ANTES", "NO_DIA", "DEPOIS",
                "COMPROMISSO_NOVO", "COMPROMISSO_REMARCADO", "COMPROMISSO_CANCELADO");
        assertThat(lista.valueStream().noneMatch(m -> m.path("configurado").asBoolean())).isTrue();
        assertThat(lista.get(0).path("variaveis")).hasSize(4);
        assertThat(lista.get(3).path("variaveis")).hasSize(1);
        assertThat(lista.get(0).path("textoSugerido").asString()).contains("{{1}}").contains("{{4}}");

        conectar(admin, token);
        JsonNode antes = modelo(admin, "ANTES", "lembrete_antes");
        modelo(admin, "NO_DIA", "lembrete_no_dia");
        modelo(admin, "DEPOIS", "lembrete_depois");
        META.modeloNaConta("lembrete_antes", "pt_BR", "APPROVED");
        META.modeloNaConta("lembrete_no_dia", "pt_BR", "PENDING");
        // "lembrete_depois" não existe na conta da Meta.
        assertThat(auditorias(consultoria, "WHATSAPP_MODELO_CONFIGURADO")).isEqualTo(3);
        assertThat(antes.path("situacao").isNull()).as("salvar não consulta a Meta").isTrue();

        Map<String, JsonNode> porTipo = new java.util.HashMap<>();
        api.get("/whatsapp/modelos", admin, 200).path("modelos").forEach(m -> porTipo.put(m.path("tipo").asString(), m));
        assertThat(porTipo.get("ANTES").path("situacao").asString()).isEqualTo("APPROVED");
        assertThat(porTipo.get("NO_DIA").path("situacao").asString()).isEqualTo("PENDING");
        assertThat(porTipo.get("DEPOIS").path("situacao").asString()).isEqualTo("NAO_ENCONTRADO");
        assertThat(porTipo.get("COMPROMISSO_NOVO").path("situacao").isNull()).isTrue();
        assertThat(META.chamadasDe(token).stream().filter(c -> c.caminho().contains("/message_templates")).count()).isEqualTo(1);

        // Token recusado pela Meta: a lista continua e os configurados saem como INDISPONIVEL.
        META.modo(MetaFalsa.Modo.TOKEN_INVALIDO);
        JsonNode semMeta = api.get("/whatsapp/modelos", admin, 200).path("modelos");
        assertThat(semMeta.get(0).path("situacao").asString()).isEqualTo("INDISPONIVEL");
    }

    @Test
    void modeloComVersaoNomeInvalidoEExclusao() throws Exception {
        UUID consultoria = consultoriaDe(admin);
        JsonNode ruim = api.put("/whatsapp/modelos/ANTES", admin, Map.of("nome", "Nome Com Espaço", "idioma", "português"), 422);
        assertThat(ruim.path("codigo").asString()).isEqualTo("WHATSAPP_INVALIDO");
        assertThat(ruim.path("fieldErrors")).hasSize(2);
        api.put("/whatsapp/modelos/ANTES", admin, Map.of("nome", "lembrete_x", "idioma", "pt_BR", "versao", 1), 409);
        api.put("/whatsapp/modelos/INEXISTENTE", admin, Map.of("nome", "lembrete_x", "idioma", "pt_BR"), 400);

        JsonNode criado = modelo(admin, "ANTES", "lembrete_x");
        long versao = criado.path("versao").asLong();
        api.put("/whatsapp/modelos/ANTES", admin, Map.of("nome", "lembrete_y", "idioma", "pt_BR"), 409);
        // Igual ao que está gravado: 200 sem auditoria nova.
        api.put("/whatsapp/modelos/ANTES", admin, Map.of("nome", "lembrete_x", "idioma", "pt_BR", "versao", versao), 200);
        assertThat(auditorias(consultoria, "WHATSAPP_MODELO_CONFIGURADO")).isEqualTo(1);
        JsonNode alterado = api.put("/whatsapp/modelos/ANTES", admin,
                Map.of("nome", "lembrete_y", "idioma", "pt_BR", "versao", versao), 200);
        assertThat(auditorias(consultoria, "WHATSAPP_MODELO_CONFIGURADO")).isEqualTo(2);

        api.delete("/whatsapp/modelos/ANTES?versao=" + (alterado.path("versao").asLong() + 4), admin, 409);
        api.delete("/whatsapp/modelos/ANTES?versao=" + alterado.path("versao").asLong(), admin, 204);
        assertThat(auditorias(consultoria, "WHATSAPP_MODELO_REMOVIDO")).isEqualTo(1);
        api.delete("/whatsapp/modelos/ANTES", admin, 204);
        assertThat(auditorias(consultoria, "WHATSAPP_MODELO_REMOVIDO")).isEqualTo(1);
    }

    @Test
    void semAPermissaoDa403ESemLoginDa401() throws Exception {
        JsonNode treinador = novaConsultoria();
        trocarPerfil(treinador, "Treinador");
        JsonNode assistente = novaConsultoria();
        trocarPerfil(assistente, "Assistente");
        AlunoDeTeste aluno = alunoComTelefone(admin, "Aluno Fictício Sem Acesso " + UUID.randomUUID());

        for (JsonNode quem : new JsonNode[] {treinador, assistente, aluno.login()}) {
            api.get("/whatsapp/conexao", quem, 403);
            api.put("/whatsapp/conexao", quem, pedidoDaConexao(token, null), 403);
            api.delete("/whatsapp/conexao", quem, 403);
            api.get("/whatsapp/modelos", quem, 403);
            api.put("/whatsapp/modelos/ANTES", quem, Map.of("nome", "lembrete_x", "idioma", "pt_BR"), 403);
            api.delete("/whatsapp/modelos/ANTES", quem, 403);
        }
        api.get("/whatsapp/conexao", null, 401);
        api.put("/whatsapp/conexao", null, Map.of("phoneNumberId", "12345", "wabaId", "67890"), 401);
        // A equipe não liga o interruptor do aluno: a rota é do aluno.
        api.put("/aluno/avisos-pelo-whatsapp", treinador, Map.of("receber", true), 403);
        assertThat(jdbc.queryForObject("select count(*) from whatsapp_conexao where consultoria_id = ?", Integer.class,
                consultoriaDe(treinador))).isZero();
    }

    @Test
    void umaConsultoriaNaoVeNemMexeNaDaOutra() throws Exception {
        conectar(admin, token);
        modelo(admin, "ANTES", "lembrete_isolado");
        AlunoDeTeste aluno = alunoComTelefone(admin, "Aluno Fictício Isolado " + UUID.randomUUID());
        autorizar(aluno, true, 200);

        JsonNode outro = novaConsultoria();
        JsonNode daOutra = api.get("/whatsapp/conexao", outro, 200);
        assertThat(daOutra.path("configurada").asBoolean()).isFalse();
        assertThat(daOutra.toString()).doesNotContain(token);
        assertThat(api.get("/whatsapp/modelos", outro, 200).path("modelos").valueStream()
                .noneMatch(m -> m.path("configurado").asBoolean())).isTrue();
        // Remover na outra não toca na minha.
        api.delete("/whatsapp/conexao", outro, 204);
        api.delete("/whatsapp/modelos/ANTES", outro, 204);
        assertThat(api.get("/whatsapp/conexao", admin, 200).path("configurada").asBoolean()).isTrue();
        assertThat(api.get("/whatsapp/modelos", admin, 200).path("modelos").get(0).path("configurado").asBoolean()).isTrue();
        // O aluno de uma consultoria não existe para a outra (a exportação dá 404).
        api.get("/alunos/" + aluno.id() + "/exportacao", outro, 404);
    }

    @Test
    void optInGravaADataEAuditaUmaVezSo() throws Exception {
        AlunoDeTeste aluno = alunoComTelefone(admin, "Aluna Fictícia OptIn " + UUID.randomUUID());
        UUID semFoneId = api.criarAluno(admin, "Aluno Fictício Sem Fone " + UUID.randomUUID());
        AlunoDeTeste semTelefone = new AlunoDeTeste(semFoneId, api.convidarEEntrar(admin, semFoneId), "");

        // Sem a consultoria conectada: 409 e nada gravado.
        JsonNode antes = api.get("/aluno/avisos-pelo-whatsapp", aluno.login(), 200);
        assertThat(antes.path("receber").asBoolean()).isFalse();
        assertThat(antes.path("disponivel").asBoolean()).isFalse();
        assertThat(antes.path("temTelefone").asBoolean()).isTrue();
        assertThat(autorizar(aluno, true, 409).path("codigo").asString()).isEqualTo("WHATSAPP_NAO_CONECTADO");

        conectar(admin, token);
        assertThat(autorizar(semTelefone, true, 409).path("codigo").asString()).isEqualTo("TELEFONE_NECESSARIO");
        assertThat(api.get("/aluno/avisos-pelo-whatsapp", semTelefone.login(), 200).path("temTelefone").asBoolean()).isFalse();

        JsonNode ligado = autorizar(aluno, true, 200);
        assertThat(ligado.path("receber").asBoolean()).isTrue();
        assertThat(ligado.path("disponivel").asBoolean()).isTrue();
        Object data = jdbc.queryForObject("select whatsapp_avisos_autorizado_em from aluno where id = ?", Object.class, aluno.id());
        assertThat(data).isNotNull();
        assertThat(auditoriasDoAluno(aluno.id())).isEqualTo(1);
        assertThat(jdbc.queryForObject("select resumo from auditoria where entidade_id = ? and acao = "
                + "'AVISOS_PELO_WHATSAPP_DO_ALUNO_ALTERADOS'", String.class, aluno.id()))
                .isEqualTo("Aluno alterou o recebimento dos avisos pelo WhatsApp.");

        // Repetir não regrava a data nem audita.
        autorizar(aluno, true, 200);
        assertThat(jdbc.queryForObject("select whatsapp_avisos_autorizado_em from aluno where id = ?", Object.class, aluno.id()))
                .isEqualTo(data);
        assertThat(auditoriasDoAluno(aluno.id())).isEqualTo(1);

        // Desligar zera e audita; desligar de novo não faz nada.
        assertThat(autorizar(aluno, false, 200).path("receber").asBoolean()).isFalse();
        assertThat(jdbc.queryForObject("select whatsapp_avisos_autorizado_em from aluno where id = ?", Object.class, aluno.id()))
                .isNull();
        assertThat(auditoriasDoAluno(aluno.id())).isEqualTo(2);
        autorizar(aluno, false, 200);
        assertThat(auditoriasDoAluno(aluno.id())).isEqualTo(2);
    }

    @Test
    void optInDoAlunoNaoAceitaCorpoSemOCampoNemIdDeOutro() throws Exception {
        conectar(admin, token);
        AlunoDeTeste aluno = alunoComTelefone(admin, "Aluno Fictício Corpo " + UUID.randomUUID());
        api.put("/aluno/avisos-pelo-whatsapp", aluno.login(), Map.of(), 400);
        // O corpo nunca leva id: um id estranho é ignorado e vale o da sessão.
        api.put("/aluno/avisos-pelo-whatsapp", aluno.login(), Map.of("receber", true, "alunoId", UUID.randomUUID().toString()), 200);
        assertThat(jdbc.queryForObject("select whatsapp_avisos_autorizado_em is not null from aluno where id = ?", Boolean.class,
                aluno.id())).isTrue();
    }

    @Test
    void exportacaoTrazAEscolhaESemTelefoneNemTexto() throws Exception {
        conectar(admin, token);
        modelo(admin, "COMPROMISSO_NOVO", "compromisso_novo");
        AlunoDeTeste aluno = alunoComTelefone(admin, "Aluno Fictício Exportado " + UUID.randomUUID());
        autorizar(aluno, true, 200);
        marcar(admin, aluno.id());

        JsonNode exportacao = api.get("/alunos/" + aluno.id() + "/exportacao", admin, 200);
        JsonNode secao = exportacao.path("avisosPeloWhatsApp");
        assertThat(secao.path("autorizadoEm").isNull()).isFalse();
        assertThat(secao.path("envios")).hasSize(1);
        assertThat(secao.path("envios").get(0).path("tipo").asString()).isEqualTo("COMPROMISSO_NOVO");
        assertThat(secao.path("envios").get(0).path("situacao").asString()).isEqualTo("PENDENTE");
        assertThat(secao.toString()).doesNotContain(aluno.telefone().replaceAll("\\D", "")).doesNotContain("Exportado")
                .doesNotContain("Sala fictícia");
    }

    @Test
    void excluirAContaCancelaOPendenteEZeraOOptIn() throws Exception {
        conectar(admin, token);
        modelo(admin, "COMPROMISSO_NOVO", "compromisso_novo");
        AlunoDeTeste aluno = alunoComTelefone(admin, "Aluna Fictícia Exclusão " + UUID.randomUUID());
        autorizar(aluno, true, 200);
        marcar(admin, aluno.id());
        assertThat(envioDe(aluno.id()).get("situacao")).isEqualTo("PENDENTE");

        api.post("/aluno/conta/excluir", aluno.login(), Map.of("senha", ApiDeTeste.SENHA, "confirmacao", "EXCLUIR"), 204);

        Map<String, Object> envio = envioDe(aluno.id());
        assertThat(envio.get("situacao")).isEqualTo("CANCELADO");
        assertThat(envio.get("motivo")).isEqualTo("ALUNO_ANONIMIZADO");
        assertThat(jdbc.queryForObject("select whatsapp_avisos_autorizado_em from aluno where id = ?", Object.class, aluno.id()))
                .isNull();
    }

    @Test
    void removerAConexaoCancelaOsPendentesDaConsultoria() throws Exception {
        conectar(admin, token);
        modelo(admin, "COMPROMISSO_NOVO", "compromisso_novo");
        AlunoDeTeste aluno = alunoComTelefone(admin, "Aluno Fictício Sem Conexão " + UUID.randomUUID());
        autorizar(aluno, true, 200);
        marcar(admin, aluno.id());

        api.delete("/whatsapp/conexao", admin, 204);

        assertThat(envioDe(aluno.id()).get("situacao")).isEqualTo("CANCELADO");
        assertThat(envioDe(aluno.id()).get("motivo")).isEqualTo("CONEXAO_REMOVIDA");
    }

    private int auditoriasDoAluno(UUID alunoId) {
        return jdbc.queryForObject("select count(*) from auditoria where acao = 'AVISOS_PELO_WHATSAPP_DO_ALUNO_ALTERADOS' "
                + "and entidade_id = ?", Integer.class, alunoId);
    }
}
