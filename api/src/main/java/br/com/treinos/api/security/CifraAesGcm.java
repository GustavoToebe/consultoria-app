package br.com.treinos.api.security;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * O algoritmo de cifra de segredo por consultoria (AES-256-GCM), no formato do MFA da biblioteca:
 * {@code v1:<chave>:<nonce>:<texto>}. Sem estado de negócio: cada uso (pagamentos, WhatsApp) cria a sua com o próprio
 * {@code contexto}, que entra no dado autenticado junto da consultoria; um segredo copiado de outra consultoria (ou de outro uso)
 * não decifra. A troca de chave é por id: a ativa cifra o novo e as demais continuam decifrando o antigo. Nada aqui guarda,
 * devolve em erro nem imprime o segredo ou as chaves.
 */
public final class CifraAesGcm {

    /** Não deu para cifrar ou decifrar (sem chave ativa, dado adulterado, outra consultoria). Nunca leva segredo nem causa. */
    public static final class Falha extends RuntimeException {
        private static final long serialVersionUID = 1L;

        Falha() {
            super("Falha na cifra.", null, false, false);
        }
    }

    private final String contexto;
    private final Map<String, SecretKeySpec> chaves = new HashMap<>();
    private final String ativa;
    private final SecureRandom aleatorio = new SecureRandom();

    /**
     * @param contexto     prefixo do dado autenticado (ex.: {@code consultoria:pagamentos:}); não é segredo, mas separa os usos
     * @param lista        {@code id:base64 de 32 bytes}, separados por vírgula; vazio = sem chave
     * @param chaveAtiva   id da chave de {@code lista} que cifra agora
     * @param nomeDaLista  nome da variável de ambiente da lista, só para a mensagem da subida recusada
     * @param nomeDaAtiva  nome da variável da chave ativa, idem
     */
    public CifraAesGcm(String contexto, String lista, String chaveAtiva, String nomeDaLista, String nomeDaAtiva) {
        this.contexto = contexto;
        this.ativa = chaveAtiva == null ? "" : chaveAtiva;
        if (lista != null && !lista.isBlank()) {
            for (String item : lista.split(",", -1)) {
                String[] partes = item.trim().split(":", -1);
                try {
                    if (partes.length != 2 || !partes[0].matches("[A-Za-z0-9_-]{1,40}")) {
                        throw new IllegalArgumentException();
                    }
                    byte[] chave = Base64.getDecoder().decode(partes[1]);
                    if (chave.length != 32 || chaves.putIfAbsent(partes[0], new SecretKeySpec(chave, "AES")) != null) {
                        throw new IllegalArgumentException();
                    }
                } catch (IllegalArgumentException e) {
                    throw new IllegalStateException(nomeDaLista + " inválida (formato id:base64 de 32 bytes, ids únicos).");
                }
            }
        }
        if ((!ativa.isBlank() || !chaves.isEmpty()) && !chaves.containsKey(ativa)) {
            throw new IllegalStateException(nomeDaAtiva + " não está em " + nomeDaLista + ".");
        }
    }

    /** Há chave ativa: dá para cifrar. */
    public boolean configurada() {
        return chaves.containsKey(ativa);
    }

    /** Os ids das chaves configuradas (não são segredo), para conferir o que já está gravado. */
    public Set<String> idsDasChaves() {
        return Set.copyOf(chaves.keySet());
    }

    public String cifrar(UUID consultoriaId, String segredo) {
        if (!configurada()) {
            throw new Falha();
        }
        try {
            byte[] nonce = new byte[12];
            aleatorio.nextBytes(nonce);
            Cipher cifra = cifra(Cipher.ENCRYPT_MODE, chaves.get(ativa), nonce, consultoriaId);
            return "v1:" + ativa + ":" + Base64.getEncoder().encodeToString(nonce) + ":"
                    + Base64.getEncoder().encodeToString(cifra.doFinal(segredo.getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException e) {
            throw new Falha();
        }
    }

    public String decifrar(UUID consultoriaId, String valor) {
        try {
            String[] partes = valor.split(":", -1);
            if (partes.length != 4 || !"v1".equals(partes[0]) || !chaves.containsKey(partes[1])) {
                throw new IllegalArgumentException();
            }
            byte[] nonce = Base64.getDecoder().decode(partes[2]);
            if (nonce.length != 12) {
                throw new IllegalArgumentException();
            }
            Cipher cifra = cifra(Cipher.DECRYPT_MODE, chaves.get(partes[1]), nonce, consultoriaId);
            return new String(cifra.doFinal(Base64.getDecoder().decode(partes[3])), StandardCharsets.UTF_8);
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            throw new Falha();
        }
    }

    private Cipher cifra(int modo, SecretKeySpec chave, byte[] nonce, UUID consultoriaId) throws GeneralSecurityException {
        Cipher cifra = Cipher.getInstance("AES/GCM/NoPadding");
        cifra.init(modo, chave, new GCMParameterSpec(128, nonce));
        cifra.updateAAD((contexto + consultoriaId).getBytes(StandardCharsets.UTF_8));
        return cifra;
    }

    @Override
    public String toString() {
        return "CifraAesGcm[configurada=" + configurada() + "]";
    }
}
