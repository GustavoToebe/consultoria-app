package br.com.treinos.api.alunos;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.treinos.api.alunos.dto.AlunoDtos.Endereco;
import br.com.treinos.api.questionarios.LimitesQuestionario;
import br.com.treinos.api.web.Formatos;
import tools.jackson.databind.JsonNode;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.function.UnaryOperator;

/**
 * A regra única do endereço do aluno: a ficha ({@code AlunoService}), a resposta ENDERECO da anamnese
 * ({@code ValidadorAtualizacao}) e a comparação/aplicação dela no cadastro ({@code PerfilDaAnamnese}) passam todas por
 * {@link #normalizar(Endereco)} (ou {@link #daResposta(JsonNode)}, que só converte o JSON). Espelhada em
 * {@code app/src/dominio} (o teste de paridade confere as fixtures).
 *
 * <ol>
 *   <li>Normalização: cada campo perde os espaços das pontas e o que sobra em branco vira nulo; CEP passa por
 *       {@link Formatos#cep} (85800-000) e UF por {@link Formatos#uf} (maiúscula, uma das 27), quando preenchidos.</li>
 *   <li>O limite de tamanho de cada campo ({@code LimitesQuestionario.ENDERECO_*}) conta depois do strip.</li>
 *   <li>Endereço vazio (todos os campos nulos depois do strip) é válido e devolve {@code null}: o endereço é opcional.</li>
 *   <li>Endereço não vazio: CEP, logradouro, número, cidade e UF são obrigatórios; complemento e bairro, opcionais. O
 *       número é só texto ("s/n" vale).</li>
 * </ol>
 *
 * Dado pessoal: as mensagens são fixas e nunca trazem o valor enviado.
 */
public final class RegrasDoEndereco {

    /** Campos da resposta ENDERECO, na ordem do endereço. */
    private static final Set<String> CHAVES = Set.of("cep", "logradouro", "numero", "complemento", "bairro", "cidade", "uf");

    private RegrasDoEndereco() { }

    /** Um problema: o campo ({@code cep}, {@code logradouro}...; nulo = a resposta inteira, de forma errada) e a mensagem fixa. */
    public record Erro(String campo, String mensagem) { }

    /** {@code endereco} é o normalizado (nulo se vazio ou se há erros); {@code erros} vazio = válido. */
    public record Resultado(Endereco endereco, List<Erro> erros) {
        public boolean valido() {
            return erros.isEmpty();
        }
    }

    // Mensagens fixas por campo (ficha). CEP e UF malformados têm as do Formatos ("CEP inválido." / "UF inválida.").
    static final String INFORME_CEP = "Informe o CEP.";
    static final String INFORME_LOGRADOURO = "Informe a rua, avenida ou logradouro.";
    static final String INFORME_NUMERO = "Informe o número (ou s/n).";
    static final String INFORME_CIDADE = "Informe a cidade.";
    static final String INFORME_UF = "Informe a UF.";
    static final String CEP_INVALIDO = "CEP inválido.";
    static final String UF_INVALIDA = "UF inválida.";
    static final String FORMA_INVALIDA = "Endereço inválido.";

    /** Mensagem fixa do excesso de tamanho (só o limite do campo, nunca o valor). */
    static String excesso(int limite) {
        return "Use no máximo " + limite + " caracteres.";
    }

