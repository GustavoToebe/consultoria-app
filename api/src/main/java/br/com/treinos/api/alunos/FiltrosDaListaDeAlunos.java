package br.com.treinos.api.alunos;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.treinos.api.auth.Usuario;
import br.com.treinos.api.treino.PlanoTreino;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import org.springframework.data.jpa.domain.Specification;

import java.util.ArrayList;
import java.util.EnumSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

/**
 * Filtros avançados da lista de alunos ({@code GET /alunos}, pedido de 31/10). Todos opcionais e combinados com E; dentro
 * de um filtro de várias opções (responsável, acesso, atualização), OU. Valor desconhecido = 400 {@code FILTRO_INVALIDO},
 * sem repetir o valor na mensagem.
 *
 * <p>Os que o banco resolve (busca, situação, responsável, acesso e plano em uso) viram uma {@link Specification} (Criteria,
 * sem SQL nativo; o {@code @TenantId} de {@link Aluno} vale). Os calculados (fase da atualização, pasta a renovar e último
 * registro) são aplicados em memória pelo {@link AlunoService} sobre os candidatos, e só então a página é cortada.
 */
public record FiltrosDaListaDeAlunos(Set<UUID> responsaveis, boolean semResponsavel, Set<Acesso> acesso,
                                     Set<String> atualizacao, Plano plano, boolean pastaARenovar, Registro registro) {

    public static final String CODIGO = "FILTRO_INVALIDO";
    public static final String SEM_RESPONSAVEL = "nenhum";
    /** Grupo "Sem pasta com período" da lista: o aluno não tem pasta vigente com fim (nem linha de atualização). */
    public static final String SEM_PASTA = "SEM_PASTA";
    /** As fases de {@code RegrasAtualizacao.calcular}, que a lista já mostra, mais {@link #SEM_PASTA}. */
    public static final Set<String> FASES = Set.of("NENHUMA", "AVISO", "ABERTA", "ATRASADA", "ENVIADA", "REVISADA", SEM_PASTA);

    /** {@code COM} = tem usuário (inclui quem ainda não trocou a senha provisória); {@code AGUARDANDO} = tem usuário com a senha provisória. */
    public enum Acesso { COM, SEM, AGUARDANDO }

    /** Plano de treino ativo. */
    public enum Plano { COM, SEM }

    /**
     * Último registro (dias de Brasília). {@code HA_MAIS_DE_N}: o último registro foi antes de hoje − N (a mesma conta do
     * "sem registro há N dias" do painel), mas **não** inclui quem nunca registrou: isso é {@code NUNCA}, à parte.
     */
    public enum Registro {
        NUNCA(0), HA_MAIS_DE_7(7), HA_MAIS_DE_14(14), HA_MAIS_DE_30(30);

        private final int dias;

        Registro(int dias) { this.dias = dias; }

        public int dias() { return dias; }
    }

    /** O que veio na URL, cru. */
    public record Pedido(List<String> responsavel, List<String> acesso, List<String> atualizacao, String plano, String pasta,
                         String registro) {

        public static Pedido vazio() {
            return new Pedido(null, null, null, null, null, null);
        }
    }

    /** Lê e valida os valores (400); permissão (403) e responsável de outra consultoria (404) ficam com quem chama. */
    public static FiltrosDaListaDeAlunos ler(Pedido p, boolean meus) {
        List<String> responsavel = limpos(p.responsavel());
        if (meus && !responsavel.isEmpty()) {
            throw new BadRequestException("Use meus ou responsavel, não os dois.", CODIGO);
        }
        Set<UUID> ids = new LinkedHashSet<>();
        boolean nenhum = false;
        for (String r : responsavel) {
            if (SEM_RESPONSAVEL.equalsIgnoreCase(r)) {
                nenhum = true;
            } else {
                ids.add(uuid(r));
            }
        }
        Set<Acesso> acesso = EnumSet.noneOf(Acesso.class);
        for (String a : limpos(p.acesso())) acesso.add(valor(Acesso.class, a, "acesso"));
        Set<String> fases = new LinkedHashSet<>();
        for (String f : limpos(p.atualizacao())) {
            String fase = f.toUpperCase(Locale.ROOT);
            if (!FASES.contains(fase)) throw invalido("atualizacao");
            fases.add(fase);
        }
        Plano plano = vazio(p.plano()) ? null : valor(Plano.class, p.plano().trim(), "plano");
        boolean aRenovar = false;
        if (!vazio(p.pasta())) {
            if (!"A_RENOVAR".equalsIgnoreCase(p.pasta().trim())) throw invalido("pasta");
            aRenovar = true;
        }
        Registro registro = vazio(p.registro()) ? null : valor(Registro.class, p.registro().trim(), "registro");
        return new FiltrosDaListaDeAlunos(Set.copyOf(ids), nenhum, acesso, Set.copyOf(fases), plano, aRenovar, registro);
    }

    /** Algum filtro que precisa de conta fora do banco: a lista inteira do escopo é lida e paginada em memória. */
    public boolean temCalculado() {
        return !atualizacao.isEmpty() || pastaARenovar || registro != null;
    }

    public boolean filtraResponsavel() {
        return !responsaveis.isEmpty() || semResponsavel;
    }

    /**
     * Busca, situação ({@code ATIVO}, {@code INATIVO} ou {@code TODOS}), responsável, acesso e plano em uso. Ordena por
     * nome (e id no empate) só na consulta da lista; a de contagem fica sem ordem.
     */
    public Specification<Aluno> especificacao(String padrao, String situacao, Set<UUID> responsaveisDoFiltro) {
        return (root, query, cb) -> {
            List<Predicate> e = new ArrayList<>();
            e.add(cb.like(cb.lower(root.get("nome")), padrao, '\\'));
            if ("ATIVO".equals(situacao)) e.add(cb.isTrue(root.get("ativo")));
            if ("INATIVO".equals(situacao)) e.add(cb.isFalse(root.get("ativo")));
            if (!responsaveisDoFiltro.isEmpty() || semResponsavel) {
                List<Predicate> ou = new ArrayList<>();
                if (!responsaveisDoFiltro.isEmpty()) ou.add(root.get("responsavelId").in(responsaveisDoFiltro));
                if (semResponsavel) ou.add(cb.isNull(root.get("responsavelId")));
                e.add(cb.or(ou.toArray(Predicate[]::new)));
            }
            if (!acesso.isEmpty()) {
                List<Predicate> ou = new ArrayList<>();
                if (acesso.contains(Acesso.COM)) ou.add(cb.isNotNull(root.get("usuarioId")));
                if (acesso.contains(Acesso.SEM)) ou.add(cb.isNull(root.get("usuarioId")));
                if (acesso.contains(Acesso.AGUARDANDO)) {
                    // A mesma definição do aguardandoPrimeiroAcesso da ficha: tem usuário e a senha provisória não foi trocada.
                    Subquery<UUID> provisoria = query.subquery(UUID.class);
                    Root<Usuario> u = provisoria.from(Usuario.class);
                    provisoria.select(u.get("id")).where(cb.equal(u.get("id"), root.get("usuarioId")), cb.isTrue(u.get("trocarSenha")));
                    ou.add(cb.exists(provisoria));
                }
                e.add(cb.or(ou.toArray(Predicate[]::new)));
            }
            if (plano != null) {
                Predicate temPlano = cb.exists(planoAtivo(root, query, cb));
                e.add(plano == Plano.COM ? temPlano : cb.not(temPlano));
            }
            if (Aluno.class.equals(query.getResultType())) {
                query.orderBy(cb.asc(cb.lower(root.get("nome"))), cb.asc(root.get("id")));
            }
            return cb.and(e.toArray(Predicate[]::new));
        };
    }

    private static Subquery<UUID> planoAtivo(Root<Aluno> root, jakarta.persistence.criteria.CriteriaQuery<?> query, CriteriaBuilder cb) {
        Subquery<UUID> sub = query.subquery(UUID.class);
        Root<PlanoTreino> t = sub.from(PlanoTreino.class);
        return sub.select(t.get("id")).where(cb.equal(t.get("alunoId"), root.get("id")), cb.isTrue(t.get("ativo")));
    }

    private static List<String> limpos(List<String> valores) {
        if (valores == null) return List.of();
        return valores.stream().filter(v -> v != null && !v.isBlank()).map(String::trim).toList();
    }

    private static boolean vazio(String s) {
        return s == null || s.isBlank();
    }

    private static UUID uuid(String s) {
        try {
            return UUID.fromString(s);
        } catch (IllegalArgumentException e) {
            throw invalido("responsavel");
        }
    }

    private static <E extends Enum<E>> E valor(Class<E> tipo, String s, String campo) {
        try {
            return Enum.valueOf(tipo, s.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw invalido(campo);
        }
    }

    /** A mensagem cita só o nome do parâmetro, nunca o valor recebido. */
    private static BadRequestException invalido(String campo) {
        return new BadRequestException("Filtro " + campo + " com valor desconhecido.", CODIGO);
    }
}
