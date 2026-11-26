package br.com.treinos.api.whatsapp;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * O aviso de compromisso volta a sair a cada fato novo (reaberto, remarcado de novo, cancelado de novo) mesmo com a chave única
 * (consultoria, tipo, compromisso, aluno) da fila: a linha que já saiu é rearmada, e o mesmo fato repetido antes de sair, ou o
 * job rodando de novo, não duplica. Lembrete de cobrança não é rearmado. Meta de mentira ({@link MetaFalsa}), dados fictícios.
 */
class AvisoDeCompromissoRepetidoIntegrationTest extends WhatsAppIntegrationTestBase {

    @Autowired private WhatsAppDaFila fila;
    @Autowired private FilaDeAvisos filaDeAvisos;
    @Autowired private WhatsAppRepositorio repositorio;
    @Autowired private PlatformTransactionManager transacoes;

    @BeforeEach
    void conectarEModelar() throws Exception {
        conectar(admin, token);
        for (String tipo : List.of("COMPROMISSO_NOVO", "COMPROMISSO_REMARCADO", "COMPROMISSO_CANCELADO")) {
            modelo(admin, tipo, tipo.toLowerCase(Locale.ROOT));
        }
    }

    private AlunoDeTeste alunoPronto() throws Exception {
        AlunoDeTeste aluno = alunoComTelefone(admin, "Aline Fictícia " + UUID.randomUUID());
        autorizar(aluno, true, 200);
        return aluno;
    }

    private JsonNode cancelar(JsonNode c, boolean cancelado) throws Exception {
        return api.post("/agenda/compromissos/" + c.path("id").asString() + "/situacao", admin,
                Map.of("cancelado", cancelado, "versao", c.path("versao").asLong()), 200);
    }

    private JsonNode mudarHora(JsonNode c, String hora) throws Exception {
        List<UUID> alunoIds = new ArrayList<>();
        c.path("participantes").forEach(p -> alunoIds.add(UUID.fromString(p.path("id").asString())));
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("alunoIds", alunoIds);
        corpo.put("responsavelId", c.path("responsavelId").asString());
        corpo.put("data", c.path("data").asString());
        corpo.put("hora", hora);
        corpo.put("duracaoMinutos", c.path("duracaoMinutos").asInt());
        corpo.put("local", c.path("local").asString());
        corpo.put("versao", c.path("versao").asLong());
        return api.put("/agenda/compromissos/" + c.path("id").asString(), admin, corpo, 200);
    }

    private long envios(String modelo) {
        return META.enviosDe(token).stream().filter(e -> e.corpo().contains("\"name\":\"" + modelo + "\"")).count();
    }

    private String situacaoDe(UUID alunoId, String tipo) {
        return jdbc.queryForObject("select situacao from whatsapp_envio where aluno_id = ? and tipo = ?", String.class, alunoId,
                tipo);
    }

    @Test
    void reabrirECancelarDeNovoAvisamOutraVez() throws Exception {
        AlunoDeTeste aluno = alunoPronto();
        JsonNode c = marcar(admin, aluno.id());
        fila.rodar();
        assertThat(envios("compromisso_novo")).isEqualTo(1);

        c = cancelar(c, true);
        fila.rodar();
        assertThat(envios("compromisso_cancelado")).isEqualTo(1);

        // Reaberto: o NOVO que já saiu é rearmado e sai de novo (era aqui que ficava mudo).
        c = cancelar(c, false);
        assertThat(situacaoDe(aluno.id(), "COMPROMISSO_NOVO")).isEqualTo("PENDENTE");
        fila.rodar();
        assertThat(envios("compromisso_novo")).isEqualTo(2);
        Map<String, Object> novo = jdbc.queryForMap("select situacao, tentativas, id_externo from whatsapp_envio "
                + "where aluno_id = ? and tipo = 'COMPROMISSO_NOVO'", aluno.id());
        assertThat(novo.get("situacao")).isEqualTo("ENVIADO");
        assertThat(novo.get("tentativas")).isEqualTo(1);
        assertThat(novo.get("id_externo")).isNotNull();

        // Cancelado de novo: o CANCELADO que já saiu também.
        cancelar(c, true);
        fila.rodar();
        assertThat(envios("compromisso_cancelado")).isEqualTo(2);
        assertThat(enviosDe(aluno.id())).as("uma linha por tipo, rearmada").isEqualTo(2);
    }

    @Test
    void remarcarDeNovoAvisaOutraVez() throws Exception {
        AlunoDeTeste aluno = alunoPronto();
        JsonNode c = marcar(admin, aluno.id());
        fila.rodar();
        c = mudarHora(c, "06:15");
        fila.rodar();
        assertThat(envios("compromisso_remarcado")).isEqualTo(1);

        mudarHora(c, "06:45");
        fila.rodar();

        assertThat(envios("compromisso_remarcado")).isEqualTo(2);
        assertThat(situacaoDe(aluno.id(), "COMPROMISSO_REMARCADO")).isEqualTo("ENVIADO");
    }

    @Test
    void mesmoFatoProcessadoDuasVezesEOJobDeNovoNaoDuplicam() throws Exception {
        AlunoDeTeste aluno = alunoPronto();
        JsonNode c = marcar(admin, aluno.id());
        fila.rodar();
        c = cancelar(c, true);
        fila.rodar();
        cancelar(c, false);
        assertThat(envios("compromisso_novo")).as("o reaberto ainda não saiu").isEqualTo(1);

        // O mesmo fato chega de novo antes de sair: a linha PENDENTE fica como está.
        UUID compromisso = jdbc.queryForObject(
                "select referencia_id from whatsapp_envio where aluno_id = ? and tipo = 'COMPROMISSO_NOVO'", UUID.class, aluno.id());
        UUID consultoria = consultoriaDe(admin);
        new TransactionTemplate(transacoes).executeWithoutResult(s -> filaDeAvisos.enfileirarDeCompromissos(consultoria,
                List.of(new FilaDeAvisos.AvisoDeCompromisso(aluno.id(), compromisso, TipoDeAviso.COMPROMISSO_NOVO))));
        assertThat(enviosDe(aluno.id())).isEqualTo(2);

        fila.rodar();
        fila.rodar();
        assertThat(envios("compromisso_novo")).as("um só envio para o reaberto, com o fato repetido e o job duas vezes")
                .isEqualTo(2);
    }

    @Test
    void lembreteDeCobrancaNuncaEhRearmado() throws Exception {
        modelo(admin, "ANTES", "lembrete_antes");
        AlunoDeTeste aluno = alunoPronto();
        UUID cobranca = UUID.randomUUID();
        UUID consultoria = consultoriaDe(admin);
        TransactionTemplate transacao = new TransactionTemplate(transacoes);
        assertThat(enfileirarLembrete(transacao, consultoria, aluno.id(), cobranca)).isTrue();
        jdbc.update("update whatsapp_envio set situacao = 'ENVIADO', id_externo = ? where aluno_id = ?",
                "wamid.so-de-teste-" + cobranca, aluno.id());

        assertThat(enfileirarLembrete(transacao, consultoria, aluno.id(), cobranca)).isFalse();
        assertThat(situacaoDe(aluno.id(), "ANTES")).isEqualTo("ENVIADO");
    }

    private boolean enfileirarLembrete(TransactionTemplate transacao, UUID consultoria, UUID aluno, UUID cobranca) {
        return Boolean.TRUE.equals(transacao.execute(s -> repositorio.enfileirar(consultoria, aluno, TipoDeAviso.ANTES, cobranca)));
    }
}
