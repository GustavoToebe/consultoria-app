package br.com.treinos.api.questionarios;

import br.com.plataforma.comum.web.BadRequestException;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.UUID;

/** Imagens das perguntas, lado da equipe. O aluno vê pela rota dele, só as do que ele responde. */
@RestController
public class QuestionarioImagemController {

    public record ImagemCriada(UUID id) { }

    private final QuestionarioImagemService imagens;

    public QuestionarioImagemController(QuestionarioImagemService imagens) {
        this.imagens = imagens;
    }

    @PreAuthorize("hasAuthority('PERM_QUESTIONARIO_ALTERAR')")
    @PostMapping(value = "/questionarios/imagens", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ImagemCriada enviar(@RequestPart("arquivo") MultipartFile arquivo) {
        try {
            return new ImagemCriada(imagens.enviar(arquivo.getBytes()));
        } catch (IOException e) {
            throw new BadRequestException("Não foi possível ler o arquivo enviado.");
        }
    }

    /** Quem edita o questionário e quem lê as respostas (atualização ou anamnese) vê as imagens das perguntas. */
    @PreAuthorize("hasAuthority('PERM_QUESTIONARIO_LER') or hasAuthority('PERM_ANAMNESE_LER') or hasAuthority('PERM_ATUALIZACAO_LER')")
    @GetMapping("/questionarios/imagens/{id}")
    public ResponseEntity<byte[]> ver(@PathVariable UUID id) {
        return imagens.ler(id).resposta();
    }
}
