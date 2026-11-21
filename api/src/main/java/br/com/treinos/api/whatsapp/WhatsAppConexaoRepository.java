package br.com.treinos.api.whatsapp;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

/** Toda consulta sai filtrada pela consultoria da sessão ({@code @TenantId}); só há uma conexão por consultoria. */
public interface WhatsAppConexaoRepository extends JpaRepository<WhatsAppConexao, UUID> {

    java.util.Optional<WhatsAppConexao> findFirstBy();
}
