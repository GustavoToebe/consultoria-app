package br.com.treinos.api.importacao.assistida.ia;

import br.com.treinos.api.dieta.ConteudoDieta;
import br.com.treinos.api.treino.ConteudoTreino;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Trecho comum aos conectores externos: texto que pode sair do servidor e decodificação da proposta devolvida.
 * Valor ausente continua ausente: peso sem data ou sem número é descartado, nunca preenchido (AGENTS.md: não
 * inventar valor). E-mail e telefone não vêm da IA: a identificação é local.
 */
final class DecodificadorDaProposta {

    private DecodificadorDaProposta() {
    }

    /**
     * Formato pedido aos dois provedores. É um formato simples, convertido aqui para o do plano: sem ele a IA
     * inventava a estrutura e nada decodificava (25/11/2026: 16 alunos vazios num PDF de um aluno só).
     */
    static final String FORMATO_DA_RESPOSTA = """
            Formato da resposta (JSON):
            {"grupos": [{"nomeAluno": texto ou null, "objetivo": texto ou null, "observacoes": texto ou null,
              "pesos": [{"data": "AAAA-MM-DD", "kg": número}],
              "treino": {"sessoes": [{"nome": texto, "diaSemana": 1 (segunda) a 7 (domingo) ou null,
                "exercicios": [{"nome": texto como está no documento,
                  "observacao": técnica, carga, cadência ou outra nota, ou null,
                  "series": [{"quantidade": quantas séries iguais, "tipo": o CODIGO da metodologia ou null,
                    "repsMin": número ou null, "repsMax": número ou null, "descansoSegundos": número ou null}]}]}]} ou null,
              "dieta": {"refeicoes": [{"nome": texto, "horario": "HH:MM" ou null,
                "opcoes": [{"itens": [{"nome": texto, "quantidade": número ou null, "unidade": "g", "ml", "un" ou outra curta}]}]}],
                "suplementos": [{"nome": texto, "dose": texto ou null, "horario": texto ou null, "observacao": texto ou null}],
                "medicacoes": [{"nome": texto, "principioAtivo": texto ou null, "concentracao": texto ou null,
                  "dose": texto ou null, "horario": texto ou null, "observacao": texto ou null}]} ou null}]}
            Um item de "grupos" por ALUNO, nunca por sessão, refeição ou página: um documento de um aluno só gera um item.
            Todas as sessões e refeições do mesmo aluno ficam dentro do mesmo item.
            "suplementos": whey, creatina, vitaminas e similares. "medicacoes": remédios, hormônios, anabolizantes,
            ergogênicos e qualquer outra substância com dose (ex.: "Testosterona enantato 250 mg/sem").
            Copie como está escrito, sem opinar nem calcular nada sobre saúde.
            Não invente: o que não estiver escrito fica null.
            """;

    // shortcut: corta em 1500 nomes por lista, trocar por busca dos nomes mais próximos do texto se a biblioteca passar disso.
    private static final int MAXIMO_DE_NOMES_DA_BIBLIOTECA = 1500;

    /**
     * Trecho de prompt comum aos conectores: metodologia (para o campo "tipo" da série) e nomes da biblioteca.
     * Nomes de exercício e alimento não são dado pessoal.
     */
    static String trechoDeMetodologiaEBiblioteca(ContextoIa contexto) {
        List<String> metodos = contexto.metodosConsultoria() == null ? List.of() : contexto.metodosConsultoria();
        StringBuilder sb = new StringBuilder();
        sb.append("Metodologia da consultoria (CODIGO = Nome (papel)): ")
                .append(metodos.isEmpty() ? "nenhuma informada" : String.join("; ", metodos)).append(".\n")
                .append("No campo \"tipo\" de cada série use o CODIGO de uma dessas linhas, ou null se não der para saber.\n");
        sb.append(listaDeNomes("Exercícios", contexto.exerciciosDaBiblioteca(),
                "exercício", "Quando o exercício do documento for o mesmo de um nome da lista"));
        sb.append(listaDeNomes("Alimentos", contexto.alimentosDaBiblioteca(),
                "alimento", "Quando o alimento do documento for o mesmo de um nome da lista"));
        return sb.toString();
    }

