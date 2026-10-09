package br.com.treinos.api.pastas;

import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.dieta.PlanoDietaRepository;
import br.com.treinos.api.dieta.PlanoDietaService;
import br.com.treinos.api.execucao.PesoService;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.PesoRequest;
import br.com.treinos.api.pastas.PastaDtos.FinalizarRequest;
import br.com.treinos.api.pastas.PastaDtos.PastaRequest;
import br.com.treinos.api.pastas.PastaDtos.PastaResumo;
import br.com.treinos.api.planos.PlanoBase;
import br.com.treinos.api.planos.dto.PlanoDtos.ReplicarRequest;
import br.com.treinos.api.treino.PlanoTreinoRepository;
import br.com.treinos.api.treino.PlanoTreinoService;
import br.com.treinos.api.web.BadRequestException;
import br.com.treinos.api.web.ConflitoException;
import br.com.treinos.api.web.Exigir;
import br.com.treinos.api.web.Fuso;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Pastas de plano do aluno. O período da pasta vale para os treinos e dietas dentro dela: ao mudar, o rascunho de cada
 * plano acompanha (versão publicada é imutável, então o plano aparece como "alterado desde a publicação"). Replicar a
 * pasta cria outra com cópia de todos os planos (conteúdo da última publicação, uids novos).
 */
@Service
public class PastaService {

    private final PastaRepository pastas;
    private final AlunoRepository alunos;
    private final PlanoTreinoRepository treinos;
    private final PlanoDietaRepository dietas;
    private final PlanoTreinoService servicoTreino;
    private final PlanoDietaService servicoDieta;
    private final PesoService pesos;

    public PastaService(PastaRepository pastas, AlunoRepository alunos, PlanoTreinoRepository treinos,
                        PlanoDietaRepository dietas, PlanoTreinoService servicoTreino, PlanoDietaService servicoDieta,
                        PesoService pesos) {
        this.pastas = pastas;
        this.alunos = alunos;
        this.treinos = treinos;
        this.dietas = dietas;
        this.servicoTreino = servicoTreino;
        this.servicoDieta = servicoDieta;
        this.pesos = pesos;
    }

    @Transactional(readOnly = true)
    public List<PastaResumo> listar(UUID alunoId) {
        exigirAluno(alunoId);
        return pastas.findByAlunoIdOrderByCriadoEmDesc(alunoId).stream().filter(p -> !p.isArquivado()).map(PastaResumo::de).toList();
    }

    @Transactional
    public PastaResumo criar(UUID alunoId, PastaRequest r) {
        exigirAluno(alunoId);
        exigirPeriodo(r.inicio(), r.fim());
        return PastaResumo.de(pastas.saveAndFlush(new PastaPlano(alunoId, r.titulo().trim(), r.inicio(), r.fim())));
    }

    @Transactional
    public PastaResumo atualizar(UUID id, PastaRequest r) {
        exigirPeriodo(r.inicio(), r.fim());
        PastaPlano pasta = buscar(id);
        pasta.atualizar(r.titulo().trim(), r.inicio(), r.fim());
        treinos.findByPastaId(id).forEach(p -> p.definirPeriodo(r.inicio(), r.fim()));
        dietas.findByPastaId(id).forEach(p -> p.definirPeriodo(r.inicio(), r.fim()));
        return PastaResumo.de(pastas.saveAndFlush(pasta));
    }

    /** Nova pasta com cópia dos treinos e das dietas da origem; plano com título próprio mantém o título. */
    @Transactional
    public PastaResumo replicar(UUID id, PastaRequest r) {
        exigirPeriodo(r.inicio(), r.fim());
        PastaPlano origem = buscar(id);
        PastaPlano nova = pastas.saveAndFlush(new PastaPlano(origem.getAlunoId(), r.titulo().trim(), r.inicio(), r.fim()));
        for (PlanoBase p : treinos.findByPastaId(id)) {
            if (p.isArquivado()) continue;
            servicoTreino.replicar(p.getId(),
                    new ReplicarRequest(tituloDaCopia(p, origem, nova), r.inicio(), r.fim(), nova.getId()));
        }
        for (PlanoBase p : dietas.findByPastaId(id)) {
            if (p.isArquivado()) continue;
            servicoDieta.replicar(p.getId(),
                    new ReplicarRequest(tituloDaCopia(p, origem, nova), r.inicio(), r.fim(), nova.getId()));
        }
        return PastaResumo.de(nova);
    }

    /**
     * Dá a pasta como concluída. Com peso informado, grava (ou substitui, na mesma data) o registro de peso do aluno
     * na mesma transação: se o peso for recusado, a pasta continua aberta.
     */
    @Transactional
    public PastaResumo finalizar(UUID id, FinalizarRequest r, UUID usuarioId) {
        PastaPlano pasta = buscar(id);
        if (pasta.getConcluidaEm() != null) {
            throw new ConflitoException("Esta pasta já foi finalizada.", "PASTA_JA_FINALIZADA");
        }
        if (r.pesoKg() == null && r.observacao() != null && !r.observacao().isBlank()) {
            throw new BadRequestException("Informe o peso para gravar a observação.");
        }
        if (r.pesoKg() != null) {
            br.com.treinos.api.equipe.AcessoAtual.exigir("ALUNO_SENSIVEL_ALTERAR");
            LocalDate data = r.data() != null ? r.data() : LocalDate.now(Fuso.BRASILIA);
            pesos.registrar(pasta.getAlunoId(), new PesoRequest(data, r.pesoKg(), r.observacao()), usuarioId);
        }
        pasta.concluir(Instant.now());
        return PastaResumo.de(pastas.saveAndFlush(pasta));
    }

    @Transactional
    public PastaResumo reabrir(UUID id) {
        PastaPlano pasta = buscar(id);
        pasta.reabrir();
        return PastaResumo.de(pastas.saveAndFlush(pasta));
    }

    @Transactional
    public void excluir(UUID id) {
        PastaPlano p = buscar(id);
        treinos.findByPastaId(id).forEach(PlanoBase::arquivar);
        dietas.findByPastaId(id).forEach(PlanoBase::arquivar);
        p.arquivar(); pastas.saveAndFlush(p);
    }

    private static String tituloDaCopia(PlanoBase plano, PastaPlano origem, PastaPlano nova) {
        return plano.getTitulo().equals(origem.getTitulo()) ? nova.getTitulo() : plano.getTitulo();
    }

    private PastaPlano buscar(UUID id) {
        return pastas.findById(id).orElseThrow(() -> new NaoEncontradoException("Pasta não encontrada."));
    }

    private void exigirAluno(UUID alunoId) {
        Exigir.existe(alunos.findById(alunoId), () -> new NaoEncontradoException("Aluno não encontrado."));
    }

    private static void exigirPeriodo(LocalDate inicio, LocalDate fim) {
        if (inicio != null && fim != null && fim.isBefore(inicio)) {
            throw new BadRequestException("O fim do período não pode ser antes do início.");
        }
    }
}
