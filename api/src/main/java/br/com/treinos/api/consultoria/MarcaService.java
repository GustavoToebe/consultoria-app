package br.com.treinos.api.consultoria;

import br.com.treinos.api.web.ApiException;
import br.com.treinos.api.web.ConflitoException;
import br.com.treinos.api.web.NaoEncontradoException;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/** Marca (nome, cor, fonte, tema, logo) da consultoria da sessão. */
@Service
public class MarcaService {

    public static final int LOGO_MAXIMO_BYTES = 512 * 1024;
    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n'};

    public record MarcaRequest(
            @NotBlank @Size(max = 120) String nome,
            @NotNull @Pattern(regexp = "^#[0-9A-Fa-f]{6}$", message = "use o formato #RRGGBB") String corPrimaria,
            @NotNull Consultoria.Fonte fonteTitulo,
            @NotNull Consultoria.Tema temaPadrao,
            @NotNull Long versao) {
    }

    public record ConsultoriaResponse(MarcaPublica marca, Long versao) {
    }

    private final ConsultoriaRepository consultorias;
    private final LogoRepositorio logos;

    public MarcaService(ConsultoriaRepository consultorias, LogoRepositorio logos) {
        this.consultorias = consultorias;
        this.logos = logos;
    }

    @Transactional(readOnly = true)
    public ConsultoriaResponse consultoria(UUID consultoriaId) {
        return resposta(buscar(consultoriaId));
    }

    @Transactional(readOnly = true)
    public MarcaPublica marca(UUID consultoriaId) {
        return MarcaPublica.de(buscar(consultoriaId));
    }

    @Transactional
    @br.com.treinos.api.auditoria.Auditar(acao="MARCA_ALTERADA",entidade="CONSULTORIA",resumo="Alterou a marca da consultoria.")
    public ConsultoriaResponse alterarMarca(UUID consultoriaId, MarcaRequest r) {
        Consultoria c = buscar(consultoriaId);
        exigirMesmaVersao(c, r.versao());
        c.alterarMarca(r.nome().trim(), r.corPrimaria().toUpperCase(java.util.Locale.ROOT),
                r.fonteTitulo(), r.temaPadrao());
        consultorias.saveAndFlush(c);
        return resposta(c);
    }

    /**
     * Aceita só PNG e JPEG conferindo os bytes (o Content-Type declarado não conta). SVG é recusado: pode levar script.
     */
    @Transactional
    @br.com.treinos.api.auditoria.Auditar(acao="LOGO_ALTERADA",entidade="CONSULTORIA",resumo="Alterou a logo da consultoria.")
    public MarcaPublica enviarLogo(UUID consultoriaId, byte[] bytes) {
        if (bytes == null || bytes.length == 0) {
            throw arquivoInvalido("Envie um arquivo PNG ou JPEG.");
        }
        if (bytes.length > LOGO_MAXIMO_BYTES) {
            throw arquivoInvalido("A logo pode ter no máximo 512 KB.");
        }
        String tipo = tipoPelosBytes(bytes).orElseThrow(() -> arquivoInvalido("A logo precisa ser PNG ou JPEG."));
        exigirExiste(consultoriaId);
        logos.gravar(consultoriaId, bytes, tipo);
        return MarcaPublica.de(buscar(consultoriaId));
    }

    @Transactional
    @br.com.treinos.api.auditoria.Auditar(acao="LOGO_REMOVIDA",entidade="CONSULTORIA",resumo="Removeu a logo da consultoria.")
    public MarcaPublica removerLogo(UUID consultoriaId) {
        exigirExiste(consultoriaId);
        logos.remover(consultoriaId);
        return MarcaPublica.de(buscar(consultoriaId));
    }

    @Transactional(readOnly = true)
    public Optional<LogoRepositorio.Logo> logoPublica(UUID consultoriaId) {
        return logos.ler(consultoriaId);
    }

    static Optional<String> tipoPelosBytes(byte[] b) {
        if (b.length >= PNG.length && java.util.Arrays.equals(java.util.Arrays.copyOf(b, PNG.length), PNG)) {
            return Optional.of("image/png");
        }
        if (b.length >= 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) {
            return Optional.of("image/jpeg");
        }
        return Optional.empty();
    }

    private static void exigirMesmaVersao(Consultoria c, Long versao) {
        if (!c.getVersao().equals(versao)) {
            throw new ConflitoException("Outra pessoa ou aba alterou a marca. Recarregue para ver a versão atual.",
                    "CONFLITO_EDICAO");
        }
    }

    private ConsultoriaResponse resposta(Consultoria c) {
        return new ConsultoriaResponse(MarcaPublica.de(c), c.getVersao());
    }

    private Consultoria buscar(UUID consultoriaId) {
        return consultorias.findById(consultoriaId)
                .orElseThrow(() -> new NaoEncontradoException("Consultoria não encontrada."));
    }

    /**
     * Confere sem carregar a entidade: o SQL da logo roda antes da primeira leitura, então a {@link Consultoria} lida
     * depois já vem com o tipo e a versão novos.
     */
    private void exigirExiste(UUID consultoriaId) {
        if (!consultorias.existsById(consultoriaId)) {
            throw new NaoEncontradoException("Consultoria não encontrada.");
        }
    }

    private static ApiException arquivoInvalido(String mensagem) {
        return new ArquivoInvalidoException(mensagem);
    }

    static final class ArquivoInvalidoException extends ApiException {
        private static final long serialVersionUID = 1L;

        ArquivoInvalidoException(String mensagem) {
            super(HttpStatus.BAD_REQUEST, mensagem, "ARQUIVO_INVALIDO");
        }
    }
}
