package br.com.treinos.api.pagamentos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Cobrança AVULSA na exportação CSV por período (o que faltava junto do link individual, do link em lote e das selecionadas, já
 * cobertos em {@link CobrancaAvulsaBaixaECancelamentoIntegrationTest} e {@link LoteDeCobrancasIntegrationTest}): a avulsa, que não
 * tem contratação nem plano, entra no arquivo com a descrição do treinador (escapada) e o valor. Dados fictícios.
 */
@AutoConfigureMockMvc
class AvulsaEmLinkECsvIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;

    private final LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
    private ApiDeTeste api;
    private JsonNode admin;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
    }

    private String csv(JsonNode quem, LocalDate de, LocalDate ate) throws Exception {
        var resposta = mvc.perform(MockMvcRequestBuilders.get("/financeiro/exportacao?de=" + de + "&ate=" + ate)
                .header("X-Treinos-Cliente", "nativo").header("Authorization", ApiDeTeste.bearer(quem))).andReturn().getResponse();
        assertThat(resposta.getStatus()).isEqualTo(200);
        return resposta.getContentAsString(StandardCharsets.UTF_8);
    }

    @Test
    void exportacaoPorPeriodoLevaAAvulsaSemContratacaoComDescricaoEValor() throws Exception {
        String nome = "Aluno Avulsa Csv " + UUID.randomUUID();
        UUID aluno = api.criarAluno(admin, nome);
        api.post("/financeiro/cobrancas-avulsas", admin, Map.of("pedidoId", UUID.randomUUID().toString(), "alunoIds", List.of(aluno.toString()),
                "descricao", "=Camiseta; do time", "valorCentavos", 4_567, "primeiroVencimento", hoje.plusDays(2).toString(),
                "parcelas", 2), 201);
        JsonNode outro = api.novoTreinador();
        UUID alunoDeFora = api.criarAluno(outro, "Aluno De Fora Csv " + UUID.randomUUID());
        api.post("/financeiro/cobrancas-avulsas", outro, Map.of("pedidoId", UUID.randomUUID().toString(), "alunoIds", List.of(alunoDeFora.toString()),
                "descricao", "Segredo de outra consultoria", "valorCentavos", 999, "primeiroVencimento", hoje.plusDays(2).toString(),
                "parcelas", 1), 201);

        String arquivo = csv(admin, hoje, hoje.plusDays(3));

        String[] linhas = arquivo.split("\r\n");
        assertThat(linhas[0]).startsWith("﻿registro;data;descricao;aluno;situacao;forma;pago_em;tipo;categoria;valor;");
        assertThat(linhas).as("cabeçalho e a parcela 1 (a 2 vence só no mês seguinte)").hasSize(2);
        assertThat(linhas[1]).contains("COBRANCA").contains(hoje.plusDays(2).toString())
                .contains("\"'=Camiseta; do time (Parcela 1/2)\"").contains(nome).contains("ABERTA").contains(";45,67;");
        assertThat(arquivo).doesNotContain("Segredo de outra consultoria");

        String mesSeguinte = csv(admin, hoje.plusDays(2).plusMonths(1), hoje.plusDays(2).plusMonths(1));
        assertThat(mesSeguinte).contains("(Parcela 2/2)");
    }
}