    private static String listaDeNomes(String titulo, List<String> nomes, String coisa, String quando) {
        if (nomes == null || nomes.isEmpty()) {
            return "";
        }
        return titulo + " da biblioteca da consultoria (um por linha):\n"
                + String.join("\n", nomes.size() > MAXIMO_DE_NOMES_DA_BIBLIOTECA
                        ? nomes.subList(0, MAXIMO_DE_NOMES_DA_BIBLIOTECA) : nomes) + "\n"
                + quando + ", use exatamente o nome da lista; se não houver, mantenha o nome do documento. "
                + "Nunca escolha um nome parecido que seja outro " + coisa + ".\n";
    }

    /** O provedor parou por limite de tokens: o JSON viria cortado, então o roteador cai nas regras com motivo próprio. */
    static final class RespostaCortada extends IllegalStateException {
        RespostaCortada(String provedor) {
            super("Resposta do " + provedor + " cortada por limite de tokens.");
        }
    }

    /** Único texto do aluno que um conector pode enviar: o extraído, sem nome de arquivo nem PDF. */
    static String textoParaEnvio(ContextoIa contexto) {
        String texto = contexto.textoParaProvedor();
        if (texto == null || texto.isBlank()) {
            throw new IllegalStateException("Sem texto para enviar.");
        }
        return texto;
    }

    static String formatarApelidos(Map<String, String> apelidos) {
        if (apelidos == null || apelidos.isEmpty()) {
            return "Nenhum";
        }
        StringBuilder sb = new StringBuilder();
        apelidos.forEach((k, v) -> sb.append("- '").append(k).append("' -> '").append(v).append("'\n"));
        return sb.toString();
    }

    static ResultadoInterpretacao decodificar(JsonMapper json, JsonNode root, ContextoIa contexto) {
        List<ResultadoInterpretacao.PropostaGrupo> grupos = new ArrayList<>();

        JsonNode gruposNode = root.path("grupos");
        if (gruposNode.isArray()) {
            for (JsonNode g : gruposNode) {
                String nome = texto(g, "nomeAluno");
                List<ResultadoInterpretacao.PropostaPeso> pesos = pesos(g.path("pesos"));
                ConteudoTreino treino = treino(g.path("treino"));
                ConteudoDieta dieta = dieta(g.path("dieta"));
                boolean temTreino = treino != null && treino.sessoes() != null && !treino.sessoes().isEmpty();
                boolean temDieta = dieta != null; // dieta() já devolve nulo sem refeição, suplemento nem medicação
                if (nome == null && pesos.isEmpty() && !temTreino && !temDieta) {
                    continue; // item que não decodificou em nada viraria "Aluno sem identificação" vazio
                }
                grupos.add(new ResultadoInterpretacao.PropostaGrupo(
                        contexto.nomeArquivo(), nome == null ? "Aluno sem identificação" : nome, null, null,
                        texto(g, "objetivo"), texto(g, "observacoes"), pesos,
                        temTreino ? treino : null, temDieta ? dieta : null));
            }
        }
        if (grupos.isEmpty()) {
            // O roteador trata a falha como erro do provedor e cai na leitura por regras.
            throw new IllegalStateException("Resposta da IA sem nenhum aluno aproveitável.");
        }

        // Dúvidas não vêm da IA: o roteador as calcula contra a biblioteca, com as ocorrências que a tela corrige.
        return new ResultadoInterpretacao(List.copyOf(grupos), List.of());
    }

    private static String texto(JsonNode no, String campo) {
        JsonNode v = no.path(campo);
        if (v.isMissingNode() || v.isNull()) {
            return null;
        }
        String t = v.asText().strip();
        return t.isEmpty() ? null : t;
    }

