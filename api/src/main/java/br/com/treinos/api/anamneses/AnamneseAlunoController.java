package br.com.treinos.api.anamneses;

import br.com.treinos.api.anamneses.AnamneseDtos.AnamneseDetalhe;
import br.com.treinos.api.anamneses.AnamneseDtos.EnviarRequest;
import br.com.treinos.api.security.UsuarioAutenticado;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Anamnese, lado do aluno: só a própria, sempre a da sessão. A resposta nunca leva o nome do questionário nem quem da
 * equipe agiu ({@link AnamneseDetalhe#paraAluno()}). Também serve as imagens das perguntas que o aluno responde.
 */
@RestController
public class AnamneseAlunoController {

    private final AnamneseService anamneses;

    public AnamneseAlunoController(AnamneseService anamneses) {
        this.anamneses = anamneses;
    }

    /** A pendente ou a última enviada; sem nenhuma, 404. */
    @PreAuthorize("hasRole('ALUNO')")
    @GetMapping("/aluno/anamnese")
    public AnamneseDetalhe atual(@AuthenticationPrincipal UsuarioAutenticado eu) {
        return anamneses.atualDoAluno(eu);
    }

    @PreAuthorize("hasRole('ALUNO')")
    @PostMapping("/aluno/anamnese/{id}/enviar")
    public AnamneseDetalhe enviar(@AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable UUID id,
                                  @Valid @RequestBody EnviarRequest r) {
        return anamneses.enviar(eu, id, r);
    }

    /** Imagem de pergunta ou opção de um questionário que o aluno responde (anamnese ou atualização). */
    @PreAuthorize("hasRole('ALUNO')")
    @GetMapping("/aluno/questionarios/imagens/{id}")
    public ResponseEntity<byte[]> imagem(@AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable UUID id) {
        return anamneses.imagemDoAluno(eu, id).resposta();
    }
}
