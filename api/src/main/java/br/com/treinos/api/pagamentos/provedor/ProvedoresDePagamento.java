package br.com.treinos.api.pagamentos.provedor;

import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** Os provedores conhecidos, pelo código. Dois com o mesmo código derrubam a subida. */
@Component
public class ProvedoresDePagamento {

    private final Map<String, ProvedorDePagamento> porCodigo = new LinkedHashMap<>();

    public ProvedoresDePagamento(List<ProvedorDePagamento> provedores) {
        for (ProvedorDePagamento p : provedores) {
            if (porCodigo.putIfAbsent(p.codigo(), p) != null) {
                throw new IllegalStateException("Dois provedores de pagamento com o mesmo código.");
            }
        }
    }

    public Optional<ProvedorDePagamento> buscar(String codigo) {
        return Optional.ofNullable(porCodigo.get(codigo));
    }

    public boolean conhece(String codigo) {
        return porCodigo.containsKey(codigo);
    }
}
