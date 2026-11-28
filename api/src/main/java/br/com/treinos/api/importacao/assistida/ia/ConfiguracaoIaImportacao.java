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
    private String geminiModelo = "gemini-2.5-flash";
    private String geminiApiKey = "";
    private String claudeApiKey = "";
    private String claudeModelo = "claude-haiku-5-5";
    private String claudeEsforco = "medium";
    // Fail-closed: sem esta chave ligada nada sai do servidor, mesmo com provedor e chave de API configurados.
    private boolean enviarDadosAoProvedor;
    // D1/D8: o PDF ou a imagem inteiros ao Claude, só como reserva da extração de texto; desligada por padrão.
    private boolean enviarArquivoAoProvedor;

    public String getProvedor() {
        return provedor != null ? provedor.strip().toLowerCase(java.util.Locale.ROOT) : "regras";
    }

    public void setProvedor(String provedor) {
        this.provedor = provedor;
    }

    public String getGeminiModelo() {
        return geminiModelo == null || geminiModelo.isBlank() ? "gemini-2.5-flash" : geminiModelo.strip();
    }

    public void setGeminiModelo(String geminiModelo) {
        this.geminiModelo = geminiModelo;
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

    public String getClaudeModelo() {
        return claudeModelo == null || claudeModelo.isBlank() ? "claude-haiku-5-5" : claudeModelo.strip();
    }

    public void setClaudeModelo(String claudeModelo) {
        this.claudeModelo = claudeModelo;
    }

    public String getClaudeEsforco() {
        return claudeEsforco == null || claudeEsforco.isBlank()
                ? "medium" : claudeEsforco.strip().toLowerCase(java.util.Locale.ROOT);
    }

    public void setClaudeEsforco(String claudeEsforco) {
        this.claudeEsforco = claudeEsforco;
    }

    public boolean isEnviarDadosAoProvedor() {
        return enviarDadosAoProvedor;
    }

    public void setEnviarDadosAoProvedor(boolean enviarDadosAoProvedor) {
        this.enviarDadosAoProvedor = enviarDadosAoProvedor;
    }

    public boolean isEnviarArquivoAoProvedor() {
        return enviarArquivoAoProvedor;
    }

    public void setEnviarArquivoAoProvedor(boolean enviarArquivoAoProvedor) {
        this.enviarArquivoAoProvedor = enviarArquivoAoProvedor;
    }

    /**
     * O arquivo vai de fato ao provedor: as duas chaves ligadas, provedor {@code claude} (o único conector que lê PDF e
     * imagem) e a chave da API dele. É o que o {@code GET /eu} diz e o que libera JPG e PNG no envio.
     */
    public boolean arquivoVaiAoProvedor() {
        return enviarArquivoAoProvedor && enviarDadosAoProvedor && "claude".equals(getProvedor()) && temChaveClaude();
    }

    public boolean temChaveGemini() {
        return !getGeminiApiKey().isBlank();
    }

    public boolean temChaveClaude() {
        return !getClaudeApiKey().isBlank();
    }
}