    private static List<ResultadoInterpretacao.PropostaPeso> pesos(JsonNode pesosNode) {
        List<ResultadoInterpretacao.PropostaPeso> pesos = new ArrayList<>();
        if (!pesosNode.isArray()) {
            return pesos;
        }
        for (JsonNode p : pesosNode) {
            String data = texto(p, "data");
            String kg = texto(p, "kg");
            if (data == null || kg == null) {
                continue; // sem data ou sem número: não vira peso
            }
            try {
                BigDecimal valor = new BigDecimal(kg.replace(',', '.'));
                pesos.add(new ResultadoInterpretacao.PropostaPeso(LocalDate.parse(data), valor, null));
            } catch (RuntimeException e) {
                // peso mal formatado é descartado
            }
        }
        return pesos;
    }

    private static ConteudoTreino treino(JsonNode no) {
        List<ConteudoTreino.Sessao> sessoes = new ArrayList<>();
        for (JsonNode s : lista(no.path("sessoes"), 20)) {
            List<ConteudoTreino.ExercicioPlano> exercicios = new ArrayList<>();
            for (JsonNode e : lista(s.path("exercicios"), 40)) {
                String nome = texto(e, "nome", 120);
                if (nome == null) {
                    continue;
                }
                List<ConteudoTreino.Serie> series = new ArrayList<>();
                for (JsonNode sr : lista(e.path("series"), 30)) {
                    Integer min = inteiro(sr, "repsMin", 1, 500);
                    Integer max = inteiro(sr, "repsMax", 1, 500);
                    if (min == null || max == null || max < min) {
                        // repsMin e repsMax andam juntos: um só (ou os dois trocados) vale como repetições exatas
                        Integer unico = min != null ? min : max;
                        min = unico;
                        max = unico;
                    }
                    Integer quantidade = inteiro(sr, "quantidade", 1, 30);
                    for (int k = 0; k < (quantidade == null ? 1 : quantidade) && series.size() < 30; k++) {
                        series.add(new ConteudoTreino.Serie(UUID.randomUUID(), texto(sr, "tipo", 30), min, max, null,
                                null, null, inteiro(sr, "descansoSegundos", 0, 3600), null, null, null));
                    }
                }
                exercicios.add(new ConteudoTreino.ExercicioPlano(UUID.randomUUID(), null, nome, null, null,
                        texto(e, "observacao", 1000), true, "kg", List.copyOf(series)));
            }
            if (!exercicios.isEmpty()) {
                sessoes.add(new ConteudoTreino.Sessao(UUID.randomUUID(), texto(s, "nome", 80),
                        inteiro(s, "diaSemana", 1, 7), null, null, null, null, List.copyOf(exercicios)));
            }
        }
        return sessoes.isEmpty() ? null : new ConteudoTreino(null, null, List.copyOf(sessoes));
    }

