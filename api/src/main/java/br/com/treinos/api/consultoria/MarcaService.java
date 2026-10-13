package br.com.treinos.api.consultoria;

import br.com.treinos.api.web.ApiException;
import br.com.treinos.api.web.BadRequestException;
import br.com.treinos.api.web.ConflitoException;
import br.com.treinos.api.web.NaoEncontradoException;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/** Marca (nome, cor, fonte, tema, logo) e metodologia da consultoria da sessão. */
@Service
public class MarcaService {

    public static final int LOGO_MAXIMO_BYTES = 512 * 1024;
    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n'};
    private static final Set<BigDecimal> ARREDONDAMENTOS = Set.of(new BigDecimal("0.25"), new BigDecimal("0.5"),
            BigDecimal.ONE, new BigDecimal("2.5"));

    public record MarcaRequest(
            @NotBlank @Size(max = 120) String nome,
            @NotNull @Pattern(regexp = "^#[0-9A-Fa-f]{6}$", message = "use o formato #RRGGBB") String corPrimaria,
            @NotNull Consultoria.Fonte fonteTitulo,
            @NotNull Consultoria.Tema temaPadrao,
            @NotNull Long versao) {
    }

    public record ConsultoriaResponse(MarcaPublica marca, ConfiguracaoConsultoria configuracao, Long versao) {
    }

    private final ConsultoriaRepository consultorias;
    private final LogoRepositorio logos;
    private final JsonMapper json;

    public MarcaService(ConsultoriaRepository consultorias, LogoRepositorio logos, JsonMapper json) {
        this.consultorias = consultorias;
        this.logos = logos;
        this.json = json;
    }

    @Transactional(readOnly = true)
    public ConsultoriaResponse consultoria(UUID consultoriaId) {
        return resposta(buscar(consultoriaId));
    }

    @Transactional(readOnly = true)
    public ConfiguracaoConsultoria configuracao(UUID consultoriaId) {
        return configuracao(buscar(consultoriaId));
    }

    @Transactional(readOnly = true)
    public MarcaPublica marca(UUID consultoriaId) {
        return MarcaPublica.de(buscar(consultoriaId));
    }

    @Transactional
    @br.com.treinos.api.auditoria.Auditar(acao="MARCA_ALTERADA",entidade="CONSULTORIA",resumo="Alterou a marca da consultoria.")
    public ConsultoriaResponse alterarMarca(UUID consultoriaId, MarcaRequest r) {
        Consultoria c = buscar(consultoriaId);
        exigirMesmaVersao(c, r.versao());
        c.alterarMarca(r.nome().trim(), r.corPrimaria().toUpperCase(java.util.Locale.ROOT),
                r.fonteTitulo(), r.temaPadrao());
        consultorias.saveAndFlush(c);
        return resposta(c);
    }

    @Transactional
    @br.com.treinos.api.auditoria.Auditar(acao="METODOLOGIA_ALTERADA",entidade="CONSULTORIA",resumo="Alterou a metodologia da consultoria.")
    public ConsultoriaResponse alterarConfiguracao(UUID consultoriaId, ConfiguracaoConsultoria nova) {
        validar(nova);
        Consultoria c = buscar(consultoriaId);
        c.alterarConfiguracao(json.writeValueAsString(nova));
        consultorias.saveAndFlush(c);
        return resposta(c);
    }

    /**
     * Aceita só PNG e JPEG conferindo os bytes (o Content-Type declarado não conta). SVG é recusado: pode levar script.
     */
    @Transactional
    @br.com.treinos.api.auditoria.Auditar(acao="LOGO_ALTERADA",entidade="CONSULTORIA",resumo="Alterou a logo da consultoria.")
    public MarcaPublica enviarLogo(UUID consultoriaId, byte[] bytes) {
        if (bytes == null || bytes.length == 0) {
            throw arquivoInvalido("Envie um arquivo PNG ou JPEG.");
        }
        if (bytes.length > LOGO_MAXIMO_BYTES) {
            throw arquivoInvalido("A logo pode ter no máximo 512 KB.");
        }
        String tipo = tipoPelosBytes(bytes).orElseThrow(() -> arquivoInvalido("A logo precisa ser PNG ou JPEG."));
        exigirExiste(consultoriaId);
        logos.gravar(consultoriaId, bytes, tipo);
        return MarcaPublica.de(buscar(consultoriaId));
    }

    @Transactional
    @br.com.treinos.api.auditoria.Auditar(acao="LOGO_REMOVIDA",entidade="CONSULTORIA",resumo="Removeu a logo da consultoria.")
    public MarcaPublica removerLogo(UUID consultoriaId) {
        exigirExiste(consultoriaId);
        logos.remover(consultoriaId);
        return MarcaPublica.de(buscar(consultoriaId));
    }

    @Transactional(readOnly = true)
    public Optional<LogoRepositorio.Logo> logoPublica(UUID consultoriaId) {
        return logos.ler(consultoriaId);
    }

