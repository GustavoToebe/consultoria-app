package br.com.treinos.api.biblioteca;

import br.com.treinos.api.biblioteca.dto.BibliotecaDtos.ExercicioResponse;
import br.com.treinos.api.execucao.AlunoAppService;
import br.com.treinos.api.treino.ConteudoTreino;
import br.com.treinos.api.treino.PlanoTreinoService;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Demonstração (fotos do catálogo e imagem própria) dos exercícios que o aluno tem em planos de treino publicados e não
 * arquivados. É só desses: o aluno nunca lê a biblioteca da consultoria. Exercício fora do plano dele, de outra
 * consultoria ou sem imagem dá 404, igual.
 */
@Service
public class DemonstracaoDoAlunoService {

    /** Um exercício do plano com o que há para mostrar. {@code imagemPropriaEm} nulo = sem imagem própria. */
    public record Demonstracao(UUID exercicioId, List<String> imagens, Instant imagemPropriaEm) {
    }

    private final PlanoTreinoService treinos;
    private final ExercicioRepository exercicios;
    private final BibliotecaService biblioteca;
    private final ExercicioImagemService imagens;

    public DemonstracaoDoAlunoService(PlanoTreinoService treinos, ExercicioRepository exercicios,
                                      BibliotecaService biblioteca, ExercicioImagemService imagens) {
        this.treinos = treinos;
        this.exercicios = exercicios;
        this.biblioteca = biblioteca;
        this.imagens = imagens;
    }

    /** Só entra quem tem alguma imagem; o app guarda a lista para mostrar sem internet. */
    @Transactional(readOnly = true)
    public List<Demonstracao> doAluno(UUID alunoId) {
        Set<UUID> ids = exerciciosDosPlanos(alunoId);
        if (ids.isEmpty()) {
            return List.of();
        }
        return biblioteca.responder(exercicios.findByIdIn(ids)).stream()
                .filter(e -> !e.imagens().isEmpty() || e.imagemPropriaEm() != null)
                .map(DemonstracaoDoAlunoService::de)
                .toList();
    }

    @Transactional(readOnly = true)
    public ImagemDoExercicio imagem(UUID alunoId, UUID exercicioId) {
        if (!exerciciosDosPlanos(alunoId).contains(exercicioId)) {
            throw new NaoEncontradoException("Imagem não encontrada.");
        }
        return imagens.imagemDe(exercicioId);
    }

    private Set<UUID> exerciciosDosPlanos(UUID alunoId) {
        Set<UUID> ids = new HashSet<>();
        for (ConteudoTreino c : treinos.conteudosPublicados(alunoId)) {
            ids.addAll(AlunoAppService.exerciciosDaBiblioteca(c));
        }
        return ids;
    }

    private static Demonstracao de(ExercicioResponse e) {
        return new Demonstracao(e.id(), e.imagens(), e.imagemPropriaEm());
    }
}
