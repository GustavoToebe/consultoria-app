package br.com.treinos.api.auth.dto;

import br.com.treinos.api.consultoria.MarcaPublica;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record EuResponse(UsuarioResumo usuario, MarcaPublica marca, AlunoResumo aluno, PerfilResumo perfil, java.util.Set<String> permissoes,
                         boolean termosPendentes, String termosVersao, java.util.List<String> funcionalidadesDoPlano,
                         boolean pagamentosHabilitados, boolean recebimentoOnlineHabilitado,
                         /* Kiwify automática ligada (financeiro e {@code TREINOS_PAGAMENTOS_KIWIFY_HABILITADO}); desligada, o app esconde tudo dela. */
                         boolean kiwifyHabilitada,
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
                         /* Marketplace efetivo (vitrine, loja e {@code TREINOS_MARKETPLACE_HABILITADO} ligadas); desligado, o app esconde o que é dele. */
                         boolean marketplaceHabilitado,
                         /* Avisos pelo WhatsApp oficial da Meta ligados ({@code TREINOS_WHATSAPP_HABILITADO}); desligado, o app esconde tudo deles. */
                         boolean whatsappHabilitado,
                         /* Só para o aluno: WhatsApp da consultoria só com dígitos (DDD + número, sem o 55), para o app montar wa.me/55<dígitos>; some se não há. */
                         String whatsappDaConsultoria,
                         /* Só para o aluno: se o acesso está pausado por atraso (sempre false para não-aluno). */
                         boolean acessoPausado) {

    public EuResponse(UsuarioResumo usuario, MarcaPublica marca, AlunoResumo aluno, PerfilResumo perfil, java.util.Set<String> permissoes,
                      boolean termosPendentes, String termosVersao, java.util.List<String> funcionalidadesDoPlano,
                      boolean pagamentosHabilitados, boolean recebimentoOnlineHabilitado, boolean kiwifyHabilitada,
                      boolean pagarNoIos, boolean pagarNoAndroid, boolean cicloHabilitado, boolean retornoHabilitado,
                      boolean pushHabilitado, boolean unidadeDeCargaHabilitada, boolean migracaoAssistidaHabilitada,
                      boolean vitrineHabilitada, boolean lojaHabilitada, boolean marketplaceHabilitado,
                      boolean whatsappHabilitado, String whatsappDaConsultoria) {
        this(usuario, marca, aluno, perfil, permissoes, termosPendentes, termosVersao, funcionalidadesDoPlano,
                pagamentosHabilitados, recebimentoOnlineHabilitado, kiwifyHabilitada, pagarNoIos, pagarNoAndroid,
                cicloHabilitado, retornoHabilitado, pushHabilitado, unidadeDeCargaHabilitada,
                migracaoAssistidaHabilitada, vitrineHabilitada, lojaHabilitada, marketplaceHabilitado,
                whatsappHabilitado, whatsappDaConsultoria, false);
    }

    public record PerfilResumo(UUID id,String nome,boolean acessoTotal) { }

    public record AlunoResumo(UUID id, String nome, String sexo, boolean acessoPausado, Instant acessoPausadoEm) {
        public AlunoResumo(UUID id, String nome, String sexo) {
            this(id, nome, sexo, false, null);
        }
    }
}
