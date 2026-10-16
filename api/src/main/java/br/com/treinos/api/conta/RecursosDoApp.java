package br.com.treinos.api.conta;

import java.util.List;

/**
 * Catálogo de recursos do app que um plano pode limitar ou ligar (contrato da Central). Todo código aqui
 * corresponde a algo que a API consegue barrar ({@link PlanoDaConsultoria}, só com {@code TREINOS_PLANO_APLICAR}). Código
 * novo aqui = recurso novo no catálogo da Central e uma checagem no servidor.
 */
public final class RecursosDoApp {

    /** Alunos ativos da consultoria. */
    public static final String LIMITE_ALUNOS_ATIVOS = "alunos_ativos";
    /** Membros ativos da equipe mais convites ainda válidos. */
    public static final String LIMITE_MEMBROS_EQUIPE = "membros_equipe";
    public static final List<String> LIMITES = List.of(LIMITE_ALUNOS_ATIVOS, LIMITE_MEMBROS_EQUIPE);

    /** Planos e modelos de mobilidade: barra criar, editar, publicar, replicar e copiar (ler e excluir continuam). */
    public static final String FUNCIONALIDADE_MOBILIDADE = "MOBILIDADE";
    /** O PDF sai no aparelho: não há rota para barrar, o app só esconde os botões. */
    public static final String FUNCIONALIDADE_PDF = "PDF";
    /** Convidar e reativar membros e criar perfis (desativar e cancelar convite continuam). */
    public static final String FUNCIONALIDADE_EQUIPE = "EQUIPE";
    public static final List<String> FUNCIONALIDADES = List.of(FUNCIONALIDADE_MOBILIDADE, FUNCIONALIDADE_PDF,
            FUNCIONALIDADE_EQUIPE);

    private RecursosDoApp() { }
}
