package br.com.treinos.api.integracao;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Configuração da integração com a Central ({@code TREINOS_INTEGRACAO_*}). Tudo vem de variável de ambiente, sem valor
 * padrão de segredo. Com {@code ativa=false} (padrão) nada fala com a Central: Minha conta usa os dados locais de
 * demonstração. Com {@code ativa=true} a API só sobe se as chaves e a URL estiverem completas ({@link ChavesDeIntegracao}).
 *
 * @param chavesEntrada chaves com que a Central assina para o Saraiva: {@code id:segredoBase64[,id:segredoBase64]}
 * @param chaveSaidaId chave com que o Saraiva assina as chamadas à Central
 * @param chaveSaidaSegredo segredo da chave de saída, em Base64
 * @param centralUrl URL base da Central (só esquema, host e porta, sem o caminho {@code /integracao})
 * @param produto código do produto na Central (padrão {@code TREINOS})
 * @param toleranciaHoras tempo máximo sem a Central confirmar o estado antes de suspender o acesso (padrão 72)
 * @param bloqueioAtivo aplica a regra de acesso por direitos no login e nas requisições (padrão desligado)
 */
@ConfigurationProperties("treinos.integracao")
public record IntegracaoProperties(boolean ativa, String chavesEntrada, String chaveSaidaId, String chaveSaidaSegredo,
                                   String centralUrl, String produto, Integer toleranciaHoras, boolean bloqueioAtivo) {

    public static final String PRODUTO_PADRAO = "TREINOS";
    public static final int TOLERANCIA_PADRAO_HORAS = 72;

    public IntegracaoProperties {
        chavesEntrada = vazioSeNulo(chavesEntrada);
        chaveSaidaId = vazioSeNulo(chaveSaidaId);
        chaveSaidaSegredo = vazioSeNulo(chaveSaidaSegredo);
        centralUrl = vazioSeNulo(centralUrl);
        produto = produto == null || produto.isBlank() ? PRODUTO_PADRAO : produto.trim();
        toleranciaHoras = toleranciaHoras == null || toleranciaHoras < 1 ? TOLERANCIA_PADRAO_HORAS : toleranciaHoras;
    }

    private static String vazioSeNulo(String valor) {
        return valor == null ? "" : valor.trim();
    }

    /** Sem segredo nenhum: este objeto pode ir parar num log. */
    @Override
    public String toString() {
        return "IntegracaoProperties[ativa=" + ativa + ", produto=" + produto + ", centralUrl=" + centralUrl
                + ", toleranciaHoras=" + toleranciaHoras + ", bloqueioAtivo=" + bloqueioAtivo + "]";
    }
}
