package br.com.treinos.api.pastas;

import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.atualizacoes.AtualizacaoRepository;
import br.com.treinos.api.dieta.PlanoDietaRepository;
import br.com.treinos.api.dieta.PlanoDietaService;
import br.com.treinos.api.execucao.PesoService;
import br.com.treinos.api.mobilidade.PlanoMobilidadeRepository;
import br.com.treinos.api.mobilidade.PlanoMobilidadeService;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.PesoRequest;
import br.com.plataforma.comum.web.ApiError.FieldError;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.equipe.AcessoAtual;
import br.com.treinos.api.pastas.PastaDtos.CopiarPastaRequest;
import br.com.treinos.api.pastas.PastaDtos.CopiarPastaResposta;
import br.com.treinos.api.pastas.PastaDtos.FinalizarRequest;
import br.com.treinos.api.pastas.PastaDtos.PlanoCopiadoDaPasta;
import br.com.treinos.api.pastas.PastaDtos.PlanoPublicadoNaPasta;
import br.com.treinos.api.pastas.PastaDtos.PlanoPuladoNaPasta;
import br.com.treinos.api.pastas.PastaDtos.PublicarPastaResposta;
import br.com.treinos.api.planos.PlanoServiceBase;
import br.com.treinos.api.planos.dto.PlanoDtos.PublicarRequest;
import br.com.treinos.api.web.ValidacaoException;
import br.com.treinos.api.pastas.PastaDtos.PastaRequest;
import br.com.treinos.api.pastas.PastaDtos.PastaResumo;
import br.com.treinos.api.pastas.PastaDtos.PastaVigenteResposta;
import br.com.treinos.api.planos.PlanoBase;
import br.com.treinos.api.planos.dto.PlanoDtos.ReplicarRequest;
import br.com.treinos.api.treino.PlanoTreinoRepository;
import br.com.treinos.api.treino.PlanoTreinoService;
import br.com.plataforma.comum.web.BadRequestException;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.web.Exigir;
import br.com.treinos.api.web.Fuso;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/**
 * Pastas de plano do aluno. O período da pasta vale para os treinos, dietas e mobilidades dentro dela: ao mudar, o rascunho de cada
 * plano acompanha (versão publicada é imutável, então o plano aparece como "alterado desde a publicação"). Replicar a
 * pasta cria outra com cópia de todos os planos (conteúdo da última publicação, uids novos).
 */
@Service
public class PastaService {

    private final PastaRepository pastas;
    private final AlunoRepository alunos;
    private final PlanoTreinoRepository treinos;
    private final PlanoDietaRepository dietas;
    private final PlanoMobilidadeRepository mobilidades;
    private final PlanoTreinoService servicoTreino;
    private final PlanoDietaService servicoDieta;
    private final PlanoMobilidadeService servicoMobilidade;
    private final PesoService pesos;
    private final AtualizacaoRepository atualizacoes;
    private final PastaVigente vigente;
    private final br.com.treinos.api.conta.PlanoDaConsultoria plano;
    private final Auditoria auditoria;

    public PastaService(PastaRepository pastas, AlunoRepository alunos, PlanoTreinoRepository treinos,
                        PlanoDietaRepository dietas, PlanoMobilidadeRepository mobilidades,
                        PlanoTreinoService servicoTreino, PlanoDietaService servicoDieta,
                        PlanoMobilidadeService servicoMobilidade, PesoService pesos,
                        AtualizacaoRepository atualizacoes, PastaVigente vigente,
                        br.com.treinos.api.conta.PlanoDaConsultoria plano, Auditoria auditoria) {
        this.plano = plano;
        this.auditoria = auditoria;
        this.atualizacoes = atualizacoes;
        this.vigente = vigente;
        this.pastas = pastas;
        this.alunos = alunos;
        this.treinos = treinos;
        this.dietas = dietas;
        this.mobilidades = mobilidades;
        this.servicoTreino = servicoTreino;
        this.servicoDieta = servicoDieta;
        this.servicoMobilidade = servicoMobilidade;
        this.pesos = pesos;
    }

    @Transactional(readOnly = true)
    public List<PastaResumo> listar(UUID alunoId) {
        exigirAluno(alunoId);
        return pastas.findByAlunoIdOrderByCriadoEmDesc(alunoId).stream().filter(p -> !p.isArquivado()).map(PastaResumo::de).toList();
    }

    /** A pasta que o aluno está usando agora (regra única em {@link PastaVigente}); nenhuma = {@code pasta} nulo. */
    @Transactional(readOnly = true)
    public PastaVigenteResposta vigente(UUID alunoId) {
        exigirAluno(alunoId);
        return new PastaVigenteResposta(vigente.de(alunoId).map(PastaResumo::de).orElse(null));
    }

