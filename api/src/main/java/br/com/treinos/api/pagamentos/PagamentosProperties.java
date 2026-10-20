package br.com.treinos.api.pagamentos;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Pagamentos do aluno ao treinador ({@code TREINOS_PAGAMENTOS_HABILITADO}). Desligado por padrão: as rotas do financeiro
 * respondem 503 {@code FINANCEIRO_INDISPONIVEL}. Exportar, apagar (LGPD) e encerrar a contratação do aluno que saiu
 * ({@link PagamentosDoAluno}) rodam sempre, com a chave ligada ou não.
 *
 * @param chaves     chaves AES-256 que cifram a API Key do treinador ({@code id:base64 de 32 bytes}, separadas por vírgula)
 * @param chaveAtiva id da chave de {@code chaves} que cifra o que é gravado agora; as demais só decifram
 * @param pagarNoIos     chave da plataforma: o app mostra o "Pagar" no iOS (só UI; o servidor não distingue plataforma)
 * @param pagarNoAndroid idem no Android
 */
@ConfigurationProperties("treinos.pagamentos")
public record PagamentosProperties(boolean habilitado, String chaves, String chaveAtiva, boolean pagarNoIos,
                                   boolean pagarNoAndroid) {

    public PagamentosProperties {
        chaves = chaves == null ? "" : chaves.trim();
        chaveAtiva = chaveAtiva == null ? "" : chaveAtiva.trim();
    }

    /** Sem as chaves: este objeto pode ir parar num log. */
    @Override
    public String toString() {
        return "PagamentosProperties[habilitado=" + habilitado + "]";
    }
}
