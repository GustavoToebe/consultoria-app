package br.com.treinos.api.comunidade;

import br.com.plataforma.comum.web.ApiError;
import br.com.treinos.api.fotos.FotoException;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/**
 * "Usar a capa do YouTube" (C25, D20): do link da equipe sai só o id do vídeo, o servidor baixa a miniatura do host fixo do
 * YouTube ({@link YoutubeCapaCliente}) e a grava como uma capa pendente comum, pela mesma limpeza do envio manual
 * ({@code CapasDaComunidadeService}) e no mesmo teto diário. Não é transacional de propósito: a rede nunca roda com
 * transação aberta. Ordem: id (422) → vaga do teto (422), gasta antes do download e não devolvida se ele falhar → download
 * (503 neutro) → limpeza e gravação. Nada do usuário sai do servidor e nada do link nem do id vai a log.
 */
@Service
public class CapaDoYoutubeService {

    static final ApiError.FieldError LINK_INVALIDO = new ApiError.FieldError("videoUrl", "Use o link de um vídeo do YouTube.");

    private final CapasDaComunidadeService capas;
    private final YoutubeCapaCliente cliente;

    CapaDoYoutubeService(CapasDaComunidadeService capas, YoutubeCapaCliente cliente) {
        this.capas = capas;
        this.cliente = cliente;
    }

    public UUID criar(String videoUrl) {
        String id = IdDoYoutube.extrair(videoUrl);
        if (id == null) {
            throw new ValidacaoException("Link não aceito.", "CAPA_INVALIDA", List.of(LINK_INVALIDO));
        }
        capas.reservarVaga();
        byte[] jpeg = cliente.baixar(id);
        if (jpeg == null) {
            throw new CapaDoYoutubeException();
        }
        try {
            return capas.gravarComVagaReservada(jpeg);
        } catch (FotoException e) {
            // O YouTube mandou algo que a limpeza recusa (truncado, grande demais): para a equipe é o mesmo 503 neutro.
            throw new CapaDoYoutubeException();
        }
    }
}
