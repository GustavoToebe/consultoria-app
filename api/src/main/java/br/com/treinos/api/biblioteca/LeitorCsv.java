package br.com.treinos.api.biblioteca;

import br.com.plataforma.comum.web.BadRequestException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;

/**
 * CSV colado ou enviado pelo treinador (planilha do Sheets/Excel). Separador {@code ;} ou {@code ,}, decidido pelo
 * cabeçalho; aceita campos entre aspas. Até {@value #LINHAS_MAXIMAS} linhas de dados.
 */
public final class LeitorCsv {

    static final int LINHAS_MAXIMAS = 1000;

    public record Linha(int numero, List<String> campos) {
        String campo(int i) {
            return i < campos.size() ? campos.get(i).trim() : "";
        }
    }

    record Tabela(char separador, List<Linha> linhas, String hash) {
    }

    private LeitorCsv() {
    }

    /**
     * Todas as linhas não vazias, inclusive a primeira, sem exigir cabeçalho. O chamador decide o que é cabeçalho.
     * Passou de {@code maximo} linhas (contando a primeira) recusa o arquivo.
     */
    public static List<Linha> lerLivre(String texto, int maximo) {
        String normalizado = normalizar(texto);
        if (normalizado.isBlank()) {
            throw new BadRequestException("O arquivo está vazio.");
        }
        return registros(normalizado, separador(normalizado), maximo, "O arquivo passa de 5.000 linhas.").stream()
                .map(l -> new Linha(l.numero(), l.campos().stream().map(String::trim).toList()))
                .toList();
    }

    static Tabela ler(String texto, List<String> cabecalhoEsperado) {
        String normalizado = normalizar(texto);
        if (normalizado.isBlank()) {
            throw new BadRequestException("O arquivo está vazio.");
        }
        char separador = separador(normalizado);
        // O cabeçalho conta como o primeiro registro; os de dados passam de LINHAS_MAXIMAS recusam o arquivo.
        List<Linha> registros = registros(normalizado, separador, LINHAS_MAXIMAS + 1,
                "Máximo de " + LINHAS_MAXIMAS + " linhas por importação.");
        List<String> cabecalho = registros.get(0).campos().stream()
                .map(c -> c.trim().toLowerCase(Locale.ROOT)).toList();
        if (!cabecalho.equals(cabecalhoEsperado)) {
            throw new BadRequestException("Cabeçalho esperado: " + String.join(String.valueOf(separador), cabecalhoEsperado));
        }
        return new Tabela(separador, List.copyOf(registros.subList(1, registros.size())), hash(normalizado));
    }

    /** Sem BOM, quebras de linha unificadas e sem linhas vazias no fim: o mesmo arquivo dá sempre o mesmo hash. */
    private static String normalizar(String texto) {
        if (texto == null) {
            return "";
        }
        String t = texto.startsWith("﻿") ? texto.substring(1) : texto;
        return t.replace("\r\n", "\n").replace('\r', '\n').strip();
    }

    /** Decidido pela primeira linha, sem contar o que está entre aspas (a linha só termina fora delas). */
    private static char separador(String normalizado) {
        int pontoEVirgula = 0;
        int virgula = 0;
        boolean entreAspas = false;
        boolean inicioDeCampo = true;
        for (int i = 0; i < normalizado.length(); i++) {
            char c = normalizado.charAt(i);
            if (entreAspas) {
                if (c == '"') {
                    entreAspas = false;
                }
            } else if (c == '\n') {
                break;
            } else if (c == '"' && inicioDeCampo) {
                entreAspas = true;
            } else {
                if (c == ';') {
                    pontoEVirgula++;
                } else if (c == ',') {
                    virgula++;
                }
                inicioDeCampo = c == ';' || c == ',' || (inicioDeCampo && (c == ' ' || c == '\t'));
            }
        }
        return pontoEVirgula >= virgula ? ';' : ',';
    }

    /**
     * Registros não vazios, na ordem, com o número da linha onde cada um começa. Campo entre aspas pode ter quebra de
     * linha, o separador e aspas duplicadas ({@code ""}); aspas sem fechar até o fim do arquivo recusam o arquivo.
     * Linha só com espaços é pulada. Passou de {@code maximo} registros, recusa com {@code excesso}.
     */
    private static List<Linha> registros(String texto, char separador, int maximo, String excesso) {
        List<Linha> registros = new ArrayList<>();
        List<String> campos = new ArrayList<>();
        StringBuilder atual = new StringBuilder();
        boolean entreAspas = false;
        // Aspas só abrem um campo no começo dele (espaços antes são aceitos); no meio do campo são texto, como no Excel.
        boolean inicioDeCampo = true;
        int linha = 1;
        int linhaDoRegistro = 1;
        int inicio = 0;
        for (int i = 0; i <= texto.length(); i++) {
            boolean fim = i == texto.length();
            char c = fim ? '\n' : texto.charAt(i);
            if (entreAspas) {
                if (fim) {
                    throw new BadRequestException("O CSV tem aspas sem fechar.");
                }
                if (c == '"' && i + 1 < texto.length() && texto.charAt(i + 1) == '"') {
                    atual.append('"');
                    i++;
                } else if (c == '"') {
                    entreAspas = false;
                } else {
                    atual.append(c);
                    if (c == '\n') {
                        linha++;
                    }
                }
            } else if (c == '"' && inicioDeCampo) {
                entreAspas = true;
                inicioDeCampo = false;
            } else if (c == separador) {
                campos.add(atual.toString());
                atual.setLength(0);
                inicioDeCampo = true;
            } else if (c == '\n') {
                inicioDeCampo = true;
                if (!texto.substring(inicio, i).isBlank()) {
                    if (registros.size() == maximo) {
                        throw new BadRequestException(excesso);
                    }
                    campos.add(atual.toString());
                    registros.add(new Linha(linhaDoRegistro, List.copyOf(campos)));
                }
                campos.clear();
                atual.setLength(0);
                linha++;
                linhaDoRegistro = linha;
                inicio = i + 1;
            } else {
                atual.append(c);
                inicioDeCampo = inicioDeCampo && (c == ' ' || c == '\t');
            }
        }
        return registros;
    }

    static String hash(String texto) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(texto.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 indisponível.", e);
        }
    }
}
