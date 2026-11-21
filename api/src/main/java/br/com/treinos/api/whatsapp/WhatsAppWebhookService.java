package br.com.treinos.api.whatsapp;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.plataforma.comum.web.CorpoExcedidoException;
import br.com.plataforma.comum.web.ForbiddenException;
import br.com.plataforma.comum.web.UnauthorizedException;
import br.com.treinos.api.whatsapp.WhatsAppRepositorio.Achado;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * O webhook da Meta. O app secret e o verify token vêm da configuração (nunca de resposta, log ou erro). O {@code POST} só é
 * interpretado depois de a assinatura {@code X-Hub-Signature-256} (HMAC-SHA256 do corpo cru com o app secret) bater, em tempo
 * constante; assinatura ausente, malformada ou errada é 401 sem gravar nada. Cada {@code status} atualiza a linha da fila pelo id
 * da mensagem na Meta, só para frente e só situação e data; id desconhecido é ignorado (a mensagem recebida do aluno também: o
 * Nível 2 não guarda nada dela). Corrida conhecida: um status que chega antes de o job gravar o id da mensagem não acha a linha
 * e é ignorado.
 */
@Service
public class WhatsAppWebhookService {

    /** Teto do corpo (a Meta manda poucos KiB; mais que isso não é dela). */
    public static final int MAXIMO_DO_CORPO = 64 * 1024;

    private static final String PREFIXO_DA_ASSINATURA = "sha256=";
    private static final Pattern DESAFIO = Pattern.compile("^[A-Za-z0-9_-]{1,200}$");
    private static final Pattern HEX = Pattern.compile("^[0-9a-f]{64}$");

    private final WhatsAppProperties propriedades;
    private final WhatsAppRepositorio fila;
    private final JsonMapper json;

    WhatsAppWebhookService(WhatsAppProperties propriedades, WhatsAppRepositorio fila, JsonMapper json) {
        this.propriedades = propriedades;
        this.fila = fila;
        this.json = json;
    }

    /** O {@code GET} de cadastro: devolve o desafio só se o modo e o verify token batem; senão 403. */
    public String verificar(String modo, String verifyToken, String desafio) {
        boolean bate = "subscribe".equals(modo) && verifyToken != null && iguais(verifyToken, propriedades.metaVerifyToken());
        if (!bate) {
            throw new ForbiddenException("Verificação recusada.");
        }
        if (desafio == null || !DESAFIO.matcher(desafio).matches()) {
            throw new BadRequestException("Desafio inválido.", "DESAFIO_INVALIDO");
        }
        return desafio;
    }

    /** O {@code POST}: confere a assinatura do corpo cru e só então o interpreta. */
    @Transactional
    public void receber(byte[] corpo, String assinatura) {
        if (corpo.length > MAXIMO_DO_CORPO) {
            throw new CorpoExcedidoException();
        }
        if (!assinaturaValida(corpo, assinatura)) {
            throw new UnauthorizedException("Assinatura inválida.", "ASSINATURA_INVALIDA");
        }
        JsonNode raiz;
        try {
            raiz = json.readTree(corpo);
        } catch (RuntimeException e) {
            throw new BadRequestException("Aviso inválido.", "AVISO_INVALIDO");
        }
        for (JsonNode entrada : raiz.path("entry")) {
            for (JsonNode mudanca : entrada.path("changes")) {
                for (JsonNode status : mudanca.path("value").path("statuses")) {
                    aplicar(status);
                }
            }
        }
    }

    private void aplicar(JsonNode status) {
        String id = status.path("id").asString("");
        if (id.isBlank() || id.length() > 120) {
            return;
        }
        Optional<Achado> achado = fila.acharPeloIdExterno(id);
        if (achado.isEmpty()) {
            return;
        }
        Achado linha = achado.get();
        switch (status.path("status").asString("")) {
            case "delivered" -> fila.entregue(linha.consultoriaId(), linha.id());
            case "read" -> fila.lido(linha.consultoriaId(), linha.id());
            case "failed" -> fila.falhouDepoisDeEnviado(linha.consultoriaId(), linha.id(), codigoDoErro(status));
            default -> {
                // "sent" já é o que a fila sabe (ENVIADO); o resto não interessa.
            }
        }
    }

    /** {@code META_<código>} do primeiro erro do status, ou {@code META_FALHA}: só dígitos, nunca o texto da Meta. */
    private static String codigoDoErro(JsonNode status) {
        int codigo = status.path("errors").path(0).path("code").asInt(-1);
        return codigo > 0 ? "META_" + codigo : "META_FALHA";
    }

    private boolean assinaturaValida(byte[] corpo, String assinatura) {
        if (assinatura == null || !assinatura.startsWith(PREFIXO_DA_ASSINATURA)) {
            return false;
        }
        String recebida = assinatura.substring(PREFIXO_DA_ASSINATURA.length()).toLowerCase(java.util.Locale.ROOT);
        if (!HEX.matcher(recebida).matches() || propriedades.metaAppSecret().isEmpty()) {
            return false;
        }
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(propriedades.metaAppSecret().getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            String esperada = java.util.HexFormat.of().formatHex(mac.doFinal(corpo));
            return iguais(esperada, recebida);
        } catch (GeneralSecurityException e) {
            return false;
        }
    }

    /** Comparação em tempo constante (para textos do mesmo tamanho; de tamanhos diferentes só revela o tamanho). */
    private static boolean iguais(String a, String b) {
        return MessageDigest.isEqual(a.getBytes(StandardCharsets.UTF_8), b.getBytes(StandardCharsets.UTF_8));
    }
}
