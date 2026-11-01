package br.com.treinos.api.atualizacoes;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Uma linha por aluno ativo com pasta vigente, lida numa consulta só (painel e listas). A atualização nasce no primeiro
 * envio ou aviso de atraso: sem ela os campos de atualização vêm nulos e a data é o fim da pasta. {@code responsavelId} é o
 * do aluno, para os filtros de responsável da lista (vários de uma vez e "sem responsável").
 */
public record LinhaAtualizacao(UUID alunoId, String nomeAluno, UUID pastaId, LocalDate fimDaPasta,
        UUID atualizacaoId, LocalDate dataAtualizacao, LocalDate atrasoAte, String estado, UUID responsavelId) {

    public LocalDate data() {
        return dataAtualizacao != null ? dataAtualizacao : fimDaPasta;
    }
}
