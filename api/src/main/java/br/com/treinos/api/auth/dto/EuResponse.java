package br.com.treinos.api.auth.dto;

import br.com.treinos.api.consultoria.MarcaPublica;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record EuResponse(UsuarioResumo usuario, MarcaPublica marca, AlunoResumo aluno, PerfilResumo perfil, java.util.Set<String> permissoes,
                         boolean termosPendentes, String termosVersao, java.util.List<String> funcionalidadesDoPlano,
                         boolean pagamentosHabilitados, boolean recebimentoOnlineHabilitado,
                         /* Kiwify automática ligada (financeiro e {@code TREINOS_PAGAMENTOS_KIWIFY_HABILITADO}); desligada, o app esconde tudo dela. */
                         boolean kiwifyHabilitada,
                         /* Overtraining Pay via Asaas ligado (financeiro e {@code TREINOS_PAGAMENTOS_ASAAS_HABILITADO}); desligado, o app esconde tudo dele. */
                         boolean overtrainingPayHabilitado,
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
                         /* Contrato digital ligado ({@code TREINOS_CONTRATOS_HABILITADO}); desligado, o app esconde tudo dele. */
                         boolean contratosHabilitados,
                         /* Regras de atenção do treinador ligadas ({@code TREINOS_REGRAS_ATENCAO_HABILITADO}); desligadas, o app esconde tudo delas. */
                         boolean regrasAtencaoHabilitada,
                         /* Só para o aluno: WhatsApp da consultoria só com dígitos (DDD + número, sem o 55), para o app montar wa.me/55<dígitos>; some se não há. */
                         String whatsappDaConsultoria,
                         /* Só para o aluno: as redes sociais da consultoria que estão preenchidas (links https por chave); some se nenhuma. */
                         java.util.Map<String, String> redesSociaisDaConsultoria) {

    public record PerfilResumo(UUID id,String nome,boolean acessoTotal) { }

    /**
     * {@code acessoDesativadoMotivo}: {@code ATRASO} = acesso pausado por atraso (o app mostra só a tela de regularização;
     * as outras rotas dão 403 {@code ACESSO_PAUSADO_POR_ATRASO}); nulo = acesso normal. O MANUAL não chega aqui (sem login).
     * {@code contratoPendenteVencido}: há contrato pendente do aluno com o prazo vencido (as outras rotas dão 403
     * {@code CONTRATO_PENDENTE}; o app mostra a tela de assinatura); sempre {@code false} com {@code TREINOS_CONTRATOS_HABILITADO} desligado.
     */
    public record AlunoResumo(UUID id, String nome, String sexo, String acessoDesativadoMotivo, boolean contratoPendenteVencido) {
    }
}