    private static ConteudoDieta dieta(JsonNode no) {
        List<ConteudoDieta.Refeicao> refeicoes = new ArrayList<>();
        for (JsonNode r : lista(no.path("refeicoes"), 20)) {
            // Itens direto na refeição também valem: é como a IA responde quando não há opções.
            List<JsonNode> opcoesNo = r.path("opcoes").isArray() ? lista(r.path("opcoes"), 6) : List.of(r);
            List<ConteudoDieta.Opcao> opcoes = new ArrayList<>();
            for (JsonNode o : opcoesNo) {
                List<ConteudoDieta.Item> itens = new ArrayList<>();
                for (JsonNode it : lista(o.path("itens"), 40)) {
                    String nome = texto(it, "nome", 160);
                    if (nome != null) {
                        itens.add(new ConteudoDieta.Item(UUID.randomUUID(), null, nome, decimal(it, "quantidade"),
                                unidade(texto(it, "unidade")), null, null, null, null, true));
                    }
                }
                if (!itens.isEmpty()) {
                    opcoes.add(new ConteudoDieta.Opcao(UUID.randomUUID(), String.valueOf((char) ('A' + opcoes.size())),
                            List.copyOf(itens)));
                }
            }
            String horario = texto(r, "horario", 5);
            if (!opcoes.isEmpty()) {
                refeicoes.add(new ConteudoDieta.Refeicao(UUID.randomUUID(), texto(r, "nome", 80),
                        horario != null && HORARIO.matcher(horario).matches() ? horario : null, null,
                        List.copyOf(opcoes)));
            }
        }
        List<ConteudoDieta.Suplemento> suplementos = new ArrayList<>();
        for (JsonNode s : lista(no.path("suplementos"), 40)) {
            String nome = texto(s, "nome", 120);
            if (nome != null) {
                suplementos.add(new ConteudoDieta.Suplemento(UUID.randomUUID(), nome, texto(s, "dose", 120),
                        texto(s, "horario", 120), texto(s, "observacao", 500), null, null));
            }
        }
        List<ConteudoDieta.Ergogenico> medicacoes = new ArrayList<>();
        for (JsonNode m : lista(no.path("medicacoes"), 40)) {
            String nome = texto(m, "nome", 120);
            if (nome != null) {
                medicacoes.add(new ConteudoDieta.Ergogenico(UUID.randomUUID(), nome, texto(m, "principioAtivo", 160),
                        texto(m, "concentracao", 40), texto(m, "dose", 120), texto(m, "horario", 120),
                        texto(m, "observacao", 500), null));
            }
        }
        // Só medicação ou suplemento também vale: o PDF pode trazer o protocolo sem refeição.
        return refeicoes.isEmpty() && suplementos.isEmpty() && medicacoes.isEmpty() ? null
                : new ConteudoDieta(null, null, null, List.copyOf(refeicoes), List.of(), null,
                        List.copyOf(suplementos), List.copyOf(medicacoes));
    }

    /** Formas longas comuns viram a sigla; outra acima de 5 letras fica nula (cortar gravaria "colhe", não inventamos). */
    private static String unidade(String u) {
        if (u == null) {
            return null;
        }
        String chave = u.toLowerCase(java.util.Locale.ROOT);
        return switch (chave) {
            case "grama", "gramas", "gr" -> "g";
            case "mililitro", "mililitros" -> "ml";
            case "unidade", "unidades", "und" -> "un";
            case "quilo", "quilos" -> "kg";
            default -> chave.length() <= 5 ? u : null;
        };
    }

    private static final java.util.regex.Pattern HORARIO = java.util.regex.Pattern.compile("([01]\\d|2[0-3]):[0-5]\\d");

    private static List<JsonNode> lista(JsonNode no, int teto) {
        List<JsonNode> itens = new ArrayList<>();
        if (no.isArray()) {
            for (JsonNode n : no) {
                if (itens.size() == teto) {
                    break;
                }
                if (n.isObject()) {
                    itens.add(n);
                }
            }
        }
        return itens;
    }

    /** Texto limpo e cortado no tamanho do campo do plano; vazio vira nulo. */
    private static String texto(JsonNode no, String campo, int maximo) {
        String t = texto(no, campo);
        return t == null || t.length() <= maximo ? t : t.substring(0, maximo).strip();
    }

    private static Integer inteiro(JsonNode no, String campo, int min, int max) {
        BigDecimal v = decimal(no, campo);
        if (v == null || v.stripTrailingZeros().scale() > 0 || v.compareTo(BigDecimal.valueOf(max)) > 0) {
            return null;
        }
        int i = v.intValue();
        return i >= min ? i : null;
    }

    private static BigDecimal decimal(JsonNode no, String campo) {
        String t = texto(no, campo);
        if (t == null) {
            return null;
        }
        try {
            BigDecimal v = new BigDecimal(t.replace(',', '.'));
            return v.signum() < 0 || v.compareTo(BigDecimal.valueOf(100000)) > 0 ? null : v;
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
