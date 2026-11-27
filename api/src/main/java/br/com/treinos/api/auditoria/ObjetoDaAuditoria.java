package br.com.treinos.api.auditoria;

import br.com.treinos.api.equipe.AcessoAtual;
import br.com.treinos.api.pagamentos.PagamentosProperties;
import br.com.treinos.api.pagamentos.RotuloDaCobranca;
import br.com.treinos.api.tenant.TenantContext;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * Nome de exibição do objeto de cada evento da página (sem o tipo: "Vitor Luiz Santos", "Padrão", "06/2026 de R$ 997,00").
 * Um select por tipo de entidade presente, em JPQL: o {@code @TenantId} isola por consultoria ({@code Usuario}, sem
 * {@code @TenantId}, filtra {@code consultoriaId} explícito). Só nome ou título curto e o rótulo da cobrança, nunca CPF, e-mail,
 * telefone, valor de saúde nem texto livre. Fica {@code null}: tipo não resolvido, objeto apagado ou de outra consultoria, aluno
 * anonimizado, o próprio autor (login, senha, MFA, termos, onde o objeto é ele mesmo) e quem lê a auditoria sem a permissão
 * de leitura daquele tipo ({@link #PERMISSOES}, plano e cobrança): o evento continua na lista, só sem o nome.
 */
@Component
public class ObjetoDaAuditoria {

    /** Entidades de uma tabela só: {@code select id, nome} filtrado por {@code ids}. */
    private static final Map<String, String> CONSULTAS = Map.of(
            "ALUNO", "select a.id, a.nome from Aluno a where a.id in :ids and a.anonimizadoEm is null",
            "QUESTIONARIO", "select q.id, q.nome from Questionario q where q.id in :ids",
            "PASTA", "select p.id, p.titulo from PastaPlano p where p.id in :ids",
            "PERFIL", "select p.id, p.nome from Perfil p where p.id in :ids");
    /**
     * O que a rota de leitura de cada tipo já exige (só {@code AUDITORIA_LER} não abre nome de aluno, título nem valor). Título de
     * pasta e de plano leva o nome do aluno e texto do treinador, não dado clínico: as rotas deles não pedem {@code ALUNO_SENSIVEL_LER}.
     */
    private static final Map<String, String> PERMISSOES = Map.of(
            "ALUNO", "ALUNO_LER", "PASTA", "ALUNO_LER", "QUESTIONARIO", "QUESTIONARIO_LER", "PERFIL", "EQUIPE_LER");
    /** Membro da equipe (não o login de aluno); {@code Usuario} não tem {@code @TenantId}. Mesma permissão de {@code /auditoria/pessoas}. */
    private static final String MEMBRO = "select u.id, u.nome from Usuario u where u.id in :ids and u.consultoriaId = :cid and u.alunoId is null";
    /** O plano de treino, dieta ou mobilidade, cada um com a permissão da sua área; "PLANO" não diz qual, e o id é único entre as três tabelas. */
    private static final Map<String, String> PLANOS = Map.of(
            "PlanoTreino", "TREINO_LER", "PlanoDieta", "DIETA_LER", "PlanoMobilidade", "TREINO_LER");
    private static final Set<String> ENTIDADES_DE_PLANO = Set.of("PLANO", "TREINO", "DIETA", "MOBILIDADE");

    private final EntityManager em;
    private final RotuloDaCobranca cobrancas;
    private final PagamentosProperties pagamentos;

    public ObjetoDaAuditoria(EntityManager em, RotuloDaCobranca cobrancas, PagamentosProperties pagamentos) {
        this.em = em;
        this.cobrancas = cobrancas;
        this.pagamentos = pagamentos;
    }

    /** Alinhado a {@code eventos}: o nome de cada um, ou {@code null}. */
    public List<String> nomes(List<RegistroAuditoria> eventos) {
        Map<String, Set<UUID>> ids = new HashMap<>();
        for (RegistroAuditoria e : eventos) {
            if (e.getEntidadeId() == null || (e.getEntidade() == null)) continue;
            String tipo = ENTIDADES_DE_PLANO.contains(e.getEntidade()) ? "PLANO" : e.getEntidade();
            if ("USUARIO".equals(tipo) && e.getEntidadeId().equals(e.getUsuarioId())) continue;
            ids.computeIfAbsent(tipo, t -> new HashSet<>()).add(e.getEntidadeId());
        }
        Map<String, Map<UUID, String>> nomes = new HashMap<>();
        CONSULTAS.forEach((tipo, jpql) -> {
            if (ids.containsKey(tipo) && AcessoAtual.pode(PERMISSOES.get(tipo))) nomes.put(tipo, ler(jpql, ids.get(tipo), false));
        });
        if (ids.containsKey("USUARIO")) nomes.put("USUARIO", ler(MEMBRO, ids.get("USUARIO"), true));
        // O rótulo leva o valor: só quem lê o Financeiro, e com ele ligado.
        if (ids.containsKey("COBRANCA") && pagamentos.habilitado() && AcessoAtual.pode("FINANCEIRO_LER")) {
            nomes.put("COBRANCA", cobrancas.de(ids.get("COBRANCA")));
        }
        if (ids.containsKey("PLANO") && AcessoAtual.pode("ALUNO_LER")) {
            Map<UUID, String> planos = new HashMap<>();
            PLANOS.forEach((entidade, permissao) -> {
                if (AcessoAtual.pode(permissao)) {
                    planos.putAll(ler("select p.id, p.titulo from " + entidade + " p where p.id in :ids", ids.get("PLANO"), false));
                }
            });
            nomes.put("PLANO", planos);
        }
        List<String> resultado = new ArrayList<>(eventos.size());
        for (RegistroAuditoria e : eventos) {
            String tipo = ENTIDADES_DE_PLANO.contains(e.getEntidade()) ? "PLANO" : e.getEntidade();
            boolean proprio = "USUARIO".equals(tipo) && Objects.equals(e.getEntidadeId(), e.getUsuarioId());
            Map<UUID, String> doTipo = nomes.get(tipo);
            resultado.add(proprio || doTipo == null || e.getEntidadeId() == null ? null : doTipo.get(e.getEntidadeId()));
        }
        return resultado;
    }

    private Map<UUID, String> ler(String jpql, Set<UUID> ids, boolean porConsultoria) {
        var consulta = em.createQuery(jpql, Object[].class).setParameter("ids", ids);
        if (porConsultoria) consulta.setParameter("cid", TenantContext.get());
        Map<UUID, String> nomes = new HashMap<>();
        for (Object[] linha : consulta.getResultList()) {
            if (linha[1] instanceof String nome && !nome.isBlank()) nomes.put((UUID) linha[0], nome);
        }
        return nomes;
    }
}
