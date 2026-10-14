package br.com.treinos.api.auth.dto;

import br.com.treinos.api.consultoria.MarcaPublica;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record EuResponse(UsuarioResumo usuario, MarcaPublica marca, AlunoResumo aluno, PerfilResumo perfil, java.util.Set<String> permissoes,
                         boolean termosPendentes, String termosVersao) {

    public record PerfilResumo(UUID id,String nome,boolean acessoTotal) { }

    public record AlunoResumo(UUID id, String nome) {
    }
}
