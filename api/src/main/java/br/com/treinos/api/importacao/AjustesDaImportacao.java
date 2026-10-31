package br.com.treinos.api.importacao;

import br.com.treinos.api.web.ValidacaoException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import tools.jackson.databind.JsonNode;

/**
 * Correções feitas na tabela do assistente antes de validar (pedido do Gustavo em 30/10, como na referência: "ajuste os
 * valores diretamente na tabela e valide novamente"): o texto novo de algumas células e as linhas tiradas. Chegam
 * junto da configuração na prévia e na confirmação, só em memória: o servidor relê o arquivo, aplica os ajustes e só
 * então valida ou grava, e o hash da prévia cobre os ajustes, então a confirmação grava exatamente o que foi validado.
 * Nunca são guardados nem vão para log (a importação guarda só a extensão, os números e a configuração sem ajustes).
 *
 * <p>Linha = número da linha no arquivo (o mesmo das mensagens de erro); coluna = índice a partir de 0.
 */
record AjustesDaImportacao(Map<Integer, Map<Integer, String>> celulas, Set<Integer> removidas) {

    static final int CELULAS_MAXIMO = 2_000;
    static final int REMOVIDAS_MAXIMO = 2_000;
    /** O mesmo teto de texto de célula do leitor. */
    static final int TEXTO_MAXIMO = 4_000;
    private static final int COLUNAS_MAXIMO = 256;

    static final AjustesDaImportacao NENHUM = new AjustesDaImportacao(Map.of(), Set.of());

    boolean vazio() {
        return celulas.isEmpty() && removidas.isEmpty();
    }

    /** Lê `ajustes` da configuração; ausente ou nulo = nenhum. Recusa sem repetir valor nenhum. */
    static AjustesDaImportacao ler(JsonNode configuracao) {
        JsonNode no = configuracao == null ? null : configuracao.path("ajustes");
        if (no == null || no.isMissingNode() || no.isNull()) {
            return NENHUM;
        }
        if (!no.isObject()) {
            throw invalido();
        }
        Map<Integer, Map<Integer, String>> celulas = new TreeMap<>();
        JsonNode lista = no.path("celulas");
        if (!lista.isMissingNode() && !lista.isNull()) {
            if (!lista.isArray() || lista.size() > CELULAS_MAXIMO) {
                throw invalido();
            }
            for (JsonNode c : lista) {
                JsonNode valor = c.path("valor");
                if (!c.path("linha").isIntegralNumber() || !c.path("coluna").isIntegralNumber() || !valor.isString()) {
                    throw invalido();
                }
                int linha = c.path("linha").asInt();
                int coluna = c.path("coluna").asInt();
                String texto = valor.asString();
                if (linha < 1 || coluna < 0 || coluna >= COLUNAS_MAXIMO || texto.length() > TEXTO_MAXIMO) {
                    throw invalido();
                }
                if (celulas.computeIfAbsent(linha, l -> new TreeMap<>()).put(coluna, texto) != null) {
                    throw invalido();
                }
            }
        }
        Set<Integer> removidas = new TreeSet<>();
        JsonNode tiradas = no.path("removidas");
        if (!tiradas.isMissingNode() && !tiradas.isNull()) {
            if (!tiradas.isArray() || tiradas.size() > REMOVIDAS_MAXIMO) {
                throw invalido();
            }
            for (JsonNode l : tiradas) {
                if (!l.isIntegralNumber() || l.asInt() < 1 || !removidas.add(l.asInt())) {
                    throw invalido();
                }
            }
        }
        return new AjustesDaImportacao(celulas, removidas);
    }

    /**
     * A planilha com os ajustes: linha removida some, célula ajustada troca de texto (vira texto, nunca número nativo).
     * Ajuste numa linha que não é de dados (o cabeçalho, as de cima dele ou fora do arquivo) recusa a importação inteira.
     */
    LeitorDePlanilha.Planilha aplicar(LeitorDePlanilha.Planilha planilha, int linhaDoCabecalho) {
        if (vazio()) {
            return planilha;
        }
        int primeira = ConfiguracaoDaImportacao.primeiraDeDados(planilha, linhaDoCabecalho);
        Set<Integer> deDados = new TreeSet<>();
        for (int i = primeira; i < planilha.linhas().size(); i++) {
            deDados.add(planilha.linhas().get(i).numero());
        }
        if (!deDados.containsAll(removidas) || !deDados.containsAll(celulas.keySet())) {
            throw new ValidacaoException("Um ajuste aponta para uma linha que não está na planilha.", "ARQUIVO_INVALIDO", List.of());
        }
        List<LeitorDePlanilha.Linha> linhas = new ArrayList<>(planilha.linhas().size());
        for (int i = 0; i < planilha.linhas().size(); i++) {
            LeitorDePlanilha.Linha linha = planilha.linhas().get(i);
            if (i < primeira) {
                linhas.add(linha);
                continue;
            }
            if (removidas.contains(linha.numero())) {
                continue;
            }
            Map<Integer, String> novas = celulas.get(linha.numero());
            if (novas == null) {
                linhas.add(linha);
                continue;
            }
            int largura = Math.max(linha.celulas().size(), ((TreeMap<Integer, String>) novas).lastKey() + 1);
            List<LeitorDePlanilha.Celula> celulasDaLinha = new ArrayList<>(largura);
            for (int c = 0; c < largura; c++) {
                String texto = novas.get(c);
                if (texto != null) {
                    celulasDaLinha.add(LeitorDePlanilha.Celula.deTextoLido(texto));
                } else {
                    celulasDaLinha.add(c < linha.celulas().size() ? linha.celulas().get(c) : LeitorDePlanilha.Celula.vazia());
                }
            }
            linhas.add(new LeitorDePlanilha.Linha(linha.numero(), celulasDaLinha));
        }
        return new LeitorDePlanilha.Planilha(planilha.abas(), planilha.aba(), linhas, planilha.data1904());
    }

    /** Forma canônica para o hash da prévia: cada texto com o tamanho na frente, para dois ajustes nunca se confundirem. */
    String canonico() {
        StringBuilder s = new StringBuilder();
        celulas.forEach((linha, colunas) -> colunas.forEach((coluna, texto) ->
                s.append("c ").append(linha).append(':').append(coluna).append(' ').append(texto.length()).append(':')
                        .append(texto).append('\n')));
        removidas.forEach(l -> s.append("r ").append(l).append('\n'));
        return s.toString();
    }

    private static ValidacaoException invalido() {
        return new ValidacaoException("Os ajustes da tabela são inválidos.", "ARQUIVO_INVALIDO", List.of());
    }
}
