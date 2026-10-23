package br.com.treinos.api.fotos;

import br.com.treinos.api.anamneses.Anamnese;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Uma foto ligada, com o envio (atualização ou anamnese) e o texto da versão respondida.
 * A consulta é uma só; o rótulo da pergunta e a ordem saem do JSON em memória.
 */
public record LinhaDaFoto(
        UUID fotoId,
        String perguntaId,
        Instant criadaEm,
        UUID atualizacaoId,
        LocalDate dataAtualizacao,
        String estadoAtualizacao,
        String respostasAtualizacao,
        String conteudoAtualizacao,
        UUID anamneseId,
        Anamnese.Situacao situacaoAnamnese,
        Instant enviadaAnamnese,
        String respostasAnamnese,
        String conteudoAnamnese) {
}
