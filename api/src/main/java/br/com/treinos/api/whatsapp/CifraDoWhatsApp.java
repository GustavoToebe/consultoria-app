package br.com.treinos.api.whatsapp;

import br.com.treinos.api.security.CifraAesGcm;
import org.springframework.stereotype.Component;

import java.util.Set;
import java.util.UUID;

/**
 * Cifra o token de acesso da Meta de cada consultoria com {@link CifraAesGcm} e as chaves próprias do WhatsApp
 * ({@code TREINOS_WHATSAPP_CHAVES} e {@code TREINOS_WHATSAPP_CHAVE_ATIVA}, nunca as dos pagamentos). O contexto é outro: um
 * segredo dos pagamentos copiado para cá não decifra. Nada aqui guarda, devolve em erro nem imprime o token ou as chaves.
 */
@Component
public class CifraDoWhatsApp {

    private static final String CONTEXTO = "consultoria:whatsapp:";

    private final CifraAesGcm cifra;

    public CifraDoWhatsApp(WhatsAppProperties propriedades) {
        this.cifra = new CifraAesGcm(CONTEXTO, propriedades.chaves(), propriedades.chaveAtiva(),
                "TREINOS_WHATSAPP_CHAVES", "TREINOS_WHATSAPP_CHAVE_ATIVA");
    }

    public boolean configurada() {
        return cifra.configurada();
    }

    Set<String> idsDasChaves() {
        return cifra.idsDasChaves();
    }

    public String cifrar(UUID consultoriaId, String token) {
        try {
            return cifra.cifrar(consultoriaId, token);
        } catch (CifraAesGcm.Falha e) {
            throw new CifraDoWhatsAppIndisponivelException();
        }
    }

    public String decifrar(UUID consultoriaId, String valor) {
        try {
            return cifra.decifrar(consultoriaId, valor);
        } catch (CifraAesGcm.Falha e) {
            throw new CifraDoWhatsAppIndisponivelException();
        }
    }

    @Override
    public String toString() {
        return "CifraDoWhatsApp[configurada=" + configurada() + "]";
    }
}