    @Transactional
    @br.com.treinos.api.auditoria.Auditar(acao="PASTA_CRIADA",entidade="PASTA",resumo="Criou uma pasta de plano.")
    public PastaResumo criar(UUID alunoId, PastaRequest r) {
        return PastaResumo.de(gravarPasta(alunoId, r));
    }

    /** Grava a pasta sem auditoria própria: a cópia da pasta para outro aluno grava uma linha só ({@code PASTA_COPIADA}). */
    private PastaPlano gravarPasta(UUID alunoId, PastaRequest r) {
        exigirAlunoParaGravar(alunoId);
        exigirPeriodo(r.inicio(), r.fim());
        return pastas.saveAndFlush(new PastaPlano(alunoId, r.titulo().trim(), r.inicio(), r.fim()));
    }

    @Transactional
    public PastaResumo atualizar(UUID id, PastaRequest r) {
        exigirPeriodo(r.inicio(), r.fim());
        PastaPlano pasta = buscar(id);
        pasta.atualizar(r.titulo().trim(), r.inicio(), r.fim());
        treinos.findByPastaId(id).forEach(p -> p.definirPeriodo(r.inicio(), r.fim()));
        dietas.findByPastaId(id).forEach(p -> p.definirPeriodo(r.inicio(), r.fim()));
        mobilidades.findByPastaId(id).forEach(p -> p.definirPeriodo(r.inicio(), r.fim()));
        PastaResumo resumo = PastaResumo.de(pastas.saveAndFlush(pasta));
        // A linha da atualização guarda a data; enquanto ABERTA ela acompanha o fim da pasta.
        if (r.fim() != null) {
            atualizacoes.moverDataDaAberta(id, r.fim());
        }
        return resumo;
    }

    /** Nova pasta com cópia dos treinos, dietas e mobilidades da origem; plano com título próprio mantém o título. */
    @Transactional
    @br.com.treinos.api.auditoria.Auditar(acao="PASTA_REPLICADA",entidade="PASTA",resumo="Replicou uma pasta de plano.")
    public PastaResumo replicar(UUID id, PastaRequest r) {
        exigirPeriodo(r.inicio(), r.fim());
        PastaPlano origem = buscar(id);
        exigirAlunoParaGravar(origem.getAlunoId());
        exigirPermissoesDosPlanos(id);
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
        // Plano sem mobilidade: a pasta nova sai sem ela (renovar a pasta não pode quebrar por causa disso).
        boolean comMobilidade = plano.funcionalidadeLiberada(br.com.treinos.api.conta.RecursosDoApp.FUNCIONALIDADE_MOBILIDADE);
        for (PlanoBase p : comMobilidade ? mobilidades.findByPastaId(id) : List.<PlanoBase>of()) {
            if (p.isArquivado()) continue;
            servicoMobilidade.replicar(p.getId(),
                    new ReplicarRequest(tituloDaCopia(p, origem, nova), r.inicio(), r.fim(), nova.getId()));
        }
        return PastaResumo.de(nova);
    }

