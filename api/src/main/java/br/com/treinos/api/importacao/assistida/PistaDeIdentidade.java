package br.com.treinos.api.importacao.assistida;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Heurísticas para deduzir o nome do aluno a partir do nome do arquivo e do cabeçalho do documento,
 * permitindo agrupar arquivos múltiplos (ex: PDF de treino + DOCX de dieta) do mesmo aluno.
 */
public final class PistaDeIdentidade {

    private static final Pattern CABECALHO_NOME = Pattern.compile(
            "(?im)^(?:aluno(?:a)?|paciente|atleta|nome|cliente)\\s*[:=-]\\s*([A-Za-zÀ-ÖØ-öø-ÿ\\s]{3,60})");

    private static final Pattern PREFIXOS_ARQUIVO = Pattern.compile(
            "(?i)^(?:treino(?:s)?|dieta(?:s)?|plano(?:s)?|ficha(?:s)?|rotina(?:s)?|protocolo(?:s)?|"
                    + "consultoria|avaliacao(?:es)?|anamnese(?:s)?|aluno(?:a)?|paciente|copia\\s+de|copy\\s+of)"
                    + "[\\s_\\-–—:]+");

    private static final Pattern SUFIXOS_ARQUIVO = Pattern.compile(
            "(?i)[\\s_\\-–—:]+(?:202[0-9]|v[0-9]+(?:\\.[0-9]+)?|final|atual|novo|ajustado|revisado|"
                    + "fase[0-9]+|etapa[0-9]+|versao[0-9]+)$");

    private static final Pattern SEPARADORES_ARQUIVO = Pattern.compile("[_\\-–—]+");
    private static final Pattern ESPACOS = Pattern.compile("\\s+");

    private PistaDeIdentidade() {
    }

    /**
     * Tenta extrair o nome do aluno a partir do nome do arquivo.
     * Ex: "Treino - Maria Santos.pdf" -> "Maria Santos"
     */
    public static String extrairDoNomeDoArquivo(String nomeArquivo) {
        if (nomeArquivo == null || nomeArquivo.isBlank()) {
            return "";
        }
        String nome = nomeArquivo.strip();
        int ponto = nome.lastIndexOf('.');
        if (ponto > 0) {
            nome = nome.substring(0, ponto);
        }

        boolean mudou = true;
        while (mudou) {
            String antes = nome;
            nome = PREFIXOS_ARQUIVO.matcher(nome).replaceFirst("");
            nome = SUFIXOS_ARQUIVO.matcher(nome).replaceFirst("");
            mudou = !nome.equals(antes);
        }
        nome = SEPARADORES_ARQUIVO.matcher(nome).replaceAll(" ");
        nome = ESPACOS.matcher(nome).replaceAll(" ").strip();

        // Se sobrou apenas palavras comuns de fitness, anos ou não contém letras, não é nome de aluno
        String min = nome.toLowerCase(Locale.ROOT);
        if (min.equals("treino") || min.equals("dieta") || min.equals("plano")
                || min.length() < 3 || !min.matches(".*[a-zà-öø-ÿ].*")
                || min.matches("^(?:19|20)[0-9]{2}$")) {
            return "";
        }

        return formatarNome(nome);
    }

    /**
     * Tenta extrair o nome do aluno das primeiras linhas do texto do documento.
     */
    public static String extrairDoCabecalho(String texto) {
        if (texto == null || texto.isBlank()) {
            return "";
        }
        // Olha apenas as primeiras 15 linhas
        String[] linhas = texto.split("\\R", 16);
        for (int i = 0; i < Math.min(linhas.length, 15); i++) {
            Matcher m = CABECALHO_NOME.matcher(linhas[i].strip());
            if (m.find()) {
                String achado = m.group(1).strip();
                if (achado.length() >= 3) {
                    return formatarNome(achado);
                }
            }
        }
        return "";
    }

    private static String formatarNome(String nomeBruto) {
        if (nomeBruto == null || nomeBruto.isBlank()) {
            return "";
        }
        String[] partes = nomeBruto.split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (String p : partes) {
            if (p.isBlank()) continue;
            if (p.length() <= 2 && (p.equalsIgnoreCase("de") || p.equalsIgnoreCase("da")
                    || p.equalsIgnoreCase("do") || p.equalsIgnoreCase("dos") || p.equalsIgnoreCase("e"))) {
                sb.append(p.toLowerCase(Locale.ROOT)).append(' ');
            } else {
                sb.append(Character.toUpperCase(p.charAt(0)))
                        .append(p.substring(1).toLowerCase(Locale.ROOT))
                        .append(' ');
            }
        }
        return sb.toString().strip();
    }
}
