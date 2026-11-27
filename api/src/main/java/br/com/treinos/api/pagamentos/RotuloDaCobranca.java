package br.com.treinos.api.pagamentos;

import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Collection;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Texto curto da cobrança para a lista de auditoria: {@code 06/2026 de R$ 997,00}, ou {@code venc. 15/06/2026 de R$ 150,00}
 * quando não há competência (avulsa, parcela). Só competência, vencimento e valor: nunca a descrição nem a observação, que são
 * texto livre do treinador. Mora em {@code pagamentos/} porque só este módulo lê a cobrança do aluno (ArquiteturaTest); a consulta
 * é em lote e filtrada pelo {@code @TenantId}.
 */
@Component
public class RotuloDaCobranca {

    private static final DateTimeFormatter COMPETENCIA = DateTimeFormatter.ofPattern("MM/yyyy", Locale.ROOT);
    private static final DateTimeFormatter DIA = DateTimeFormatter.ofPattern("dd/MM/yyyy", Locale.ROOT);

    private final EntityManager em;

    public RotuloDaCobranca(EntityManager em) {
        this.em = em;
    }

    /** Um select para todos os ids; id que não existe na consultoria da sessão fica fora do mapa. */
    public Map<UUID, String> de(Collection<UUID> ids) {
        Map<UUID, String> rotulos = new HashMap<>();
        if (ids.isEmpty()) {
            return rotulos;
        }
        for (Object[] c : em.createQuery("select c.id, c.competencia, c.vencimento, c.valorCentavos from CobrancaAluno c where c.id in :ids",
                Object[].class).setParameter("ids", ids).getResultList()) {
            String quando = c[1] != null ? ((LocalDate) c[1]).format(COMPETENCIA) : "venc. " + ((LocalDate) c[2]).format(DIA);
            rotulos.put((UUID) c[0], quando + " de " + reais((Long) c[3]));
        }
        return rotulos;
    }

    /** {@code R$ 1.234,56}, com espaço comum. */
    static String reais(long centavos) {
        long abs = Math.abs(centavos);
        String inteiros = String.format(Locale.ROOT, "%,d", abs / 100).replace(',', '.');
        return (centavos < 0 ? "-" : "") + "R$ " + inteiros + "," + String.format(Locale.ROOT, "%02d", abs % 100);
    }
}
