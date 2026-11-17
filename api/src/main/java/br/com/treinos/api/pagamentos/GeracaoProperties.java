package br.com.treinos.api.pagamentos;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * A rotina diária que gera as mensalidades ({@code TREINOS_PAGAMENTOS_GERACAO_AGENDADA}, padrão ligada): os testes a desligam e
 * chamam {@link RotinaDeGeracaoDeCobrancas#rodar} à mão, como fazem com a conciliação e os lembretes.
 */
@ConfigurationProperties("treinos.pagamentos.geracao")
public record GeracaoProperties(Boolean agendada) {

    public GeracaoProperties {
        agendada = agendada == null || agendada;
    }
}
