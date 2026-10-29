package br.com.treinos.api.pagamentos;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Lembretes de cobrança por e-mail. A configuração de cada consultoria fica no banco ({@code lembrete_configuracao}); aqui só
 * se liga ou não o job agendado ({@code TREINOS_PAGAMENTOS_LEMBRETES_AGENDADOS}, padrão ligado): os testes o desligam e
 * chamam {@link LembretesDeCobranca#rodar} à mão, como fazem com a conciliação.
 */
@ConfigurationProperties("treinos.pagamentos.lembretes")
public record LembretesProperties(Boolean agendados) {

    public LembretesProperties {
        agendados = agendados == null || agendados;
    }
}
