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
import br.com.treinos.api.execucao.dto.ExecucaoDtos.PastaDoAluno;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.PlanosDaPasta;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.TreinoAtual;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.UltimaCarga;
import br.com.treinos.api.pastas.PastaPlano;
import br.com.treinos.api.pastas.PastaRepository;
import br.com.treinos.api.planos.PlanoBase;
import br.com.treinos.api.planos.PlanoServiceBase.VersaoAtiva;
import br.com.treinos.api.planos.VersaoBase;
import br.com.treinos.api.planos.dto.PlanoDtos.VersaoDetalhe;
import br.com.treinos.api.security.UsuarioAutenticado;
import br.com.treinos.api.treino.ConteudoTreino;
import br.com.treinos.api.treino.PlanoTreinoService;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.web.ProibidoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
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
    private final PastaRepository pastas;

    public AlunoAppService(AlunoRepository alunos, PlanoTreinoService treinos, PlanoDietaService dietas,
                           HistoricoService historico, MarcaService marcas, PastaRepository pastas) {
        this.alunos = alunos;
        this.treinos = treinos;
        this.dietas = dietas;
        this.historico = historico;
        this.marcas = marcas;
        this.pastas = pastas;
    }

    @Transactional(readOnly = true)
    public PainelAluno painel(UsuarioAutenticado eu) {
        UUID alunoId = alunoDaSessao(eu);
        Aluno aluno = alunos.findById(alunoId).orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado."));
        TreinoAtual treino = treinos.versaoAtiva(alunoId).map(AlunoAppService::treinoDe).orElse(null);
        Map<UUID, UltimaCarga> ultimas = treino == null ? Map.of()
                : historico.ultimasCargas(alunoId, exerciciosDaBiblioteca(treino.conteudo()));
        ConfiguracaoConsultoria config = treino != null && treino.conteudo().metodologia() != null
                ? treino.conteudo().metodologia().configuracao() : marcas.configuracao(eu.consultoriaId());
        return new PainelAluno(marcas.marca(eu.consultoriaId()), new AlunoNome(aluno.getNome()), treino, ultimas,
                new ConfiguracaoAluno(config.arredondamentoKg(), config.tipoTrabalho(), config.instrucoesTreino()), Instant.now());
    }

    @Transactional(readOnly = true)
    public DietaAtual dieta(UsuarioAutenticado eu) {
        UUID alunoId = alunoDaSessao(eu);
        return new DietaAtual(dietas.versaoAtiva(alunoId).map(AlunoAppService::dietaDe).orElse(null));
    }

    /**
     * Pastas do aluno com plano publicado, ativas primeiro (rascunho nunca conta). A {@code atual} é a do treino
     * vigente (ou da dieta vigente, sem treino): é o que o pacote offline traz.
     */
    @Transactional(readOnly = true)
    public List<PastaDoAluno> pastas(UsuarioAutenticado eu) {
        UUID alunoId = alunoDaSessao(eu);
        Set<UUID> comTreino = pastasDe(treinos.publicadosEmPastas(alunoId));
        Set<UUID> comDieta = pastasDe(dietas.publicadosEmPastas(alunoId));
        UUID atual = treinos.versaoAtiva(alunoId).map(a -> a.plano().getPastaId())
                .or(() -> dietas.versaoAtiva(alunoId).map(a -> a.plano().getPastaId())).orElse(null);
        return pastas.findByAlunoIdOrderByCriadoEmDesc(alunoId).stream()
                .filter(p -> !p.isArquivado() && (comTreino.contains(p.getId()) || comDieta.contains(p.getId())))
                .map(p -> new PastaDoAluno(p.getId(), p.getTitulo(), p.getInicio(), p.getFim(), p.getConcluidaEm(),
                        p.getId().equals(atual), comTreino.contains(p.getId()), comDieta.contains(p.getId())))
                .sorted(Comparator.comparing(p -> p.concluidaEm() != null))
                .toList();
    }

    /** Treino e dieta publicados de uma pasta do aluno. Pasta de outro aluno, arquivada ou sem publicado: 404. */
    @Transactional(readOnly = true)
    public PlanosDaPasta planosDaPasta(UsuarioAutenticado eu, UUID pastaId) {
        UUID alunoId = alunoDaSessao(eu);
        PastaPlano pasta = pastas.findById(pastaId)
                .filter(p -> !p.isArquivado() && alunoId.equals(p.getAlunoId()))
                .orElseThrow(() -> new NaoEncontradoException("Pasta não encontrada."));
        TreinoAtual treino = treinos.versaoPublicadaDaPasta(alunoId, pasta.getId()).map(AlunoAppService::treinoDe).orElse(null);
        VersaoDetalhe<br.com.treinos.api.dieta.ConteudoDieta> dieta =
                dietas.versaoPublicadaDaPasta(alunoId, pasta.getId()).map(AlunoAppService::dietaDe).orElse(null);
        if (treino == null && dieta == null) {
            throw new NaoEncontradoException("Pasta não encontrada.");
        }
        return new PlanosDaPasta(pasta.getId(), treino, dieta);
    }

    private static TreinoAtual treinoDe(VersaoAtiva<? extends PlanoBase, ? extends VersaoBase, ConteudoTreino> a) {
        return new TreinoAtual(a.plano().getId(), a.versao().getId(), a.versao().getNumero(), a.versao().getTitulo(),
                a.versao().getInicio(), a.versao().getFim(), a.versao().getPublicadoEm(), a.conteudo());
    }

    private static VersaoDetalhe<br.com.treinos.api.dieta.ConteudoDieta> dietaDe(
            VersaoAtiva<? extends PlanoBase, ? extends VersaoBase, br.com.treinos.api.dieta.ConteudoDieta> a) {
        return new VersaoDetalhe<>(a.versao().getId(), a.plano().getId(), a.versao().getNumero(),
                a.versao().getTitulo(), a.versao().getInicio(), a.versao().getFim(), a.versao().getPublicadoEm(),
                a.conteudo());
    }

    private static Set<UUID> pastasDe(List<? extends PlanoBase> planos) {
        return planos.stream().map(PlanoBase::getPastaId).collect(Collectors.toSet());
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
