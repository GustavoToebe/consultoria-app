package br.com.treinos.api.avaliacoes;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Contratos HTTP da avaliação física. As medidas são circunferências em cm (todas opcionais, ao menos uma); a validação
 * mora no serviço ({@link ValidacaoDaAvaliacao}) para responder 422 {@code AVALIACAO_INVALIDA} com o campo certo, em vez
 * do 400 genérico da Bean Validation.
 */
public final class AvaliacaoFisicaDtos {

    private AvaliacaoFisicaDtos() { }

    /** Circunferências em cm, uma casa decimal. Nulo = não medido (nunca zero). Espelho em {@code dominio/avaliacaoFisica.ts}. */
    public record Medidas(BigDecimal bracoDireito, BigDecimal bracoEsquerdo, BigDecimal peitoral, BigDecimal cintura,
                          BigDecimal abdomen, BigDecimal quadril, BigDecimal coxaDireita, BigDecimal coxaEsquerda,
                          BigDecimal panturrilhaDireita, BigDecimal panturrilhaEsquerda) {

        public static final Medidas VAZIAS = new Medidas(null, null, null, null, null, null, null, null, null, null);

        /** Na ordem da tela; a chave é o nome do campo no JSON (o {@code field} do erro é {@code medidas.<chave>}). */
        public Map<String, BigDecimal> porCampo() {
            Map<String, BigDecimal> m = new LinkedHashMap<>();
            m.put("bracoDireito", bracoDireito);
            m.put("bracoEsquerdo", bracoEsquerdo);
            m.put("peitoral", peitoral);
            m.put("cintura", cintura);
            m.put("abdomen", abdomen);
            m.put("quadril", quadril);
            m.put("coxaDireita", coxaDireita);
            m.put("coxaEsquerda", coxaEsquerda);
            m.put("panturrilhaDireita", panturrilhaDireita);
            m.put("panturrilhaEsquerda", panturrilhaEsquerda);
            return m;
        }

        static Medidas de(Map<String, BigDecimal> m) {
            return new Medidas(m.get("bracoDireito"), m.get("bracoEsquerdo"), m.get("peitoral"), m.get("cintura"),
                    m.get("abdomen"), m.get("quadril"), m.get("coxaDireita"), m.get("coxaEsquerda"),
                    m.get("panturrilhaDireita"), m.get("panturrilhaEsquerda"));
        }
    }

    /** {@code versao} só vale no PUT (lock otimista; ausente ou diferente = 409 {@code CONFLITO_EDICAO}). */
    public record AvaliacaoRequest(LocalDate data, Medidas medidas, String observacao, Long versao) { }

    /**
     * {@code pesoKg} é o registro de peso da mesma data, quando existe (o peso não é guardado de novo na avaliação);
     * nulo = sem peso naquela data.
     */
    public record AvaliacaoResponse(UUID id, LocalDate data, Medidas medidas, String observacao, BigDecimal pesoKg,
                                    Long versao, Instant criadoEm, Instant alteradoEm) {
        static AvaliacaoResponse de(AvaliacaoFisica a, BigDecimal pesoKg) {
            return new AvaliacaoResponse(a.getId(), a.getData(), a.medidas(), a.getObservacao(), pesoKg, a.getVersao(),
                    a.getCriadoEm(), a.getAlteradoEm());
        }
    }
}
