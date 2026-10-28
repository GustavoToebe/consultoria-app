package br.com.treinos.api.alunos.dto;

import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.dto.AlunoDtos.Endereco;
import br.com.treinos.api.auth.Usuario;

/**
 * O cadastro do próprio aluno. {@code nome}, {@code email} (do cadastro) e {@code emailDeAcesso} só se leem (quem muda é o
 * treinador). {@code telefone}, {@code cpf}, {@code endereco} e {@code sexo} saem nulos quando não há valor; {@code sexo} é o
 * nome do enum. Dado pessoal: o {@code toString} não mostra nada.
 */
public record MeusDadosResponse(String nome, String email, String emailDeAcesso, String telefone, String cpf,
                                Endereco endereco, String sexo, long versao) {

    /** {@code usuario} é o do aluno (telefone e e-mail de acesso moram nele); nulo se ainda não existe. */
    public static MeusDadosResponse de(Aluno a, Usuario usuario) {
        return new MeusDadosResponse(a.getNome(), a.getEmail(),
                usuario == null || a.isAnonimizado() ? null : usuario.getEmail(),
                usuario == null ? null : usuario.getTelefone(), a.getCpf(), a.endereco(),
                a.getSexo() == null ? null : a.getSexo().name(), a.getVersao());
    }

    @Override
    public String toString() {
        return "MeusDadosResponse[...]";
    }
}
