package br.com.treinos.api.pagamentos.provedor;

import java.util.UUID;

/**
 * A credencial com que o serviço chama o provedor em nome de uma consultoria: a conta (InfiniteTag, sem o {@code $}) e o
 * segredo (API Key já decifrada; {@code null} quando o treinador não tem). O provedor não lê banco: quem resolve a
 * credencial é o serviço, que a passa por parâmetro. {@code toString} só traz o id da consultoria: nem conta nem segredo.
 */
public record CredencialDoProvedor(UUID consultoriaId, String conta, String segredo) {

    @Override
    public String toString() {
        return "CredencialDoProvedor[consultoriaId=" + consultoriaId + "]";
    }
}