    /**
     * Dá a pasta como concluída. Com peso informado, grava (ou substitui, na mesma data) o registro de peso do aluno
     * na mesma transação: se o peso for recusado, a pasta continua aberta.
     */
    @Transactional
    @br.com.treinos.api.auditoria.Auditar(acao="PASTA_FINALIZADA",entidade="PASTA",resumo="Finalizou uma pasta de plano.")
    public PastaResumo finalizar(UUID id, FinalizarRequest r, UUID usuarioId) {
        PastaPlano pasta = buscar(id);
        if (pasta.getConcluidaEm() != null) {
            throw new ConflictException("Esta pasta já foi finalizada.", "PASTA_JA_FINALIZADA");
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
        exigirPermissoesDosPlanos(id);
        treinos.findByPastaId(id).forEach(PlanoBase::arquivar);
        dietas.findByPastaId(id).forEach(PlanoBase::arquivar);
        mobilidades.findByPastaId(id).forEach(PlanoBase::arquivar);
        p.arquivar(); pastas.saveAndFlush(p);
    }

    /**
     * "Publicar tudo": publica o rascunho de treino, dieta e mobilidade da pasta de uma vez, numa transação só.
     * Ordem: pasta (404, também a arquivada) → permissão de publicar de CADA tipo presente (403) → validação de todos os
     * planos a publicar → só então publica. Um erro em qualquer plano ({@code PLANO_INVALIDO}) ou aviso sem
     * {@code confirmarAvisos} ({@code CONFIRMAR_AVISOS}) devolve 422 com a lista por plano e nada é publicado. Cada
     * publicação passa pelo {@code publicar} do serviço do tipo (a mesma versão imutável e a mesma auditoria da rota
     * individual). Plano sem publicação, ou com o rascunho alterado depois da última (inclusive pela mudança de período
     * da pasta), entra; plano já publicado e sem alteração é pulado, sem versão nova. Plano arquivado não entra, e
     * mobilidade só com a funcionalidade ligada no plano da consultoria.
     */
    @Transactional
    public PublicarPastaResposta publicarTudo(UUID id, boolean confirmarAvisos, UUID usuarioId) {
        buscarAtiva(id);
        List<Alvo> alvos = planosDaPasta(id);
        exigirPermissaoDosAlvos(alvos, "PUBLICAR");
        List<Alvo> aPublicar = alvos.stream().filter(Alvo::pendente).toList();
        List<FieldError> erros = new ArrayList<>();
        List<FieldError> avisos = new ArrayList<>();
        for (Alvo a : aPublicar) {
            var resultado = a.servico().validar(a.plano().getId());
            boolean repetido = aPublicar.stream().filter(o -> o.tipo().equals(a.tipo())).count() > 1;
            resultado.erros().forEach(p -> erros.add(new FieldError(campo(a, repetido, p.caminho()), p.mensagem())));
            resultado.avisos().forEach(p -> avisos.add(new FieldError(campo(a, repetido, p.caminho()), p.mensagem())));
        }
        if (!erros.isEmpty()) {
            throw new ValidacaoException("Há planos com erros que impedem a publicação. Nada foi publicado.",
                    "PLANO_INVALIDO", erros);
        }
        if (!avisos.isEmpty() && !confirmarAvisos) {
            throw new ValidacaoException("Confira os avisos antes de publicar. Nada foi publicado.", "CONFIRMAR_AVISOS", avisos);
        }
        // Antes de publicar: depois, os publicados também deixam de ter alteração pendente.
        List<PlanoPuladoNaPasta> pulados = alvos.stream().filter(a -> !aPublicar.contains(a))
                .map(a -> new PlanoPuladoNaPasta(a.tipo(), a.plano().getId())).toList();
        List<PlanoPublicadoNaPasta> publicados = new ArrayList<>();
        for (Alvo a : aPublicar) {
            var publicado = a.servico().publicar(a.plano().getId(),
                    new PublicarRequest(a.plano().getVersao(), confirmarAvisos), usuarioId);
            publicados.add(new PlanoPublicadoNaPasta(a.tipo(), a.plano().getId(), publicado.plano().versaoPublicada()));
        }
        return new PublicarPastaResposta(List.copyOf(publicados), pulados);
    }

    /**
     * Copia a pasta para OUTRO aluno: pasta nova no destino (com o título e o período do corpo, sem o questionário
     * escolhido da origem) e, dentro dela, uma cópia de cada plano, sempre em rascunho, a partir da última versão
     * publicada (o rascunho, se nunca publicou), com uids novos e sem o que é pessoal de cada tipo (ergogênicos da dieta);
     * é o mesmo {@code copiarParaAluno} dos planos. Tudo é conferido antes de criar qualquer coisa: pasta de origem
     * inexistente, arquivada ou de outra consultoria = 404; destino inexistente ou de outra consultoria = 404, anonimizado
     * = 409; mesmo aluno = 400; sem o {@code *_ALTERAR} de algum tipo presente = 403. Auditoria: uma linha só,
     * {@code PASTA_COPIADA} (a pasta nova), sem as linhas por plano ({@code TREINO_COPIADO}…) nem {@code PASTA_CRIADA}.
     */
    @Transactional
    public CopiarPastaResposta copiarParaAluno(UUID id, CopiarPastaRequest r) {
        AcessoAtual.exigir("PASTA_ALTERAR"); // cria uma pasta nova
        PastaPlano origem = buscarAtiva(id);
        br.com.treinos.api.alunos.AlunoService.exigirNaoAnonimizado(
                alunos.findById(r.alunoId()).orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado.")));
        if (origem.getAlunoId().equals(r.alunoId())) {
            throw new BadRequestException("Escolha outro aluno: para o mesmo aluno, use Renovar pasta.");
        }
        exigirPeriodo(r.inicio(), r.fim());
        List<Alvo> alvos = planosDaPasta(id);
        exigirPermissaoDosAlvos(alvos, "ALTERAR");
        PastaPlano nova = gravarPasta(r.alunoId(), new PastaRequest(r.titulo(), r.inicio(), r.fim()));
        List<PlanoCopiadoDaPasta> copiados = new ArrayList<>();
        for (Alvo a : alvos) {
            var copia = a.servico().copiarParaAlunoSemAuditoria(a.plano().getId(), r.alunoId(), nova.getId(),
                    tituloDaCopia(a.plano(), origem, nova));
            copiados.add(new PlanoCopiadoDaPasta(a.tipo(), copia.plano().id()));
        }
        auditoria.registrarEvento("PASTA_COPIADA", "PASTA", nova.getId(), "Copiou uma pasta de plano para outro aluno.");
        return new CopiarPastaResposta(nova.getId(), List.copyOf(copiados));
    }

    /** Um plano da pasta com o serviço do tipo; {@code tipo} é o que vai no corpo e no prefixo dos erros. */
    private record Alvo(String tipo, PlanoBase plano, PlanoServiceBase<?, ?, ?> servico) {
        /** Nunca publicado, ou com o rascunho alterado depois da última publicação. */
        boolean pendente() {
            return plano.getVersaoPublicada() == 0 || plano.rascunhoAlteradoDepoisDePublicar();
        }
    }

    /** Planos não arquivados da pasta: treino, dieta e mobilidade (esta só com a funcionalidade ligada), na ordem de criação. */
    private List<Alvo> planosDaPasta(UUID pastaId) {
        List<Alvo> alvos = new ArrayList<>();
        treinos.findByPastaId(pastaId).stream().filter(p -> !p.isArquivado()).sorted(PLANOS_POR_CRIACAO)
                .forEach(p -> alvos.add(new Alvo("treino", p, servicoTreino)));
        dietas.findByPastaId(pastaId).stream().filter(p -> !p.isArquivado()).sorted(PLANOS_POR_CRIACAO)
                .forEach(p -> alvos.add(new Alvo("dieta", p, servicoDieta)));
        if (plano.funcionalidadeLiberada(br.com.treinos.api.conta.RecursosDoApp.FUNCIONALIDADE_MOBILIDADE)) {
            mobilidades.findByPastaId(pastaId).stream().filter(p -> !p.isArquivado()).sorted(PLANOS_POR_CRIACAO)
                    .forEach(p -> alvos.add(new Alvo("mobilidade", p, servicoMobilidade)));
        }
        return alvos;
    }

    private static final Comparator<PlanoBase> PLANOS_POR_CRIACAO = Comparator
            .comparing(PlanoBase::getCriadoEm, Comparator.nullsLast(Comparator.naturalOrder()))
            .thenComparing(PlanoBase::getId);

    /** {@code sufixo}: {@code PUBLICAR} ou {@code ALTERAR}. Treino e mobilidade usam a do treino. Antes de qualquer efeito. */
    private static void exigirPermissaoDosAlvos(List<Alvo> alvos, String sufixo) {
        if (alvos.stream().anyMatch(a -> !a.tipo().equals("dieta"))) AcessoAtual.exigir("TREINO_" + sufixo);
        if (alvos.stream().anyMatch(a -> a.tipo().equals("dieta"))) AcessoAtual.exigir("DIETA_" + sufixo);
    }

    /** {@code treino.<caminho>}; com mais de um plano do mesmo tipo a publicar, {@code treino[<planoId>].<caminho>}. */
    private static String campo(Alvo alvo, boolean repetido, String caminho) {
        String base = repetido ? alvo.tipo() + "[" + alvo.plano().getId() + "]" : alvo.tipo();
        return caminho == null || caminho.isBlank() ? base : base + "." + caminho;
    }

    /** Pasta que existe nesta consultoria e não foi arquivada; senão 404. */
    private PastaPlano buscarAtiva(UUID id) {
        PastaPlano pasta = buscar(id);
        if (pasta.isArquivado()) {
            throw new NaoEncontradoException("Pasta não encontrada.");
        }
        return pasta;
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

    /** Gravar dado novo: o aluno existe e não foi anonimizado (dado de saúde num cadastro anonimizado contraria a LGPD). */
    private void exigirAlunoParaGravar(UUID alunoId) {
        br.com.treinos.api.alunos.AlunoService.exigirNaoAnonimizado(
                alunos.findById(alunoId).orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado.")));
    }

    /**
     * Replicar ou excluir a pasta cria ou arquiva os planos dela: só com a permissão de alterar cada tipo presente, como
     * aplicar modelo e copiar plano já exigem (mobilidade usa a do treino). Antes de qualquer efeito.
     */
    private void exigirPermissoesDosPlanos(UUID pastaId) {
        boolean treino = treinos.findByPastaId(pastaId).stream().anyMatch(p -> !p.isArquivado())
                || mobilidades.findByPastaId(pastaId).stream().anyMatch(p -> !p.isArquivado());
        if (treino) br.com.treinos.api.equipe.AcessoAtual.exigir("TREINO_ALTERAR");
        if (dietas.findByPastaId(pastaId).stream().anyMatch(p -> !p.isArquivado())) {
            br.com.treinos.api.equipe.AcessoAtual.exigir("DIETA_ALTERAR");
        }
    }

    private static void exigirPeriodo(LocalDate inicio, LocalDate fim) {
        if (inicio != null && fim != null && fim.isBefore(inicio)) {
            throw new BadRequestException("O fim do período não pode ser antes do início.");
        }
    }
}
