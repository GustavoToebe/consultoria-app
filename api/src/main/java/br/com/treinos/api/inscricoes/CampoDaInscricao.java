package br.com.treinos.api.inscricoes;

import java.util.EnumSet;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Campos fixos da página "Quero ser aluno" que o treinador pode esconder (D4 de
 * {@code docs/planos/inscricao-com-perguntas-proprias.md}). O sistema usa cada um: e-mail no convite, sexo e objetivo no
 * cadastro do aceite, os outros no CRM e nos indicadores. Nome, WhatsApp e a ciência do texto nunca se escondem e por isso
 * não estão aqui. Campo escondido que chega no envio é ignorado (não recusa: a página pode ser de antes da mudança).
 */
public enum CampoDaInscricao {
    EMAIL, SEXO, OBJETIVO, INTERESSE, MODALIDADE, PREVISAO_INICIO, ORIGEM;

    /** Lê a coluna ({@code EMAIL,SEXO}); valor desconhecido é ignorado. */
    static Set<CampoDaInscricao> ler(String coluna) {
        Set<CampoDaInscricao> campos = EnumSet.noneOf(CampoDaInscricao.class);
        if (coluna == null || coluna.isBlank()) return campos;
        for (String parte : coluna.split(",")) {
            for (CampoDaInscricao c : values()) {
                if (c.name().equals(parte.trim().toUpperCase(Locale.ROOT))) campos.add(c);
            }
        }
        return campos;
    }

    /** Grava na ordem do enum, sem repetir. */
    static String escrever(Set<CampoDaInscricao> campos) {
        if (campos == null || campos.isEmpty()) return "";
        return EnumSet.copyOf(campos).stream().map(Enum::name).collect(Collectors.joining(","));
    }

    /** Os visíveis, na ordem do enum. */
    static Set<CampoDaInscricao> visiveis(Set<CampoDaInscricao> ocultos) {
        Set<CampoDaInscricao> todos = EnumSet.allOf(CampoDaInscricao.class);
        todos.removeAll(ocultos);
        return todos;
    }
}
