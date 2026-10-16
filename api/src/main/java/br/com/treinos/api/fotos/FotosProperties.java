package br.com.treinos.api.fotos;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.net.URI;

/**
 * Armazenamento das fotos de atualização ({@code TREINOS_FOTOS_*}). Desligado por padrão: sem {@code habilitado=true} a
 * pergunta FOTOS continua sem envio e nenhuma outra variável é lida. Ligado, a API só sobe com endpoint, bucket, chave e
 * segredo preenchidos (sem chamada de rede na subida: um erro do R2 não pode derrubar a produção). Segredos só em variável de
 * ambiente, sem valor padrão.
 *
 * @param endpoint endereço S3 do bucket (R2: {@code https://<conta>.r2.cloudflarestorage.com})
 * @param chave access key id do token com Object Read &amp; Write só no bucket das fotos
 * @param segredo secret access key do mesmo token
 * @param regiao região para assinar as chamadas ({@code auto} no R2)
 * @param manutencaoAtiva liga os jobs de remoção e de limpeza das pendentes (desligado só nos testes, que os chamam à mão)
 */
@ConfigurationProperties("treinos.fotos")
public record FotosProperties(boolean habilitado, String endpoint, String bucket, String chave, String segredo, String regiao,
                              Boolean manutencaoAtiva) {

    public FotosProperties {
        endpoint = limpar(endpoint);
        bucket = limpar(bucket);
        chave = limpar(chave);
        segredo = limpar(segredo);
        regiao = limpar(regiao).isEmpty() ? "auto" : limpar(regiao);
        manutencaoAtiva = manutencaoAtiva == null || manutencaoAtiva;
    }

    /** Falha a subida, dizendo só o NOME da variável que falta (nunca o valor). */
    void exigirCompleta() {
        faltando(endpoint, "TREINOS_FOTOS_ENDPOINT");
        faltando(bucket, "TREINOS_FOTOS_BUCKET");
        faltando(chave, "TREINOS_FOTOS_CHAVE");
        faltando(segredo, "TREINOS_FOTOS_SEGREDO");
        URI uri = URI.create(endpoint);
        if (uri.getHost() == null || !("https".equals(uri.getScheme()) || "http".equals(uri.getScheme()))) {
            throw new IllegalStateException("TREINOS_FOTOS_ENDPOINT precisa ser uma URL http(s) completa.");
        }
    }

    private static void faltando(String valor, String nome) {
        if (valor.isEmpty()) {
            throw new IllegalStateException("Fotos ligadas (TREINOS_FOTOS_HABILITADO=true), mas falta " + nome + ".");
        }
    }

    private static String limpar(String valor) {
        return valor == null ? "" : valor.trim();
    }

    /** Sem segredo nenhum: este objeto pode ir parar num log. */
    @Override
    public String toString() {
        return "FotosProperties[habilitado=" + habilitado + "]";
    }
}
