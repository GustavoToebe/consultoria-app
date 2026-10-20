package br.com.treinos.api.pagamentos;

import org.springframework.stereotype.Component;

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
 * Cifra a API Key do treinador (AES-256-GCM), no formato do MFA da biblioteca: {@code v1:<chave>:<nonce>:<texto>}. As
 * chaves ficam fora do banco, e o dado autenticado traz a consultoria, então um segredo copiado de outra consultoria (ou
 * de outro uso) não decifra. A troca de chave é por id: a ativa cifra o novo e as demais continuam decifrando o antigo.
 * Nada aqui guarda, devolve em erro nem imprime o segredo ou as chaves.
 */
@Component
public class CifraDePagamento {

    private static final String CONTEXTO = "consultoria:pagamentos:";

    private final Map<String, SecretKeySpec> chaves = new HashMap<>();
    private final String ativa;
    private final SecureRandom aleatorio = new SecureRandom();

    public CifraDePagamento(PagamentosProperties propriedades) {
        this.ativa = propriedades.chaveAtiva();
        String lista = propriedades.chaves();
        if (!lista.isBlank()) {
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
                    throw new IllegalStateException(
                            "TREINOS_PAGAMENTOS_CHAVES inválida (formato id:base64 de 32 bytes, ids únicos).");
                }
            }
        }
        if ((!ativa.isBlank() || !chaves.isEmpty()) && !chaves.containsKey(ativa)) {
            throw new IllegalStateException("TREINOS_PAGAMENTOS_CHAVE_ATIVA não está em TREINOS_PAGAMENTOS_CHAVES.");
        }
    }

    /** Há chave ativa: dá para cifrar. Sem ela, nenhuma API Key nova é aceita. */
    public boolean configurada() {
        return chaves.containsKey(ativa);
    }

    /** Os ids das chaves configuradas (não são segredo), para conferir o que já está gravado. */
    Set<String> idsDasChaves() {
        return Set.copyOf(chaves.keySet());
    }

    public String cifrar(UUID consultoriaId, String segredo) {
        if (!configurada()) {
            throw new CifraIndisponivelException();
        }
        try {
            byte[] nonce = new byte[12];
            aleatorio.nextBytes(nonce);
            Cipher cifra = cifra(Cipher.ENCRYPT_MODE, chaves.get(ativa), nonce, consultoriaId);
            return "v1:" + ativa + ":" + Base64.getEncoder().encodeToString(nonce) + ":"
                    + Base64.getEncoder().encodeToString(cifra.doFinal(segredo.getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException e) {
            throw new CifraIndisponivelException();
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
            throw new CifraIndisponivelException();
        }
    }

    private static Cipher cifra(int modo, SecretKeySpec chave, byte[] nonce, UUID consultoriaId)
            throws GeneralSecurityException {
        Cipher cifra = Cipher.getInstance("AES/GCM/NoPadding");
        cifra.init(modo, chave, new GCMParameterSpec(128, nonce));
        cifra.updateAAD((CONTEXTO + consultoriaId).getBytes(StandardCharsets.UTF_8));
        return cifra;
    }

    @Override
    public String toString() {
        return "CifraDePagamento[configurada=" + configurada() + "]";
    }
}
