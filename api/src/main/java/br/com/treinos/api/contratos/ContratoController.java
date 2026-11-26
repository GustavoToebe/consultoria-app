package br.com.treinos.api.contratos;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.treinos.api.contratos.ContratoDtos.CancelarRequest;
import br.com.treinos.api.contratos.ContratoDtos.ContratoDetalhe;
import br.com.treinos.api.contratos.ContratoDtos.ContratoResumo;
import br.com.treinos.api.contratos.ContratoDtos.GerarContratoPdfRequest;
import br.com.treinos.api.contratos.ContratoDtos.GerarContratoRequest;
import br.com.treinos.api.contratos.ContratoDtos.PreviaDoContrato;
import br.com.treinos.api.contratos.ContratoDtos.ProrrogarRequest;
import br.com.treinos.api.security.UsuarioAutenticado;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

/**
 * Contratos dos alunos, lado da equipe (D1 a D23): ler com {@code CONTRATO_LER}; prévia, gerar (que já é o envio, D23), cancelar e
 * prorrogar com {@code CONTRATO_ALTERAR}. Aluno de outra consultoria ou contrato dela = 404. Texto, CPF, IP e nome nunca vão a log.
 */
@RestController
@ExigeContratos
public class ContratoController {

    private static final String LER = "hasAuthority('PERM_CONTRATO_LER')";
    private static final String ALTERAR = "hasAuthority('PERM_CONTRATO_ALTERAR')";

    private final ContratoService contratos;
    private final JsonMapper json;

    public ContratoController(ContratoService contratos, JsonMapper json) {
        this.contratos = contratos;
        this.json = json;
    }

    @PreAuthorize(LER)
    @GetMapping("/alunos/{id}/contratos")
    public List<ContratoResumo> listar(@PathVariable UUID id) {
        return contratos.listar(id);
    }

    @PreAuthorize(LER)
    @GetMapping("/contratos/{id}")
    public ContratoDetalhe obter(@PathVariable UUID id) {
        return contratos.obter(id);
    }

    /** O modelo preenchido, sem gravar: {@code faltas} lista o que impede gerar. */
    @PreAuthorize(ALTERAR)
    @PostMapping("/alunos/{id}/contratos/previa")
    public PreviaDoContrato previa(@PathVariable UUID id, @RequestBody GerarContratoRequest r) {
        return contratos.previa(id, r);
    }

    /** 201 na primeira vez; o mesmo {@code pedidoId} de novo devolve o contrato que já foi gerado, em 200. */
    @PreAuthorize(ALTERAR)
    @PostMapping("/alunos/{id}/contratos")
    public ResponseEntity<ContratoDetalhe> gerar(@AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable UUID id,
                                                 @RequestBody GerarContratoRequest r) {
        var gerado = contratos.gerar(eu, id, r);
        return ResponseEntity.status(gerado.criado() ? HttpStatus.CREATED : HttpStatus.OK).body(gerado.contrato());
    }

    /** PDF próprio (D14): o arquivo e os {@code dados} em JSON. Mesma resposta do modelo: 201, ou 200 no mesmo {@code pedidoId}. */
    @PreAuthorize(ALTERAR)
    @PostMapping(value = "/alunos/{id}/contratos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ContratoDetalhe> gerarPdf(@AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable UUID id,
                                                    @RequestPart(value = "arquivo", required = false) MultipartFile arquivo,
                                                    @RequestPart(value = "dados", required = false) String dados) {
        byte[] bytes;
        try {
            bytes = arquivo == null ? null : arquivo.getBytes();
        } catch (IOException e) {
            throw new BadRequestException("Não foi possível ler o arquivo enviado.");
        }
        var gerado = contratos.gerarPdf(eu, id, lerDados(dados), bytes);
        return ResponseEntity.status(gerado.criado() ? HttpStatus.CREATED : HttpStatus.OK).body(gerado.contrato());
    }

    /** Dados ausentes ou que não leem: nulo, e o serviço responde 422 no campo {@code dados} (sem repetir o texto). */
    private GerarContratoPdfRequest lerDados(String dados) {
        if (dados == null || dados.isBlank()) {
            return null;
        }
        try {
            return json.readValue(dados, GerarContratoPdfRequest.class);
        } catch (JacksonException e) {
            return null;
        }
    }

    @PreAuthorize(LER)
    @GetMapping("/contratos/{id}/arquivo")
    public ResponseEntity<byte[]> arquivo(@PathVariable UUID id) {
        return pdf(contratos.arquivo(id));
    }

    /** PDF de contrato é dado pessoal: nunca em cache nem farejado como outro tipo. */
    static ResponseEntity<byte[]> pdf(byte[] bytes) {
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .cacheControl(CacheControl.noStore())
                .header("X-Content-Type-Options", "nosniff")
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"contrato.pdf\"")
                .body(bytes);
    }

    @PreAuthorize(ALTERAR)
    @PostMapping("/contratos/{id}/cancelar")
    public ContratoDetalhe cancelar(@PathVariable UUID id, @RequestBody CancelarRequest r) {
        return contratos.cancelar(id, r);
    }

    @PreAuthorize(ALTERAR)
    @PostMapping("/contratos/{id}/prorrogar")
    public ContratoDetalhe prorrogar(@PathVariable UUID id, @RequestBody ProrrogarRequest r) {
        return contratos.prorrogar(id, r);
    }
}
