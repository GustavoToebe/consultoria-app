package br.com.treinos.api.execucao;

import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.consultoria.ConfiguracaoConsultoria;
import br.com.treinos.api.consultoria.MarcaService;
import br.com.treinos.api.dieta.PlanoDietaService;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.AlunoNome;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.ConfiguracaoAluno;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.DietaAtual;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.PainelAluno;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.TreinoAtual;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.UltimaCarga;
import br.com.treinos.api.planos.dto.PlanoDtos.VersaoDetalhe;
import br.com.treinos.api.security.UsuarioAutenticado;
import br.com.treinos.api.treino.ConteudoTreino;
import br.com.treinos.api.treino.PlanoTreinoService;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.web.ProibidoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Rotas {@code /aluno/**}: sempre o aluno da sessão, nunca um id vindo do cliente. O painel é o pacote que o app
 * guarda para funcionar sem internet (seção 11): marca, versão publicada do treino, últimas cargas e configuração.
 */
@Service
public class AlunoAppService {

    private final AlunoRepository alunos;
    private final PlanoTreinoService treinos;
    private final PlanoDietaService dietas;
    private final HistoricoService historico;
    private final MarcaService marcas;

    public AlunoAppService(AlunoRepository alunos, PlanoTreinoService treinos, PlanoDietaService dietas,
                           HistoricoService historico, MarcaService marcas) {
        this.alunos = alunos;
        this.treinos = treinos;
        this.dietas = dietas;
        this.historico = historico;
        this.marcas = marcas;
    }

    @Transactional(readOnly = true)
    public PainelAluno painel(UsuarioAutenticado eu) {
        UUID alunoId = alunoDaSessao(eu);
        Aluno aluno = alunos.findById(alunoId).orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado."));
        TreinoAtual treino = treinos.versaoAtiva(alunoId)
                .map(a -> new TreinoAtual(a.plano().getId(), a.versao().getId(), a.versao().getNumero(),
                        a.versao().getTitulo(), a.versao().getInicio(), a.versao().getFim(),
                        a.versao().getPublicadoEm(), a.conteudo()))
                .orElse(null);
        Map<UUID, UltimaCarga> ultimas = treino == null ? Map.of()
                : historico.ultimasCargas(alunoId, exerciciosDaBiblioteca(treino.conteudo()));
        ConfiguracaoConsultoria config = marcas.configuracao(eu.consultoriaId());
        return new PainelAluno(marcas.marca(eu.consultoriaId()), new AlunoNome(aluno.getNome()), treino, ultimas,
                new ConfiguracaoAluno(config.arredondamentoKg(), config.tipoTrabalho()), Instant.now());
    }

    @Transactional(readOnly = true)
    public DietaAtual dieta(UsuarioAutenticado eu) {
        UUID alunoId = alunoDaSessao(eu);
        VersaoDetalhe<br.com.treinos.api.dieta.ConteudoDieta> dieta = dietas.versaoAtiva(alunoId)
                .map(a -> new VersaoDetalhe<>(a.versao().getId(), a.plano().getId(), a.versao().getNumero(),
                        a.versao().getTitulo(), a.versao().getInicio(), a.versao().getFim(),
                        a.versao().getPublicadoEm(), a.conteudo()))
                .orElse(null);
        return new DietaAtual(dieta);
    }

    public static UUID alunoDaSessao(UsuarioAutenticado eu) {
        if (eu.alunoId() == null) {
            throw new ProibidoException("Acesso negado.");
        }
        return eu.alunoId();
    }

    private static Set<UUID> exerciciosDaBiblioteca(ConteudoTreino conteudo) {
        return conteudo.sessoesOuVazio().stream()
                .flatMap(s -> s.exerciciosOuVazio().stream())
                .map(ConteudoTreino.ExercicioPlano::exercicioId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
    }
}
