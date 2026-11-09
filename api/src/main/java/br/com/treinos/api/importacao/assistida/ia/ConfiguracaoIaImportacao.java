package br.com.treinos.api.importacao.assistida.ia;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Propriedades de configuração dos conectores de inteligência artificial da importação assistida.
 */
@Component
@ConfigurationProperties(prefix = "treinos.importacao.ia")
public class ConfiguracaoIaImportacao {

    private String provedor = "regras";
    private String modeloPadrao = "gemini-2.5-flash";
    private String modeloForte = "gemini-2.5-pro";
    private String geminiApiKey = "";
    private String claudeApiKey = "";
    // Fail-closed: sem esta chave ligada nada sai do servidor, mesmo com provedor e chave de API configurados.
    private boolean enviarDadosAoProvedor;

    public String getProvedor() {
        return provedor != null ? provedor.strip().toLowerCase(java.util.Locale.ROOT) : "regras";
    }

    public void setProvedor(String provedor) {
        this.provedor = provedor;
    }

    public String getModeloPadrao() {
        return modeloPadrao;
    }

    public void setModeloPadrao(String modeloPadrao) {
        this.modeloPadrao = modeloPadrao;
    }

    public String getModeloForte() {
        return modeloForte;
    }

    public void setModeloForte(String modeloForte) {
        this.modeloForte = modeloForte;
    }

    public String getGeminiApiKey() {
        return geminiApiKey != null ? geminiApiKey.strip() : "";
    }

    public void setGeminiApiKey(String geminiApiKey) {
        this.geminiApiKey = geminiApiKey;
    }

    public String getClaudeApiKey() {
        return claudeApiKey != null ? claudeApiKey.strip() : "";
    }

    public void setClaudeApiKey(String claudeApiKey) {
        this.claudeApiKey = claudeApiKey;
    }

    public boolean isEnviarDadosAoProvedor() {
        return enviarDadosAoProvedor;
    }

    public void setEnviarDadosAoProvedor(boolean enviarDadosAoProvedor) {
        this.enviarDadosAoProvedor = enviarDadosAoProvedor;
    }

    public boolean temChaveGemini() {
        return !getGeminiApiKey().isBlank();
    }

    public boolean temChaveClaude() {
        return !getClaudeApiKey().isBlank();
    }
}
