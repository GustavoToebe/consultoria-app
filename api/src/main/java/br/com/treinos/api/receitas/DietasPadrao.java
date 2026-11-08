package br.com.treinos.api.receitas;

import br.com.treinos.api.dieta.ConteudoDieta;
import br.com.treinos.api.dieta.ConteudoDieta.Item;
import br.com.treinos.api.web.Buscas;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * As 11 dietas padrão (M-T6). O JSON guarda quantidade e unidade, com kcal e macros nulos.
 * {@link #comAlimentoIds} preenche os quatro do item resolvido com a mesma conta de {@code recalcularItem}
 * no app: valor do alimento vezes a quantidade, convertendo g/un por {@code gramasPorUnidade}.
 * Sem peso por unidade (ovo em {@code un}) ou item manual, o valor continua nulo. Nada é estimado.
 */
public final class DietasPadrao {

    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final List<String> ARQUIVOS = List.of(
            "dieta-1-emagrecimento-1800.json",
            "dieta-2-manutencao-2200.json",
            "dieta-3-ganho-massa-3000.json",
            "dieta-4-emagrecimento-1500.json",
            "dieta-5-emagrecimento-1600.json",
            "dieta-6-emagrecimento-2000.json",
            "dieta-7-manutencao-2400.json",
            "dieta-8-manutencao-2600.json",
            "dieta-9-ganho-massa-2800.json",
            "dieta-10-ganho-massa-3200.json",
            "dieta-11-ganho-massa-3500.json");

    private static final List<Modelo> MODELOS = ler();

    private DietasPadrao() {
    }

    public record Modelo(String nome, String descricao, ConteudoDieta conteudo) {
    }

    public static List<Modelo> modelos() {
        return MODELOS;
    }

    /** Receitas que uma consultoria nova passa a ter: as de {@link ReceitasPadrao} mais estas dietas. */
    public static int totalNaConsultoriaNova() {
        return ReceitasPadrao.todas().size() + MODELOS.size();
    }

    /** Nomes sem acento dos itens que não são manuais. O Whey entra aqui; pão, chia, frutas e legumes não. */
    public static Set<String> buscasParaResolver() {
        Set<String> buscas = new LinkedHashSet<>();
        for (Modelo modelo : MODELOS) {
            cadaItem(modelo.conteudo(), item -> {
                if (!manual(item) && item.nome() != null && !item.nome().isBlank()) {
                    buscas.add(Buscas.semAcento(item.nome()));
                }
            });
        }
        return buscas;
    }

    /**
     * Números do alimento já gravado (catálogo copiado ou o que o treinador tem). A conta não estima o que falta.
     */
    public record Nutrientes(UUID id, BigDecimal baseQuantidade, String baseUnidade, BigDecimal kcal,
                             BigDecimal proteina, BigDecimal carboidrato, BigDecimal gordura,
                             BigDecimal gramasPorUnidade) {
    }

    /**
     * Copia o conteúdo, aponta o {@code alimentoId} e preenche kcal e macros na proporção da quantidade.
     * A mesma conta de {@code recalcularItem}: sem conversão ou item manual, os quatro continuam nulos.
     */
    public static ConteudoDieta comAlimentoIds(ConteudoDieta conteudo, Map<String, Nutrientes> porBusca) {
        return conteudo.comItens(item -> {
            if (manual(item) || item.nome() == null) {
                return item;
            }
            Nutrientes alimento = porBusca.get(Buscas.semAcento(item.nome()));
            if (alimento == null) {
                return item;
            }
            return new Item(item.uid(), alimento.id(), item.nome(), item.quantidade(), item.unidade(),
                    valorNaQuantidade(alimento.kcal(), alimento, item),
                    valorNaQuantidade(alimento.proteina(), alimento, item),
                    valorNaQuantidade(alimento.carboidrato(), alimento, item),
                    valorNaQuantidade(alimento.gordura(), alimento, item),
                    item.manual(), item.fatorCorrecao(), item.fatorCoccao(), item.grupo());
        });
    }

    /**
     * Valor do alimento na quantidade do item, arredondado em 3 casas como {@code Math.round(n * 1000) / 1000}.
     * {@code null} se o alimento não tem o valor, a base é zero ou a unidade não converte.
     */
    static BigDecimal valorNaQuantidade(BigDecimal valorDoAlimento, Nutrientes alimento, Item item) {
        Double naBase = quantidadeNaBase(alimento, item.quantidade(), item.unidade());
        if (naBase == null || alimento.baseQuantidade() == null || alimento.baseQuantidade().signum() == 0
                || valorDoAlimento == null) {
            return null;
        }
        double fator = naBase / alimento.baseQuantidade().doubleValue();
        return BigDecimal.valueOf(Math.round(valorDoAlimento.doubleValue() * fator * 1000.0) / 1000.0);
    }

    /** Quantidade na unidade-base. {@code null} sem como converter (ovo em {@code un} sem gramas por unidade). */
    private static Double quantidadeNaBase(Nutrientes alimento, BigDecimal quantidade, String unidade) {
        if (quantidade == null || quantidade.signum() <= 0) {
            return null;
        }
        if (unidade != null && unidade.equals(alimento.baseUnidade())) {
            return quantidade.doubleValue();
        }
        if (alimento.gramasPorUnidade() == null || alimento.gramasPorUnidade().signum() == 0) {
            return null;
        }
        double porUnidade = alimento.gramasPorUnidade().doubleValue();
        if ("un".equals(unidade) && "g".equals(alimento.baseUnidade())) {
            return quantidade.doubleValue() * porUnidade;
        }
        if ("g".equals(unidade) && "un".equals(alimento.baseUnidade())) {
            return quantidade.doubleValue() / porUnidade;
        }
        return null;
    }

    public static boolean manual(Item item) {
        return Boolean.TRUE.equals(item.manual());
    }

    public static void cadaItem(ConteudoDieta conteudo, java.util.function.Consumer<Item> acao) {
        for (ConteudoDieta.Refeicao refeicao : conteudo.refeicoesOuVazio()) {
            for (ConteudoDieta.Opcao opcao : refeicao.opcoesOuVazio()) {
                for (Item item : opcao.itensOuVazio()) {
                    acao.accept(item);
                }
            }
        }
    }

    private static List<Modelo> ler() {
        List<Modelo> modelos = new ArrayList<>();
        for (String arquivo : ARQUIVOS) {
            String caminho = "receitas-padrao/dietas/" + arquivo;
            try (InputStream in = DietasPadrao.class.getClassLoader().getResourceAsStream(caminho)) {
                if (in == null) {
                    throw new IllegalStateException("Dieta padrão ausente: " + caminho);
                }
                JsonNode raiz = JSON.readTree(in);
                JsonNode lista = raiz.get("modelos");
                if (lista == null || lista.size() != 1) {
                    throw new IllegalStateException("Dieta padrão sem um modelo: " + arquivo);
                }
                JsonNode modelo = lista.get(0);
                String nome = modelo.path("nome").asString("").strip();
                if (nome.isEmpty() || nome.length() > 120) {
                    throw new IllegalStateException("Nome de dieta padrão inválido: " + arquivo);
                }
                String descricao = modelo.path("descricao").asString(null);
                if (descricao != null && descricao.length() > 400) {
                    throw new IllegalStateException("Descrição de dieta padrão longa demais: " + arquivo);
                }
                ConteudoDieta conteudo = JSON.treeToValue(modelo.get("conteudo"), ConteudoDieta.class);
                modelos.add(new Modelo(nome, descricao, conteudo));
            } catch (IOException e) {
                throw new IllegalStateException("Não foi possível ler " + arquivo, e);
            }
        }
        return List.copyOf(modelos);
    }
}
