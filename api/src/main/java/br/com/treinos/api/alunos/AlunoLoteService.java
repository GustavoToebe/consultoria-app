package br.com.treinos.api.alunos;

import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.questionarios.QuestionarioService;
import br.com.treinos.api.web.BadRequestException;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * Ações em lote na lista de alunos: trocar responsável, trocar questionário e desativar. Tudo ou nada numa transação:
 * qualquer id que não seja da consultoria (ou não exista) responde 404 e nada muda, e um aluno anonimizado recusa o
 * lote inteiro (409). Cada aluno alterado gera a sua linha de auditoria, com as mesmas ações das rotas individuais.
 * Não confere a versão (lock otimista) do aluno: vale a última escrita.
 */
@Service
public class AlunoLoteService {

    public static final int LIMITE = 100;

    public record Resultado(int selecionados, int alterados) { }

    private final AlunoRepository alunos;
    private final AlunoService alunoService;
    private final QuestionarioService questionarios;
    private final Auditoria auditoria;

    public AlunoLoteService(AlunoRepository alunos, AlunoService alunoService, QuestionarioService questionarios,
                            Auditoria auditoria) {
        this.alunos = alunos;
        this.alunoService = alunoService;
        this.questionarios = questionarios;
        this.auditoria = auditoria;
    }

    @Transactional
    public Resultado trocarResponsavel(List<UUID> ids, UUID responsavelId) {
        List<Aluno> selecionados = travar(ids);
        selecionados.forEach(AlunoService::exigirNaoAnonimizado);
        int alterados = 0;
        for (Aluno aluno : selecionados) {
            UUID anterior = aluno.getResponsavelId();
            alunoService.definirResponsavel(aluno, responsavelId);
            if (!Objects.equals(anterior, aluno.getResponsavelId())) {
                alunos.save(aluno);
                auditoria.registrarEvento("ALUNO_RESPONSAVEL_ALTERADO", "ALUNO", aluno.getId(), "Alterou o responsável do aluno.");
                alterados++;
            }
        }
        alunos.flush();
        return new Resultado(selecionados.size(), alterados);
    }

    /** {@code questionarioId} nulo devolve os alunos ao padrão da consultoria. */
    @Transactional
    public Resultado trocarQuestionario(List<UUID> ids, UUID questionarioId) {
        List<Aluno> selecionados = travar(ids);
        selecionados.forEach(AlunoService::exigirNaoAnonimizado);
        questionarios.exigirEscolhivel(questionarioId);
        int alterados = 0;
        for (Aluno aluno : selecionados) {
            if (!Objects.equals(aluno.getQuestionarioId(), questionarioId)) {
                aluno.alterarQuestionario(questionarioId);
                alunos.save(aluno);
                auditoria.registrarEvento("ALUNO_QUESTIONARIO_ALTERADO", "ALUNO", aluno.getId(),
                        "Trocou o questionário de atualização do aluno.");
                alterados++;
            }
        }
        alunos.flush();
        return new Resultado(selecionados.size(), alterados);
    }

    /** Quem já está inativo (inclusive anonimizado) fica como está; os demais perdem o acesso e as sessões. */
    @Transactional
    public Resultado desativar(List<UUID> ids) {
        List<Aluno> selecionados = travar(ids);
        int alterados = 0;
        for (Aluno aluno : selecionados) {
            if (aluno.isAtivo()) {
                alunoService.aplicarSituacao(aluno, false);
                alunos.save(aluno);
                auditoria.registrarEvento("ALUNO_SITUACAO", "ALUNO", aluno.getId(), "Alterou a situação do aluno.");
                alterados++;
            }
        }
        alunos.flush();
        return new Resultado(selecionados.size(), alterados);
    }

    /** Ids repetidos contam uma vez; id fora da consultoria atual não volta da consulta e derruba o lote com 404. */
    private List<Aluno> travar(List<UUID> ids) {
        if (ids == null || ids.isEmpty()) {
            throw new BadRequestException("Escolha ao menos um aluno.");
        }
        var distintos = new LinkedHashSet<>(ids);
        if (distintos.contains(null) || distintos.size() > LIMITE) {
            throw new BadRequestException("Escolha de 1 a " + LIMITE + " alunos.");
        }
        List<Aluno> achados = alunos.buscarParaAlterarVarios(distintos);
        if (achados.size() != distintos.size()) {
            throw new NaoEncontradoException("Aluno não encontrado.");
        }
        return achados;
    }
}
