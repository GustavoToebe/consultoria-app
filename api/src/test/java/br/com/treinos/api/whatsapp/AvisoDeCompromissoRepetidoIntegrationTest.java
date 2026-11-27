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
 * O aviso de compromisso volta a sair a cada fato novo (reaberto, remarcado de novo, cancelado de novo): cada fato é uma linha
 * nova da fila ({@code ocorrencia} + 1), e o histórico da exportação guarda uma linha por mensagem. O mesmo fato repetido
 * enquanto o aviso do mesmo tipo está pendente, ou até {@link WhatsAppRepositorio#JANELA_DO_MESMO_FATO_MINUTOS} minutos depois
 * de sair, não reenvia, e o job rodando de novo também não. Lembrete de cobrança não ganha ocorrência nova. Meta de mentira
 * ({@link MetaFalsa}), dados fictícios.
 */
class AvisoDeCompromissoRepetidoIntegrationTest extends WhatsAppIntegrationTestBase {

    @Autowired private WhatsAppDaFila fila;
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

    private int linhas(UUID alunoId, String tipo) {
        return jdbc.queryForObject("select count(*) from whatsapp_envio where aluno_id = ? and tipo = ?", Integer.class, alunoId,
                tipo);
    }

    /** Faz de conta que o último aviso do tipo saiu há {@code minutos} minutos (para sair da janela do mesmo fato). */
    private void saiuHa(UUID alunoId, String tipo, int minutos) {
        jdbc.update("update whatsapp_envio set enviado_em = now() - make_interval(mins => ?) where aluno_id = ? and tipo = ? "
                + "and ocorrencia = (select max(ocorrencia) from whatsapp_envio where aluno_id = ? and tipo = ?)",
                minutos, alunoId, tipo, alunoId, tipo);
    }

    private boolean enfileirar(UUID consultoria, UUID aluno, TipoDeAviso tipo, UUID referencia) {
        return Boolean.TRUE.equals(new TransactionTemplate(transacoes)
                .execute(s -> repositorio.enfileirar(consultoria, aluno, tipo, referencia)));
    }

    @Test
    void reabrirECancelarDeNovoGanhamLinhaNovaEAvisamOutraVez() throws Exception {
        AlunoDeTeste aluno = alunoPronto();
        JsonNode c = marcar(admin, aluno.id());
        fila.rodar();
        assertThat(envios("compromisso_novo")).isEqualTo(1);

        c = cancelar(c, true);
        fila.rodar();
        assertThat(envios("compromisso_cancelado")).isEqualTo(1);

        // Reaberto: o aluno recebeu "cancelado" no meio, então é fato novo e o NOVO sai de novo (era aqui que ficava mudo).
        c = cancelar(c, false);
        fila.rodar();
        assertThat(envios("compromisso_novo")).isEqualTo(2);

        // Cancelado de novo: o CANCELADO também.
        cancelar(c, true);
        fila.rodar();
        assertThat(envios("compromisso_cancelado")).isEqualTo(2);

        // Uma linha por mensagem, cada uma com a sua ocorrência, e nenhuma foi reescrita: o histórico da exportação (LGPD) as traz.
        assertThat(enviosDe(aluno.id())).isEqualTo(4);
        assertThat(jdbc.queryForList("select ocorrencia from whatsapp_envio where aluno_id = ? and tipo = 'COMPROMISSO_NOVO' "
                + "order by ocorrencia", Integer.class, aluno.id())).containsExactly(1, 2);
        assertThat(jdbc.queryForList("select distinct situacao from whatsapp_envio where aluno_id = ?", String.class, aluno.id()))
                .containsExactly("ENVIADO");
        JsonNode exportados = api.get("/alunos/" + aluno.id() + "/exportacao", admin, 200).path("avisosPeloWhatsApp")
                .path("envios");
        assertThat(exportados).hasSize(4);
        exportados.forEach(e -> assertThat(e.path("enviadoEm").isNull()).isFalse());
    }

    @Test
    void remarcarDeNovoSoReenviaDepoisDaJanelaDoMesmoFato() throws Exception {
        AlunoDeTeste aluno = alunoPronto();
        JsonNode c = marcar(admin, aluno.id());
        fila.rodar();
        c = mudarHora(c, "06:15");
        fila.rodar();
        assertThat(envios("compromisso_remarcado")).isEqualTo(1);

        // Minutos depois, o mesmo fato (remarcou de novo): a mensagem que saiu já mandou abrir o app, não reenvia.
        c = mudarHora(c, "06:45");
        fila.rodar();
        assertThat(envios("compromisso_remarcado")).isEqualTo(1);
        assertThat(linhas(aluno.id(), "COMPROMISSO_REMARCADO")).isEqualTo(1);

        // Passada a janela, é uma remarcação nova: linha nova e mensagem nova, com a anterior intacta no histórico.
        saiuHa(aluno.id(), "COMPROMISSO_REMARCADO", WhatsAppRepositorio.JANELA_DO_MESMO_FATO_MINUTOS + 1);
        mudarHora(c, "06:30");
        fila.rodar();
        assertThat(envios("compromisso_remarcado")).isEqualTo(2);
        assertThat(linhas(aluno.id(), "COMPROMISSO_REMARCADO")).isEqualTo(2);
    }

    @Test
    void mesmoFatoPendenteOuRecemEnviadoNaoDuplicaEOJobDeNovoTambemNao() throws Exception {
        AlunoDeTeste aluno = alunoPronto();
        JsonNode c = marcar(admin, aluno.id());
        fila.rodar();
        c = cancelar(c, true);
        fila.rodar();
        cancelar(c, false);
        UUID compromisso = jdbc.queryForObject("select referencia_id from whatsapp_envio where aluno_id = ? "
                + "and tipo = 'COMPROMISSO_NOVO' limit 1", UUID.class, aluno.id());
        UUID consultoria = consultoriaDe(admin);

        // O mesmo fato chega de novo com o reaberto ainda pendente: nada novo.
        assertThat(enfileirar(consultoria, aluno.id(), TipoDeAviso.COMPROMISSO_NOVO, compromisso)).isFalse();
        assertThat(linhas(aluno.id(), "COMPROMISSO_NOVO")).isEqualTo(2);

        fila.rodar();
        fila.rodar();
        assertThat(envios("compromisso_novo")).as("um só envio para o reaberto").isEqualTo(2);

        // E de novo logo depois de sair (dentro da janela): continua sem nada novo.
        assertThat(enfileirar(consultoria, aluno.id(), TipoDeAviso.COMPROMISSO_NOVO, compromisso)).isFalse();
        fila.rodar();
        assertThat(envios("compromisso_novo")).isEqualTo(2);
        assertThat(linhas(aluno.id(), "COMPROMISSO_NOVO")).isEqualTo(2);

        // Fora da janela vira fato novo.
        saiuHa(aluno.id(), "COMPROMISSO_NOVO", WhatsAppRepositorio.JANELA_DO_MESMO_FATO_MINUTOS + 1);
        assertThat(enfileirar(consultoria, aluno.id(), TipoDeAviso.COMPROMISSO_NOVO, compromisso)).isTrue();
        assertThat(linhas(aluno.id(), "COMPROMISSO_NOVO")).isEqualTo(3);
    }

    @Test
    void avisoQueNuncaSaiuNaoImpedeOFatoNovo() throws Exception {
        AlunoDeTeste aluno = alunoPronto();
        JsonNode c = marcar(admin, aluno.id());
        // Falhou de vez (token recusado): nada chegou ao aluno, então o fato novo ganha linha nova.
        META.modo(MetaFalsa.Modo.TOKEN_INVALIDO);
        fila.rodar();
        assertThat(envioDe(aluno.id()).get("situacao")).isEqualTo("FALHOU");
        META.modo(MetaFalsa.Modo.OK);
        c = cancelar(c, true);
        cancelar(c, false);
        fila.rodar();
        assertThat(linhas(aluno.id(), "COMPROMISSO_NOVO")).isEqualTo(2);
        assertThat(envios("compromisso_novo")).as("a primeira falhou na Meta e foi contada; a do reaberto saiu").isEqualTo(2);
    }

    @Test
    void lembreteDeCobrancaNuncaGanhaOcorrenciaNova() throws Exception {
        modelo(admin, "ANTES", "lembrete_antes");
        AlunoDeTeste aluno = alunoPronto();
        UUID cobranca = UUID.randomUUID();
        UUID consultoria = consultoriaDe(admin);
        assertThat(enfileirar(consultoria, aluno.id(), TipoDeAviso.ANTES, cobranca)).isTrue();
        jdbc.update("update whatsapp_envio set situacao = 'ENVIADO', enviado_em = now() - interval '2 days', id_externo = ? "
                + "where aluno_id = ?", "wamid.so-de-teste-" + cobranca, aluno.id());

        assertThat(enfileirar(consultoria, aluno.id(), TipoDeAviso.ANTES, cobranca)).isFalse();
        assertThat(linhas(aluno.id(), "ANTES")).isEqualTo(1);
    }
}
