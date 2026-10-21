package br.com.treinos.api.biblioteca;

import br.com.treinos.api.auditoria.Auditar;
import br.com.treinos.api.biblioteca.dto.BibliotecaDtos.ExercicioResponse;
import br.com.treinos.api.consultoria.MarcaService;
import br.com.treinos.api.consultoria.PngSemMetadados;
import br.com.treinos.api.fotos.GifSemMetadados;
import br.com.treinos.api.fotos.JpegSemMetadados;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Imagem ou GIF próprio de um exercício da biblioteca. O tipo vem dos bytes (o nome e o tipo declarados não contam; SVG
 * e o resto são recusados) e o arquivo é regravado sem metadados: JPEG e PNG como a foto e a logo, GIF por
 * {@link GifSemMetadados} (fica a animação e o número de repetições, sai comentário, texto e aplicação). Limites de 1 MB
 * (o que chega e o que fica) e 800 px. A permissão é conferida na rota; exercício de outra consultoria dá 404.
 */
@Service
public class ExercicioImagemService {

    static final int BYTES_MAXIMOS = 1_000_000;
    static final int LADO_MAXIMO = 800;

    private final ExercicioRepository exercicios;
    private final ExercicioImagemRepository imagens;
    private final BibliotecaService biblioteca;

    public ExercicioImagemService(ExercicioRepository exercicios, ExercicioImagemRepository imagens,
                                  BibliotecaService biblioteca) {
        this.exercicios = exercicios;
        this.imagens = imagens;
        this.biblioteca = biblioteca;
    }

    @Transactional
    @Auditar(acao = "EXERCICIO_IMAGEM_ALTERADA", entidade = "EXERCICIO",
            resumo = "Alterou a imagem de um exercício da biblioteca.")
    public ExercicioResponse enviar(UUID exercicioId, byte[] recebido) {
        Exercicio exercicio = exercicioAtivo(exercicioId);
        if (recebido == null || recebido.length == 0) {
            throw invalida("Envie uma imagem JPEG, PNG ou GIF.");
        }
        if (recebido.length > BYTES_MAXIMOS) {
            throw grandeDemais();
        }
        String tipo = tipoPelosBytes(recebido);
        byte[] limpo;
        try {
            limpo = switch (tipo) {
                case "image/gif" -> GifSemMetadados.limpar(recebido, LADO_MAXIMO);
                case "image/png" -> {
                    if (!MarcaService.ladosDoPngCabem(recebido, LADO_MAXIMO)) {
                        throw new IllegalArgumentException("PNG grande demais.");
                    }
                    yield PngSemMetadados.limpar(recebido);
                }
                default -> JpegSemMetadados.limpar(recebido, LADO_MAXIMO);
            };
        } catch (IllegalArgumentException quebrada) {
            throw invalida("A imagem precisa estar inteira e ter no máximo " + LADO_MAXIMO + " px de largura e de altura.");
        }
        if (limpo.length > BYTES_MAXIMOS) {
            throw grandeDemais();
        }
        Instant agora = Instant.now();
        ExercicioImagem atual = imagens.findById(exercicioId).orElse(null);
        if (atual == null) {
            imagens.save(new ExercicioImagem(exercicioId, tipo, limpo, agora));
        } else {
            atual.substituir(tipo, limpo, agora);
        }
        imagens.flush();
        return biblioteca.responder(exercicio);
    }

    @Transactional
    @Auditar(acao = "EXERCICIO_IMAGEM_REMOVIDA", entidade = "EXERCICIO",
            resumo = "Removeu a imagem de um exercício da biblioteca.")
    public ExercicioResponse remover(UUID exercicioId) {
        Exercicio exercicio = exercicioAtivo(exercicioId);
        ExercicioImagem atual = imagens.findById(exercicioId)
                .orElseThrow(() -> new NaoEncontradoException("Este exercício não tem imagem própria."));
        imagens.delete(atual);
        imagens.flush();
        return biblioteca.responder(exercicio);
    }

    /** Equipe: exercício da consultoria (inativo também, a ficha antiga ainda pode mostrá-lo) e com imagem; senão, 404. */
    @Transactional(readOnly = true)
    public ImagemDoExercicio ler(UUID exercicioId) {
        if (!exercicios.existsById(exercicioId)) {
            throw new NaoEncontradoException("Exercício não encontrado.");
        }
        return imagemDe(exercicioId);
    }

    ImagemDoExercicio imagemDe(UUID exercicioId) {
        ExercicioImagem i = imagens.findById(exercicioId)
                .orElseThrow(() -> new NaoEncontradoException("Imagem não encontrada."));
        return new ImagemDoExercicio(i.getTipo(), i.getBytes());
    }

    private Exercicio exercicioAtivo(UUID id) {
        return exercicios.findById(id).filter(Exercicio::isAtivo)
                .orElseThrow(() -> new NaoEncontradoException("Exercício não encontrado."));
    }

    private static String tipoPelosBytes(byte[] bytes) {
        if (GifSemMetadados.ehGif(bytes)) {
            return "image/gif";
        }
        return MarcaService.tipoPelosBytes(bytes)
                .orElseThrow(() -> invalida("A imagem precisa ser JPEG, PNG ou GIF."));
    }

    private static ValidacaoException invalida(String mensagem) {
        return new ValidacaoException(mensagem, "IMAGEM_EXERCICIO_INVALIDA", List.of());
    }

    private static ValidacaoException grandeDemais() {
        return new ValidacaoException("A imagem passou de 1 MB. Reduza e envie de novo.",
                "IMAGEM_EXERCICIO_GRANDE_DEMAIS", List.of());
    }
}
