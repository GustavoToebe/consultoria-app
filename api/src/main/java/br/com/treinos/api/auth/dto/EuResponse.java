package br.com.treinos.api.auth.dto;

import br.com.treinos.api.consultoria.MarcaPublica;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record EuResponse(UsuarioResumo usuario, MarcaPublica marca, AlunoResumo aluno, PerfilResumo perfil, java.util.Set<String> permissoes,
                         boolean termosPendentes, String termosVersao, java.util.List<String> funcionalidadesDoPlano,
                         boolean pagamentosHabilitados, boolean recebimentoOnlineHabilitado,
                         boolean pagarNoIos, boolean pagarNoAndroid,
                         /* Módulo do ciclo menstrual ligado ({@code TREINOS_CICLO_HABILITADO}); desligado, o app esconde tudo dele. */
                         boolean cicloHabilitado,
                         /* Concluir treino ligado ({@code TREINOS_RETORNO_HABILITADO}); desligado, o app esconde tudo dele. */
                         boolean retornoHabilitado) {

    public record PerfilResumo(UUID id,String nome,boolean acessoTotal) { }

    public record AlunoResumo(UUID id, String nome, String sexo) {
    }
}
