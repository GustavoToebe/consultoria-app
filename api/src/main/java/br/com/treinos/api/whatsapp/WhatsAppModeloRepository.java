package br.com.treinos.api.whatsapp;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

/** Toda consulta sai filtrada pela consultoria da sessão ({@code @TenantId}). */
public interface WhatsAppModeloRepository extends JpaRepository<WhatsAppModelo, UUID> {

    Optional<WhatsAppModelo> findByTipo(TipoDeAviso tipo);
}
