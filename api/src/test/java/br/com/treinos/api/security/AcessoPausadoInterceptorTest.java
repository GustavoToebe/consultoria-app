package br.com.treinos.api.security;

import br.com.treinos.api.contratos.ContratosProperties;
import br.com.treinos.api.contratos.TravaPorContrato;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** A lista fechada do aluno pausado falha fechada: método, caminho e grafia exatos; qualquer variação é barrada. */
class AcessoPausadoInterceptorTest {

    private static final String COBRANCA = "/aluno/financeiro/cobrancas/" + UUID.randomUUID();

    @Test
    void liberaSoAsRotasDaListaComOMetodoCerto() {
        assertThat(AcessoPausadoInterceptor.permitido("GET", "/eu")).isTrue();
        assertThat(AcessoPausadoInterceptor.permitido("GET", "/aluno/financeiro")).isTrue();
        assertThat(AcessoPausadoInterceptor.permitido("PUT", "/eu/senha")).isTrue();
        assertThat(AcessoPausadoInterceptor.permitido("DELETE", "/aluno/push-token")).isTrue();
        assertThat(AcessoPausadoInterceptor.permitido("POST", "/termos/aceite")).isTrue();
        assertThat(AcessoPausadoInterceptor.permitido("POST", COBRANCA + "/link")).isTrue();
        assertThat(AcessoPausadoInterceptor.permitido("POST", "/aluno/financeiro/cobrancas/"
                + UUID.randomUUID().toString().toUpperCase(java.util.Locale.ROOT) + "/pix")).isTrue();
    }

    private static final String CONTRATO = "/aluno/contratos/" + UUID.randomUUID();

    /** As quatro rotas de envio da fila offline: só a trava do contrato as libera (D19). */
    private static final String[][] FILA = {
            {"POST", "/aluno/execucoes/lote"}, {"POST", "/aluno/mobilidade/registros"},
            {"POST", "/aluno/agua"}, {"POST", "/aluno/sessoes-concluidas"}};

    /** Amostra das rotas reais do aluno (controllers) que nenhuma das duas listas pode liberar. */
    private static final String[] FORA_DAS_DUAS_LISTAS = {
            "GET /aluno/painel", "GET /aluno/dieta", "GET /aluno/mobilidade", "GET /aluno/pastas", "GET /aluno/pastas/" + UUID.randomUUID(),
            "GET /aluno/execucoes", "GET /aluno/progresso", "GET /aluno/pesos",
            "GET /aluno/mobilidade/registros", "GET /aluno/agua", "GET /aluno/sessoes-concluidas",
            "PUT /aluno/execucoes/lote", "DELETE /aluno/agua", "PUT /aluno/agua", "GET /aluno/execucoes/lote",
            "GET /aluno/exercicios/demonstracoes", "GET /aluno/exercicios/" + UUID.randomUUID() + "/imagem",
            "GET /aluno/anamnese", "POST /aluno/anamnese/" + UUID.randomUUID() + "/enviar", "GET /aluno/atualizacao", "GET /aluno/atualizacoes",
            "POST /aluno/atualizacao/enviar", "POST /aluno/atualizacao/atraso", "GET /aluno/avaliacoes-fisicas",
            "GET /aluno/avisos-de-compromisso", "POST /aluno/avisos-de-compromisso/" + UUID.randomUUID() + "/visto", "GET /aluno/compromissos",
            "GET /aluno/avisos-pelo-whatsapp", "PUT /aluno/avisos-pelo-whatsapp",
            "GET /aluno/ciclo", "POST /aluno/ciclo/ativar", "POST /aluno/ciclo/registros", "PUT /aluno/ciclo/configuracao",
            "GET /aluno/fotos/linha-do-tempo", "GET /aluno/foto-perfil", "PUT /aluno/foto-perfil", "DELETE /aluno/foto-perfil", "POST /aluno/fotos",
            "GET /aluno/indicacao", "GET /aluno/vitrine", "GET /aluno/uso-de-imagem", "PUT /aluno/uso-de-imagem",
            "GET /aluno/lembretes-de-cobranca", "PUT /aluno/lembretes-de-cobranca", "PUT /aluno/push-token", "PUT /aluno/meus-dados",
            "GET /aluno/comunidade/mural", "POST /aluno/comunidade/mural", "GET /aluno/comunidade/perfil", "GET /aluno/comunidade/ranking",
            "GET /aluno/financeiro/cobrancas", "POST /aluno/financeiro/cobrancas/" + UUID.randomUUID() + "/baixa",
            "GET /alunos", "GET /alunos/" + UUID.randomUUID() + "/contratos", "POST /alunos/" + UUID.randomUUID() + "/contratos",
            "POST /contratos/" + UUID.randomUUID() + "/cancelar", "GET /consultoria", "GET /consultoria/contratos",
            // Variações das rotas liberadas: outro método, grafia, sufixo ou id que não é UUID.
            "POST /aluno/contratos", "PUT /aluno/contratos/" + UUID.randomUUID(), "DELETE /aluno/contratos/" + UUID.randomUUID(),
            "POST /aluno/contratos/" + UUID.randomUUID(), "GET /aluno/contratos/" + UUID.randomUUID() + "/assinar",
            "POST /aluno/contratos/" + UUID.randomUUID() + "/arquivo", "GET /aluno/contratos/" + UUID.randomUUID() + "/arquivo/",
            "GET /aluno/contratos/", "GET /Aluno/contratos", "GET /aluno/contratos/123", "GET /aluno/contratos/123/arquivo",
            "POST /aluno/contratos/123/assinar", "POST /aluno/contratos/" + UUID.randomUUID() + "/assinar/",
            "GET /aluno/contratos/" + UUID.randomUUID() + "/outro", "GET /aluno/contratos/../painel", "GET /aluno/contratos;x=1",
            "GET /aluno/contratos/" + UUID.randomUUID() + "/arquivo;x=1", "POST /aluno/contratos/" + UUID.randomUUID() + "/assinar;x=1"};

