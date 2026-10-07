package br.com.treinos.api.biblioteca;

import br.com.treinos.api.web.BadRequestException;

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
final class LeitorCsv {

    static final int LINHAS_MAXIMAS = 1000;

    record Linha(int numero, List<String> campos) {
        String campo(int i) {
            return i < campos.size() ? campos.get(i).trim() : "";
        }
    }

    record Tabela(char separador, List<Linha> linhas, String hash) {
    }

    private LeitorCsv() {
    }

    static Tabela ler(String texto, List<String> cabecalhoEsperado) {
        String normalizado = normalizar(texto);
        if (normalizado.isBlank()) {
            throw new BadRequestException("O arquivo está vazio.");
        }
        String[] brutas = normalizado.split("\n", -1);
        char separador = brutas[0].chars().filter(c -> c == ';').count()
                >= brutas[0].chars().filter(c -> c == ',').count() ? ';' : ',';
        List<String> cabecalho = campos(brutas[0], separador).stream()
                .map(c -> c.trim().toLowerCase(Locale.ROOT)).toList();
        if (!cabecalho.equals(cabecalhoEsperado)) {
            throw new BadRequestException("Cabeçalho esperado: " + String.join(String.valueOf(separador), cabecalhoEsperado));
        }
        List<Linha> linhas = new ArrayList<>();
        for (int i = 1; i < brutas.length; i++) {
            if (brutas[i].isBlank()) {
                continue;
            }
            if (linhas.size() == LINHAS_MAXIMAS) {
                throw new BadRequestException("Máximo de " + LINHAS_MAXIMAS + " linhas por importação.");
            }
            linhas.add(new Linha(i + 1, campos(brutas[i], separador)));
        }
        return new Tabela(separador, linhas, hash(normalizado));
    }

    /** Sem BOM, quebras de linha unificadas e sem linhas vazias no fim: o mesmo arquivo dá sempre o mesmo hash. */
    private static String normalizar(String texto) {
        if (texto == null) {
            return "";
        }
        String t = texto.startsWith("﻿") ? texto.substring(1) : texto;
        return t.replace("\r\n", "\n").replace('\r', '\n').strip();
    }

    private static List<String> campos(String linha, char separador) {
        List<String> campos = new ArrayList<>();
        StringBuilder atual = new StringBuilder();
        boolean entreAspas = false;
        for (int i = 0; i < linha.length(); i++) {
            char c = linha.charAt(i);
            if (entreAspas) {
                if (c == '"' && i + 1 < linha.length() && linha.charAt(i + 1) == '"') {
                    atual.append('"');
                    i++;
                } else if (c == '"') {
                    entreAspas = false;
                } else {
                    atual.append(c);
                }
            } else if (c == '"') {
                entreAspas = true;
            } else if (c == separador) {
                campos.add(atual.toString());
                atual.setLength(0);
            } else {
                atual.append(c);
            }
        }
        campos.add(atual.toString());
        return campos;
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