    public ConfiguracaoConsultoria configuracao(Consultoria c) {
        return json.readValue(c.getConfiguracao(), ConfiguracaoConsultoria.class);
    }

    static Optional<String> tipoPelosBytes(byte[] b) {
        if (b.length >= PNG.length && java.util.Arrays.equals(java.util.Arrays.copyOf(b, PNG.length), PNG)) {
            return Optional.of("image/png");
        }
        if (b.length >= 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) {
            return Optional.of("image/jpeg");
        }
        return Optional.empty();
    }

    public static void validar(ConfiguracaoConsultoria c) {
        if (c == null || c.tiposSerie() == null || c.tiposSerie().isEmpty() || c.tiposSerie().size() > 20) {
            throw new BadRequestException("Informe de 1 a 20 tipos de série.");
        }
        Set<String> tipos = new HashSet<>();
        for (String t : c.tiposSerie()) {
            if (t == null || t.isBlank() || t.length() > 30 || !tipos.add(t.trim())) {
                throw new BadRequestException("Tipos de série: sem nomes vazios, repetidos ou com mais de 30 letras.");
            }
        }
        if (!tipos.contains(c.tipoTrabalho()) || !tipos.contains(c.tipoPreparacao())) {
            throw new BadRequestException("O tipo de trabalho e o de preparação precisam estar na lista de tipos.");
        }
        if (c.arredondamentoKg() == null || ARREDONDAMENTOS.stream().noneMatch(a -> a.compareTo(c.arredondamentoKg()) == 0)) {
            throw new BadRequestException("Arredondamento precisa ser 0,25, 0,5, 1 ou 2,5 kg.");
        }
        Map<String, List<Integer>> regra = c.regraPreparacao() == null ? Map.of() : c.regraPreparacao();
        for (Map.Entry<String, List<Integer>> e : regra.entrySet()) {
            int quantidade;
            try {
                quantidade = Integer.parseInt(e.getKey());
            } catch (NumberFormatException ex) {
                throw new BadRequestException("Regra de preparação: a chave é a quantidade de séries (1 a 10).");
            }
            List<Integer> percentuais = e.getValue();
            if (quantidade < 1 || quantidade > 10 || percentuais == null || percentuais.size() != quantidade
                    || percentuais.stream().anyMatch(p -> p == null || p < 1 || p > 200)) {
                throw new BadRequestException("Regra de preparação: " + e.getKey()
                        + " série(s) precisam de " + e.getKey() + " percentual(is) de 1 a 200.");
            }
        }
        for (Map.Entry<String, ConfiguracaoConsultoria.Repeticoes> e : c.repeticoes().entrySet()) {
            if (!tipos.contains(e.getKey())) {
                throw new BadRequestException("Repetições: o tipo \"" + e.getKey() + "\" não está na lista de tipos.");
            }
            ConfiguracaoConsultoria.Repeticoes r = e.getValue();
            if (r == null || r.min() == null || r.max() == null || r.min() < 0 || r.max() > 500 || r.max() < r.min()) {
                throw new BadRequestException("Repetições de " + e.getKey()
                        + ": informe mínima e máxima de 0 a 500, com a máxima maior ou igual à mínima.");
            }
        }
        if (c.instrucoesTreino() != null && c.instrucoesTreino().length() > 20000) {
            throw new BadRequestException("Instruções do treino com no máximo 20.000 caracteres.");
        }
        if (c.rodapePdf() != null && c.rodapePdf().length() > 500) {
            throw new BadRequestException("Rodapé do PDF com no máximo 500 caracteres.");
        }
    }

    private static void exigirMesmaVersao(Consultoria c, Long versao) {
        if (!c.getVersao().equals(versao)) {
            throw new ConflitoException("Outra pessoa ou aba alterou a marca. Recarregue para ver a versão atual.",
                    "CONFLITO_EDICAO");
        }
    }

    private ConsultoriaResponse resposta(Consultoria c) {
        return new ConsultoriaResponse(MarcaPublica.de(c), configuracao(c), c.getVersao());
    }

    private Consultoria buscar(UUID consultoriaId) {
        return consultorias.findById(consultoriaId)
                .orElseThrow(() -> new NaoEncontradoException("Consultoria não encontrada."));
    }

    /**
     * Confere sem carregar a entidade: o SQL da logo roda antes da primeira leitura, então a {@link Consultoria} lida
     * depois já vem com o tipo e a versão novos.
     */
    private void exigirExiste(UUID consultoriaId) {
        if (!consultorias.existsById(consultoriaId)) {
            throw new NaoEncontradoException("Consultoria não encontrada.");
        }
    }

    private static ApiException arquivoInvalido(String mensagem) {
        return new ArquivoInvalidoException(mensagem);
    }

    static final class ArquivoInvalidoException extends ApiException {
        private static final long serialVersionUID = 1L;

        ArquivoInvalidoException(String mensagem) {
            super(HttpStatus.BAD_REQUEST, mensagem, "ARQUIVO_INVALIDO");
        }
    }
}