    private static String metodo(String rota) {
        return rota.substring(0, rota.indexOf(' '));
    }

    private static String caminho(String rota) {
        return rota.substring(rota.indexOf(' ') + 1);
    }

    @Test
    void asQuatroRotasDeContratoPassamNasDuasListas() {
        assertThat(AcessoPausadoInterceptor.permitido("GET", "/aluno/contratos")).isTrue();
        assertThat(AcessoPausadoInterceptor.permitido("GET", CONTRATO)).isTrue();
        assertThat(AcessoPausadoInterceptor.permitido("GET", CONTRATO + "/arquivo")).isTrue();
        assertThat(AcessoPausadoInterceptor.permitido("POST", CONTRATO + "/assinar")).isTrue();
        assertThat(AcessoPausadoInterceptor.permitido("GET", CONTRATO.toUpperCase(java.util.Locale.ROOT).replace("/ALUNO/CONTRATOS/", "/aluno/contratos/"))).isTrue();

        assertThat(AcessoPausadoInterceptor.permitidoComContratoVencido("GET", "/aluno/contratos")).isTrue();
        assertThat(AcessoPausadoInterceptor.permitidoComContratoVencido("GET", CONTRATO)).isTrue();
        assertThat(AcessoPausadoInterceptor.permitidoComContratoVencido("GET", CONTRATO + "/arquivo")).isTrue();
        assertThat(AcessoPausadoInterceptor.permitidoComContratoVencido("POST", CONTRATO + "/assinar")).isTrue();
    }

