package br.com.treinos.api.contratos;

import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Os campos que um modelo de contrato pode usar (D9, lista fechada), escritos entre chaves: {@code {aluno_nome}}. Regra pura, sem
 * banco: o serviço do modelo recusa o campo desconhecido ao salvar e o de preenchimento troca cada campo pelo valor do aluno. Só vale
 * como campo o que tem a forma {@code {letras, números e _}}; chaves com outro conteúdo ficam como texto.
 */
public final class CamposDoContrato {

    private CamposDoContrato() { }

    public enum Campo {
        ALUNO_NOME("aluno_nome"), ALUNO_CPF("aluno_cpf"), ALUNO_ENDERECO("aluno_endereco"),
        RESPONSAVEL_NOME("responsavel_nome"), RESPONSAVEL_CPF("responsavel_cpf"),
        CONSULTORIA("consultoria"), PLANO("plano"), VALOR_TOTAL("valor_total"), PARCELAS("parcelas"),
        VIGENCIA_INICIO("vigencia_inicio"), VIGENCIA_FIM("vigencia_fim"), DATA("data");

        private final String codigo;

        Campo(String codigo) {
            this.codigo = codigo;
        }

        public String codigo() {
            return codigo;
        }

        static Optional<Campo> de(String codigo) {
            for (Campo c : values()) {
                if (c.codigo.equals(codigo)) {
                    return Optional.of(c);
                }
            }
            return Optional.empty();
        }
    }

    private static final Pattern TOKEN = Pattern.compile("\\{([A-Za-z0-9_]+)\\}");

    /** Os campos conhecidos que o texto usa. */
    public static Set<Campo> usados(String texto) {
        Set<Campo> usados = EnumSet.noneOf(Campo.class);
        Matcher m = TOKEN.matcher(texto);
        while (m.find()) {
            Campo.de(m.group(1)).ifPresent(usados::add);
        }
        return usados;
    }

    /** Quantos campos desconhecidos o texto tem (o texto e os nomes nunca vão à mensagem de erro). */
    public static int desconhecidos(String texto) {
        int total = 0;
        Matcher m = TOKEN.matcher(texto);
        while (m.find()) {
            if (Campo.de(m.group(1)).isEmpty()) {
                total++;
            }
        }
        return total;
    }

    /** Troca cada campo que tem valor; o que não tem, e o que não é campo, fica como está. */
    public static String preencher(String texto, Map<Campo, String> valores) {
        Matcher m = TOKEN.matcher(texto);
        StringBuilder saida = new StringBuilder();
        while (m.find()) {
            String valor = Campo.de(m.group(1)).map(valores::get).orElse(null);
            m.appendReplacement(saida, Matcher.quoteReplacement(valor == null ? m.group() : valor));
        }
        m.appendTail(saida);
        return saida.toString();
    }

    /** Dados fictícios de todos os campos, para a prévia do modelo: nunca dado de pessoa real. */
    static Map<Campo, String> exemplo() {
        Map<Campo, String> v = new java.util.EnumMap<>(Campo.class);
        v.put(Campo.ALUNO_NOME, "Maria Aluna de Exemplo");
        v.put(Campo.ALUNO_CPF, "123.456.789-09");
        v.put(Campo.ALUNO_ENDERECO, "Rua Exemplo, 100, Centro, Cidade Exemplo/UF, CEP 00000-000");
        v.put(Campo.RESPONSAVEL_NOME, "João Responsável de Exemplo");
        v.put(Campo.RESPONSAVEL_CPF, "987.654.321-00");
        v.put(Campo.CONSULTORIA, "Consultoria de Exemplo");
        v.put(Campo.PLANO, "Plano de Exemplo");
        v.put(Campo.VALOR_TOTAL, "R$ 1.200,00");
        v.put(Campo.PARCELAS, "entrada de R$ 200,00 em 01/01/2030; parcela 1/2 de R$ 500,00 em 01/02/2030; parcela 2/2 de R$ 500,00 em 01/03/2030");
        v.put(Campo.VIGENCIA_INICIO, "01/01/2030");
        v.put(Campo.VIGENCIA_FIM, "31/03/2030");
        v.put(Campo.DATA, "01/01/2030");
        return v;
    }

    /** Todos os campos, na ordem da lista, para a tela mostrar. */
    public static List<String> codigos() {
        List<String> codigos = new ArrayList<>();
        for (Campo c : Campo.values()) {
            codigos.add(c.codigo());
        }
        return List.copyOf(codigos);
    }
}
