package br.com.treinos.api.atencao;

import tools.jackson.databind.JsonNode;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Aplica as regras do treinador às respostas de um envio e devolve só fatos ({@code tipo}, {@code perguntaId},
 * {@code limiteVigente}, {@code valorObservado}), nunca juízo nem texto. Pura (sem banco, rede nem relógio) e <b>total</b>: resposta
 * malformada, antiga, de tipo trocado ou pergunta que não existe na versão é ignorada; nunca lança.
 *
 * <p>Operador inclusivo (C4), o mesmo do app: NOTA_ABAIXO {@code nota ≤ limite}; NOTA_CAIU {@code anterior − atual ≥ limite}
 * (guarda {@code atual − anterior}, negativo); PESO_MUDOU {@code |atual − anterior| ≥ limite} (guarda o Δ com sinal);
 * POUCOS_TREINOS {@code dias ≤ limite}. A "anterior" é a de {@code app/src/dominio/mudancasDaAtualizacao.ts} (quem chama a
 * escolhe) e a pergunta dela só vale com o mesmo id e o mesmo tipo.
 */
public final class AvaliadorDeAtencao {

    /** Uma regra vigente no envio. {@code perguntaId} só nos modelos de pergunta; {@code limite} só nos de número. */
    public record Regra(TipoDeRegra tipo, String perguntaId, BigDecimal limite) { }

    /** O fato gravado e devolvido ao treinador. {@code valorObservado} nulo no SIM e no ITEM_MARCADO. */
    public record Fato(String tipo, String perguntaId, BigDecimal limiteVigente, BigDecimal valorObservado) {
        /** Dado derivado de saúde: nada de valor no texto. */
        @Override
        public String toString() {
            return "Fato[" + tipo + "]";
        }
    }

    /** A atualização anterior (conteúdo da versão que ela respondeu e as respostas); nula na primeira. */
    public record Anterior(JsonNode conteudo, JsonNode respostas) { }

    /** Acima disso o número não cabe na coluna ({@code numeric(8,1)}) e não é resposta válida de nada: ignora. */
    private static final BigDecimal TETO = BigDecimal.valueOf(1_000_000);

    private AvaliadorDeAtencao() {
    }

    /**
     * @param conteudo conteúdo da versão respondida agora
     * @param respostas respostas já validadas do envio
     * @param anterior a atualização anterior, ou nula
     * @param diasComTreino dias com treino no período do envio, ou nulo (sem POUCOS_TREINOS ninguém precisa dele)
     */
    public static List<Fato> avaliar(JsonNode conteudo, JsonNode respostas, Anterior anterior, Long diasComTreino,
            List<Regra> regras) {
        Map<String, Fato> fatos = new LinkedHashMap<>();
        if (regras == null) {
            return List.of();
        }
        Map<String, String> tipos = tipos(conteudo);
        Map<String, String> tiposAntes = anterior == null ? Map.of() : tipos(anterior.conteudo());
        for (Regra r : regras) {
            try {
                for (Fato f : avaliar(r, tipos, respostas, tiposAntes, anterior, diasComTreino)) {
                    fatos.putIfAbsent(f.tipo() + "|" + f.perguntaId(), f);
                }
            } catch (RuntimeException naoEntendida) {
                // Total: regra ou resposta que não se entende não vira fato nem derruba o envio.
                continue;
            }
        }
        return List.copyOf(fatos.values());
    }

    private static List<Fato> avaliar(Regra r, Map<String, String> tipos, JsonNode respostas, Map<String, String> tiposAntes,
            Anterior anterior, Long dias) {
        if (r == null || r.tipo() == null || (r.tipo().temLimite() && r.limite() == null)) {
            return List.of();
        }
        TipoDeRegra tipo = r.tipo();
        BigDecimal limite = r.limite();
        List<Fato> saida = new ArrayList<>();
        switch (tipo) {
            case NOTA_ABAIXO -> {
                BigDecimal nota = tipos.get(r.perguntaId()) != null && "NOTA".equals(tipos.get(r.perguntaId()))
                        ? numero(resposta(respostas, r.perguntaId())) : null;
                if (nota != null && nota.compareTo(limite) <= 0) {
                    saida.add(new Fato(tipo.name(), r.perguntaId(), limite, nota));
                }
            }
            case SIM -> {
                JsonNode v = resposta(respostas, r.perguntaId());
                if ("SIM_NAO".equals(tipos.get(r.perguntaId())) && v.isBoolean() && v.booleanValue()) {
                    saida.add(new Fato(tipo.name(), r.perguntaId(), null, null));
                }
            }
            case ITEM_MARCADO -> {
                JsonNode v = resposta(respostas, r.perguntaId());
                if ("ITENS_DO_PLANO".equals(tipos.get(r.perguntaId())) && v.isArray() && v.size() > 0) {
                    saida.add(new Fato(tipo.name(), r.perguntaId(), null, null));
                }
            }
            case NOTA_CAIU, PESO_MUDOU -> {
                if (anterior == null) {
                    return List.of();
                }
                String tipoDaPergunta = tipo == TipoDeRegra.NOTA_CAIU ? "NOTA" : "PESO";
                for (var e : tipos.entrySet()) {
                    if (!tipoDaPergunta.equals(e.getValue()) || !tipoDaPergunta.equals(tiposAntes.get(e.getKey()))) {
                        continue;
                    }
                    BigDecimal agora = numero(resposta(respostas, e.getKey()));
                    BigDecimal antes = numero(resposta(anterior.respostas(), e.getKey()));
                    if (agora == null || antes == null) {
                        continue;
                    }
                    BigDecimal delta = agora.subtract(antes);
                    boolean bateu = tipo == TipoDeRegra.NOTA_CAIU ? delta.negate().compareTo(limite) >= 0
                            : delta.abs().compareTo(limite) >= 0;
                    if (bateu) {
                        saida.add(new Fato(tipo.name(), e.getKey(), limite, delta));
                    }
                }
            }
            case POUCOS_TREINOS -> {
                if (dias != null && BigDecimal.valueOf(dias).compareTo(limite) <= 0) {
                    saida.add(new Fato(tipo.name(), null, limite, BigDecimal.valueOf(dias)));
                }
            }
        }
        return saida;
    }

    /** Id → tipo das perguntas, na ordem do questionário (o primeiro id vence, como no app). */
    private static Map<String, String> tipos(JsonNode conteudo) {
        Map<String, String> tipos = new LinkedHashMap<>();
        if (conteudo == null) {
            return tipos;
        }
        for (JsonNode secao : conteudo.path("secoes")) {
            for (JsonNode p : secao.path("perguntas")) {
                if (p.path("id").isString() && p.path("tipo").isString()) {
                    tipos.putIfAbsent(p.path("id").stringValue(), p.path("tipo").stringValue());
                }
            }
        }
        return tipos;
    }

    private static JsonNode resposta(JsonNode respostas, String id) {
        return respostas == null || id == null ? tools.jackson.databind.node.MissingNode.getInstance() : respostas.path(id);
    }

    /** Número finito e de tamanho plausível; o resto (texto, booleano, NaN) não é número. */
    private static BigDecimal numero(JsonNode v) {
        if (v == null || !v.isNumber() || (v.isFloatingPointNumber() && !Double.isFinite(v.doubleValue()))) {
            return null;
        }
        BigDecimal n = v.decimalValue();
        return n.abs().compareTo(TETO) >= 0 ? null : n;
    }
}
