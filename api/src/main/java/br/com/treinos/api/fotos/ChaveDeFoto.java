package br.com.treinos.api.fotos;

import java.util.UUID;

/**
 * Nome do objeto no bucket: {@code consultorias/<consultoriaId>/fotos/<fotoId>.jpg}. O id da consultoria vem sempre do banco
 * (da linha do aluno ou da própria foto), nunca do cliente. Só UUIDs: nenhum nome, e-mail ou arquivo de pessoa vai para o
 * bucket. O prefixo por consultoria permite apagar tudo dela de uma vez ({@link #prefixoDaConsultoria}), por exemplo quando
 * a consultoria sai.
 */
final class ChaveDeFoto {

    private ChaveDeFoto() {
    }

    static String prefixoDaConsultoria(UUID consultoriaId) {
        return "consultorias/" + consultoriaId + "/";
    }

    static String de(UUID consultoriaId, UUID fotoId) {
        return prefixoDaConsultoria(consultoriaId) + "fotos/" + fotoId + ".jpg";
    }
}
