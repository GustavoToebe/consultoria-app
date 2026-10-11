package br.com.treinos.api.biblioteca.dto;

import br.com.treinos.api.web.LinkExterno;
import br.com.treinos.api.web.LinksExternos;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

public final class SuplementoDtos {

    private SuplementoDtos() { }

    /** O {@code link} vazio vale (sem link); preenchido só {@code https} (ver {@link LinksExternos}). */
    public record SuplementoRequest(
            @NotBlank @Size(max = 120) String nome,
            @Size(max = 80) String marca,
            @Size(max = 60) String categoria,
            @Size(max = 80) String porcao,
            @Size(max = 40) String porcoesPorEmbalagem,
            @Size(max = 20) List<@Size(max = 60) String> sabores,
            @LinkExterno @Size(max = LinksExternos.TAMANHO_MAXIMO) String link) {
    }

    public record SuplementoResponse(UUID id, String nome, String marca, String categoria, String porcao,
                                     String porcoesPorEmbalagem, List<String> sabores, String link) {
    }
}
