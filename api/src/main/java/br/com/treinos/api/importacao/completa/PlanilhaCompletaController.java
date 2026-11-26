package br.com.treinos.api.importacao.completa;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.treinos.api.auth.LimiteTentativas;
import br.com.treinos.api.importacao.completa.PlanilhaCompletaDtos.Analise;
import br.com.treinos.api.importacao.completa.PlanilhaCompletaDtos.Confirmacao;
import br.com.treinos.api.importacao.completa.PlanilhaCompletaDtos.Desfeita;
import br.com.treinos.api.importacao.completa.PlanilhaCompletaDtos.Previa;
import br.com.treinos.api.security.UsuarioAutenticado;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/**
 * Planilha completa (várias abas ligadas entre si): análise e prévia só leem; a confirmação grava tudo em rascunho numa
 * transação; o "Desfazer" apaga o que ficou intocado. Mesmo limite por usuário da importação de uma aba (prévia e
 * confirmação) e o mesmo leitor (tamanho, zip, linhas, colunas e texto). Toda rota exige {@code ALUNO_ALTERAR}; as
 * outras permissões são conferidas por parte no serviço. As respostas guardadas na consultoria (fase 2) se esquecem por
 * {@code DELETE /importacoes/planilha-completa/respostas-salvas}.
 */
@RestController
@RequestMapping("/importacoes")
public class PlanilhaCompletaController {

    private final PlanilhaCompletaService service;
    private final GravacaoDaPlanilha gravacao;
    private final DesfazerDaPlanilha desfazer;
    private final LimiteTentativas limites;
    private final JsonMapper json;
    /** Uma chave é {@code nome:<nome comparável>}, e o nome do aluno tem até 120 caracteres. */
    private static final int CHAVE_MAXIMA = 200;

    public PlanilhaCompletaController(PlanilhaCompletaService service, GravacaoDaPlanilha gravacao,
                                      DesfazerDaPlanilha desfazer, LimiteTentativas limites, JsonMapper json) {
        this.json = json;
        this.service = service;
        this.gravacao = gravacao;
        this.desfazer = desfazer;
        this.limites = limites;
    }

    @PostMapping(value = "/planilha-completa/analisar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('PERM_ALUNO_ALTERAR')")
    public Analise analisar(@AuthenticationPrincipal UsuarioAutenticado eu, @RequestPart("arquivo") MultipartFile arquivo)
            throws IOException {
        limites.previaDeImportacao(eu.usuarioId());
        return service.analisar(arquivo.getOriginalFilename(), arquivo.getBytes());
    }

    @PostMapping(value = "/planilha-completa/previa", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('PERM_ALUNO_ALTERAR')")
    public Previa previa(@AuthenticationPrincipal UsuarioAutenticado eu, @RequestPart("arquivo") MultipartFile arquivo,
                         @RequestPart(value = "respostas", required = false) String respostas) throws IOException {
        limites.previaDeImportacao(eu.usuarioId());
        return gravacao.previa(eu.usuarioId(), arquivo.getOriginalFilename(), arquivo.getBytes(), respostas);
    }

    /**
     * {@code chavesIgnoradas} = JSON com a lista das chaves (da amostra) dos alunos desmarcados, numa parte do corpo e nunca
     * na query: a chave pode ser {@code nome:<nome do aluno>} e a query vai para o log de acesso do proxy.
     */
    @PostMapping(value = "/planilha-completa/confirmar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('PERM_ALUNO_ALTERAR')")
    public Confirmacao confirmar(@AuthenticationPrincipal UsuarioAutenticado eu,
                                 @RequestPart("arquivo") MultipartFile arquivo,
                                 @RequestPart(value = "respostas", required = false) String respostas,
                                 @RequestPart(value = "chavesIgnoradas", required = false) String chavesIgnoradas,
                                 @RequestParam String hash)
            throws IOException {
        limites.confirmacaoDeImportacao(eu.usuarioId());
        return gravacao.confirmar(eu, arquivo.getOriginalFilename(), arquivo.getBytes(), respostas, hash,
                chaves(chavesIgnoradas));
    }

    private Set<String> chaves(String texto) {
        if (texto == null || texto.isBlank()) {
            return Set.of();
        }
        try {
            JsonNode lista = json.readTree(texto);
            if (!lista.isArray()) {
                throw new BadRequestException("A lista de alunos ignorados é inválida.", "ALUNOS_IGNORADOS_INVALIDOS");
            }
            Set<String> chaves = new HashSet<>();
            for (JsonNode c : lista) {
                if (!c.isString() || c.asString().length() > CHAVE_MAXIMA) {
                    throw new BadRequestException("A lista de alunos ignorados é inválida.", "ALUNOS_IGNORADOS_INVALIDOS");
                }
                chaves.add(c.asString());
            }
            return chaves;
        } catch (JacksonException e) {
            throw new BadRequestException("A lista de alunos ignorados é inválida.", "ALUNOS_IGNORADOS_INVALIDOS");
        }
    }

    /** Apaga as respostas guardadas das importações anteriores (a próxima análise volta sem sugestão marcada). */
    @DeleteMapping("/planilha-completa/respostas-salvas")
    @PreAuthorize("hasAuthority('PERM_ALUNO_ALTERAR')")
    public RespostasEsquecidas esquecerRespostas() {
        return new RespostasEsquecidas(service.esquecerRespostas());
    }

    public record RespostasEsquecidas(int apagadas) {
    }

    @PostMapping("/{id}/desfazer")
    @PreAuthorize("hasAuthority('PERM_ALUNO_ALTERAR')")
    public Desfeita desfazer(@PathVariable UUID id) {
        return desfazer.desfazer(id);
    }
}
