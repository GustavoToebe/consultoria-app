package br.com.treinos.api.importacao.assistida;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Blindagem de privacidade (LGPD): detecta e remove CPF, telefone, e-mail e CEP
 * do texto antes de qualquer envio a provedores de IA externos (Gemini / Claude).
 * Os dados reais permanecem exclusivamente em memória local da aplicação Java.
 */
public final class RedatorLgpdImportacao {

    private static final Pattern CPF_REGEX = Pattern.compile("\\b\\d{3}\\.?\\d{3}\\.?\\d{3}-?\\d{2}\\b");
    private static final Pattern EMAIL_REGEX = Pattern.compile("\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}\\b");
    private static final Pattern TELEFONE_REGEX = Pattern.compile(
            "(?:\\+?55\\s?)?(?:\\(?([1-9][0-9])\\)?\\s?)?(?:9\\s?[0-9]{4}[-\\s]?[0-9]{4}|[2-8][0-9]{3}[-\\s]?[0-9]{4})\\b");
    private static final Pattern CEP_REGEX = Pattern.compile("\\b\\d{5}[-\\s]?\\d{3}\\b");

    public record RedacaoResultado(String textoRedigido, List<String> cpfs, List<String> emails,
                                   List<String> telefones, List<String> ceps) {
        public String primeiroCpf() {
            return cpfs.isEmpty() ? null : cpfs.getFirst();
        }

        public String primeiroEmail() {
            return emails.isEmpty() ? null : emails.getFirst();
        }

        public String primeiroTelefone() {
            return telefones.isEmpty() ? null : telefones.getFirst();
        }
    }

    private RedatorLgpdImportacao() {
    }

    /**
     * Substitui dados sensíveis por marcadores neutros e retorna o texto limpo com as listas de dados extraídos.
     */
    public static RedacaoResultado redigir(String textoOriginal) {
        if (textoOriginal == null || textoOriginal.isBlank()) {
            return new RedacaoResultado("", List.of(), List.of(), List.of(), List.of());
        }

        List<String> cpfs = new ArrayList<>();
        List<String> emails = new ArrayList<>();
        List<String> telefones = new ArrayList<>();
        List<String> ceps = new ArrayList<>();

        // 1. E-mails
        Matcher mEmail = EMAIL_REGEX.matcher(textoOriginal);
        StringBuilder sbEmail = new StringBuilder();
        while (mEmail.find()) {
            emails.add(mEmail.group());
            mEmail.appendReplacement(sbEmail, "[EMAIL_EXTRAIDO]");
        }
        mEmail.appendTail(sbEmail);
        String texto = sbEmail.toString();

        // 2. CPFs
        Matcher mCpf = CPF_REGEX.matcher(texto);
        StringBuilder sbCpf = new StringBuilder();
        while (mCpf.find()) {
            cpfs.add(mCpf.group());
            mCpf.appendReplacement(sbCpf, "[CPF_EXTRAIDO]");
        }
        mCpf.appendTail(sbCpf);
        texto = sbCpf.toString();

        // 3. CEPs
        Matcher mCep = CEP_REGEX.matcher(texto);
        StringBuilder sbCep = new StringBuilder();
        while (mCep.find()) {
            ceps.add(mCep.group());
            mCep.appendReplacement(sbCep, "[CEP_EXTRAIDO]");
        }
        mCep.appendTail(sbCep);
        texto = sbCep.toString();

        // 4. Telefones
        Matcher mTel = TELEFONE_REGEX.matcher(texto);
        StringBuilder sbTel = new StringBuilder();
        while (mTel.find()) {
            String achado = mTel.group();
            // Evita falsos positivos como números pequenos de séries "4x10" ou anos "2026"
            if (achado.replaceAll("[^0-9]", "").length() >= 8) {
                telefones.add(achado);
                mTel.appendReplacement(sbTel, "[TELEFONE_EXTRAIDO]");
            }
        }
        mTel.appendTail(sbTel);
        texto = sbTel.toString();

        return new RedacaoResultado(texto, List.copyOf(cpfs), List.copyOf(emails),
                List.copyOf(telefones), List.copyOf(ceps));
    }
}