    /** Normaliza e confere o endereço da ficha ({@code null} = sem endereço). */
    public static Resultado normalizar(Endereco bruto) {
        if (bruto == null) {
            return new Resultado(null, List.of());
        }
        String cep = aparar(bruto.cep());
        String logradouro = aparar(bruto.logradouro());
        String numero = aparar(bruto.numero());
        String complemento = aparar(bruto.complemento());
        String bairro = aparar(bruto.bairro());
        String cidade = aparar(bruto.cidade());
        String uf = aparar(bruto.uf());
        if (cep == null && logradouro == null && numero == null && complemento == null && bairro == null && cidade == null
                && uf == null) {
            return new Resultado(null, List.of());
        }
        var erros = new ArrayList<Erro>();
        // Na ordem do formulário (CEP, logradouro, número, complemento, bairro, cidade, UF).
        String cepFormatado = formatado(erros, "cep", cep, LimitesQuestionario.ENDERECO_CEP_TAMANHO, INFORME_CEP, CEP_INVALIDO,
                Formatos::cep);
        String logradouroOk = texto(erros, "logradouro", logradouro, LimitesQuestionario.ENDERECO_LOGRADOURO_TAMANHO, INFORME_LOGRADOURO);
        String numeroOk = texto(erros, "numero", numero, LimitesQuestionario.ENDERECO_NUMERO_TAMANHO, INFORME_NUMERO);
        String complementoOk = texto(erros, "complemento", complemento, LimitesQuestionario.ENDERECO_COMPLEMENTO_TAMANHO, null);
        String bairroOk = texto(erros, "bairro", bairro, LimitesQuestionario.ENDERECO_BAIRRO_TAMANHO, null);
        String cidadeOk = texto(erros, "cidade", cidade, LimitesQuestionario.ENDERECO_CIDADE_TAMANHO, INFORME_CIDADE);
        String ufFormatada = formatado(erros, "uf", uf, LimitesQuestionario.ENDERECO_UF_TAMANHO, INFORME_UF, UF_INVALIDA,
                Formatos::uf);
        if (!erros.isEmpty()) {
            return new Resultado(null, List.copyOf(erros));
        }
        return new Resultado(new Endereco(cepFormatado, logradouroOk, numeroOk, complementoOk, bairroOk, cidadeOk, ufFormatada),
                List.of());
    }

    /**
     * A resposta ENDERECO da anamnese: um objeto só com as sete chaves, cada valor um texto (forma errada = erro sem campo);
     * dali em diante é a mesma {@link #normalizar(Endereco)} da ficha.
     */
    public static Resultado daResposta(JsonNode resposta) {
        if (resposta == null || !resposta.isObject()) {
            return new Resultado(null, List.of(new Erro(null, FORMA_INVALIDA)));
        }
        for (var e : resposta.properties()) {
            if (!CHAVES.contains(e.getKey()) || !e.getValue().isString()) {
                return new Resultado(null, List.of(new Erro(null, FORMA_INVALIDA)));
            }
        }
        return normalizar(new Endereco(texto(resposta, "cep"), texto(resposta, "logradouro"), texto(resposta, "numero"),
                texto(resposta, "complemento"), texto(resposta, "bairro"), texto(resposta, "cidade"), texto(resposta, "uf")));
    }

    private static String texto(JsonNode objeto, String chave) {
        JsonNode n = objeto.path(chave);
        return n.isString() ? n.asString() : null;
    }

    /** Sem os espaços das pontas; o que sobra em branco vira nulo. */
    private static String aparar(String texto) {
        if (texto == null) {
            return null;
        }
        String t = texto.strip();
        return t.isEmpty() ? null : t;
    }

    /** Campo de texto livre: obrigatório (mensagem não nula) ou opcional; o excesso conta depois do strip. */
    private static String texto(List<Erro> erros, String campo, String valor, int limite, String faltando) {
        if (valor == null) {
            if (faltando != null) {
                erros.add(new Erro(campo, faltando));
            }
            return null;
        }
        if (valor.length() > limite) {
            erros.add(new Erro(campo, excesso(limite)));
            return null;
        }
        return valor;
    }

    /** CEP e UF: obrigatórios; acima do limite (depois do strip) ou fora do formato dão a mesma mensagem fixa de formato. */
    private static String formatado(List<Erro> erros, String campo, String valor, int limite, String faltando,
                                    String invalido, UnaryOperator<String> formato) {
        if (valor == null) {
            erros.add(new Erro(campo, faltando));
            return null;
        }
        if (valor.length() > limite) {
            erros.add(new Erro(campo, invalido));
            return null;
        }
        try {
            return formato.apply(valor);
        } catch (BadRequestException recusado) {
            erros.add(new Erro(campo, recusado.getMessage()));
            return null;
        }
    }
}
