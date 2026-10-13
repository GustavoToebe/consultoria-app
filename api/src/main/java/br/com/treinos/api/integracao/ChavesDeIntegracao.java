package br.com.treinos.api.integracao;

import org.springframework.stereotype.Component;

import java.net.URI;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Chaves HMAC lidas uma vez, na subida. Configuração errada derruba a API na hora, com mensagem clara; deixar para a
 * primeira chamada faria toda rota {@code /integracao} responder 500. Os segredos têm no mínimo 32 bytes (contrato 2.1).
 */
@Component
public class ChavesDeIntegracao {

    static final int SEGREDO_MINIMO_BYTES = 32;

    /** Classe e não record: record com array compara e imprime pela referência (e o segredo não deve ir para log). */
    public static final class Chave {
        private final String id;
        private final byte[] segredo;

        public Chave(String id, byte[] segredo) {
            this.id = id;
            this.segredo = segredo;
        }

        public String id() {
            return id;
        }

        public byte[] segredo() {
            return segredo;
        }

        @Override
        public String toString() {
            return "Chave[id=" + id + "]";
        }
    }

    private final IntegracaoProperties propriedades;
    private final Map<String, Chave> entrada;
    private final Chave saida;

    public ChavesDeIntegracao(IntegracaoProperties propriedades) {
        this.propriedades = propriedades;
        this.entrada = lerEntrada(propriedades.chavesEntrada());
        this.saida = lerSaida(propriedades);
        if (propriedades.ativa()) {
            exigirConfiguracaoCompleta(propriedades);
        }
    }

    public Optional<Chave> entrada(String id) {
        return Optional.ofNullable(entrada.get(id));
    }

    /** Chave com que este app assina as chamadas à Central. */
    public Optional<Chave> saida() {
        return Optional.ofNullable(saida);
    }

    public boolean ativa() {
        return propriedades.ativa();
    }

    static Map<String, Chave> lerEntrada(String texto) {
        Map<String, Chave> chaves = new LinkedHashMap<>();
        if (texto == null || texto.isBlank()) {
            return chaves;
        }
        for (String item : texto.split(",")) {
            if (item.isBlank()) {
                continue;
            }
            String[] partes = item.trim().split(":", -1);
            if (partes.length != 2) {
                throw new IllegalStateException("TREINOS_INTEGRACAO_CHAVES_ENTRADA: cada chave deve ser id:segredoBase64"
                        + " (o código do produto não entra aqui; é a Central que escopa a chave a TREINOS).");
            }
            Chave chave = chave(partes[0], partes[1], "TREINOS_INTEGRACAO_CHAVES_ENTRADA");
            if (chaves.putIfAbsent(chave.id(), chave) != null) {
                throw new IllegalStateException("TREINOS_INTEGRACAO_CHAVES_ENTRADA: identificador repetido: " + chave.id());
            }
        }
        if (chaves.size() > 2) {
            throw new IllegalStateException("TREINOS_INTEGRACAO_CHAVES_ENTRADA: no máximo duas chaves ativas (troca sem parada).");
        }
        return chaves;
    }

    private static Chave lerSaida(IntegracaoProperties p) {
        if (p.chaveSaidaId().isEmpty() && p.chaveSaidaSegredo().isEmpty()) {
            return null;
        }
        return chave(p.chaveSaidaId(), p.chaveSaidaSegredo(), "TREINOS_INTEGRACAO_CHAVE_SAIDA_*");
    }

    private static Chave chave(String id, String segredoBase64, String origem) {
        String identificador = id == null ? "" : id.trim();
        if (!identificador.matches("[A-Za-z0-9._-]{1,80}")) {
            throw new IllegalStateException(origem + ": identificador de chave inválido (use letras, números, ponto, hífen ou sublinhado).");
        }
        byte[] segredo;
        try {
            segredo = Base64.getDecoder().decode(segredoBase64 == null ? "" : segredoBase64.trim());
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException(origem + ": o segredo da chave '" + identificador + "' não está em Base64.");
        }
        if (segredo.length < SEGREDO_MINIMO_BYTES) {
            throw new IllegalStateException(origem + ": o segredo da chave '" + identificador + "' precisa ter pelo menos "
                    + SEGREDO_MINIMO_BYTES + " bytes.");
        }
        return new Chave(identificador, segredo);
    }

    private void exigirConfiguracaoCompleta(IntegracaoProperties p) {
        if (entrada.isEmpty()) {
            throw new IllegalStateException("TREINOS_INTEGRACAO_ATIVA=true exige TREINOS_INTEGRACAO_CHAVES_ENTRADA.");
        }
        if (saida == null) {
            throw new IllegalStateException("TREINOS_INTEGRACAO_ATIVA=true exige TREINOS_INTEGRACAO_CHAVE_SAIDA_ID e _SEGREDO.");
        }
        try {
            URI uri = URI.create(p.centralUrl());
            if (uri.getHost() == null || !("https".equals(uri.getScheme()) || "http".equals(uri.getScheme()))) {
                throw new IllegalArgumentException();
            }
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("TREINOS_INTEGRACAO_ATIVA=true exige TREINOS_INTEGRACAO_CENTRAL_URL (http/https com host).");
        }
    }
}