    @Test
    void aListaDoContratoVencidoTemTudoDoAtrasoMaisAFilaDeEnvioSoEmPost() {
        // Tudo que o ATRASO libera o contrato também libera.
        assertThat(AcessoPausadoInterceptor.permitidoComContratoVencido("GET", "/eu")).isTrue();
        assertThat(AcessoPausadoInterceptor.permitidoComContratoVencido("GET", "/aluno/financeiro")).isTrue();
        assertThat(AcessoPausadoInterceptor.permitidoComContratoVencido("PUT", "/eu/senha")).isTrue();
        assertThat(AcessoPausadoInterceptor.permitidoComContratoVencido("DELETE", "/aluno/push-token")).isTrue();
        assertThat(AcessoPausadoInterceptor.permitidoComContratoVencido("POST", COBRANCA + "/pix")).isTrue();
        assertThat(AcessoPausadoInterceptor.permitidoComContratoVencido("POST", "/aluno/conta/excluir")).isTrue();

        // A fila só passa na do contrato: o ATRASO continua barrando (a pausa por atraso e o offline são pendência separada).
        for (String[] rota : FILA) {
            assertThat(AcessoPausadoInterceptor.permitidoComContratoVencido(rota[0], rota[1])).as(rota[1]).isTrue();
            assertThat(AcessoPausadoInterceptor.permitido(rota[0], rota[1])).as("atraso " + rota[1]).isFalse();
            for (String outro : new String[]{"GET", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS", "post"}) {
                assertThat(AcessoPausadoInterceptor.permitidoComContratoVencido(outro, rota[1])).as(outro + " " + rota[1]).isFalse();
            }
            for (String variacao : new String[]{rota[1] + "/", rota[1].toUpperCase(java.util.Locale.ROOT), rota[1] + ";x=1", rota[1] + "/x"}) {
                assertThat(AcessoPausadoInterceptor.permitidoComContratoVencido("POST", variacao)).as(variacao).isFalse();
            }
        }
    }

    @Test
    void nenhumaRotaForaDasListasPassaEmNenhumaDasDuasTravas() {
        for (String rota : FORA_DAS_DUAS_LISTAS) {
            assertThat(AcessoPausadoInterceptor.permitido(metodo(rota), caminho(rota))).as("atraso " + rota).isFalse();
            assertThat(AcessoPausadoInterceptor.permitidoComContratoVencido(metodo(rota), caminho(rota))).as("contrato " + rota).isFalse();
        }
    }

    @Test
    void comAChaveDesligadaATravaNemConsultaOBanco() {
        TravaPorContrato trava = new TravaPorContrato(new ContratosProperties(false), (aluno, situacao, agora) -> {
            throw new AssertionError("consultou o banco com a chave desligada");
        });

        assertThat(trava.contratoPendenteVencido(UUID.randomUUID(), UUID.randomUUID())).isFalse();
    }

    @Test
    void erroNaConsultaDaTravaSobeComo5xxEnuncaLibera() {
        TravaPorContrato trava = new TravaPorContrato(new ContratosProperties(true), (aluno, situacao, agora) -> {
            throw new DataAccessResourceFailureException("banco fora do ar");
        });
        // O repositório do ATRASO nem é tocado: a trava do contrato vem antes e falha primeiro.
        AcessoPausadoInterceptor interceptor = new AcessoPausadoInterceptor(null, trava);
        var sessao = new UsuarioAutenticado(UUID.randomUUID(), UUID.randomUUID(), "ALUNO", UUID.randomUUID());
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(sessao, null, List.of()));
        try {
            assertThatThrownBy(() -> interceptor.preHandle(new MockHttpServletRequest("GET", "/aluno/painel"), new MockHttpServletResponse(), new Object()))
                    .isInstanceOf(DataAccessResourceFailureException.class);
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    @Test
    void overtrainingPayLiberaPixFaturaESituacaoMasNaoCartao() {
        assertThat(AcessoPausadoInterceptor.permitido("POST", COBRANCA + "/overtraining-pay/pix")).isTrue();
        assertThat(AcessoPausadoInterceptor.permitido("POST", COBRANCA + "/overtraining-pay/fatura")).isTrue();
        assertThat(AcessoPausadoInterceptor.permitido("GET", COBRANCA + "/situacao")).isTrue();
        assertThat(AcessoPausadoInterceptor.permitido("POST", COBRANCA + "/overtraining-pay/cartao")).isFalse();
        assertThat(AcessoPausadoInterceptor.permitido("GET", COBRANCA + "/overtraining-pay/fatura")).isFalse();
        assertThat(AcessoPausadoInterceptor.permitido("POST", COBRANCA + "/overtraining-pay/fatura/")).isFalse();
        assertThat(AcessoPausadoInterceptor.permitido("POST", "/aluno/financeiro/cobrancas/123/overtraining-pay/fatura"))
                .isFalse();
        assertThat(AcessoPausadoInterceptor.permitido("POST", COBRANCA + "/overtraining-pay/pix/x")).isFalse();
    }

    @Test
    void outroMetodoNoCaminhoLiberadoEBarrado() {
        assertThat(AcessoPausadoInterceptor.permitido("HEAD", "/eu")).isFalse();
        assertThat(AcessoPausadoInterceptor.permitido("OPTIONS", "/eu")).isFalse();
        assertThat(AcessoPausadoInterceptor.permitido("PUT", "/eu")).isFalse();
        assertThat(AcessoPausadoInterceptor.permitido("POST", "/eu")).isFalse();
        assertThat(AcessoPausadoInterceptor.permitido("PATCH", "/eu/senha")).isFalse();
        assertThat(AcessoPausadoInterceptor.permitido("POST", "/aluno/meus-dados")).isFalse();
        assertThat(AcessoPausadoInterceptor.permitido("GET", COBRANCA + "/link")).isFalse();
        assertThat(AcessoPausadoInterceptor.permitido("get", "/eu")).isFalse();
    }

    @Test
    void grafiaDiferenteEBarrada() {
        assertThat(AcessoPausadoInterceptor.permitido("GET", "/eu/")).isFalse();
        assertThat(AcessoPausadoInterceptor.permitido("GET", "/EU")).isFalse();
        assertThat(AcessoPausadoInterceptor.permitido("GET", "/Aluno/financeiro")).isFalse();
        assertThat(AcessoPausadoInterceptor.permitido("GET", "/eu;x=1")).isFalse();
        assertThat(AcessoPausadoInterceptor.permitido("GET", "/aluno/financeiro/../painel")).isFalse();
        assertThat(AcessoPausadoInterceptor.permitido("POST", COBRANCA + "/link/")).isFalse();
        assertThat(AcessoPausadoInterceptor.permitido("POST", "/aluno/financeiro/cobrancas/123/link")).isFalse();
        assertThat(AcessoPausadoInterceptor.permitido("POST", COBRANCA + "/baixa")).isFalse();
        assertThat(AcessoPausadoInterceptor.permitido("GET", "/aluno/painel")).isFalse();
        assertThat(AcessoPausadoInterceptor.permitido("GET", "")).isFalse();
    }
}
