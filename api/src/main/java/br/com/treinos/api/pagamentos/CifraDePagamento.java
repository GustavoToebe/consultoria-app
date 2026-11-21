package br.com.treinos.api.pagamentos;

import br.com.treinos.api.security.CifraAesGcm;
import org.springframework.stereotype.Component;

import java.util.Set;
import java.util.UUID;

/**
 * Cifra a API Key do treinador (AES-256-GCM), no formato do MFA da biblioteca: {@code v1:<chave>:<nonce>:<texto>}. O
 * algoritmo é o de {@link CifraAesGcm} (compartilhado com o WhatsApp); aqui ficam só as chaves dos pagamentos e o erro 503
 * deste módulo. As chaves ficam fora do banco, e o dado autenticado traz a consultoria. Nada aqui guarda, devolve em erro nem
 * imprime o segredo ou as chaves.
 */
@Component
public class CifraDePagamento {

    private static final String CONTEXTO = "consultoria:pagamentos:";

    private final CifraAesGcm cifra;

    public CifraDePagamento(PagamentosProperties propriedades) {
        this.cifra = new CifraAesGcm(CONTEXTO, propriedades.chaves(), propriedades.chaveAtiva(),
                "TREINOS_PAGAMENTOS_CHAVES", "TREINOS_PAGAMENTOS_CHAVE_ATIVA");
    }

    /** Há chave ativa: dá para cifrar. Sem ela, nenhuma API Key nova é aceita. */
    public boolean configurada() {
        return cifra.configurada();
    }

    /** Os ids das chaves configuradas (não são segredo), para conferir o que já está gravado. */
    Set<String> idsDasChaves() {
        return cifra.idsDasChaves();
    }

    public String cifrar(UUID consultoriaId, String segredo) {
        try {
            return cifra.cifrar(consultoriaId, segredo);
        } catch (CifraAesGcm.Falha e) {
            throw new CifraIndisponivelException();
        }
    }

    public String decifrar(UUID consultoriaId, String valor) {
        try {
            return cifra.decifrar(consultoriaId, valor);
        } catch (CifraAesGcm.Falha e) {
            throw new CifraIndisponivelException();
        }
    }

    @Override
    public String toString() {
        return "CifraDePagamento[configurada=" + configurada() + "]";
    }
}
