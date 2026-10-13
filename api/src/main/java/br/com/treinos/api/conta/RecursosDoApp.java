package br.com.treinos.api.conta;

import java.util.List;

/**
 * Catálogo de recursos do app que um plano pode limitar ou ligar (contrato da Central). Hoje só o
 * consumo lê os limites; nenhuma rota usa as funcionalidades ainda. Código novo aqui = recurso novo no catálogo da Central.
 */
public final class RecursosDoApp {

    /** Alunos ativos da consultoria. */
    public static final String LIMITE_ALUNOS_ATIVOS = "alunos_ativos";
    /** Membros ativos da equipe mais convites ainda válidos. */
    public static final String LIMITE_MEMBROS_EQUIPE = "membros_equipe";
    public static final List<String> LIMITES = List.of(LIMITE_ALUNOS_ATIVOS, LIMITE_MEMBROS_EQUIPE);

    public static final String FUNCIONALIDADE_CHECKIN = "CHECKIN";
    public static final String FUNCIONALIDADE_MOBILIDADE = "MOBILIDADE";
    public static final String FUNCIONALIDADE_PDF = "PDF";
    public static final String FUNCIONALIDADE_EQUIPE = "EQUIPE";
    public static final List<String> FUNCIONALIDADES = List.of(FUNCIONALIDADE_CHECKIN, FUNCIONALIDADE_MOBILIDADE,
            FUNCIONALIDADE_PDF, FUNCIONALIDADE_EQUIPE);

    private RecursosDoApp() { }
}
