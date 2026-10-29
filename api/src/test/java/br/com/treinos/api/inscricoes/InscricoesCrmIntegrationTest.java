package br.com.treinos.api.inscricoes;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * CRM de interessados (V045, docs/planos/interessados-crm.md): qualificação e origem do formulário, etapas, encerrar com
 * motivo, reabrir em ciclos, proposta, retornos, respostas prontas e mensagem preparada, busca, filtros e contagens,
 * mesma pessoa e indicadores. Isolamento por consultoria em cada parte. Só dados fictícios.
 */
@AutoConfigureMockMvc
class InscricoesCrmIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;

    private ApiDeTeste api;
    private JsonNode admin;
    private String codigo;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        codigo = abrirLink(admin);
    }

    // ---- auxiliares ----

    private static String usuarioId(JsonNode login) {
        return login.path("usuario").path("id").asString();
    }

    private UUID consultoriaDe(JsonNode login) {
        return banco.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class, usuarioId(login));
    }

    private void perfil(JsonNode login, String nome) {
        banco.update("update usuario u set perfil_id = p.id from perfil p where u.id = ?::uuid "
                + "and p.consultoria_id = u.consultoria_id and p.nome = ?", usuarioId(login), nome);
    }

    private String abrirLink(JsonNode login) throws Exception {
        JsonNode atual = api.get("/inscricoes/configuracao", login, 200);
        Map<String, Object> corpo = new HashMap<>();
        corpo.put("aberta", true);
        corpo.put("responsavelId", null);
        corpo.put("texto", null);
        corpo.put("versao", atual.path("versao").isNull() ? null : atual.path("versao").asLong());
        return api.put("/inscricoes/configuracao", login, corpo, 200).path("codigo").asString();
    }

    private static Map<String, Object> corpo(String nome, String whatsapp, String email) {
        Map<String, Object> corpo = new HashMap<>();
        corpo.put("nome", nome);
        corpo.put("whatsapp", whatsapp);
        corpo.put("email", email);
        return corpo;
    }

    /** Inscreve pelo link e devolve o id da inscrição mais nova. */
    private String inscrever(Map<String, Object> corpo) throws Exception {
        api.post("/publico/inscricoes/" + codigo, null, corpo, 202);
        return api.get("/inscricoes?situacao=TODAS", admin, 200).path("itens").get(0).path("id").asString();
    }

    private String inscrever(String nome) throws Exception {
        return inscrever(corpo(nome, "11987654321", null));
    }

    private JsonNode detalhe(String id) throws Exception {
        return api.get("/inscricoes/" + id, admin, 200);
    }

    private long versao(String id) throws Exception {
        return detalhe(id).path("versao").asLong();
    }

    private static List<String> tipos(JsonNode detalhe) {
        List<String> tipos = new ArrayList<>();
        detalhe.path("eventos").forEach(e -> tipos.add(e.path("tipo").asString()));
        return tipos;
    }

    private static Map<String, Object> mapa(Object... pares) {
        Map<String, Object> m = new HashMap<>();
        for (int k = 0; k < pares.length; k += 2) m.put((String) pares[k], pares[k + 1]);
        return m;
    }

    private static String hoje() {
        return LocalDate.now(Fuso.BRASILIA).toString();
    }

    // ---- formulário público ----

    @Test
    void qualificacaoEOrigemDoFormularioFicamGuardadasEOLinkInvalidoEIgnorado() throws Exception {
        Map<String, Object> completo = corpo("Pessoa Fictícia Qualificada", "11987654321", null);
        completo.put("interesse", "TREINO_E_DIETA");
        completo.put("modalidade", "ONLINE");
        completo.put("previsaoInicio", "ESTE_MES");
        completo.put("origem", "INDICACAO");
        completo.put("origemLink", "Campanha-Outubro");
        String id = inscrever(completo);
        JsonNode d = detalhe(id);
        assertThat(d.path("interesse").asString()).isEqualTo("TREINO_E_DIETA");
        assertThat(d.path("modalidadeDesejada").asString()).isEqualTo("ONLINE");
        assertThat(d.path("previsaoInicio").asString()).isEqualTo("ESTE_MES");
        assertThat(d.path("origemInformada").asString()).isEqualTo("INDICACAO");
        assertThat(d.path("origemLink").asString()).isEqualTo("campanha-outubro");
        // A respondida vale primeiro; o link fica guardado.
        assertThat(d.path("origem").asString()).isEqualTo("INDICACAO");
        assertThat(tipos(d)).containsExactly("CRIADA");
        assertThat(d.path("ciclo").asInt()).isEqualTo(1);

        Map<String, Object> soLink = corpo("Pessoa Fictícia Do Link", "11912345678", null);
        soLink.put("origemLink", "instagram");
        assertThat(detalhe(inscrever(soLink)).path("origem").asString()).isEqualTo("INSTAGRAM");

        Map<String, Object> invalido = corpo("Pessoa Fictícia Link Ruim", "11912340000", null);
        invalido.put("origemLink", "<script>");
        JsonNode semOrigem = detalhe(inscrever(invalido));
        assertThat(semOrigem.path("origemLink").isNull()).isTrue();
        assertThat(semOrigem.path("origem").isNull()).isTrue();

        // Valor fora da lista fechada: 400, nada gravado.
        Map<String, Object> ruim = corpo("Pessoa Fictícia Ruim", "11912341111", null);
        ruim.put("interesse", "QUALQUER");
        api.post("/publico/inscricoes/" + codigo, null, ruim, 400);
        assertThat(api.get("/inscricoes?situacao=TODAS", admin, 200).path("total").asLong()).isEqualTo(3);
    }

    // ---- etapas, encerrar e reabrir ----

    @Test
    void etapaEncerrarComMotivoEReabrirEmCicloNovo() throws Exception {
        String id = inscrever("Pessoa Fictícia Ciclo");
        long v = versao(id);
        JsonNode emContato = api.put("/inscricoes/" + id + "/etapa", admin, mapa("situacao", "EM_CONTATO", "versao", v), 200);
        assertThat(emContato.path("situacao").asString()).isEqualTo("EM_CONTATO");
        assertThat(api.put("/inscricoes/" + id + "/etapa", admin, mapa("situacao", "EM_NEGOCIACAO", "versao", v), 409)
                .path("codigo").asString()).isEqualTo("CONFLITO_EDICAO");
        v = emContato.path("versao").asLong();
        // Etapa e andamento não encerram nem aceitam.
        api.put("/inscricoes/" + id + "/etapa", admin, mapa("situacao", "RECUSADA", "versao", v), 400);
        api.put("/inscricoes/" + id + "/etapa", admin, mapa("situacao", "ACEITA", "versao", v), 400);
        api.put("/inscricoes/" + id, admin, mapa("situacao", "DESISTIU", "pagamento", "NAO_CONTROLADO", "versao", v), 400);
        // Encerrar sem motivo: 400.
        api.post("/inscricoes/" + id + "/encerrar", admin, mapa("situacao", "DESISTIU", "versao", v), 400);

        JsonNode encerrada = api.post("/inscricoes/" + id + "/encerrar", admin, mapa("situacao", "DESISTIU",
                "motivo", "MOMENTO", "detalhe", "Volta no ano que vem.", "versao", v), 200);
        assertThat(encerrada.path("situacao").asString()).isEqualTo("DESISTIU");
        assertThat(encerrada.path("motivoEncerramento").asString()).isEqualTo("MOMENTO");
        assertThat(encerrada.path("motivoDetalhe").asString()).isEqualTo("Volta no ano que vem.");
        assertThat(encerrada.path("encerradaPorNome").asString()).isEqualTo("Treinador Teste");
        v = encerrada.path("versao").asLong();
        assertThat(api.post("/inscricoes/" + id + "/encerrar", admin, mapa("situacao", "RECUSADA", "motivo", "PRECO",
                "versao", v), 409).path("codigo").asString()).isEqualTo("INSCRICAO_ENCERRADA");
        assertThat(api.put("/inscricoes/" + id + "/etapa", admin, mapa("situacao", "NOVA", "versao", v), 409)
                .path("codigo").asString()).isEqualTo("INSCRICAO_ENCERRADA");
        // Encerrada: pagamento e responsável continuam editáveis com a situação igual.
        JsonNode pagamento = api.put("/inscricoes/" + id, admin, mapa("situacao", "DESISTIU", "pagamento", "AGUARDANDO",
                "responsavelId", usuarioId(admin), "versao", v), 200);
        v = pagamento.path("versao").asLong();

        api.post("/inscricoes/" + id + "/reabrir", admin, mapa("motivo", " ", "versao", v), 400);
        JsonNode reaberta = api.post("/inscricoes/" + id + "/reabrir", admin, mapa("motivo", "Voltou a chamar.", "versao", v), 200);
        assertThat(reaberta.path("situacao").asString()).isEqualTo("EM_CONTATO");
        assertThat(reaberta.path("ciclo").asInt()).isEqualTo(2);
        assertThat(reaberta.path("motivoEncerramento").isNull()).isTrue();
        assertThat(reaberta.path("encerradaEm").isNull()).isTrue();
        // O encerramento anterior fica no histórico (eventos do mais novo ao mais antigo).
        List<String> tiposReaberta = tipos(reaberta);
        assertThat(tiposReaberta).containsExactlyInAnyOrder("REABERTA", "RESPONSAVEL", "PAGAMENTO", "ENCERRADA", "ETAPA", "CRIADA");
        assertThat(tiposReaberta.getFirst()).isEqualTo("REABERTA");
        assertThat(tiposReaberta.getLast()).isEqualTo("CRIADA");
        JsonNode evEncerrada = reaberta.path("eventos").get(tiposReaberta.indexOf("ENCERRADA"));
        assertThat(evEncerrada.path("motivo").asString()).isEqualTo("MOMENTO");
        assertThat(evEncerrada.path("ciclo").asInt()).isEqualTo(1);
        assertThat(reaberta.path("eventos").get(0).path("detalhe").asString()).isEqualTo("Voltou a chamar.");
        assertThat(reaberta.path("eventos").get(0).path("ciclo").asInt()).isEqualTo(2);
        assertThat(api.post("/inscricoes/" + id + "/reabrir", admin, mapa("motivo", "De novo.",
                "versao", reaberta.path("versao").asLong()), 409).path("codigo").asString()).isEqualTo("INSCRICAO_ABERTA");

        // Aceita não reabre nem encerra.
        JsonNode aceite = api.post("/inscricoes/" + id + "/aceitar", admin,
                mapa("convidar", false, "versao", reaberta.path("versao").asLong()), 200);
        long va = versao(id);
        assertThat(api.post("/inscricoes/" + id + "/reabrir", admin, mapa("motivo", "x", "versao", va), 409)
                .path("codigo").asString()).isEqualTo("INSCRICAO_JA_ACEITA");
        assertThat(api.put("/inscricoes/" + id + "/etapa", admin, mapa("situacao", "NOVA", "versao", va), 409)
                .path("codigo").asString()).isEqualTo("INSCRICAO_JA_ACEITA");
        JsonNode aceita = detalhe(id);
        assertThat(aceita.path("aceitaEm").isNull()).isFalse();
        assertThat(aceita.path("alunoId").asString()).isEqualTo(aceite.path("alunoId").asString());
        assertThat(tipos(aceita).getFirst()).isEqualTo("ACEITA");

        // Auditoria com resumos fixos, sem o texto da equipe nem o nome.
        List<String> resumos = banco.queryForList("select resumo from auditoria where consultoria_id = ? "
                + "and acao in ('INSCRICAO_ENCERRADA', 'INSCRICAO_REABERTA')", String.class, consultoriaDe(admin));
        assertThat(resumos).hasSize(2).allSatisfy(r -> assertThat(r).doesNotContain("Voltou", "ano que vem", "Fictícia"));

        // Outra consultoria: 404 em tudo.
        JsonNode outra = api.novoTreinador();
        api.put("/inscricoes/" + id + "/etapa", outra, mapa("situacao", "NOVA", "versao", va), 404);
        api.post("/inscricoes/" + id + "/encerrar", outra, mapa("situacao", "RECUSADA", "motivo", "PRECO", "versao", va), 404);
        api.post("/inscricoes/" + id + "/reabrir", outra, mapa("motivo", "x", "versao", va), 404);
    }

    // ---- proposta ----

    @Test
    void propostaManualEDoFinanceiroViramCopiaENaoMudamComOPlano() throws Exception {
        String id = inscrever("Pessoa Fictícia Proposta");
        long v = versao(id);
        api.put("/inscricoes/" + id + "/proposta", admin, mapa("valorCentavos", -1, "versao", v), 400);
        JsonNode manual = api.put("/inscricoes/" + id + "/proposta", admin, mapa("planoNome", "Plano Fictício",
                "modalidade", "ONLINE", "periodicidade", "MENSAL", "valorReferenciaCentavos", 30000,
                "valorCentavos", 25000, "condicoes", "Primeiro mês com desconto.", "versao", v), 200);
        assertThat(manual.path("proposta").path("planoNome").asString()).isEqualTo("Plano Fictício");
        assertThat(manual.path("proposta").path("valorCentavos").asLong()).isEqualTo(25000);
        assertThat(manual.path("proposta").path("atualizadaPorNome").asString()).isEqualTo("Treinador Teste");
        assertThat(manual.path("eventos").get(0).path("detalhe").asString()).isEqualTo("Plano Fictício · R$ 250,00 · Mensal");
        // A lista mostra o plano da proposta.
        assertThat(api.get("/inscricoes", admin, 200).path("itens").get(0).path("propostaPlanoNome").asString())
                .isEqualTo("Plano Fictício");

        // Plano do Financeiro: nome, periodicidade e referência saem dele (o corpo é ignorado nesses três).
        JsonNode plano = api.post("/financeiro/planos", admin, mapa("nome", "Trimestral " + UUID.randomUUID(),
                "valorCentavos", 90000, "periodicidade", "TRIMESTRAL"), 200);
        List<JsonNode> referencias = new ArrayList<>();
        api.get("/inscricoes/planos-de-referencia", admin, 200).forEach(referencias::add);
        assertThat(referencias).anySatisfy(p -> assertThat(p.path("id").asString()).isEqualTo(plano.path("id").asString()));
        JsonNode comPlano = api.put("/inscricoes/" + id + "/proposta", admin, mapa("planoId", plano.path("id").asString(),
                "planoNome", "Outro nome", "periodicidade", "MENSAL", "valorReferenciaCentavos", 1, "valorCentavos", 80000,
                "versao", manual.path("versao").asLong()), 200);
        assertThat(comPlano.path("proposta").path("planoNome").asString()).isEqualTo(plano.path("nome").asString());
        assertThat(comPlano.path("proposta").path("periodicidade").asString()).isEqualTo("TRIMESTRAL");
        assertThat(comPlano.path("proposta").path("valorReferenciaCentavos").asLong()).isEqualTo(90000);
        // Arquivar o plano não mexe na proposta já feita.
        api.post("/financeiro/planos/" + plano.path("id").asString() + "/arquivar", admin,
                mapa("versao", plano.path("versao").asLong()), 200);
        assertThat(detalhe(id).path("proposta").path("valorReferenciaCentavos").asLong()).isEqualTo(90000);
        // Plano de outra consultoria (ou arquivado): 404.
        api.put("/inscricoes/" + id + "/proposta", admin, mapa("planoId", plano.path("id").asString(),
                "versao", comPlano.path("versao").asLong()), 404);

        // Limpar: tudo nulo.
        JsonNode limpa = api.put("/inscricoes/" + id + "/proposta", admin, mapa("versao", comPlano.path("versao").asLong()), 200);
        assertThat(limpa.path("proposta").path("planoNome").isNull()).isTrue();
        assertThat(limpa.path("eventos").get(0).path("detalhe").asString()).isEqualTo("Proposta removida");

        // Depois do aceite não muda; a proposta não cria cobrança nem confirma pagamento.
        api.post("/inscricoes/" + id + "/aceitar", admin, mapa("convidar", false, "versao", limpa.path("versao").asLong()), 200);
        JsonNode aceita = detalhe(id);
        assertThat(aceita.path("pagamento").asString()).isEqualTo("NAO_CONTROLADO");
        api.put("/inscricoes/" + id + "/proposta", admin, mapa("valorCentavos", 1, "versao", aceita.path("versao").asLong()), 409);
        assertThat(banco.queryForObject("select count(*) from cobranca_aluno where consultoria_id = ?", Long.class,
                consultoriaDe(admin))).isZero();
    }

    // ---- retornos ----

    @Test
    void retornosMarcarReagendarConcluirSemSubirAVersaoDaInscricao() throws Exception {
        String id = inscrever("Pessoa Fictícia Retorno");
        long v = versao(id);
        String ontem = LocalDate.now(Fuso.BRASILIA).minusDays(1).toString();
        JsonNode marcado = api.post("/inscricoes/" + id + "/retornos", admin, mapa("descricao", "Ligar de novo",
                "data", ontem, "responsavelId", usuarioId(admin)), 200);
        assertThat(marcado.path("versao").asLong()).isEqualTo(v);
        assertThat(marcado.path("retornos")).hasSize(1);
        JsonNode retorno = marcado.path("retornos").get(0);
        assertThat(retorno.path("data").asString()).isEqualTo(ontem);
        assertThat(retorno.path("responsavelNome").asString()).isEqualTo("Treinador Teste");
        assertThat(tipos(marcado).getFirst()).isEqualTo("RETORNO_MARCADO");

        // Lista e contagens: atrasado (ontem).
        JsonNode pendentes = api.get("/inscricoes/retornos", admin, 200);
        assertThat(pendentes).hasSize(1);
        assertThat(pendentes.get(0).path("atrasado").asBoolean()).isTrue();
        assertThat(pendentes.get(0).path("inscricaoNome").asString()).isEqualTo("Pessoa Fictícia Retorno");
        assertThat(api.get("/inscricoes/retornos?meus=true", admin, 200)).hasSize(1);
        JsonNode contagens = api.get("/inscricoes/contagens", admin, 200);
        assertThat(contagens.path("retornosAtrasados").asLong()).isEqualTo(1);
        assertThat(contagens.path("retornosHoje").asLong()).isZero();
        assertThat(api.get("/inscricoes", admin, 200).path("itens").get(0).path("proximoRetorno").path("atrasado").asBoolean())
                .isTrue();

        // Reagendar para hoje (versão do retorno); versão velha = 409.
        String retornoId = retorno.path("id").asString();
        long vr = retorno.path("versao").asLong();
        JsonNode reagendado = api.put("/inscricoes/retornos/" + retornoId, admin, mapa("descricao", "Ligar à tarde",
                "data", hoje(), "responsavelId", usuarioId(admin), "versao", vr), 200);
        assertThat(api.put("/inscricoes/retornos/" + retornoId, admin, mapa("descricao", "x", "data", hoje(),
                "versao", vr), 409).path("codigo").asString()).isEqualTo("CONFLITO_EDICAO");
        assertThat(api.get("/inscricoes/contagens", admin, 200).path("retornosHoje").asLong()).isEqualTo(1);
        // Data absurda: 422.
        api.post("/inscricoes/" + id + "/retornos", admin, mapa("descricao", "Longe", "data", "2099-01-01"), 422);

        long vr2 = reagendado.path("retornos").get(0).path("versao").asLong();
        JsonNode concluido = api.post("/inscricoes/retornos/" + retornoId + "/concluir", admin, mapa("versao", vr2), 200);
        assertThat(concluido.path("retornos").get(0).path("concluidoEm").isNull()).isFalse();
        assertThat(concluido.path("retornos").get(0).path("concluidoPorNome").asString()).isEqualTo("Treinador Teste");
        // Concluir de novo não muda nada.
        api.post("/inscricoes/retornos/" + retornoId + "/concluir", admin, mapa("versao", vr2), 200);
        assertThat(api.get("/inscricoes/retornos", admin, 200)).isEmpty();
        assertThat(tipos(detalhe(id))).startsWith("RETORNO_CONCLUIDO", "RETORNO_ALTERADO", "RETORNO_MARCADO");
        assertThat(versao(id)).isEqualTo(v);

        // Outra consultoria: 404; encerrada não recebe retorno novo.
        JsonNode outra = api.novoTreinador();
        api.post("/inscricoes/" + id + "/retornos", outra, mapa("descricao", "x", "data", hoje()), 404);
        api.post("/inscricoes/retornos/" + retornoId + "/concluir", outra, mapa("versao", vr2), 404);
        assertThat(api.get("/inscricoes/retornos", outra, 200)).isEmpty();
        api.post("/inscricoes/" + id + "/encerrar", admin, mapa("situacao", "RECUSADA", "motivo", "SEM_RETORNO", "versao", v), 200);
        assertThat(api.post("/inscricoes/" + id + "/retornos", admin, mapa("descricao", "x", "data", hoje()), 409)
                .path("codigo").asString()).isEqualTo("INSCRICAO_ENCERRADA");
    }

    // ---- respostas prontas ----

    @Test
    void respostasProntasPadraoCrudEMensagemPreparadaSemOTexto() throws Exception {
        JsonNode modelos = api.get("/inscricoes/modelos-de-mensagem", admin, 200);
        List<String> nomes = new ArrayList<>();
        modelos.forEach(m -> nomes.add(m.path("nome").asString()));
        assertThat(nomes).containsExactly("Apresentação", "Planos", "Retomada", "Boas-vindas");
        assertThat(modelos.get(0).path("texto").asString()).contains("{primeiro_nome}", "{consultoria}");

        JsonNode novo = api.post("/inscricoes/modelos-de-mensagem", admin, mapa("nome", "Horários",
                "texto", "Oi, {primeiro_nome}! Atendemos de segunda a sábado.", "ordem", 5), 200);
        assertThat(api.post("/inscricoes/modelos-de-mensagem", admin, mapa("nome", "horários", "texto", "x", "ordem", 6), 409)
                .path("codigo").asString()).isEqualTo("MODELO_NOME_EM_USO");
        JsonNode alterado = api.put("/inscricoes/modelos-de-mensagem/" + novo.path("id").asString(), admin,
                mapa("nome", "Horários", "texto", "Novo texto fictício.", "ordem", 5, "versao", novo.path("versao").asLong()), 200);
        api.put("/inscricoes/modelos-de-mensagem/" + novo.path("id").asString(), admin,
                mapa("nome", "Horários", "texto", "x", "ordem", 5, "versao", novo.path("versao").asLong()), 409);
        api.delete("/inscricoes/modelos-de-mensagem/" + novo.path("id").asString() + "?versao="
                + alterado.path("versao").asLong(), admin, 204);
        assertThat(api.get("/inscricoes/modelos-de-mensagem", admin, 200)).hasSize(4);

        // Mensagem preparada: só o nome do modelo e a ação no histórico; a versão não sobe.
        String id = inscrever("Pessoa Fictícia Mensagem");
        long v = versao(id);
        api.post("/inscricoes/" + id + "/mensagens", admin, mapa("modeloId", modelos.get(0).path("id").asString(),
                "acao", "COPIADA"), 204);
        api.post("/inscricoes/" + id + "/mensagens", admin, mapa("acao", "WHATSAPP_ABERTO"), 204);
        JsonNode d = detalhe(id);
        assertThat(d.path("versao").asLong()).isEqualTo(v);
        assertThat(d.path("eventos").get(0).path("tipo").asString()).isEqualTo("MENSAGEM_PREPARADA");
        assertThat(d.path("eventos").get(0).path("para").asString()).isEqualTo("WHATSAPP_ABERTO");
        assertThat(d.path("eventos").get(0).path("detalhe").asString()).isEqualTo("Mensagem livre");
        assertThat(d.path("eventos").get(1).path("detalhe").asString()).isEqualTo("Apresentação");
        assertThat(d.path("eventos").get(1).path("para").asString()).isEqualTo("COPIADA");

        // Permissões e isolamento: a Nutricionista não vê; outra consultoria tem os próprios quatro.
        JsonNode outra = api.novoTreinador();
        api.post("/inscricoes/" + id + "/mensagens", outra, mapa("acao", "COPIADA"), 404);
        api.put("/inscricoes/modelos-de-mensagem/" + modelos.get(0).path("id").asString(), outra,
                mapa("nome", "x", "texto", "x", "ordem", 1, "versao", 0), 404);
        assertThat(api.get("/inscricoes/modelos-de-mensagem", outra, 200)).hasSize(4);
        perfil(admin, "Nutricionista");
        api.get("/inscricoes/modelos-de-mensagem", admin, 403);
        api.post("/inscricoes/" + id + "/mensagens", admin, mapa("acao", "COPIADA"), 403);
    }

    // ---- busca, filtros e contagens ----

    @Test
    void buscaSemAcentoPorContatoFiltrosEContagens() throws Exception {
        Map<String, Object> jose = corpo("José Ávila Fictício", "11987650001", "jose.ficticio@teste.local");
        jose.put("origem", "INSTAGRAM");
        String idJose = inscrever(jose);
        inscrever(corpo("Maria Fictícia", "11987650002", null));
        api.put("/inscricoes/" + idJose, admin, mapa("situacao", "EM_CONTATO", "pagamento", "NAO_CONTROLADO",
                "responsavelId", usuarioId(admin), "versao", versao(idJose)), 200);

        assertThat(api.get("/inscricoes?busca=jose avila", admin, 200).path("total").asLong()).isEqualTo(1);
        assertThat(api.get("/inscricoes?busca=JOSÉ", admin, 200).path("total").asLong()).isEqualTo(1);
        assertThat(api.get("/inscricoes?busca=0002", admin, 200).path("itens").get(0).path("nome").asString())
                .isEqualTo("Maria Fictícia");
        assertThat(api.get("/inscricoes?busca=(11) 98765-0001", admin, 200).path("total").asLong()).isEqualTo(1);
        assertThat(api.get("/inscricoes?busca=ficticio@teste", admin, 200).path("total").asLong()).isEqualTo(1);
        assertThat(api.get("/inscricoes?busca=100%", admin, 200).path("total").asLong()).isZero();
        assertThat(api.get("/inscricoes?responsavel=nenhum", admin, 200).path("itens").get(0).path("nome").asString())
                .isEqualTo("Maria Fictícia");
        assertThat(api.get("/inscricoes?responsavel=" + usuarioId(admin), admin, 200).path("total").asLong()).isEqualTo(1);
        assertThat(api.get("/inscricoes?origem=INSTAGRAM", admin, 200).path("total").asLong()).isEqualTo(1);
        assertThat(api.get("/inscricoes?origem=NAO_INFORMADA", admin, 200).path("total").asLong()).isEqualTo(1);
        api.get("/inscricoes?origem=TV", admin, 400);
        api.get("/inscricoes?responsavel=ninguem", admin, 400);

        JsonNode contagens = api.get("/inscricoes/contagens", admin, 200);
        assertThat(contagens.path("porSituacao").path("NOVA").asLong()).isEqualTo(1);
        assertThat(contagens.path("porSituacao").path("EM_CONTATO").asLong()).isEqualTo(1);
        assertThat(contagens.path("porSituacao").path("ACEITA").asLong()).isZero();
        assertThat(contagens.path("abertas").asLong()).isEqualTo(2);
        assertThat(contagens.path("todas").asLong()).isEqualTo(2);
        assertThat(api.get("/inscricoes/contagens?meus=true", admin, 200).path("abertas").asLong()).isEqualTo(1);
        assertThat(api.get("/inscricoes/contagens?busca=maria", admin, 200).path("porSituacao").path("NOVA").asLong())
                .isEqualTo(1);
        // Outra consultoria não conta nada daqui.
        assertThat(api.get("/inscricoes/contagens", api.novoTreinador(), 200).path("todas").asLong()).isZero();
    }

    // ---- mesma pessoa ----

    @Test
    void duplicidadeContaAnterioresESemelhantesERelacionarSemJuntar() throws Exception {
        String antiga = inscrever(corpo("Pessoa Fictícia Antiga", "11987650003", "mesma@teste.local"));
        api.post("/inscricoes/" + antiga + "/encerrar", admin, mapa("situacao", "DESISTIU", "motivo", "PRECO",
                "versao", versao(antiga)), 200);
        String nova = inscrever(corpo("Pessoa Fictícia Nova", "11987650003", null));

        JsonNode d = detalhe(nova);
        assertThat(d.path("duplicidade").path("outrasInscricoesAbertas").asInt()).isZero();
        assertThat(d.path("duplicidade").path("outrasInscricoesAnteriores").asInt()).isEqualTo(1);

        JsonNode semelhantes = api.get("/inscricoes/" + nova + "/semelhantes", admin, 200);
        assertThat(semelhantes.path("inscricoes")).hasSize(1);
        JsonNode s = semelhantes.path("inscricoes").get(0);
        assertThat(s.path("id").asString()).isEqualTo(antiga);
        assertThat(s.path("situacao").asString()).isEqualTo("DESISTIU");
        assertThat(s.path("coincide").get(0).asString()).isEqualTo("WHATSAPP");
        assertThat(s.path("relacionada").asBoolean()).isFalse();
        assertThat(semelhantes.path("aluno").isNull()).isTrue();

        long v = versao(nova);
        api.put("/inscricoes/" + nova + "/relacao", admin, mapa("outraId", nova, "versao", v), 400);
        api.put("/inscricoes/" + nova + "/relacao", admin, mapa("outraId", UUID.randomUUID().toString(), "versao", v), 404);
        JsonNode relacionada = api.put("/inscricoes/" + nova + "/relacao", admin, mapa("outraId", antiga, "versao", v), 200);
        assertThat(relacionada.path("relacionadaA").path("id").asString()).isEqualTo(antiga);
        assertThat(relacionada.path("relacionadaA").path("nome").asString()).isEqualTo("Pessoa Fictícia Antiga");
        assertThat(api.get("/inscricoes/" + nova + "/semelhantes", admin, 200).path("inscricoes").get(0)
                .path("relacionada").asBoolean()).isTrue();
        // Sem círculo: a antiga não aponta de volta.
        assertThat(api.put("/inscricoes/" + antiga + "/relacao", admin, mapa("outraId", nova, "versao", versao(antiga)), 409)
                .path("codigo").asString()).isEqualTo("INSCRICAO_JA_RELACIONADA");
        // Nada foi juntado nem apagado.
        assertThat(api.get("/inscricoes?situacao=TODAS", admin, 200).path("total").asLong()).isEqualTo(2);

        JsonNode desfeita = api.delete("/inscricoes/" + nova + "/relacao?versao=" + relacionada.path("versao").asLong(), admin, 200);
        assertThat(desfeita.path("relacionadaA").isNull()).isTrue();
        assertThat(tipos(desfeita)).startsWith("RELACAO_DESFEITA", "RELACIONADA");

        JsonNode outra = api.novoTreinador();
        api.get("/inscricoes/" + nova + "/semelhantes", outra, 404);
        api.put("/inscricoes/" + nova + "/relacao", outra, mapa("outraId", antiga, "versao", 0), 404);
    }

    // ---- indicadores ----

    @Test
    void indicadoresDoPeriodoContamEntradasAceitesMotivosEOrigem() throws Exception {
        Map<String, Object> a = corpo("Pessoa Fictícia A", "11987651001", null);
        a.put("origem", "INSTAGRAM");
        String idA = inscrever(a);
        String idB = inscrever(corpo("Pessoa Fictícia B", "11987651002", null));
        String idC = inscrever(corpo("Pessoa Fictícia C", "11987651001", null));
        api.post("/inscricoes/" + idA + "/aceitar", admin, mapa("convidar", false, "versao", versao(idA)), 200);
        api.post("/inscricoes/" + idB + "/encerrar", admin, mapa("situacao", "RECUSADA", "motivo", "PRECO",
                "versao", versao(idB)), 200);
        api.post("/inscricoes/" + idB + "/reabrir", admin, mapa("motivo", "Voltou.", "versao", versao(idB)), 200);
        api.post("/inscricoes/" + idC + "/encerrar", admin, mapa("situacao", "DESISTIU", "motivo", "MOMENTO",
                "versao", versao(idC)), 200);

        String de = LocalDate.now(Fuso.BRASILIA).minusDays(1).toString();
        JsonNode ind = api.get("/inscricoes/indicadores?de=" + de + "&ate=" + hoje(), admin, 200);
        assertThat(ind.path("entradas").asLong()).isEqualTo(3);
        assertThat(ind.path("pessoas").asLong()).isEqualTo(2);
        assertThat(ind.path("aceites").asLong()).isEqualTo(1);
        assertThat(ind.path("aceitesDasEntradas").asLong()).isEqualTo(1);
        assertThat(ind.path("conversao").asDouble()).isBetween(0.33, 0.34);
        assertThat(ind.path("recusadas").asLong()).isEqualTo(1);
        assertThat(ind.path("desistencias").asLong()).isEqualTo(1);
        assertThat(ind.path("reaberturas").asLong()).isEqualTo(1);
        assertThat(ind.path("diasAteAceite").path("mediana").isNull()).isFalse();
        List<String> motivos = new ArrayList<>();
        ind.path("porMotivo").forEach(m -> motivos.add(m.path("motivo").asString() + "=" + m.path("quantidade").asLong()));
        assertThat(motivos).containsExactlyInAnyOrder("PRECO=1", "MOMENTO=1");
        JsonNode instagram = null;
        for (JsonNode o : ind.path("porOrigem")) if ("INSTAGRAM".equals(o.path("origem").asString())) instagram = o;
        assertThat(instagram).isNotNull();
        assertThat(instagram.path("entradas").asLong()).isEqualTo(1);
        assertThat(instagram.path("aceites").asLong()).isEqualTo(1);

        // Período sem nada: zeros e nulos (nunca zero inventado na conversão nem nos dias).
        JsonNode vazio = api.get("/inscricoes/indicadores?de=2020-01-01&ate=2020-01-31", admin, 200);
        assertThat(vazio.path("entradas").asLong()).isZero();
        assertThat(vazio.path("conversao").isNull()).isTrue();
        assertThat(vazio.path("diasAteAceite").path("media").isNull()).isTrue();
        // Período inválido: 400.
        assertThat(api.get("/inscricoes/indicadores?de=2025-01-01&ate=2026-06-01", admin, 400).path("codigo").asString())
                .isEqualTo("PERIODO_INVALIDO");
        api.get("/inscricoes/indicadores?de=" + hoje() + "&ate=" + de, admin, 400);
        // Outra consultoria: zeros.
        assertThat(api.get("/inscricoes/indicadores?de=" + de + "&ate=" + hoje(), api.novoTreinador(), 200)
                .path("entradas").asLong()).isZero();
        perfil(admin, "Nutricionista");
        api.get("/inscricoes/indicadores", admin, 403);
    }

    // ---- privacidade ----

    @Test
    void exportacaoLevaQualificacaoEPropostaEAnonimizarApagaHistoricoERetornos() throws Exception {
        Map<String, Object> c = corpo("Aluna Fictícia CRM", "11987652001", "crm-" + UUID.randomUUID() + "@teste.local");
        c.put("interesse", "TREINO");
        c.put("origem", "GOOGLE");
        String id = inscrever(c);
        long v = api.put("/inscricoes/" + id + "/proposta", admin, mapa("planoNome", "Plano Fictício",
                "valorCentavos", 20000, "versao", versao(id)), 200).path("versao").asLong();
        api.post("/inscricoes/" + id + "/retornos", admin, mapa("descricao", "Retorno fictício", "data", hoje()), 200);
        String alunoId = api.post("/inscricoes/" + id + "/aceitar", admin, mapa("convidar", false, "versao", v), 200)
                .path("alunoId").asString();

        JsonNode item = api.get("/alunos/" + alunoId + "/exportacao", admin, 200).path("inscricao").path("itens").get(0);
        assertThat(item.path("interesse").asString()).isEqualTo("TREINO");
        assertThat(item.path("origemInformada").asString()).isEqualTo("GOOGLE");
        assertThat(item.path("proposta").path("planoNome").asString()).isEqualTo("Plano Fictício");
        assertThat(item.path("proposta").path("valorCentavos").asLong()).isEqualTo(20000);

        // Anonimizar o aluno apaga a inscrição, e com ela eventos e retornos.
        api.patch("/alunos/" + alunoId + "/situacao", admin, Map.of("ativo", false), 200);
        api.post("/alunos/" + alunoId + "/anonimizar", admin, Map.of("nomeConfirmado", "Aluna Fictícia CRM"), 200);
        UUID consultoria = consultoriaDe(admin);
        assertThat(banco.queryForObject("select count(*) from inscricao_evento where consultoria_id = ?", Long.class,
                consultoria)).isZero();
        assertThat(banco.queryForObject("select count(*) from inscricao_retorno where consultoria_id = ?", Long.class,
                consultoria)).isZero();
    }
}
