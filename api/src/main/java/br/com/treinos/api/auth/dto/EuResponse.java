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
                         boolean retornoHabilitado,
                         /* Push do Expo ligado ({@code TREINOS_PUSH_HABILITADO}); desligado, o app não pede permissão nem registra token. */
                         boolean pushHabilitado,
                         /* Escolha de kg ou lb ({@code TREINOS_UNIDADE_CARGA_HABILITADA}); desligado, o app esconde a escolha e usa kg. */
                         boolean unidadeDeCargaHabilitada,
                         /* Migração assistida (diagnóstico do arquivo) ligada ({@code TREINOS_MIGRACAO_ASSISTIDA_HABILITADA}); desligada, o app esconde tudo dela. */
                         boolean migracaoAssistidaHabilitada,
                         /* Vitrine da consultoria ligada ({@code TREINOS_VITRINE_HABILITADA}); desligada, o app esconde tudo dela. */
                         boolean vitrineHabilitada,
                         /* Página pública da loja efetiva (vitrine e {@code TREINOS_LOJA_HABILITADA} ligadas); desligada, o app esconde o que é dela. */
                         boolean lojaHabilitada,
                         /* Só para o aluno: WhatsApp da consultoria só com dígitos (DDD + número, sem o 55), para o app montar wa.me/55<dígitos>; some se não há. */
                         String whatsappDaConsultoria) {

    public record PerfilResumo(UUID id,String nome,boolean acessoTotal) { }

    public record AlunoResumo(UUID id, String nome, String sexo) {
    }
}
