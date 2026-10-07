package br.com.treinos.api.tenant;

import org.hibernate.cfg.MultiTenancySettings;
import org.springframework.boot.hibernate.autoconfigure.HibernatePropertiesCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Liga o {@link TenantIdentifierResolver} ao Hibernate. Para a estratégia por discriminador ({@code @TenantId}) é o
 * único ajuste necessário (igual ao Servirea). No Boot 4.1 o customizer fica em
 * {@code org.springframework.boot.hibernate.autoconfigure}.
 */
@Configuration
public class TenantConfiguration {

    @Bean
    public HibernatePropertiesCustomizer tenantIdentifierResolverCustomizer(TenantIdentifierResolver resolver) {
        return propriedades -> propriedades.put(MultiTenancySettings.MULTI_TENANT_IDENTIFIER_RESOLVER, resolver);
    }
}
