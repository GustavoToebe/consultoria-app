package br.com.treinos.api.alunos.dto;

import br.com.treinos.api.alunos.dto.AlunoDtos.Endereco;
import jakarta.validation.constraints.Size;

/**
 * "Meus dados": o aluno corrige o próprio cadastro. Sempre o aluno da sessão (nunca id no corpo).
 * {@code telefone}, {@code endereco}, {@code sexo}, {@code instagram} e {@code tiktok} <b>substituem</b> o gravado: telefone, instagram e tiktok em branco ou nulos apagam, endereço nulo ou
 * vazio apaga, sexo nulo ou em branco é "não informado". {@code cpf} nulo ou em branco não tem efeito; só preenche se o
 * cadastro está sem CPF. {@code versao} é obrigatória (lock otimista, 409 {@code CONFLITO_EDICAO}).
 * Tudo é dado pessoal: o {@code toString} não mostra nada.
 */
public record MeusDadosRequest(
        @Size(max = 25) String telefone,
        @Size(max = 20) String cpf,
        Endereco endereco,
        @Size(max = 10) String sexo,
        @Size(max = 200) String instagram,
        @Size(max = 200) String tiktok,
        Long versao) {

    @Override
    public String toString() {
        return "MeusDadosRequest[...]";
    }
}
